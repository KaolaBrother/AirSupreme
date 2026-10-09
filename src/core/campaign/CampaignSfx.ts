import type * as THREE from 'three';
import type { SpecialWeaponId } from '@/core/CombatContracts';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type {
  UnitPresentationEvent,
  WeaponPresentationEvent,
} from '@/core/campaign/CampaignPresentation';

/**
 * 战役音效路由：把特殊武器 / 单位 / Boss 的事件映射到 AudioManager 的新音效（api-spec §6）。
 *
 * - 远处的单位事件按距离静音（听者 = 玩家位置），坦克炮 / 防空炮 / 声呐各自限流；
 * - Boss 效果提示（cue）按 integration-notes 的映射：熔岩喷发、声呐、汽笛、雷击、护盾、
 *   阶段警报 + phase-change 刺激音（警报与刺激音另有冷却，避免阶段切换与 cue 叠响）。
 * 纯转发，无 DOM；每个方法都不抛异常（AudioManager 内部按 beginSound 策略节流）。
 */

export interface CampaignSfxDeps {
  audio: AudioManager;
  /** 听者位置（玩家），用于距离衰减；null 时不做距离判定 */
  getListenerPosition(): THREE.Vector3 | null;
  /** 阶段切换刺激音（MusicSystem.playStinger('phase-change')） */
  playPhaseStinger(): void;
}

/** 单位事件的可闻距离（米） */
const UNIT_EVENT_RANGE: Readonly<Partial<Record<UnitPresentationEvent, number>>> = {
  cannon: 650,
  'missile-launch': 900,
  'flak-burst': 550,
  'rocket-salvo': 700,
  ciws: 450,
  'bomb-drop': 800,
  'sub-surface': 900,
  'sub-dive': 900,
  explosion: 1400,
  'destroyed-ground': 1600,
  'destroyed-sea': 1600,
  'destroyed-air': 1600,
};

/** 同类事件的最短间隔（毫秒） */
const UNIT_EVENT_THROTTLE_MS: Readonly<Partial<Record<UnitPresentationEvent, number>>> = {
  cannon: 160,
  'missile-launch': 250,
  'flak-burst': 120,
  'rocket-salvo': 1600,
  ciws: 300,
  'bomb-drop': 300,
  'sub-surface': 1200,
  'sub-dive': 1200,
  'sam-locking': 900,
  'sam-launched': 700,
  explosion: 90,
  'civilian-hit': 1500,
};

const BOSS_ALARM_COOLDOWN_MS = 2500;
const BOSS_CUE_THROTTLE_MS = 140;

const LASER_WARNING_CUES: ReadonlySet<string> = new Set([
  'beam-charge',
  'lance-charge',
  'pinwheel-charge',
  'judgement-charge',
  'coil-charge',
  'barrage-charge',
  'shockwave-charge',
  'pylon-charge',
  'arc-telegraph',
  'orbital-telegraph',
]);
const LOCK_CUES: ReadonlySet<string> = new Set(['lance-lock', 'judgement-lock']);
const SWEEP_CUES: ReadonlySet<string> = new Set([
  'beam-fire',
  'lance-fire',
  'pinwheel-fire',
  'judgement-fire',
  'prism-fire',
]);
const LIGHTNING_CUES: ReadonlySet<string> = new Set([
  'lightning',
  'storm-strike',
  'arc-strike',
  'orbital-strike',
  'storm-call',
]);
const HEAVY_CUES: ReadonlySet<string> = new Set([
  'stomp',
  'breach',
  'mortar-impact',
  'shockwave',
  'mine-detonate',
  'cell-burst',
  'ram',
  'footfall',
]);
const STEALTH_CUES: ReadonlySet<string> = new Set(['cloak', 'decloak', 'cloak-fail', 'decoys']);
/** 阶段警报 + phase-change 刺激音（神谕：护盾崩溃 / 过载 / 最后之光） */
const ALARM_CUES: ReadonlySet<string> = new Set([
  'shield-collapse',
  'overload',
  'last-light',
  'core-exposed',
  'overdrive',
]);
const DEATH_CUES: ReadonlySet<string> = new Set([
  'collapse',
  'crash',
  'hull-break',
  'death-implode',
]);
/** 发射类提示（导弹发射音由 onMissileFired 播放，这里只处理迫击炮 / 鱼雷 / 无人机） */
const LAUNCH_CUES: ReadonlySet<string> = new Set(['drone-launch', 'mortar-launch', 'torpedo']);
/** 子目标被摧毁（散热口、压载舱、气囊机库、护盾塔、发射器……） */
const PART_DESTROYED_CUES: ReadonlySet<string> = new Set([
  'vent-destroyed',
  'tank-destroyed',
  'sail-destroyed',
  'bay-destroyed',
  'hangar-destroyed',
  'pylon-destroyed',
  'emitter-destroyed',
  'decoy-pop',
]);

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export class CampaignSfxRouter {
  private readonly lastUnitEventAt = new Map<UnitPresentationEvent, number>();
  private readonly lastCueAt = new Map<string, number>();
  private lastAlarmAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: CampaignSfxDeps) {}

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /** 距离（米）；没有位置或听者时为 0 */
  private distanceTo(position: THREE.Vector3 | null): number {
    const listener = this.deps.getListenerPosition();
    if (!position || !listener) return 0;
    const distance = listener.distanceTo(position);
    return Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY;
  }

  // ───────────────────────────── 特殊武器 / 热焰弹 ─────────────────────────────

  public onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void {
    const audio = this.deps.audio;
    switch (event) {
      case 'fired':
        if (weapon === 'rockets') audio.playRocketSalvo();
        else if (weapon === 'swarm') audio.playSwarmLaunch();
        else if (weapon === 'laser') audio.playLaserStart();
        else if (weapon === 'railgun') audio.playRailgunFire();
        else if (weapon === 'emp') audio.playEmpPulse();
        break;
      case 'beam-end':
        audio.playLaserStop();
        break;
      case 'overheat':
        audio.playLaserOverheat();
        break;
      case 'charge-start':
        audio.playRailgunCharge();
        break;
      case 'charge-cancel':
        audio.playRailgunChargeCancel();
        break;
      case 'dry-fire':
      case 'flare-empty':
        audio.playMissileDry();
        break;
      case 'switch':
        audio.playWeaponSwitch();
        break;
      case 'unlock':
        audio.playWeaponUnlock();
        break;
      case 'flare':
        audio.playFlareDeploy();
        break;
      case 'emp':
      default:
        // EMP 的音效随 'fired' 播放（onFired 与 onEmpPulse 同帧触发，避免重复）
        break;
    }
  }

  // ───────────────────────────── 地面 / 海上 / 空中单位 ─────────────────────────────

  public onUnitEvent(
    event: UnitPresentationEvent,
    position: THREE.Vector3 | null,
    scale: number = 1
  ): void {
    const range = UNIT_EVENT_RANGE[event];
    const distance = this.distanceTo(position);
    if (range !== undefined && distance > range) return;
    const throttle = UNIT_EVENT_THROTTLE_MS[event];
    if (throttle !== undefined) {
      const now = this.now();
      if (now - (this.lastUnitEventAt.get(event) ?? Number.NEGATIVE_INFINITY) < throttle) return;
      this.lastUnitEventAt.set(event, now);
    }

    const audio = this.deps.audio;
    switch (event) {
      case 'cannon':
        audio.playTankCannon();
        break;
      case 'missile-launch':
        audio.playSamLaunch();
        break;
      case 'flak-burst':
        audio.playFlakCannonExplosion();
        break;
      case 'ciws':
        audio.playFlakCannonFire();
        break;
      case 'rocket-salvo': {
        // 武装直升机攻击航路：越近越响
        const intensity = range ? Math.max(0.35, 1 - distance / range) : 1;
        audio.playHelicopterPass(intensity);
        break;
      }
      case 'bomb-drop':
        audio.playBombDrop();
        break;
      case 'sub-surface':
      case 'sub-dive':
        audio.playSonarPing();
        break;
      case 'sam-locking':
        audio.playSamLockWarning();
        break;
      case 'sam-launched':
        audio.playIncomingWarning(distance > 0 ? distance : undefined);
        break;
      case 'explosion':
        audio.playExplosion('enemy', Math.max(0.5, Math.min(3, finiteOr(scale, 1))));
        break;
      case 'civilian-hit':
        audio.playCivilianWarning();
        break;
      case 'destroyed-ground':
        audio.playUnitDestroyed('ground');
        break;
      case 'destroyed-sea':
        audio.playUnitDestroyed('sea');
        break;
      case 'destroyed-air':
        audio.playUnitDestroyed('air');
        break;
      default:
        break;
    }
  }

  // ───────────────────────────── Boss 效果提示 ─────────────────────────────

  /** 阶段警报（阶段切换与 Boss 自己的警报 cue 共用冷却） */
  public playBossAlarm(withStinger: boolean): void {
    const now = this.now();
    if (now - this.lastAlarmAt < BOSS_ALARM_COOLDOWN_MS) return;
    this.lastAlarmAt = now;
    this.deps.audio.playBossPhaseAlarm();
    if (withStinger) this.deps.playPhaseStinger();
  }

  public onBossCue(cue: string, _position: THREE.Vector3, intensity: number): void {
    const now = this.now();
    if (now - (this.lastCueAt.get(cue) ?? Number.NEGATIVE_INFINITY) < BOSS_CUE_THROTTLE_MS) return;
    this.lastCueAt.set(cue, now);

    const audio = this.deps.audio;
    const level = Math.max(0.6, Math.min(2, finiteOr(intensity, 1)));
    if (ALARM_CUES.has(cue)) {
      this.playBossAlarm(true);
      return;
    }
    switch (cue) {
      case 'geyser':
        audio.playLavaEruption();
        return;
      case 'sonar':
        audio.playSonarPing();
        return;
      case 'horn':
        audio.playShipHorn();
        return;
      case 'shield-hit':
        audio.playShieldHit();
        return;
      case 'death-freeze':
        audio.playLaserWarning();
        return;
      case 'death-flash':
        audio.playBossExplosion(1.6);
        return;
      case 'awaken':
        this.playBossAlarm(false);
        return;
      default:
        break;
    }
    if (LOCK_CUES.has(cue)) {
      audio.playSamLockWarning();
    } else if (LASER_WARNING_CUES.has(cue)) {
      audio.playLaserWarning();
    } else if (SWEEP_CUES.has(cue)) {
      audio.playLaserSweep();
    } else if (LIGHTNING_CUES.has(cue)) {
      audio.playLightningStrike();
    } else if (HEAVY_CUES.has(cue)) {
      audio.playHeavyWeaponImpact('boss-cannon', level);
    } else if (STEALTH_CUES.has(cue)) {
      audio.playTeleport();
    } else if (DEATH_CUES.has(cue)) {
      audio.playBossExplosion(1.2);
    } else if (PART_DESTROYED_CUES.has(cue)) {
      audio.playExplosion('enemy', cue === 'decoy-pop' ? 0.6 : 1.4);
    } else if (LAUNCH_CUES.has(cue)) {
      audio.playMissileLaunch('boss');
    }
  }
}
