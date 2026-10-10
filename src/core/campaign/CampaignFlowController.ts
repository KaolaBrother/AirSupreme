import type { GameSessionState } from '@/core/GameSessionState';
import { GameStatus } from '@/core/GameState';
import {
  CAMPAIGN_SAVE_VERSION,
  clearCampaignCheckpoint,
  describeCheckpointText,
  isSwiftJoinAnnounced,
  loadCampaignCheckpoint,
  markCampaignCompleted,
  recordLevelReached,
  saveCampaignCheckpoint,
  type CampaignCheckpointInput,
  type CampaignRunStats,
  type CampaignSaveData,
  type CheckpointKind,
} from '@/core/save/SaveSystem';
import {
  TOTAL_LEVELS,
  getCampaignChapter,
  getUnlockedWeaponsThrough,
} from '@/features/campaign/CampaignData';
import { getLevelConfig } from '@/features/terrain/LevelConfig';
import { getStartingUpgradePoints, type PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { format, tr, type LocalizedText } from '@/i18n';
import type { HudText } from '@/ui/HUD';
import type { CampaignDebriefInput, ICampaignPresentation } from './CampaignPresentation';
import type { WingmanId } from './Wingmen';

/**
 * 协调器提供给战役流程的具体操作。流程控制器只决定“接下来发生什么”，
 * 关卡加载、Boss 战、菜单显示等细节都由协调器实现。
 */
export interface CampaignFlowDeps {
  session: GameSessionState;
  stats: PlayerStats;
  presentation: ICampaignPresentation;
  /** 加载关卡（地形、单位强度、玩家落点、回血、武器同步）；地形就绪后 resolve */
  prepareLevel(level: number, startWave: number): Promise<void>;
  /** 进入波次战斗（简报、教学、首波计时、僚机、关卡音乐） */
  startLevelCombat(level: number, startWave: number, firstLevelOfSession: boolean): void;
  /** 显示 Boss 简报后开始 Boss 战 */
  startBossEncounter(level: number, isBossMode: boolean): void;
  /** 机库整备（UpgradeMenu 'hangar'），玩家点“出击”后回调 */
  showHangar(level: number, onContinue: () => void): void;
  /** 进度同步到武器系统 / 热焰弹 / HUD（关卡开始、读档、机库购买后） */
  syncProgression(level: number): void;
  /** 剧情冻结（章节卡片 / 结算 / 机库期间暂停模拟） */
  setStoryHold(hold: boolean): void;
  /** 最终胜利画面 */
  showMissionComplete(finalScore: number): void;
  /**
   * 当前存档所需的运行时快照（分数 / 生命 / 导弹 / 武器 / 热焰弹 / 视角）；
   * 'hangar' 检查点的 level 是即将开始的那一关（升级上限与武器解锁按那一关）
   */
  captureCheckpoint(kind: CheckpointKind, level: number, wave: number): CampaignCheckpointInput;
  getScore(): number;
}

/**
 * 击破 Boss 到结算 / 下一章之间的停顿（秒，游戏时间：暂停不计）：至少等爆炸（MIN），
 * 然后等无线电把收尾台词全部说完（配音后每章 2-5 句，含逐字与停顿约 10-30 秒）。
 * 看门狗：等待上限 = 开始收尾时无线电的积压估计（按语音包清单里当前语言的配音时长）+ SLACK，
 * 再夹在 MAX 以内——无论如何不会卡住；到上限时结算卡片出现，正在说的那句照样说完。
 */
const BOSS_OUTRO_MIN_SECONDS = 1.6;
const BOSS_OUTRO_SLACK_SECONDS = 6;
const BOSS_OUTRO_MAX_SECONDS = 75;

/**
 * 存档提示文案：以双语原文（+ 参数）交给 HUD，提示仍在显示时切换语言按新语言重绘。
 * 'hangar' 检查点写在击破上一关 Boss 时，提示刚完成的那一关。
 */
const AUTOSAVE_WAVE: LocalizedText = {
  en: 'Level {level} · Wave {wave}',
  zh: '第{level}关 · 第{wave}波',
};
const AUTOSAVE_BOSS: LocalizedText = {
  en: 'Level {level} · Before the boss',
  zh: '第{level}关 · Boss 战前',
};
const AUTOSAVE_LEVEL_CLEARED: LocalizedText = {
  en: 'Level {level} cleared',
  zh: '第{level}关完成',
};
const RESUMED_FROM: LocalizedText = { en: 'Resumed: {checkpoint}', zh: '继续：{checkpoint}' };

/** 等待中的 Boss 收尾（tick 推进） */
interface PendingOutro {
  elapsed: number;
  ceiling: number;
  then: () => void;
}

/**
 * 暂停菜单“保存并退出”的去向（describeExitSave 的预告与 saveForExit 的实际结果同一形状）：
 * - saved：检查点写在 position（stage 是它的类型）；“继续战役”从那一波 / Boss 战 / 机库重新开始，
 *   带着退出时的分数、生命、升级与弹药；
 * - no-save-mode：本局不存档（Boss 模式）；
 * - not-started：本局还没到第一个检查点（第一章开场卡片之前），没有可存的进度；
 * - complete：战役已通关，检查点已清除；
 * - failed：没存上（隐私模式 / 配额已满 / 写入没有落盘），只出现在 saveForExit 的结果里。
 */
export type CampaignExitSave =
  | { kind: 'saved'; stage: CheckpointKind; position: LocalizedText }
  | { kind: 'no-save-mode' | 'not-started' | 'complete' | 'failed' };

/**
 * 十关战役流程（api-spec §10）：
 * 正常模式：章节开场 → 简报 + 无线电 → 波次（单位随波部署，敌机与敌方单位全清才过波）
 * → 自动存档 'wave' → … → 自动存档 'boss' → Boss → 击破即存 'hangar'（下一关之前的机库）
 * → 收尾台词 → 结算 → 机库（下一章上限 / 解锁；“出击”时再存一次 'hangar'）→ 下一章；
 * 第 10 关之后：结局 → MISSION COMPLETE，markCampaignCompleted + clearCampaignCheckpoint。
 * Boss 模式：没有剧情卡片，只有 Boss 登场无线电；武器解锁到当前关卡；Boss 之间进入机库整备；不存档。
 */
export class CampaignFlowController {
  private stats: CampaignRunStats = { kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 };
  private levelStartScore = 0;
  private levelKills = 0;
  private levelCiviliansLost = 0;
  private levelAlliesLost = 0;
  private firstLevelOfSession = true;
  private victory = false;
  private disposed = false;
  /** 本局雨燕的入列台词已播过（每局一次；写进检查点，读档不重播） */
  private swiftJoined = false;
  private outro: PendingOutro | null = null;
  /**
   * 当前进度所在的检查点位置（最近一次检查点时机；读档时取自存档）：“保存并退出”把此刻的快照
   * 重写在这里。null：本局还没到第一个检查点，或战役已通关（检查点已清除）。
   */
  private exitPoint: { kind: CheckpointKind; level: number; wave: number } | null = null;

  constructor(private readonly deps: CampaignFlowDeps) {}

  // ───────────────────────────── 开局 ─────────────────────────────

  /**
   * 新开一局（正常或 Boss 模式，起始关卡 L）：清空升级 → 设定关卡上限 → 解锁至 L 的武器；
   * L > 1 时补发起步升级点并先进入机库。正常模式清除旧检查点。
   */
  public setupNewRun(level: number): void {
    const upgrades = this.deps.stats.getUpgrades();
    upgrades.reset();
    upgrades.setCampaignLevel(level);
    upgrades.setUnlockedWeapons(getUnlockedWeaponsThrough(level));
    if (level > 1) {
      upgrades.awardBonusPoints(getStartingUpgradePoints(level));
    }
    if (!this.deps.session.isBossMode()) {
      clearCampaignCheckpoint();
    }
    this.resetRunStats();
  }

  /** 开始会话（setupNewRun 之后）：L > 1 先进机库，再进入章节 / Boss */
  public beginNewRun(level: number): void {
    this.firstLevelOfSession = true;
    const begin = (): void => {
      if (this.deps.session.isBossMode()) {
        this.beginBossStage(level);
      } else {
        this.beginChapter(level);
      }
    };
    if (level > 1) {
      this.deps.syncProgression(level);
      this.deps.showHangar(level, begin);
    } else {
      begin();
    }
  }

  /**
   * 读档续玩（正常模式）：进度已由协调器还原；按检查点类型回到机库（下一章之前）、波次或 Boss 战前。
   * 机库检查点与刚打完上一关一样继续：机库 → 本章开场卡片 → 战斗。
   */
  public resumeFromCheckpoint(save: CampaignSaveData): void {
    this.firstLevelOfSession = false;
    this.stats = { ...save.stats };
    this.swiftJoined = isSwiftJoinAnnounced(save);
    this.exitPoint = { kind: save.checkpoint, level: save.level, wave: save.wave };
    this.levelStartScore = save.score;
    this.levelKills = 0;
    this.levelCiviliansLost = 0;
    this.levelAlliesLost = 0;
    const level = save.level;
    if (save.checkpoint === 'hangar') {
      this.deps.session.setLevel(level);
      this.deps.syncProgression(level);
      this.deps.showHangar(level, () => this.launchChapter(level));
      return;
    }
    const totalWaves = getLevelConfig(level)?.totalWaves ?? 1;
    const resumeBoss = save.checkpoint === 'boss' || save.wave >= totalWaves;
    const startWave = resumeBoss ? Math.max(0, totalWaves - 1) : save.wave;
    void this.deps.prepareLevel(level, startWave).then(() => {
      if (this.disposed) return;
      // 检查点描述本身也是双语的：两种语言各自拼好，HUD 切换语言时整句换成另一种
      const checkpoint = describeCheckpointText(save);
      this.deps.presentation.showAutosave({
        en: format(RESUMED_FROM.en, { checkpoint: checkpoint.en }),
        zh: format(RESUMED_FROM.zh, { checkpoint: checkpoint.zh }),
      });
      if (resumeBoss) {
        this.deps.startBossEncounter(level, false);
      } else {
        this.deps.startLevelCombat(level, startWave, false);
      }
    });
  }

  // ───────────────────────────── 章节 / Boss ─────────────────────────────

  /**
   * 机库“出击”（Boss 击破后 / 读档回到机库）：先重写 'hangar' 检查点（机库里的购买在章节卡片
   * 期间退出也不会丢），再进入章节开场。
   */
  private launchChapter(level: number): void {
    if (this.disposed) return;
    this.writeCheckpoint('hangar', level, 0, false);
    this.beginChapter(level);
  }

  private beginChapter(level: number): void {
    const session = this.deps.session;
    session.setLevel(level);
    recordLevelReached(level);
    this.levelStartScore = this.deps.getScore();
    this.levelKills = 0;
    this.levelCiviliansLost = 0;
    this.levelAlliesLost = 0;
    const firstOfSession = this.firstLevelOfSession;
    this.firstLevelOfSession = false;

    void this.deps.prepareLevel(level, 0).then(() => {
      if (this.disposed) return;
      const chapter = getCampaignChapter(level);
      const presentation = this.deps.presentation;
      this.deps.setStoryHold(true);
      // 章节卡片（剧情曲 + 打字机）；第一章前先播序章，本章新武器显示解锁台词
      presentation.showChapterIntro(
        level,
        {
          includePrologue: level === 1 && firstOfSession,
          unlockLine: chapter.unlockLine ? tr(chapter.unlockLine) : null,
        },
        () => {
          if (this.disposed) return;
          this.deps.setStoryHold(false);
          this.writeCheckpoint('level-start', level, 0);
          presentation.radio('level-start', level);
          // 入关简报 + 关卡曲；chapter-start 刺激音跟在新曲目之后（按新调性移调）
          this.deps.startLevelCombat(level, 0, firstOfSession);
          presentation.playStinger('chapter-start');
        }
      );
    });
  }

  private beginBossStage(level: number): void {
    const session = this.deps.session;
    session.setLevel(level);
    this.levelStartScore = this.deps.getScore();
    void this.deps.prepareLevel(level, 0).then(() => {
      if (this.disposed) return;
      this.deps.startBossEncounter(level, true);
    });
  }

  // ───────────────────────────── 事件 ─────────────────────────────

  /** 一波结束：正常模式写 'wave' 检查点（wave = 下一波序号） */
  public handleWaveComplete(wave: number): void {
    const session = this.deps.session;
    if (session.isBossMode() || session.isInBossBattle()) return;
    const level = session.getLevel();
    this.deps.presentation.radio('wave-complete', level, wave);
    const totalWaves = getLevelConfig(level)?.totalWaves ?? 0;
    if (wave + 1 < totalWaves) {
      this.writeCheckpoint('wave', level, wave + 1);
    } else {
      // 最后一波已清空、Boss 检查点还没写（波次间隔之后才写）：此刻退出应回到 Boss 战前，不重打这一波
      this.exitPoint = { kind: 'boss', level, wave: totalWaves };
    }
  }

  /** 波次开始：章节无线电 */
  public handleWaveStart(wave: number): void {
    const session = this.deps.session;
    if (session.isBossMode() || session.isInBossBattle()) return;
    this.deps.presentation.radio('wave-start', session.getLevel(), wave);
  }

  /** 全部波次清空：写 'boss' 检查点，随后协调器进入 Boss 简报 */
  public handleLevelComplete(level: number): void {
    if (this.deps.session.isBossMode()) return;
    const totalWaves = getLevelConfig(level)?.totalWaves ?? 0;
    this.writeCheckpoint('boss', level, totalWaves);
    this.deps.presentation.playStinger('level-complete');
  }

  /**
   * Boss 被击破：收尾台词 → 结算 → 机库 → 下一章；第 10 关后结局与通关。
   * 正常模式第 1-9 关在击破时立即写 'hangar' 检查点（下一关之前的机库：Boss 后的分数、统计、
   * 升级点，下一关的上限与武器解锁），收尾 / 结算期间退出也能从机库继续。
   */
  public handleBossDefeated(level: number, isBossMode: boolean): void {
    const presentation = this.deps.presentation;
    presentation.playStinger('boss-defeated');
    const nextLevel = level + 1;

    if (level >= TOTAL_LEVELS) {
      const finalScore = this.deps.getScore();
      // 本局已经判了任务失败（同一步里先阵亡、后击破）：不记通关，也不动检查点
      if (!isBossMode && !this.isRunOver()) {
        this.victory = true;
        // 立即记录通关并清除检查点（结局演出中途退出也不会留下过期存档）
        markCampaignCompleted(finalScore);
        clearCampaignCheckpoint();
        this.exitPoint = null;
      }
      this.afterBossOutro(() => {
        const finish = (): void => {
          if (this.disposed) return;
          this.deps.setStoryHold(false);
          // campaign-complete 刺激音，随后胜利曲
          presentation.onMissionComplete();
          this.deps.showMissionComplete(this.deps.getScore());
        };
        if (isBossMode) {
          finish();
          return;
        }
        this.deps.setStoryHold(true);
        presentation.showDebrief(this.buildDebrief(level), () => {
          presentation.showEnding(this.deps.getScore(), finish);
        });
      });
      return;
    }

    if (!isBossMode) {
      this.writeCheckpoint('hangar', nextLevel, 0);
    }

    this.afterBossOutro(() => {
      const advance = (): void => {
        if (this.disposed) return;
        this.deps.setStoryHold(false);
        this.unlockLevel(nextLevel);
        this.deps.showHangar(nextLevel, () => {
          if (isBossMode) {
            this.beginBossStage(nextLevel);
          } else {
            this.launchChapter(nextLevel);
          }
        });
      };
      if (isBossMode) {
        advance();
        return;
      }
      this.deps.setStoryHold(true);
      presentation.showDebrief(this.buildDebrief(level), advance);
    });
  }

  /**
   * Boss 击破后的收尾（tick 推进的游戏时间，暂停不计）：至少停顿 BOSS_OUTRO_MIN_SECONDS 让爆炸
   * 播完，再等无线电把收尾台词全部说完；看门狗上限 = 此刻的无线电积压估计 + 余量（不超过
   * BOSS_OUTRO_MAX_SECONDS）。期间失败 / 退出时不再推进（不在失败结算上叠结算卡片）。
   */
  private afterBossOutro(then: () => void): void {
    const backlog = this.deps.presentation.getRadioBacklogSeconds();
    const estimate = Number.isFinite(backlog) ? Math.max(0, backlog) : BOSS_OUTRO_MAX_SECONDS;
    this.outro = {
      elapsed: 0,
      ceiling: Math.min(
        BOSS_OUTRO_MAX_SECONDS,
        Math.max(BOSS_OUTRO_MIN_SECONDS, estimate) + BOSS_OUTRO_SLACK_SECONDS
      ),
      then,
    };
  }

  private advanceOutro(deltaTime: number): void {
    const outro = this.outro;
    if (!outro) return;
    if (this.disposed || !this.deps.session.isPlaying()) {
      this.outro = null;
      return;
    }
    outro.elapsed += deltaTime;
    if (outro.elapsed < BOSS_OUTRO_MIN_SECONDS) return;
    if (outro.elapsed < outro.ceiling && this.deps.presentation.isRadioBusy()) return;
    this.outro = null;
    outro.then();
  }

  /** 进入新关卡：升级上限、武器解锁随章节推进（新解锁的武器满弹） */
  private unlockLevel(level: number): void {
    const upgrades = this.deps.stats.getUpgrades();
    upgrades.setCampaignLevel(level);
    upgrades.setUnlockedWeapons(getUnlockedWeaponsThrough(level));
    this.deps.session.setLevel(level);
    this.deps.syncProgression(level);
  }

  // ───────────────────────────── 统计 ─────────────────────────────

  public recordKill(): void {
    this.stats.kills++;
    this.levelKills++;
  }

  public recordAssetLost(civilian: boolean): void {
    if (civilian) {
      this.stats.civiliansLost++;
      this.levelCiviliansLost++;
    } else {
      this.levelAlliesLost++;
    }
  }

  public recordDeath(): void {
    this.stats.deaths++;
  }

  /** 累计游戏时间并推进 Boss 收尾（模拟步长，只在战斗进行时调用：暂停 / 剧情冻结时不调用） */
  public tick(deltaTime: number): void {
    if (Number.isFinite(deltaTime) && deltaTime > 0) {
      this.stats.playTimeSeconds += deltaTime;
      this.advanceOutro(deltaTime);
    }
  }

  /**
   * 具名僚机随队升空（关卡开场 / 读档回到 Boss 战前的编队起飞；增援与道具召唤的友机不经过这里）：
   * 雨燕本局第一次升空时播她的入列台词——每局战役只播一次，并立即记进当前检查点，
   * 读档 / 继续不会重播；Boss 模式不播。渡鸦从第 1 章起随队，没有入列台词。
   */
  public handleWingmanLaunched(id: WingmanId): void {
    if (id !== 'swift' || this.swiftJoined || this.deps.session.isBossMode()) return;
    this.swiftJoined = true;
    this.deps.presentation.onWingmanEvent(id, 'joined');
    this.persistSwiftJoined();
  }

  /** 把“雨燕已入列”补写进当前检查点（入关检查点写在她升空之前） */
  private persistSwiftJoined(): void {
    if (this.isRunOver()) return;
    const save = loadCampaignCheckpoint();
    if (!save || save.swiftJoined === true) return;
    saveCampaignCheckpoint({ ...save, swiftJoined: true });
  }

  public getRunStats(): CampaignRunStats {
    return { ...this.stats };
  }

  public isVictory(): boolean {
    return this.victory;
  }

  private resetRunStats(): void {
    this.stats = { kills: 0, civiliansLost: 0, deaths: 0, playTimeSeconds: 0 };
    this.levelStartScore = 0;
    this.levelKills = 0;
    this.levelCiviliansLost = 0;
    this.levelAlliesLost = 0;
    this.victory = false;
    this.swiftJoined = false;
    this.outro = null;
    this.exitPoint = null;
  }

  // ───────────────────────────── 保存并退出 ─────────────────────────────

  /** “保存并退出”的预告（只读，不写存档）：会存到哪里，或者为什么不存 */
  public describeExitSave(): CampaignExitSave {
    if (this.deps.session.isBossMode()) return { kind: 'no-save-mode' };
    const point = this.exitPoint;
    if (!point) return { kind: this.victory ? 'complete' : 'not-started' };
    const data = this.deps.captureCheckpoint(point.kind, point.level, point.wave);
    return {
      kind: 'saved',
      stage: point.kind,
      position: describeCheckpointText({
        ...data,
        version: CAMPAIGN_SAVE_VERSION,
        savedAt: Date.now(),
      }),
    };
  }

  /**
   * 暂停菜单“保存并退出”：把此刻的快照（分数 / 生命 / 导弹 / 升级 / 特殊武器与弹药 / 热焰弹 /
   * 视角 / 统计）重写在当前进度的检查点位置上——“继续战役”从那一波 / Boss 战 / 机库重新开始。
   * 不显示存档提示（紧接着就退出）。写入后读回确认；写不进去、读不回来，或者读回来的不是刚写的
   * 那一份（写入被悄悄丢弃，存储里还是更早的检查点）都返回 'failed'。
   */
  public saveForExit(): CampaignExitSave {
    const point = this.exitPoint;
    if (!point || this.deps.session.isBossMode()) return this.describeExitSave();
    const startedAt = Date.now();
    const written = this.writeCheckpoint(point.kind, point.level, point.wave, false);
    if (!written) return { kind: 'failed' };
    const stored = loadCampaignCheckpoint();
    if (!stored || !this.isCheckpointJustWritten(stored, written, startedAt)) {
      return { kind: 'failed' };
    }
    return { kind: 'saved', stage: stored.checkpoint, position: describeCheckpointText(stored) };
  }

  /**
   * 后台存档（页面转入后台 / 关闭；GameCoordinator.saveCampaignInBackground）：和“保存并退出”一样，
   * 把此刻的快照静默重写在当前进度的检查点位置上，只是不退出——除了存储，不动任何运行状态
   * （对局里的生命数不变），也不触发任何演出。什么时候不写也和“保存并退出”相同：Boss 模式、
   * 还没到第一个检查点、战役已通关、本局已结束（这些情况下连存储都不读）。
   *
   * 转入后台不是玩家自己选的存档，所以它不能让“从检查点重试 / 继续战役”比被它覆盖的那份检查点
   * 更糟：存储里现有的检查点如果就在同一个位置（类型、关卡、波次都相同——这一波 / Boss 战 / 机库
   * 开始时写的那份，或之后在这里重写的那份），写入的生命数取已存的与此刻的两者中较大的；其余
   * （分数、导弹、升级、特殊武器与弹药、热焰弹、视角、统计）一律按此刻。存储里没有检查点、
   * 读不出来，或者是别的位置：原样写此刻的状态。
   * 检查点只有一个存档位，新开一局时清空、读档续玩时沿用，所以同一位置上已存的那份就是本局的。
   */
  public saveInBackground(): void {
    const point = this.exitPoint;
    if (!point || this.deps.session.isBossMode() || this.isRunOver()) return;
    const stored = loadCampaignCheckpoint();
    const storedLives =
      stored &&
      stored.checkpoint === point.kind &&
      stored.level === point.level &&
      stored.wave === point.wave
        ? stored.lives
        : undefined;
    this.writeCheckpoint(point.kind, point.level, point.wave, false, storedLives);
  }

  /**
   * 读回来的检查点是不是这一次刚写的：存档时间不早于这次写入开始，位置和分数与写入的一致
   * （存储把分数取整，所以按“相差不到 1 分”比）。
   */
  private isCheckpointJustWritten(
    stored: CampaignSaveData,
    written: CampaignCheckpointInput,
    startedAt: number
  ): boolean {
    return (
      stored.savedAt >= startedAt &&
      stored.checkpoint === written.checkpoint &&
      stored.level === written.level &&
      stored.wave === written.wave &&
      Math.abs(stored.score - written.score) < 1
    );
  }

  private buildDebrief(level: number): CampaignDebriefInput {
    const totalScore = this.deps.getScore();
    return {
      level,
      scoreGained: Math.max(0, totalScore - this.levelStartScore),
      totalScore,
      kills: this.levelKills,
      civiliansLost: this.levelCiviliansLost,
      alliesLost: this.levelAlliesLost,
      bonusPoints: [],
    };
  }

  /**
   * 本局已经结束（结算面板已经亮出）。阵亡与清波 / 清关 / 击破 Boss 可能落在同一个模拟步里，
   * 协调器会把这一步跑完，这些进度事件于是在任务失败之后才到：此后本局不再写、改写或清除检查点，
   * 也不再记通关——面板上写的“从检查点重试 · …”和存储里的那一份保持一致，直到玩家自己选。
   */
  private isRunOver(): boolean {
    return this.deps.session.getStatus() === GameStatus.GAME_OVER;
  }

  /**
   * 写检查点（正常模式）。announce：显示存档提示（HUD + 存档音效）；机库“出击”时的重写不提示
   * （紧接着就是章节卡片）。'hangar' 的 level 是即将开始的那一关。
   * minLives：只有后台存档给（见 saveInBackground）——快照里的生命数比它少时写它，其余不变。
   * 返回交给存储的那份快照；存储没有接受（Boss 模式、本局已结束、存储不可用或已满）时为 null。
   */
  private writeCheckpoint(
    kind: CheckpointKind,
    level: number,
    wave: number,
    announce: boolean = true,
    minLives?: number
  ): CampaignCheckpointInput | null {
    const session = this.deps.session;
    if (session.isBossMode() || this.isRunOver()) return null;
    this.exitPoint = { kind, level, wave };
    const data = this.deps.captureCheckpoint(kind, level, wave);
    data.stats = this.getRunStats();
    data.swiftJoined = this.swiftJoined;
    if (minLives !== undefined && minLives > data.lives) {
      data.lives = minLives;
    }
    if (!saveCampaignCheckpoint(data)) return null;
    if (!announce) return data;
    let label: HudText;
    switch (kind) {
      case 'boss':
        label = { text: AUTOSAVE_BOSS, params: { level } };
        break;
      case 'hangar':
        // 击破上一关 Boss 时写入：提示刚完成的那一关
        label = { text: AUTOSAVE_LEVEL_CLEARED, params: { level: level - 1 } };
        break;
      default:
        label = { text: AUTOSAVE_WAVE, params: { level, wave: wave + 1 } };
        break;
    }
    // 存档提示 + 存档音效；关卡开场、Boss 战前与 Boss 击破分别有 chapter-start / level-complete /
    // boss-defeated 刺激音，checkpoint 刺激音只跟在波次检查点后面，避免两段刺激音叠在一起
    this.deps.presentation.showAutosave(label);
    if (kind === 'wave') {
      this.deps.presentation.playStinger('checkpoint');
    }
    return data;
  }

  public dispose(): void {
    this.disposed = true;
    this.outro = null;
  }
}
