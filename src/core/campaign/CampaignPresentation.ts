import type * as THREE from 'three';
import type { SpecialWeaponId } from '@/core/CombatContracts';
import type { AudioManager } from '@/core/Audio/AudioManager';
import { getLevelMusicForLevel, type MusicSystem } from '@/core/Audio/MusicSystem';
import type { VoiceKind, VoicePlayOptions } from '@/core/Audio/VoiceSystem';
import type { CameraModeSetting } from '@/core/SessionSettings';
import {
  CAMPAIGN_PROLOGUE,
  GENERIC_RADIO,
  NARRATION_SPEAKER,
  UNIT_FIRST_CONTACT_RADIO,
  getCampaignChapter,
  getChapterRadio,
  type CampaignSpeakerId,
  type GenericRadioKey,
  type RadioLine,
  type RadioTriggerKind,
} from '@/features/campaign/CampaignData';
import type { HUD, HudWeaponPanelState, HudWeaponSlotState } from '@/ui/HUD';
import type { RadioComms } from '@/ui/RadioComms';
import type { StoryCardKind, StoryNarration, StoryOverlay } from '@/ui/StoryOverlay';
import { CampaignSfxRouter } from './CampaignSfx';
import type { WingmanEvent, WingmanId, WingmanStatus } from './Wingmen';

/**
 * 战役表现层（集成第 2 轮）
 *
 * 玩法代码只通过 ICampaignPresentation 讲故事 / 报状态 / 出声音：
 * - 剧情卡片：StoryOverlay（章节开场 + 序章 + 新武器解锁、任务结算、尾声 + 片尾字幕）；
 * - 无线电：RadioComms（CampaignData 章节台词、首次遭遇、通用告警；告警为高优先级）；
 * - HUD 新面板：特殊武器 / 热焰弹 / 自动存档 / 视角 / Boss 阶段 / 导弹告警 / 闪烁告警 / 雷达量程；
 * - 音乐：关卡曲 / Boss 曲 / 剧情曲 / 胜利曲、刺激音、强度；
 * - 音效：特殊武器、单位、Boss 效果提示（CampaignSfxRouter）；
 * - 配音（VoiceSystem，可选）：无线电台词出现时播放该句配音（台词等配音说完），剧情卡片逐段朗读；
 *   入关预取本章台词；暂停 / 继续、清空无线电、失败、释放时停下或暂停配音。
 *
 * StoryOverlay / RadioComms 与其样式较大，按需加载（开局即预加载）；加载前的无线电台词先排队。
 * 逐帧调用的 HUD 推送都在这里做差分：数值不变时不调用 HUD（HUD 自己也只在变化时写 DOM），
 * 且不分配对象。
 */

/** 结算卡片所需数据（映射到 StoryOverlay.DebriefData） */
export interface CampaignDebriefInput {
  level: number;
  scoreGained: number;
  totalScore: number;
  kills: number;
  civiliansLost: number;
  alliesLost: number;
  bonusPoints: Array<{ label: string; points: number }>;
}

/** 与 MusicSystem 的 MusicStinger 取值一致 */
export type CampaignStinger =
  | 'chapter-start'
  | 'boss-defeated'
  | 'level-complete'
  | 'game-over'
  | 'campaign-complete'
  | 'checkpoint'
  | 'phase-change';

/** 与 SpecialWeaponsController 的武器事件一致 */
export type WeaponPresentationEvent =
  | 'fired'
  | 'beam-end'
  | 'overheat'
  | 'charge-start'
  | 'charge-cancel'
  | 'dry-fire'
  | 'switch'
  | 'unlock'
  | 'flare'
  | 'flare-empty'
  | 'emp';

/** 单位事件（UnitSystem.onUnitEvent 的 kind，以及锁定 / 爆炸 / 摧毁等单位控制器事件） */
export type UnitPresentationEvent =
  | 'cannon'
  | 'missile-launch'
  | 'flak-burst'
  | 'rocket-salvo'
  | 'ciws'
  | 'bomb-drop'
  | 'sub-surface'
  | 'sub-dive'
  | 'sam-locking'
  | 'sam-launched'
  | 'explosion'
  | 'civilian-hit'
  | 'destroyed-ground'
  | 'destroyed-sea'
  | 'destroyed-air';

export type MissileWarningLevel = 'none' | 'locking' | 'incoming';

/** 无线电台词按说话人筛选（神谕的遗言先于其他收尾台词） */
export interface RadioSpeakerFilter {
  only?: CampaignSpeakerId;
  exclude?: CampaignSpeakerId;
}

/** HUD 武器面板快照（与 WeaponSystem.getHudState() 结构一致） */
export interface CampaignWeaponPanelState {
  selected: SpecialWeaponId | null;
  name: string;
  icon: string;
  shortCode: string;
  mode: 'salvo' | 'beam' | 'charge' | 'pulse' | null;
  ammo: number;
  maxAmmo: number;
  reloadProgress: number;
  heat: number;
  overheated: boolean;
  charge: number;
  cooldown: number;
  ready: boolean;
  slots: Array<{
    id: SpecialWeaponId;
    icon: string;
    shortCode: string;
    selected: boolean;
    ready: boolean;
  }>;
}

export interface ICampaignPresentation {
  // ── 剧情卡片（StoryOverlay） ──
  /** 开局预加载剧情 / 无线电界面（失败时卡片直接放行） */
  preloadStoryUi(): Promise<void>;
  showChapterIntro(
    level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void;
  showDebrief(data: CampaignDebriefInput, onContinue: () => void): void;
  showEnding(finalScore: number, onComplete: () => void): void;
  /** 剧情卡片显示中 */
  isStoryActive(): boolean;

  // ── 无线电（RadioComms） ──
  radio(
    trigger: RadioTriggerKind,
    level: number,
    index?: number,
    speakers?: RadioSpeakerFilter
  ): void;
  /**
   * 通用台词。返回这句是否进了无线电：Boss 模式过滤掉的普通台词、正在配音时跳过的紧急告警
   * （missile-warning / low-health / civilian-hit 从不打断正在配音的台词）返回 false。
   */
  genericRadio(key: GenericRadioKey): boolean;
  unitFirstContact(unitType: string): void;
  /** 僚机入列 / 被击落：播放 WINGMAN_EVENT_RADIO 登记的通用台词（未登记的事件不出声） */
  onWingmanEvent(id: WingmanId, event: WingmanEvent): void;
  /** 某名僚机此刻是否在空中（无线电 / 语音挑选说话人用） */
  isWingmanFlying(id: WingmanId): boolean;
  /** 无线电正在播放或有排队台词 */
  isRadioBusy(): boolean;
  /**
   * 估计无线电把当前与排队的台词全部说完还要多少秒（游戏时间；有配音的台词按语音包清单里的
   * 当前语言时长计）。Boss 收尾据此设定等待上限。
   */
  getRadioBacklogSeconds(): number;
  /** 关卡结束 / 换关 / 失败：清空无线电 */
  clearRadio(): void;

  // ── HUD 新面板 ──
  updateWeaponPanel(state: CampaignWeaponPanelState | null): void;
  updateFlares(charges: number, max: number, rechargeProgress: number): void;
  showAutosave(label: string): void;
  /** announce = false：开局 / 读档同步视角，不播放切换音效 */
  setCameraMode(mode: CameraModeSetting, announce?: boolean): void;
  setBossStatus(label: string | null, phase?: { current: number; total: number }): void;
  /** 导弹告警：单位（SAM）与 Boss 导弹两个来源取最高级 */
  setMissileWarning(level: MissileWarningLevel, source?: 'units' | 'boss'): void;
  flashWarning(text: string, tone: 'threat' | 'sys' | 'ally'): void;
  setRadarRangeMultiplier(multiplier: number): void;
  /** 每个模拟步长：低血量蜂鸣 + 低血量无线电（高优先级） */
  updatePlayerHealth(deltaTime: number, healthPercent: number, active: boolean): void;

  // ── 音乐 ──
  playLevelMusic(level: number): void;
  playBossMusic(level: number): void;
  playStinger(kind: CampaignStinger): void;
  setMusicIntensity(intensity: number): void;
  /** Boss 进入新阶段：阶段台词、警报 + phase-change 刺激音、音乐强度、HUD 闪烁告警 */
  onBossPhaseChange(level: number, phase: number, label: string | null): void;
  /** Boss 血量首次低于 25%：台词；adjustIntensity 时音乐强度拉满 */
  onBossLowHealth(level: number, adjustIntensity: boolean): void;
  onPause(): void;
  onResume(): void;
  onGameOver(): void;
  /** 第 10 关之后：campaign-complete 刺激音，随后胜利曲 */
  onMissionComplete(): void;

  // ── 音效 ──
  onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void;
  onUnitEvent(event: UnitPresentationEvent, position: THREE.Vector3 | null, scale?: number): void;
  onBossCue(cue: string, position: THREE.Vector3, intensity: number): void;

  /** 每个模拟步长：无线电计时（剧情卡片显示时冻结） */
  update(deltaTime: number): void;
  dispose(): void;
}

/** 雷达量程接口（PresentationController 透传到 RadarMinimap） */
export interface RadarRangeTarget {
  setRadarRangeMultiplier(multiplier: number): void;
}

/** 表现层用到的配音接口（VoiceSystem 的子集，便于测试替身） */
export interface CampaignVoice {
  play(lineId: string, options: VoicePlayOptions): number;
  stop(kind?: VoiceKind): void;
  stopAll(): void;
  pause(): void;
  resume(): void;
  prefetch(lineIds: readonly string[]): void;
  loadManifest(): Promise<unknown>;
  /** 清单记录的这句配音时长（秒，当前语言）；没有这句 / 清单未加载时为 null */
  getLineDuration?(lineId: string): number | null;
}

interface StoryUiModules {
  StoryOverlay: typeof import('@/ui/StoryOverlay').StoryOverlay;
  RadioComms: typeof import('@/ui/RadioComms').RadioComms;
}

export interface DefaultCampaignPresentationDeps {
  getHud(): HUD | null;
  getRadar(): RadarRangeTarget | null;
  audio: AudioManager;
  music: MusicSystem;
  /** Boss 模式：没有剧情卡片，无线电只播 Boss 登场与高优先级告警 */
  isBossMode(): boolean;
  /** 听者（玩家）位置：远处单位事件静音 */
  getListenerPosition(): THREE.Vector3 | null;
  /** 剧情界面模块加载（缺省为动态导入；测试可注入） */
  loadStoryUi?(): Promise<StoryUiModules>;
  /** 具名僚机的在空状态（缺省视为都不在空中） */
  wingmen?: WingmanStatus;
  /** 角色配音（缺省没有配音：无线电与剧情卡片纯文字） */
  voice?: CampaignVoice;
}

interface StoryUi {
  overlay: StoryOverlay;
  radio: RadioComms;
}

interface PendingRadioLine {
  line: RadioLine;
  priority: 'normal' | 'high';
}

/**
 * 高优先级通用台词（紧急告警）：打断普通台词，但从不打断正在配音的台词——
 * 那时直接跳过这句（HUD 闪烁告警 / 告警音照常，紧迫感由它们传达；低血量等配音说完再报）。
 */
const HIGH_PRIORITY_RADIO: ReadonlySet<GenericRadioKey> = new Set<GenericRadioKey>([
  'civilian-hit',
  'missile-warning',
  'low-health',
]);
/** 僚机事件台词：line 由 speakerWingman 播报（他 / 她在空中时），否则播 fallback（天穹指挥部） */
interface WingmanEventRadio {
  line: GenericRadioKey;
  speakerWingman?: WingmanId;
  fallback?: GenericRadioKey;
}

/**
 * 僚机事件 → 通用台词（GENERIC_RADIO）。渡鸦从第 1 章起一直随队，入列不播台词；
 * 雨燕第 3 章起入列时报到；被击落由另一名僚机（在空中时）或天穹指挥部播报。
 * 僚机名册不支持本关内复活（被击落的僚机下一关 / 读档后才归队），所以没有“重返战斗”台词。
 * 未登记的事件不播台词。
 */
const WINGMAN_EVENT_RADIO: Readonly<
  Partial<Record<`${WingmanId}:${WingmanEvent}`, WingmanEventRadio>>
> = {
  'swift:joined': { line: 'swift-joined' },
  'raven:down': { line: 'raven-down-swift', speakerWingman: 'swift', fallback: 'raven-down-hq' },
  'swift:down': { line: 'swift-down-raven', speakerWingman: 'raven', fallback: 'swift-down-hq' },
};
/** 剧情界面加载前最多缓存的台词 */
const MAX_PENDING_RADIO = 6;
/** 积压粗估（剧情界面加载前的缓存台词）：没有配音时长时按阅读上限，每句再加余量（秒） */
const PENDING_LINE_READING_SECONDS = 6.5;
const PENDING_LINE_SLACK = 1.5;
/** 入关预取：紧急告警台词（要求立即开口） */
const URGENT_VOICE_KEYS: readonly GenericRadioKey[] = [
  'missile-warning',
  'low-health',
  'civilian-hit',
];
/** 无线电配音最多等待加载的时间（毫秒）：超过就这句纯文字 */
const RADIO_VOICE_MAX_DELAY_MS = 1500;
/** 剧情旁白最多等待加载的时间（毫秒），略短于 StoryOverlay 自己的等待上限 */
const NARRATION_VOICE_MAX_DELAY_MS = 1500;
/** 结束当前音乐的刺激音时长（毫秒，含收尾）：其后才开始胜利曲 */
const ENDING_STINGER_MS: Readonly<Partial<Record<CampaignStinger, number>>> = {
  'boss-defeated': 4200,
  'level-complete': 3200,
  'game-over': 5000,
  'campaign-complete': 9600,
};
/** Boss 阶段 → 音乐强度（低于 25% 血量拉满到 1） */
const PHASE_INTENSITY: readonly number[] = [0.35, 0.35, 0.6, 0.85];
/** 结算行浮现节奏（与 StoryOverlay 的 DEBRIEF_ROW_BASE_MS / STAGGER 对齐） */
const DEBRIEF_TALLY_BASE_MS = 300;
const DEBRIEF_TALLY_STAGGER_MS = 110;
/** 结算固定行：本关得分、击落 / 摧毁、平民损失、友军损失、总分 */
const DEBRIEF_FIXED_ROWS = 5;
/** 低血量：蜂鸣间隔、台词冷却、重新武装阈值 */
const LOW_HEALTH_THRESHOLD = 0.25;
const LOW_HEALTH_REARM = 0.4;
const LOW_HEALTH_BEEP_SECONDS = 1.35;
const LOW_HEALTH_RADIO_COOLDOWN = 25;
const MISSILE_WARNING_RANK: Readonly<Record<MissileWarningLevel, number>> = {
  none: 0,
  locking: 1,
  incoming: 2,
};

function quantize(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function defaultLoadStoryUi(): Promise<StoryUiModules> {
  return Promise.all([import('@/ui/StoryOverlay'), import('@/ui/RadioComms')]).then(
    ([story, radio]) => ({ StoryOverlay: story.StoryOverlay, RadioComms: radio.RadioComms })
  );
}

/**
 * 战役表现层的正式实现（名字沿用第 1 轮的挂钩点）。
 */
export class DefaultCampaignPresentation implements ICampaignPresentation {
  private readonly sfx: CampaignSfxRouter;
  private storyUi: StoryUi | null = null;
  private storyUiPromise: Promise<StoryUi | null> | null = null;
  private readonly pendingRadio: PendingRadioLine[] = [];
  private disposed = false;
  /** 每次 show* 递增：被新的演出 / 释放取代的旧请求不再显示 */
  private storyToken = 0;
  private cardKind: StoryCardKind | null = null;
  private debriefRows = 0;
  private endingMusicStarted = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  /** 结束音乐的刺激音还在响到这个时刻（毫秒） */
  private endingStingerUntil = 0;
  /** 当前无线电配音请求（过期回调据此忽略） */
  private radioVoiceHandle = 0;

  // HUD 差分状态
  private readonly weaponPanel: HudWeaponPanelState = {
    visible: false,
    icon: '',
    name: '',
    shortCode: '',
    mode: null,
    ammo: 0,
    maxAmmo: 0,
    reloadProgress: 0,
    heat: 0,
    overheated: false,
    charge: 0,
    cooldown: 0,
    ready: false,
    slots: [],
  };
  private readonly slotPool: HudWeaponSlotState[] = [];
  private weaponPanelPushed = false;
  private flareCharges = -1;
  private flareMax = -1;
  private flareProgress = -1;
  private unitMissileWarning: MissileWarningLevel = 'none';
  private bossMissileWarning: MissileWarningLevel = 'none';
  private pushedMissileWarning: MissileWarningLevel | null = null;
  private radarRangeMultiplier = Number.NaN;
  private lowHealthBeepTimer = 0;
  private lowHealthRadioArmed = true;
  private lowHealthRadioCooldown = 0;

  constructor(private readonly deps: DefaultCampaignPresentationDeps) {
    this.sfx = new CampaignSfxRouter({
      audio: deps.audio,
      getListenerPosition: () => deps.getListenerPosition(),
      playPhaseStinger: () => this.playStinger('phase-change'),
    });
  }

  // ───────────────────────────── 剧情界面加载 ─────────────────────────────

  public preloadStoryUi(): Promise<void> {
    // 配音清单与剧情界面一起尽早加载（失败时纯文字）
    void this.deps.voice?.loadManifest().catch(() => undefined);
    return this.ensureStoryUi().then(() => undefined);
  }

  private ensureStoryUi(): Promise<StoryUi | null> {
    if (!this.storyUiPromise) {
      const load = this.deps.loadStoryUi ?? defaultLoadStoryUi;
      this.storyUiPromise = load().then(
        (modules) => {
          if (this.disposed) return null;
          const overlay = new modules.StoryOverlay();
          const radio = new modules.RadioComms();
          overlay.onTypeTick = () => this.deps.audio.playTypewriterTick();
          overlay.onCardShown = (kind) => this.handleCardShown(kind);
          overlay.narration = this.createNarration();
          radio.onLineShown = (line) => {
            this.deps.audio.playRadioOpen();
            this.playRadioVoice(radio, line);
          };
          this.storyUi = { overlay, radio };
          for (const pending of this.pendingRadio) {
            radio.enqueue(pending.line, { priority: pending.priority });
          }
          this.pendingRadio.length = 0;
          return this.storyUi;
        },
        (error: unknown) => {
          console.error('Failed to load story UI', error);
          return null;
        }
      );
    }
    return this.storyUiPromise;
  }

  // ───────────────────────────── 配音 ─────────────────────────────

  /**
   * 无线电台词出现：播放该句配音。开口时台词按配音时长延长停留，说完（或没出声 / 被打断）
   * 才放行下一句；被高优先级打断后重播时（每句最多一次）会重新调用这里，配音从头再说一遍。
   */
  private playRadioVoice(radio: RadioComms, line: RadioLine): void {
    const voice = this.deps.voice;
    if (!voice || this.disposed) return;
    const handle = voice.play(line.id, {
      kind: 'radio',
      speaker: line.speaker,
      maxStartDelayMs: RADIO_VOICE_MAX_DELAY_MS,
      onStart: (info) => {
        if (this.radioVoiceHandle === handle) radio.holdForVoice(line, info.duration);
      },
      onEnd: () => {
        if (this.radioVoiceHandle === handle) this.radioVoiceHandle = 0;
        radio.releaseVoice(line);
      },
      onSilent: () => {
        if (this.radioVoiceHandle === handle) this.radioVoiceHandle = 0;
        radio.releaseVoice(line);
      },
    });
    this.radioVoiceHandle = handle;
  }

  /** 剧情卡片的旁白挂钩：天穹指挥官逐段朗读序章 / 章节简报 / 尾声 */
  private createNarration(): StoryNarration | null {
    const voice = this.deps.voice;
    if (!voice) return null;
    return {
      play: (voiceId, events) => {
        if (this.disposed) {
          events.onSilent();
          return;
        }
        voice.play(voiceId, {
          kind: 'narration',
          speaker: NARRATION_SPEAKER,
          maxStartDelayMs: NARRATION_VOICE_MAX_DELAY_MS,
          onStart: (info) => events.onStart(info.duration),
          onEnd: () => events.onEnd(),
          onSilent: () => events.onSilent(),
        });
      },
      stop: () => voice.stop('narration'),
    };
  }

  /** 入关预取本章配音：序章 → 简报 → 入关台词 → 其余章节台词 → 紧急告警 */
  private prefetchChapterVoice(level: number, includePrologue: boolean): void {
    const voice = this.deps.voice;
    if (!voice) return;
    const chapter = getCampaignChapter(level);
    const levelStart = chapter.radio.filter((line) => line.trigger === 'level-start');
    const rest = chapter.radio.filter((line) => line.trigger !== 'level-start');
    voice.prefetch([
      ...(includePrologue ? CAMPAIGN_PROLOGUE.map((line) => line.id) : []),
      ...chapter.intro.map((line) => line.id),
      ...levelStart.map((line) => line.id),
      ...rest.map((line) => line.id),
      ...URGENT_VOICE_KEYS.map((key) => GENERIC_RADIO[key].id),
    ]);
  }

  /** Boss 战预取（Boss 模式没有章节卡片）：本章 Boss 台词 */
  private prefetchBossVoice(level: number): void {
    const voice = this.deps.voice;
    if (!voice) return;
    voice.prefetch(
      getCampaignChapter(level)
        .radio.filter((line) => line.trigger.startsWith('boss-'))
        .map((line) => line.id)
    );
  }

  // ───────────────────────────── 剧情卡片 ─────────────────────────────

  public showChapterIntro(
    level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void {
    const token = ++this.storyToken;
    this.clearRadio();
    this.prefetchChapterVoice(level, options.includePrologue);
    void this.ensureStoryUi().then((ui) => {
      if (this.disposed || token !== this.storyToken) return;
      if (!ui) {
        onComplete();
        return;
      }
      this.cardKind = 'chapter';
      this.deps.music.playStoryMusic();
      ui.overlay.showChapterIntro(getCampaignChapter(level), onComplete, {
        includePrologue: options.includePrologue,
        unlockLine: options.unlockLine,
      });
    });
  }

  public showDebrief(data: CampaignDebriefInput, onContinue: () => void): void {
    const token = ++this.storyToken;
    void this.ensureStoryUi().then((ui) => {
      if (this.disposed || token !== this.storyToken) return;
      if (!ui) {
        onContinue();
        return;
      }
      this.cardKind = 'debrief';
      this.debriefRows = DEBRIEF_FIXED_ROWS + data.bonusPoints.length;
      ui.overlay.showDebrief(
        {
          chapter: getCampaignChapter(data.level),
          scoreGained: data.scoreGained,
          totalScore: data.totalScore,
          kills: data.kills,
          civiliansLost: data.civiliansLost,
          alliesLost: data.alliesLost,
          bonusPoints: data.bonusPoints,
        },
        onContinue
      );
    });
  }

  public showEnding(finalScore: number, onComplete: () => void): void {
    const token = ++this.storyToken;
    void this.ensureStoryUi().then((ui) => {
      if (this.disposed || token !== this.storyToken) return;
      if (!ui) {
        onComplete();
        return;
      }
      this.cardKind = 'ending';
      this.endingMusicStarted = false;
      ui.overlay.showEnding({ finalScore }, onComplete);
    });
  }

  public isStoryActive(): boolean {
    return this.storyUi?.overlay.isActive() ?? false;
  }

  /** 卡片出现：章节卡重音、结算胜利曲 + 逐行计数音、尾声剧情曲 */
  private handleCardShown(kind: StoryCardKind): void {
    this.cardKind = kind;
    const audio = this.deps.audio;
    switch (kind) {
      case 'chapter':
        audio.playChapterImpact();
        break;
      case 'debrief': {
        // 关卡结束：清空无线电（正在说的那句配音说完，不在句中截断）；胜利曲等 Boss 击破刺激音收尾后再进
        this.clearRadioQueue(true);
        this.afterEndingStinger(() => this.deps.music.playVictoryMusic());
        for (let row = 0; row < this.debriefRows; row++) {
          this.schedule(
            () => {
              if (this.cardKind === 'debrief' && this.isStoryActive()) {
                audio.playDebriefTally();
              }
            },
            DEBRIEF_TALLY_BASE_MS + row * DEBRIEF_TALLY_STAGGER_MS
          );
        }
        break;
      }
      case 'ending':
        if (!this.endingMusicStarted) {
          this.endingMusicStarted = true;
          this.clearRadio();
          this.afterEndingStinger(() => this.deps.music.playStoryMusic());
        }
        break;
      default:
        break;
    }
  }

  // ───────────────────────────── 无线电 ─────────────────────────────

  public radio(
    trigger: RadioTriggerKind,
    level: number,
    index?: number,
    speakers?: RadioSpeakerFilter
  ): void {
    // Boss 模式只有 Boss 登场台词（没有剧情）
    if (this.deps.isBossMode() && trigger !== 'boss-spawn') return;
    for (const line of getChapterRadio(level, trigger, index)) {
      if (speakers?.only && line.speaker !== speakers.only) continue;
      if (speakers?.exclude && line.speaker === speakers.exclude) continue;
      this.enqueueRadio(line, 'normal');
    }
  }

  public genericRadio(key: GenericRadioKey): boolean {
    const high = HIGH_PRIORITY_RADIO.has(key);
    // Boss 模式只保留高优先级的战术告警
    if (this.deps.isBossMode() && !high) return false;
    // 紧急告警不打断正在配音的台词（剧情台词不会被反复从头念起）
    if (high && this.isRadioVoicing()) return false;
    const line = GENERIC_RADIO[key];
    if (!line || this.disposed) return false;
    this.enqueueRadio(line, high ? 'high' : 'normal');
    return true;
  }

  /** 无线电当前台词的配音正在说 */
  private isRadioVoicing(): boolean {
    return this.storyUi?.radio.isVoicing() ?? false;
  }

  public unitFirstContact(unitType: string): void {
    if (this.deps.isBossMode()) return;
    const line = UNIT_FIRST_CONTACT_RADIO[unitType];
    if (line) this.enqueueRadio(line, 'normal');
  }

  public onWingmanEvent(id: WingmanId, event: WingmanEvent): void {
    const entry = WINGMAN_EVENT_RADIO[`${id}:${event}`];
    if (!entry) return;
    const useFallback =
      entry.speakerWingman !== undefined && !this.isWingmanFlying(entry.speakerWingman);
    const key = useFallback ? entry.fallback : entry.line;
    if (key) this.genericRadio(key);
  }

  public isWingmanFlying(id: WingmanId): boolean {
    return this.deps.wingmen?.isFlying(id) ?? false;
  }

  private enqueueRadio(line: RadioLine, priority: 'normal' | 'high'): void {
    if (this.disposed) return;
    const radio = this.storyUi?.radio;
    if (radio) {
      radio.enqueue(line, { priority });
      return;
    }
    if (this.pendingRadio.some((pending) => pending.line.text === line.text)) return;
    if (this.pendingRadio.length >= MAX_PENDING_RADIO) this.pendingRadio.shift();
    this.pendingRadio.push({ line, priority });
    void this.ensureStoryUi();
  }

  public isRadioBusy(): boolean {
    return this.storyUi ? this.storyUi.radio.isBusy() : this.pendingRadio.length > 0;
  }

  public getRadioBacklogSeconds(): number {
    const voice = this.deps.voice;
    const voiceSeconds = (line: RadioLine): number | null =>
      voice?.getLineDuration?.(line.id) ?? null;
    const radio = this.storyUi?.radio;
    if (radio) {
      return radio.estimateRemainingSeconds(voiceSeconds);
    }
    // 剧情界面还没加载：缓存的台词按“配音时长或阅读上限 + 余量”粗估
    let total = 0;
    for (const pending of this.pendingRadio) {
      total += (voiceSeconds(pending.line) ?? PENDING_LINE_READING_SECONDS) + PENDING_LINE_SLACK;
    }
    return total;
  }

  public clearRadio(): void {
    this.clearRadioQueue(false);
  }

  /** 清空无线电；letVoiceFinish：正在说的那句配音说完（结算卡片），否则立即停下 */
  private clearRadioQueue(letVoiceFinish: boolean): void {
    this.pendingRadio.length = 0;
    this.storyUi?.radio.clear();
    if (!letVoiceFinish) {
      this.radioVoiceHandle = 0;
      this.deps.voice?.stop('radio');
    }
  }

  // ───────────────────────────── HUD 新面板 ─────────────────────────────

  /** 特殊武器面板：拷贝到复用的面板状态，只有可见数值（百分之一精度）变化时才推送 */
  public updateWeaponPanel(state: CampaignWeaponPanelState | null): void {
    const hud = this.deps.getHud();
    if (!hud) {
      this.weaponPanelPushed = false;
      return;
    }
    const panel = this.weaponPanel;
    let changed = !this.weaponPanelPushed;
    const visible = state !== null && state.selected !== null;
    if (panel.visible !== visible) {
      panel.visible = visible;
      changed = true;
    }
    if (state) {
      if (panel.icon !== state.icon) {
        panel.icon = state.icon;
        changed = true;
      }
      if (panel.name !== state.name) {
        panel.name = state.name;
        changed = true;
      }
      if (panel.shortCode !== state.shortCode) {
        panel.shortCode = state.shortCode;
        changed = true;
      }
      if (panel.mode !== state.mode) {
        panel.mode = state.mode;
        changed = true;
      }
      const ammo = Number.isFinite(state.ammo) ? Math.floor(state.ammo) : state.ammo;
      if (panel.ammo !== ammo) {
        panel.ammo = ammo;
        changed = true;
      }
      if (panel.maxAmmo !== state.maxAmmo) {
        panel.maxAmmo = state.maxAmmo;
        changed = true;
      }
      const reload = quantize(state.reloadProgress);
      if (panel.reloadProgress !== reload) {
        panel.reloadProgress = reload;
        changed = true;
      }
      const heat = quantize(state.heat);
      if (panel.heat !== heat) {
        panel.heat = heat;
        changed = true;
      }
      if (panel.overheated !== state.overheated) {
        panel.overheated = state.overheated;
        changed = true;
      }
      const charge = quantize(state.charge);
      if (panel.charge !== charge) {
        panel.charge = charge;
        changed = true;
      }
      const cooldown = quantize(state.cooldown);
      if (panel.cooldown !== cooldown) {
        panel.cooldown = cooldown;
        changed = true;
      }
      if (panel.ready !== state.ready) {
        panel.ready = state.ready;
        changed = true;
      }
      if (this.copySlots(state.slots)) changed = true;
    }
    if (!changed) return;
    this.weaponPanelPushed = true;
    hud.updateWeaponPanel(panel);
  }

  /** 挂架行：复用槽位对象；返回是否有变化 */
  private copySlots(source: CampaignWeaponPanelState['slots']): boolean {
    const slots = this.weaponPanel.slots;
    let changed = slots.length !== source.length;
    while (this.slotPool.length < source.length) {
      this.slotPool.push({ icon: '', shortCode: '', selected: false, ready: false });
    }
    slots.length = source.length;
    for (let i = 0; i < source.length; i++) {
      const from = source[i];
      const to = this.slotPool[i];
      if (
        to.icon !== from.icon ||
        to.shortCode !== from.shortCode ||
        to.selected !== from.selected ||
        to.ready !== from.ready
      ) {
        to.icon = from.icon;
        to.shortCode = from.shortCode;
        to.selected = from.selected;
        to.ready = from.ready;
        changed = true;
      }
      if (slots[i] !== to) {
        slots[i] = to;
        changed = true;
      }
    }
    return changed;
  }

  public updateFlares(charges: number, max: number, rechargeProgress: number): void {
    const hud = this.deps.getHud();
    if (!hud) {
      this.flareMax = -1;
      return;
    }
    const progress = quantize(rechargeProgress);
    if (charges === this.flareCharges && max === this.flareMax && progress === this.flareProgress) {
      return;
    }
    this.flareCharges = charges;
    this.flareMax = max;
    this.flareProgress = progress;
    hud.updateFlares(charges, max, progress);
  }

  public showAutosave(label: string): void {
    this.deps.getHud()?.showAutosave(label);
    this.deps.audio.playAutosave();
  }

  public setCameraMode(mode: CameraModeSetting, announce: boolean = true): void {
    this.deps.getHud()?.setCameraMode(mode);
    if (announce) {
      this.deps.audio.playCameraSwitch();
    }
  }

  public setBossStatus(label: string | null, phase?: { current: number; total: number }): void {
    const hud = this.deps.getHud();
    if (!hud) return;
    if (label === null && !phase) {
      hud.setBossStatus(null);
      return;
    }
    // Boss 没有状态提示时只显示阶段菱形（null 会把整条收起）
    hud.setBossStatus(label ?? '', phase);
  }

  public setMissileWarning(level: MissileWarningLevel, source: 'units' | 'boss' = 'units'): void {
    if (source === 'boss') {
      this.bossMissileWarning = level;
    } else {
      this.unitMissileWarning = level;
    }
    const combined =
      MISSILE_WARNING_RANK[this.bossMissileWarning] > MISSILE_WARNING_RANK[this.unitMissileWarning]
        ? this.bossMissileWarning
        : this.unitMissileWarning;
    if (combined === this.pushedMissileWarning) return;
    const hud = this.deps.getHud();
    if (!hud) return;
    this.pushedMissileWarning = combined;
    hud.setMissileWarning(combined);
  }

  public flashWarning(text: string, tone: 'threat' | 'sys' | 'ally'): void {
    this.deps.getHud()?.flashWarning(text, tone);
  }

  public setRadarRangeMultiplier(multiplier: number): void {
    if (multiplier === this.radarRangeMultiplier) return;
    const radar = this.deps.getRadar();
    if (!radar) return;
    this.radarRangeMultiplier = multiplier;
    radar.setRadarRangeMultiplier(multiplier);
  }

  public updatePlayerHealth(deltaTime: number, healthPercent: number, active: boolean): void {
    if (this.lowHealthRadioCooldown > 0) this.lowHealthRadioCooldown -= deltaTime;
    if (!active || !(healthPercent <= LOW_HEALTH_THRESHOLD)) {
      this.lowHealthBeepTimer = 0;
      if (!active || healthPercent > LOW_HEALTH_REARM) this.lowHealthRadioArmed = true;
      return;
    }
    this.lowHealthBeepTimer += deltaTime;
    if (this.lowHealthBeepTimer >= LOW_HEALTH_BEEP_SECONDS) {
      this.lowHealthBeepTimer = 0;
      this.deps.audio.playLowHealthWarning();
    }
    // 正在配音的台词说完之前不报（蜂鸣照常）；仍然低血量就在那之后报
    if (this.lowHealthRadioArmed && this.lowHealthRadioCooldown <= 0 && !this.isRadioVoicing()) {
      this.lowHealthRadioArmed = false;
      this.lowHealthRadioCooldown = LOW_HEALTH_RADIO_COOLDOWN;
      this.genericRadio('low-health');
    }
  }

  // ───────────────────────────── 音乐 ─────────────────────────────

  public playLevelMusic(level: number): void {
    this.deps.music.playLevelMusic(getLevelMusicForLevel(level));
  }

  public playBossMusic(level: number): void {
    this.deps.music.playBossMusic(level);
    this.prefetchBossVoice(level);
  }

  public playStinger(kind: CampaignStinger): void {
    this.deps.music.playStinger(kind);
    const duration = ENDING_STINGER_MS[kind];
    if (duration !== undefined) {
      this.endingStingerUntil = nowMs() + duration;
    }
  }

  public setMusicIntensity(intensity: number): void {
    this.deps.music.setIntensity(intensity);
  }

  public onBossPhaseChange(level: number, phase: number, label: string | null): void {
    this.radio('boss-phase', level, phase);
    this.sfx.playBossAlarm(true);
    if (label) {
      this.flashWarning(label, 'threat');
    }
    const index = Math.max(0, Math.min(PHASE_INTENSITY.length - 1, Math.round(phase)));
    this.setMusicIntensity(PHASE_INTENSITY[index]);
  }

  public onBossLowHealth(level: number, adjustIntensity: boolean): void {
    this.radio('boss-low-health', level);
    if (adjustIntensity) {
      this.setMusicIntensity(1);
    }
  }

  public onPause(): void {
    this.deps.music.pauseMusic();
    this.deps.audio.stopSustainedSounds();
    this.deps.voice?.pause();
  }

  public onResume(): void {
    this.deps.music.resumeMusic();
    this.deps.voice?.resume();
  }

  public onGameOver(): void {
    this.clearRadio();
    this.deps.voice?.stopAll();
    this.setMissileWarning('none', 'units');
    this.setMissileWarning('none', 'boss');
    this.deps.audio.stopSustainedSounds();
    this.playStinger('game-over');
  }

  public onMissionComplete(): void {
    this.clearRadio();
    this.deps.voice?.stopAll();
    this.deps.audio.stopSustainedSounds();
    this.playStinger('campaign-complete');
    this.afterEndingStinger(() => this.deps.music.playVictoryMusic());
  }

  /** 等结束音乐的刺激音（Boss 击破 / 通关）奏完再切换曲目，避免两段音乐叠在一起 */
  private afterEndingStinger(callback: () => void): void {
    const wait = this.endingStingerUntil - nowMs();
    if (wait <= 0) {
      callback();
      return;
    }
    this.schedule(callback, wait);
  }

  // ───────────────────────────── 音效 ─────────────────────────────

  public onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void {
    this.sfx.onWeaponEvent(event, weapon);
  }

  public onUnitEvent(
    event: UnitPresentationEvent,
    position: THREE.Vector3 | null,
    scale: number = 1
  ): void {
    this.sfx.onUnitEvent(event, position, scale);
  }

  public onBossCue(cue: string, position: THREE.Vector3, intensity: number): void {
    this.sfx.onBossCue(cue, position, intensity);
  }

  // ───────────────────────────── 逐帧 / 释放 ─────────────────────────────

  public update(deltaTime: number): void {
    const ui = this.storyUi;
    if (ui && !ui.overlay.isActive()) {
      ui.radio.update(deltaTime);
    }
  }

  private schedule(callback: () => void, delayMs: number): void {
    if (this.disposed || typeof setTimeout === 'undefined') return;
    const handle = setTimeout(
      () => {
        this.timers.delete(handle);
        if (!this.disposed) callback();
      },
      Math.max(0, delayMs)
    );
    this.timers.add(handle);
  }

  private clearTimers(): void {
    for (const handle of this.timers) clearTimeout(handle);
    this.timers.clear();
  }

  public dispose(): void {
    this.disposed = true;
    this.storyToken++;
    this.clearTimers();
    this.pendingRadio.length = 0;
    this.radioVoiceHandle = 0;
    // 配音系统归协调器所有（由它释放）；这里只停下声音
    this.deps.voice?.stopAll();
    this.storyUi?.overlay.dispose();
    this.storyUi?.radio.dispose();
    this.storyUi = null;
  }
}
