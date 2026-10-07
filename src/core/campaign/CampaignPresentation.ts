import type * as THREE from 'three';
import type { SpecialWeaponId } from '@/core/CombatContracts';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type { MusicSystem } from '@/core/Audio/MusicSystem';
import { LevelMusic } from '@/core/Audio/MusicSystem';
import type { CameraModeSetting } from '@/core/SessionSettings';
import {
  getChapterRadio,
  type GenericRadioKey,
  type RadioTriggerKind,
} from '@/features/campaign/CampaignData';
import type { HUD } from '@/ui/HUD';

/**
 * 战役表现层适配器（集成第 2 轮的挂钩点）
 *
 * 第 1 轮（玩法核心）只调用这一个接口来“讲故事 / 报状态 / 出声音”。默认实现
 * `DefaultCampaignPresentation` 只使用今天已经存在的 HUD / AudioManager / MusicSystem 方法：
 * 章节卡片、结算、结局直接回调；无线电与新 HUD 面板为空操作或退化为 showPowerUpBig 提示。
 *
 * 第 2 轮把方法体换成真正的实现即可，玩法代码无需改动：
 * - showChapterIntro / showDebrief / showEnding → StoryOverlay
 * - radio / genericRadio / unitFirstContact → RadioComms（CampaignData 台词）
 * - updateWeaponPanel / updateFlares / showAutosave / setCameraMode / setBossStatus /
 *   setMissileWarning / flashWarning / setRadarRangeMultiplier → HUD / RadarMinimap 新面板
 * - playStinger / setMusicIntensity / playLevelMusic / playBossMusic → MusicSystem 新曲目
 * - onWeaponEvent / onUnitEvent / onBossCue → AudioManager 新音效
 */

/** 结算卡片所需数据（第 2 轮映射到 StoryOverlay.DebriefData） */
export interface CampaignDebriefInput {
  level: number;
  scoreGained: number;
  totalScore: number;
  kills: number;
  civiliansLost: number;
  alliesLost: number;
  bonusPoints: Array<{ label: string; points: number }>;
}

/** 与 MusicSystem 规划中的 MusicStinger 取值一致 */
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

/** 单位事件（UnitSystem.onUnitEvent 的 kind 以及锁定 / 摧毁等协调器事件） */
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
  | 'destroyed-ground'
  | 'destroyed-sea'
  | 'destroyed-air';

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
  showChapterIntro(
    level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void;
  showDebrief(data: CampaignDebriefInput, onContinue: () => void): void;
  showEnding(finalScore: number, onComplete: () => void): void;
  /** 剧情卡片显示中（协调器据此冻结模拟） */
  isStoryActive(): boolean;

  // ── 无线电（RadioComms） ──
  radio(trigger: RadioTriggerKind, level: number, index?: number): void;
  genericRadio(key: GenericRadioKey): void;
  unitFirstContact(unitType: string): void;

  // ── HUD 新面板 ──
  updateWeaponPanel(state: CampaignWeaponPanelState | null): void;
  updateFlares(charges: number, max: number, rechargeProgress: number): void;
  showAutosave(label: string): void;
  setCameraMode(mode: CameraModeSetting): void;
  setBossStatus(label: string | null, phase?: { current: number; total: number }): void;
  setMissileWarning(level: 'none' | 'locking' | 'incoming'): void;
  flashWarning(text: string, tone: 'threat' | 'sys' | 'ally'): void;
  setRadarRangeMultiplier(multiplier: number): void;

  // ── 音乐 / 音效 ──
  playLevelMusic(level: number): void;
  playBossMusic(level: number): void;
  playStinger(kind: CampaignStinger): void;
  setMusicIntensity(intensity: number): void;
  onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void;
  onUnitEvent(event: UnitPresentationEvent, position: THREE.Vector3 | null): void;
  onBossCue(cue: string, position: THREE.Vector3, intensity: number): void;

  /** 每帧（模拟步长）推进：无线电队列、打字机等 */
  update(deltaTime: number): void;
  dispose(): void;
}

export interface DefaultCampaignPresentationDeps {
  getHud(): HUD | null;
  audio: AudioManager;
  music: MusicSystem;
}

/** 第 1-5 关沿用原有曲目；第 6-10 关在第 2 轮换成 getLevelMusicForLevel 的新曲目 */
const LEGACY_LEVEL_MUSIC: Readonly<Record<number, LevelMusic>> = {
  1: LevelMusic.LAKE,
  2: LevelMusic.DESERT,
  3: LevelMusic.SNOW,
  4: LevelMusic.OCEAN,
  5: LevelMusic.CITY,
  6: LevelMusic.CITY,
  7: LevelMusic.SNOW,
  8: LevelMusic.DESERT,
  9: LevelMusic.OCEAN,
  10: LevelMusic.CITY,
};

/** Boss 提示音分组（只用现有音效；第 2 轮按 cue 细分为新音效） */
const CHARGE_CUES = new Set<string>([
  'beam-charge',
  'lance-charge',
  'pinwheel-charge',
  'judgement-charge',
  'judgement-lock',
  'lance-lock',
  'coil-charge',
  'barrage-charge',
  'shockwave-charge',
  'arc-telegraph',
  'orbital-telegraph',
  'pylon-charge',
]);
const FIRE_CUES = new Set<string>([
  'beam-fire',
  'lance-fire',
  'pinwheel-fire',
  'judgement-fire',
  'prism-fire',
  'lightning',
]);
const HEAVY_CUES = new Set<string>([
  'stomp',
  'breach',
  'mortar-impact',
  'geyser',
  'storm-strike',
  'arc-strike',
  'orbital-strike',
  'shockwave',
  'mine-detonate',
  'cell-burst',
  'ram',
]);
const STEALTH_CUES = new Set<string>(['cloak', 'decloak', 'cloak-fail']);

/**
 * 默认（第 1 轮）实现：只用现有方法给出最低限度的反馈，绝不调用尚未落地的 API。
 */
export class DefaultCampaignPresentation implements ICampaignPresentation {
  private lastWarningAt = 0;
  private lastWarningText = '';

  constructor(private readonly deps: DefaultCampaignPresentationDeps) {}

  showChapterIntro(
    _level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void {
    // 第 2 轮：StoryOverlay.showChapterIntro(getCampaignChapter(level), onComplete, options)。
    // 第 1 轮没有剧情卡片：入关简报由协调器紧接着显示；新武器解锁给一句提示
    if (options.unlockLine) {
      this.deps.getHud()?.showPowerUpBig('🔓', options.unlockLine, 1.8, true);
    }
    onComplete();
  }

  showDebrief(_data: CampaignDebriefInput, onContinue: () => void): void {
    // 第 2 轮：StoryOverlay.showDebrief(data, onContinue)
    onContinue();
  }

  showEnding(_finalScore: number, onComplete: () => void): void {
    // 第 2 轮：StoryOverlay.showEnding({ finalScore }, onComplete)
    onComplete();
  }

  isStoryActive(): boolean {
    return false;
  }

  radio(trigger: RadioTriggerKind, level: number, index?: number): void {
    // 第 2 轮：RadioComms.enqueue(line)。第 1 轮只取第一句做简短提示（Boss 登场 / 击破）
    if (trigger !== 'boss-spawn' && trigger !== 'boss-defeated') return;
    const line = getChapterRadio(level, trigger, index)[0];
    if (!line) return;
    this.deps.getHud()?.showPowerUpBig('📻', line.text, 1.6, true);
  }

  genericRadio(_key: GenericRadioKey): void {
    // 第 2 轮：RadioComms.enqueue(GENERIC_RADIO[key])
  }

  unitFirstContact(_unitType: string): void {
    // 第 2 轮：RadioComms.enqueue(UNIT_FIRST_CONTACT_RADIO[unitType])
  }

  updateWeaponPanel(_state: CampaignWeaponPanelState | null): void {
    // 第 2 轮：HUD.updateWeaponPanel
  }

  updateFlares(_charges: number, _max: number, _rechargeProgress: number): void {
    // 第 2 轮：HUD.updateFlares
  }

  showAutosave(_label: string): void {
    // 第 2 轮：HUD.showAutosave(label) + AudioManager.playAutosave()
    this.deps.getHud()?.showPowerUpBig('💾', '自动存档', 0.9, true);
  }

  setCameraMode(_mode: CameraModeSetting): void {
    // 第 2 轮：HUD.setCameraMode(mode) + AudioManager.playCameraSwitch()
  }

  setBossStatus(_label: string | null, _phase?: { current: number; total: number }): void {
    // 第 2 轮：HUD.setBossStatus
  }

  setMissileWarning(_level: 'none' | 'locking' | 'incoming'): void {
    // 第 2 轮：HUD.setMissileWarning + AudioManager.playSamLockWarning
  }

  flashWarning(text: string, tone: 'threat' | 'sys' | 'ally'): void {
    // 第 2 轮：HUD.flashWarning(text, tone)。第 1 轮退化为大字提示（同文案 1.2 秒内不重复）
    const now = Date.now();
    if (text === this.lastWarningText && now - this.lastWarningAt < 1200) return;
    this.lastWarningText = text;
    this.lastWarningAt = now;
    const icon = tone === 'threat' ? '⚠️' : tone === 'ally' ? '🤝' : '📡';
    this.deps.getHud()?.showPowerUpBig(icon, text, 1, true);
  }

  setRadarRangeMultiplier(_multiplier: number): void {
    // 第 2 轮：RadarMinimap.setRangeMultiplier
  }

  playLevelMusic(level: number): void {
    // 第 2 轮：getLevelMusicForLevel(level)
    this.deps.music.playLevelMusic(LEGACY_LEVEL_MUSIC[level] ?? LevelMusic.LAKE);
  }

  playBossMusic(level: number): void {
    // 第 2 轮：getBossMusicForLevel(level)
    this.deps.music.playBossMusic(level);
  }

  playStinger(_kind: CampaignStinger): void {
    // 第 2 轮：MusicSystem.playStinger(kind)
  }

  setMusicIntensity(_intensity: number): void {
    // 第 2 轮：MusicSystem.setIntensity(intensity)
  }

  onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void {
    // 第 2 轮：playRocketSalvo / playLaserStart / playLaserStop / playLaserOverheat /
    // playRailgunCharge / playRailgunChargeCancel / playRailgunFire / playSwarmLaunch /
    // playEmpPulse / playFlareDeploy / playWeaponSwitch / playWeaponUnlock
    const audio = this.deps.audio;
    switch (event) {
      case 'fired':
        if (weapon === 'rockets' || weapon === 'swarm') audio.playMissileLaunch('player');
        else if (weapon === 'railgun') audio.playHeavyWeaponImpact('boss-cannon', 0.9);
        else if (weapon === 'laser') audio.playLaserSweep();
        else if (weapon === 'emp') audio.playTeleport();
        break;
      case 'overheat':
        audio.playMissileDry();
        break;
      case 'charge-start':
        audio.playLaserWarning();
        break;
      case 'charge-cancel':
      case 'dry-fire':
      case 'flare-empty':
        audio.playMissileDry();
        break;
      case 'switch':
        audio.playMissileLockConfirm();
        break;
      case 'unlock':
        audio.playLevelUp();
        break;
      case 'flare':
        audio.playFlakCannonFire();
        break;
      default:
        break;
    }
  }

  onUnitEvent(event: UnitPresentationEvent, _position: THREE.Vector3 | null): void {
    // 第 2 轮：playSamLockWarning / playSamLaunch / playTankCannon / playBombDrop /
    // playSonarPing / playHelicopterPass / playUnitDestroyed(domain)
    // 爆炸声由 UnitSystem.onExplosion 统一播放（避免与摧毁事件重复）
    const audio = this.deps.audio;
    switch (event) {
      case 'sam-locking':
        audio.playMissileLock();
        break;
      case 'sam-launched':
        audio.playIncomingWarning();
        break;
      default:
        break;
    }
  }

  onBossCue(cue: string, _position: THREE.Vector3, intensity: number): void {
    // 第 2 轮：playLavaEruption / playSonarPing / playShipHorn / playShieldHit /
    // playLightningStrike / playBossPhaseAlarm + playStinger('phase-change')
    const audio = this.deps.audio;
    const level = Number.isFinite(intensity) ? Math.max(0.6, Math.min(2, intensity)) : 1;
    if (CHARGE_CUES.has(cue)) {
      audio.playLaserWarning();
    } else if (FIRE_CUES.has(cue)) {
      audio.playLaserSweep();
    } else if (HEAVY_CUES.has(cue)) {
      audio.playHeavyWeaponImpact('boss-cannon', level);
    } else if (STEALTH_CUES.has(cue)) {
      audio.playTeleport();
    } else if (
      cue === 'collapse' ||
      cue === 'crash' ||
      cue === 'hull-break' ||
      cue === 'death-implode'
    ) {
      audio.playBossExplosion(1.2);
    }
  }

  update(_deltaTime: number): void {
    // 第 2 轮：RadioComms.update(deltaTime)
  }

  dispose(): void {
    // 第 2 轮：StoryOverlay / RadioComms.dispose()
  }
}
