import * as THREE from 'three';
import {
  SPECIAL_WEAPON_IDS,
  type CombatTarget,
  type DecoyPoint,
  type IDecoyProvider,
  type SpecialWeaponId,
} from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import type { InputState } from '@/core/Input/InputHandler';
import type { CameraModeSetting } from '@/core/SessionSettings';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import type { CountermeasureSystem } from '@/features/weapons/CountermeasureSystem';
import type { WeaponMuzzle, WeaponSaveState, WeaponSystem } from '@/features/weapons/WeaponSystem';
import { tr } from '@/i18n';

export type WeaponSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };

export interface SpecialWeaponsDeps {
  scene: THREE.Scene;
  presentation: ICampaignPresentation;
  /** 填充特殊武器目标（敌机 / 单位 / Boss 部件 / 可拦截导弹），数组由控制器复用 */
  collectTargets(out: CombatTarget[]): void;
  /** EMP 脉冲：单位瘫痪、导弹销毁、幻影之翼现形、屏幕电磁闪 */
  onEmpPulse(center: THREE.Vector3, radius: number, seconds: number): void;
  /** 发射：炮口焰 / 镜头震动 */
  onFired(id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3): void;
  /** 命中爆炸：镜头震动（scale 为爆炸规模） */
  onImpact(id: SpecialWeaponId, position: THREE.Vector3, scale: number): void;
  /** 简短提示（第 1 轮用现有 HUD 大字提示） */
  notify(icon: string, text: string): void;
}

/** 机头挂点偏移（机体局部，前方为 -Z） */
const MUZZLE_OFFSET = new THREE.Vector3(0, 0.3, -0.5);
/** HUD 面板轮询间隔（秒）：getHudState 会分配槽位数组，不必每帧调用 */
const HUD_POLL_INTERVAL = 1 / 12;
const EMPTY_DECOYS: readonly DecoyPoint[] = [];

/**
 * 特殊武器（集束火箭 / 脉冲激光 / 蜂群导弹 / 电磁轨道炮 / 电磁脉冲）与热焰弹的运行时接线：
 * 输入（F 按住、Tab/X 切换、1-5 选择、G 热焰弹）、挂点、目标提供者、EMP、升级 / 解锁同步、
 * 复活补给、存档导出 / 导入、HUD 轮询（第 2 轮面板）。
 *
 * 两个系统体积较大，按需加载；加载前所有调用为空操作。
 */
export class SpecialWeaponsController implements IDecoyProvider {
  private weapons: WeaponSystem | null = null;
  private flares: CountermeasureSystem | null = null;
  private loadPromise: Promise<void> | null = null;
  private disposed = false;

  private readonly targets: CombatTarget[] = [];
  private readonly muzzle: WeaponMuzzle = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
  };
  private readonly lastAircraftPosition = new THREE.Vector3();
  private readonly aircraftVelocity = new THREE.Vector3();
  private hasLastAircraftPosition = false;
  private hudPollTimer = 0;
  private unlocked: SpecialWeaponId[] = [];
  private viewMode: CameraModeSetting = 'third-person';
  private effectDensity = 1;
  private surfaceSampler: WeaponSurfaceSampler | null = null;
  private progressionStats: PlayerStats | null = null;

  constructor(private readonly deps: SpecialWeaponsDeps) {}

  public ensureLoaded(particleSystem: ParticleSystem): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = Promise.all([
        import('@/features/weapons/WeaponSystem'),
        import('@/features/weapons/CountermeasureSystem'),
      ]).then(([weaponModule, flareModule]) => {
        if (this.disposed) return;
        const weapons = new weaponModule.WeaponSystem(this.deps.scene, particleSystem);
        const flares = new flareModule.CountermeasureSystem(this.deps.scene, particleSystem);
        this.attach(weapons, flares);
        this.weapons = weapons;
        this.flares = flares;
        // 加载前已同步过进度：补上强化等级与热焰弹容量
        if (this.progressionStats) {
          this.syncProgression(this.progressionStats, this.unlocked);
        }
      });
    }
    return this.loadPromise;
  }

  public isReady(): boolean {
    return this.weapons !== null;
  }

  private attach(weapons: WeaponSystem, flares: CountermeasureSystem): void {
    weapons.setTargetProvider(() => {
      this.targets.length = 0;
      this.deps.collectTargets(this.targets);
      return this.targets;
    });
    weapons.setSurfaceSampler(this.surfaceSampler);
    weapons.setViewMode(this.viewMode);
    weapons.setEffectDensity(this.effectDensity);
    weapons.setUnlocked(this.unlocked);

    const presentation = this.deps.presentation;
    weapons.onFired = (id, position, direction) => {
      presentation.onWeaponEvent('fired', id);
      this.deps.onFired(id, position, direction);
    };
    weapons.onImpact = (id, position, scale) => this.deps.onImpact(id, position, scale);
    weapons.onEmpPulse = (center, radius, seconds) => {
      presentation.onWeaponEvent('emp', 'emp');
      this.deps.onEmpPulse(center, radius, seconds);
    };
    weapons.onOverheat = () => {
      presentation.onWeaponEvent('overheat', 'laser');
      presentation.genericRadio('weapon-overheat');
    };
    weapons.onChargeStart = () => presentation.onWeaponEvent('charge-start', 'railgun');
    weapons.onDryFire = (id) =>
      presentation.onWeaponEvent(id === 'railgun' ? 'charge-cancel' : 'dry-fire', id);
    weapons.onBeamEnd = (id) => presentation.onWeaponEvent('beam-end', id);
    flares.onDeployed = () => presentation.onWeaponEvent('flare', null);
  }

  // ───────────────────────────── 配置 ─────────────────────────────

  public setSurfaceSampler(sampler: WeaponSurfaceSampler | null): void {
    this.surfaceSampler = sampler;
    this.weapons?.setSurfaceSampler(sampler);
  }

  public setViewMode(mode: CameraModeSetting): void {
    this.viewMode = mode;
    this.weapons?.setViewMode(mode);
  }

  /** 特效密度（由粒子预算推导：性能档 ≈0.45，画质档 1） */
  public setEffectDensity(density: number): void {
    const next = Number.isFinite(density) ? Math.max(0.3, Math.min(1, density)) : 1;
    if (Math.abs(next - this.effectDensity) < 0.02) return;
    this.effectDensity = next;
    this.weapons?.setEffectDensity(next);
  }

  /**
   * 进度同步（关卡开始 / 机库购买后 / 读档）：解锁列表、各武器强化等级、热焰弹容量。
   * 返回本次新解锁的武器（开局播报用）。
   */
  public syncProgression(
    stats: PlayerStats,
    unlocked: readonly SpecialWeaponId[]
  ): SpecialWeaponId[] {
    this.progressionStats = stats;
    const previous = new Set(this.unlocked);
    this.unlocked = SPECIAL_WEAPON_IDS.filter((id) => unlocked.includes(id));
    const newlyUnlocked = this.unlocked.filter((id) => !previous.has(id));
    const weapons = this.weapons;
    if (weapons) {
      // 先设等级再解锁：新解锁的武器按当前等级满弹
      for (const id of SPECIAL_WEAPON_IDS) {
        weapons.setUpgradeLevel(id, stats.getWeaponUpgradeLevel(id));
      }
      weapons.setUnlocked(this.unlocked);
    }
    this.flares?.setCapacity(stats.getFlareCapacity());
    return newlyUnlocked;
  }

  /** 关卡开始 / 复活：补满弹药、清除在途弹体与光束；热焰弹充满 */
  public refill(): void {
    this.weapons?.refill();
    this.weapons?.clear();
    const flares = this.flares;
    if (flares) {
      flares.importState({ charges: flares.getMaxCharges() });
    }
    this.hasLastAircraftPosition = false;
  }

  /** 换关 / 读档：清除在途弹体、光束与热焰弹（弹药保留） */
  public clearInFlight(): void {
    this.weapons?.clear();
    this.flares?.clear();
    this.hasLastAircraftPosition = false;
  }

  // ───────────────────────────── 输入与每帧 ─────────────────────────────

  /**
   * 输入：F 扳机（按住）、切换 / 选择请求、热焰弹请求。canFire = false（复活中 / 剧情冻结）时松开扳机。
   */
  public handleInput(
    input: InputState,
    cycleRequested: boolean,
    slotRequested: number,
    flareRequested: boolean,
    aircraft: THREE.Object3D,
    canFire: boolean
  ): void {
    const weapons = this.weapons;
    if (!weapons) return;
    weapons.setTriggerHeld(canFire && input.special);

    if (cycleRequested) {
      const before = weapons.getSelected();
      const after = weapons.selectNext();
      if (after && after !== before) this.announceSelection();
      else if (!after) {
        this.deps.notify('🔒', tr({ en: 'No special weapons yet', zh: '尚无特殊武器' }));
      }
    }
    if (slotRequested >= 0) {
      const id = SPECIAL_WEAPON_IDS[slotRequested];
      const before = weapons.getSelected();
      if (weapons.selectIndex(slotRequested)) {
        if (weapons.getSelected() !== before) this.announceSelection();
      } else if (id) {
        this.deps.presentation.onWeaponEvent('dry-fire', id);
        this.deps.notify('🔒', tr({ en: 'Weapon not unlocked yet', zh: '武器尚未解锁' }));
      }
    }
    if (flareRequested && canFire) {
      const deployed =
        this.flares?.deploy(aircraft.position, aircraft.quaternion, this.aircraftVelocity) ?? false;
      if (!deployed) {
        this.deps.presentation.onWeaponEvent('flare-empty', null);
      }
    }
  }

  private announceSelection(): void {
    const weapons = this.weapons;
    if (!weapons) return;
    const state = weapons.getHudState();
    this.deps.presentation.onWeaponEvent('switch', state.selected);
    this.deps.notify(state.icon, state.name);
  }

  /** 模拟步长：挂点、武器、热焰弹、HUD 轮询 */
  public update(deltaTime: number, aircraft: THREE.Object3D): void {
    const weapons = this.weapons;
    if (!weapons) return;

    // 载机速度（热焰弹抛射继承速度）：位置差分，瞬移时清零
    if (this.hasLastAircraftPosition && deltaTime > 0) {
      this.aircraftVelocity
        .subVectors(aircraft.position, this.lastAircraftPosition)
        .multiplyScalar(1 / deltaTime);
      if (this.aircraftVelocity.lengthSq() > 400 * 400) this.aircraftVelocity.set(0, 0, 0);
    } else {
      this.aircraftVelocity.set(0, 0, 0);
    }
    this.lastAircraftPosition.copy(aircraft.position);
    this.hasLastAircraftPosition = true;

    this.muzzle.quaternion.copy(aircraft.quaternion);
    this.muzzle.position
      .copy(MUZZLE_OFFSET)
      .applyQuaternion(aircraft.quaternion)
      .add(aircraft.position);
    weapons.update(deltaTime, this.muzzle);
    this.flares?.update(deltaTime);

    this.hudPollTimer -= deltaTime;
    if (this.hudPollTimer <= 0) {
      this.hudPollTimer = HUD_POLL_INTERVAL;
      this.pushHud();
    }
  }

  /** 立即推送一次 HUD（切换 / 购买后） */
  public pushHud(): void {
    const weapons = this.weapons;
    const flares = this.flares;
    const presentation = this.deps.presentation;
    presentation.updateWeaponPanel(
      weapons && this.unlocked.length > 0 ? weapons.getHudState() : null
    );
    if (flares) {
      presentation.updateFlares(
        flares.getCharges(),
        flares.getMaxCharges(),
        flares.getRechargeProgress()
      );
    }
  }

  // ───────────────────────────── 查询 / 存档 ─────────────────────────────

  /** IDecoyProvider：燃烧中的热焰弹（SAM / Boss 导弹据此偏转） */
  public getActiveDecoys(): readonly DecoyPoint[] {
    return this.flares?.getActiveDecoys() ?? EMPTY_DECOYS;
  }

  public getSelected(): SpecialWeaponId | null {
    return this.weapons?.getSelected() ?? null;
  }

  public getUnlocked(): SpecialWeaponId[] {
    return [...this.unlocked];
  }

  public getFlareCharges(): number {
    return this.flares?.getCharges() ?? 0;
  }

  public getMaxFlareCharges(): number {
    return this.flares?.getMaxCharges() ?? 0;
  }

  public getActiveProjectileCount(): number {
    return this.weapons?.getActiveProjectileCount() ?? 0;
  }

  public isBeamActive(): boolean {
    return this.weapons?.isBeamActive() ?? false;
  }

  public exportState(): WeaponSaveState {
    return (
      this.weapons?.exportState() ?? {
        unlocked: [...this.unlocked],
        selected: null,
        ammo: {},
      }
    );
  }

  /** 读档：调用前须先 syncProgression（等级决定弹药上限） */
  public importState(state: WeaponSaveState, flareCharges: number): void {
    this.weapons?.importState(state);
    this.flares?.importState({ charges: flareCharges });
    this.hasLastAircraftPosition = false;
  }

  public dispose(): void {
    this.disposed = true;
    this.weapons?.dispose();
    this.flares?.dispose();
    this.weapons = null;
    this.flares = null;
    this.targets.length = 0;
  }
}
