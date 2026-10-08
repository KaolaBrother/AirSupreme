import type { GameSessionState } from '@/core/GameSessionState';
import {
  clearCampaignCheckpoint,
  describeCheckpoint,
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
import type { CampaignDebriefInput, ICampaignPresentation } from './CampaignPresentation';

/**
 * 协调器提供给战役流程的具体操作。流程控制器只决定“接下来发生什么”，
 * 关卡加载、Boss 战、菜单显示等细节都由协调器实现。
 */
export interface CampaignFlowDeps {
  session: GameSessionState;
  stats: PlayerStats;
  presentation: ICampaignPresentation;
  scheduleTimeout(callback: () => void, delayMs: number): void;
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
  /** 当前存档所需的运行时快照（分数 / 生命 / 导弹 / 武器 / 热焰弹 / 视角） */
  captureCheckpoint(kind: CheckpointKind, level: number, wave: number): CampaignCheckpointInput;
  getScore(): number;
}

/** 击破 Boss 到结算 / 下一章之间的停顿（毫秒）：至少等爆炸，最多等收尾台词播完 */
const BOSS_OUTRO_MIN_MS = 1600;
const BOSS_OUTRO_MAX_MS = 6500;
const BOSS_OUTRO_POLL_MS = 250;

/**
 * 十关战役流程（api-spec §10）：
 * 正常模式：章节开场 → 简报 + 无线电 → 波次（单位随波部署，敌机与敌方单位全清才过波）
 * → 自动存档 'wave' → … → 自动存档 'boss' → Boss → 结算 → 机库（下一章上限 / 解锁）→ 下一章；
 * 第 10 关之后：结局 → MISSION COMPLETE，markCampaignCompleted + clearCampaignCheckpoint。
 * Boss 模式：没有剧情卡片，只有 Boss 登场无线电；武器解锁到当前关卡；Boss 之间进入机库整备。
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

  /** 读档续玩（正常模式）：进度已由协调器还原；按检查点类型回到波次或 Boss 战前 */
  public resumeFromCheckpoint(save: CampaignSaveData): void {
    this.firstLevelOfSession = false;
    this.stats = { ...save.stats };
    this.levelStartScore = save.score;
    this.levelKills = 0;
    this.levelCiviliansLost = 0;
    this.levelAlliesLost = 0;
    const level = save.level;
    const totalWaves = getLevelConfig(level)?.totalWaves ?? 1;
    const resumeBoss = save.checkpoint === 'boss' || save.wave >= totalWaves;
    const startWave = resumeBoss ? Math.max(0, totalWaves - 1) : save.wave;
    void this.deps.prepareLevel(level, startWave).then(() => {
      if (this.disposed) return;
      this.deps.presentation.showAutosave(`继续：${describeCheckpoint(save)}`);
      if (resumeBoss) {
        this.deps.startBossEncounter(level, false);
      } else {
        this.deps.startLevelCombat(level, startWave, false);
      }
    });
  }

  // ───────────────────────────── 章节 / Boss ─────────────────────────────

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
        { includePrologue: level === 1 && firstOfSession, unlockLine: chapter.unlockLine },
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

  /** Boss 被击破：结算 → 机库 → 下一章；第 10 关后结局与通关 */
  public handleBossDefeated(level: number, isBossMode: boolean): void {
    const presentation = this.deps.presentation;
    presentation.playStinger('boss-defeated');
    const nextLevel = level + 1;

    if (level >= TOTAL_LEVELS) {
      const finalScore = this.deps.getScore();
      if (!isBossMode) {
        this.victory = true;
        // 立即记录通关并清除检查点（结局演出中途退出也不会留下过期存档）
        markCampaignCompleted(finalScore);
        clearCampaignCheckpoint();
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

    this.afterBossOutro(() => {
      const advance = (): void => {
        if (this.disposed) return;
        this.deps.setStoryHold(false);
        this.unlockLevel(nextLevel);
        this.deps.showHangar(nextLevel, () => {
          if (isBossMode) {
            this.beginBossStage(nextLevel);
          } else {
            this.beginChapter(nextLevel);
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
   * Boss 击破后的收尾：至少停顿 1.6 秒让爆炸播完，再等收尾台词说完（最多 6.5 秒）；
   * 期间玩家阵亡 / 退出则放弃（不在失败结算上叠结算卡片）。
   */
  private afterBossOutro(then: () => void): void {
    const startedAt = Date.now();
    const check = (): void => {
      if (this.disposed || !this.deps.session.isPlaying()) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed < BOSS_OUTRO_MAX_MS && this.deps.presentation.isRadioBusy()) {
        this.deps.scheduleTimeout(check, BOSS_OUTRO_POLL_MS);
        return;
      }
      then();
    };
    this.deps.scheduleTimeout(check, BOSS_OUTRO_MIN_MS);
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

  /** 累计游戏时间（模拟步长，只在战斗进行时调用） */
  public tick(deltaTime: number): void {
    if (Number.isFinite(deltaTime) && deltaTime > 0) {
      this.stats.playTimeSeconds += deltaTime;
    }
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

  private writeCheckpoint(kind: CheckpointKind, level: number, wave: number): void {
    const session = this.deps.session;
    if (session.isBossMode()) return;
    const data = this.deps.captureCheckpoint(kind, level, wave);
    data.stats = this.getRunStats();
    if (saveCampaignCheckpoint(data)) {
      const label = kind === 'boss' ? `第${level}关 · Boss 战前` : `第${level}关 · 第${wave + 1}波`;
      // 存档提示 + 存档音效；关卡开场与 Boss 战前分别有 chapter-start / level-complete 刺激音，
      // checkpoint 刺激音只跟在波次检查点后面，避免两段刺激音叠在一起
      this.deps.presentation.showAutosave(label);
      if (kind === 'wave') {
        this.deps.presentation.playStinger('checkpoint');
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
  }
}
