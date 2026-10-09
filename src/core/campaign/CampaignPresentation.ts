import type * as THREE from 'three';
import type { SpecialWeaponId } from '@/core/CombatContracts';
import type { AudioManager } from '@/core/Audio/AudioManager';
import { getLevelMusicForLevel, type MusicSystem } from '@/core/Audio/MusicSystem';
import type { CameraModeSetting } from '@/core/SessionSettings';
import {
  GENERIC_RADIO,
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
import type { StoryCardKind, StoryOverlay } from '@/ui/StoryOverlay';
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
 * - 音效：特殊武器、单位、Boss 效果提示（CampaignSfxRouter）。
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
  genericRadio(key: GenericRadioKey): void;
  unitFirstContact(unitType: string): void;
  /** 僚机入列 / 被击落：播放 WINGMAN_EVENT_RADIO 登记的通用台词（未登记的事件不出声） */
  onWingmanEvent(id: WingmanId, event: WingmanEvent): void;
  /** 某名僚机此刻是否在空中（无线电 / 语音挑选说话人用） */
  isWingmanFlying(id: WingmanId): boolean;
  /** 无线电正在播放或有排队台词 */
  isRadioBusy(): boolean;
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
}

interface StoryUi {
  overlay: StoryOverlay;
  radio: RadioComms;
}

interface PendingRadioLine {
  line: RadioLine;
  priority: 'normal' | 'high';
}

/** 高优先级通用台词（打断普通台词） */
const HIGH_PRIORITY_RADIO: ReadonlySet<GenericRadioKey> = new Set<GenericRadioKey>([
  'civilian-hit',
  'missile-warning',
  'low-health',
]);
/**
 * 僚机事件 → 通用台词键（GENERIC_RADIO）。战役数据为渡鸦 / 雨燕补充入列、被击落台词后在此登记；
 * 未登记的事件不播台词。
 */
const WINGMAN_EVENT_RADIO: Readonly<
  Partial<Record<`${WingmanId}:${WingmanEvent}`, GenericRadioKey>>
> = {};
/** 剧情界面加载前最多缓存的台词 */
const MAX_PENDING_RADIO = 6;
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
          radio.onLineShown = () => this.deps.audio.playRadioOpen();
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

  // ───────────────────────────── 剧情卡片 ─────────────────────────────

  public showChapterIntro(
    level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void {
    const token = ++this.storyToken;
    this.clearRadio();
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
        // 关卡结束：清空无线电；胜利曲等 Boss 击破刺激音收尾后再进
        this.clearRadio();
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

  public genericRadio(key: GenericRadioKey): void {
    const high = HIGH_PRIORITY_RADIO.has(key);
    // Boss 模式只保留高优先级的战术告警
    if (this.deps.isBossMode() && !high) return;
    const line = GENERIC_RADIO[key];
    if (line) this.enqueueRadio(line, high ? 'high' : 'normal');
  }

  public unitFirstContact(unitType: string): void {
    if (this.deps.isBossMode()) return;
    const line = UNIT_FIRST_CONTACT_RADIO[unitType];
    if (line) this.enqueueRadio(line, 'normal');
  }

  public onWingmanEvent(id: WingmanId, event: WingmanEvent): void {
    const key = WINGMAN_EVENT_RADIO[`${id}:${event}`];
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

  public clearRadio(): void {
    this.pendingRadio.length = 0;
    this.storyUi?.radio.clear();
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
    if (this.lowHealthRadioArmed && this.lowHealthRadioCooldown <= 0) {
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
  }

  public onResume(): void {
    this.deps.music.resumeMusic();
  }

  public onGameOver(): void {
    this.clearRadio();
    this.setMissileWarning('none', 'units');
    this.setMissileWarning('none', 'boss');
    this.deps.audio.stopSustainedSounds();
    this.playStinger('game-over');
  }

  public onMissionComplete(): void {
    this.clearRadio();
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
    this.storyUi?.overlay.dispose();
    this.storyUi?.radio.dispose();
    this.storyUi = null;
  }
}
