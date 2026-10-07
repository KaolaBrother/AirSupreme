import * as THREE from 'three';
import type { CombatTarget, SpecialWeaponId } from '@/core/CombatContracts';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import {
  SPECIAL_WEAPON_CONFIGS,
  SPECIAL_WEAPON_IDS,
  clampWeaponUpgradeLevel,
  getSpecialWeaponStats,
  isSpecialWeaponId,
  type SpecialWeaponMode,
  type SpecialWeaponStats,
} from './WeaponTypes';
import { TargetSnapshotBuffer, isFiniteVector } from './WeaponTargeting';
import { WeaponFx } from './WeaponFx';
import {
  EmpController,
  LaserController,
  ProjectileController,
  RailgunController,
  createFireFrame,
  type FireFrame,
  type SurfaceSampler,
  type WeaponContext,
} from './WeaponControllers';

/**
 * 特殊武器系统
 *
 * 五种武器（集束火箭 / 脉冲激光 / 蜂群导弹 / 电磁轨道炮 / 电磁脉冲）的选择、弹药、
 * 冷却、热量、蓄力与命中判定。命中只通过 CombatTarget 契约完成：
 * ENEMY / CIVILIAN 受伤，FRIENDLY 与玩家（NEUTRAL）永远不受伤。
 *
 * scene 为 null 时只运行逻辑（不创建任何网格），命中照常计算，便于单元测试。
 */

export interface WeaponHudSlot {
  id: SpecialWeaponId;
  icon: string;
  shortCode: string;
  selected: boolean;
  ready: boolean;
}

export interface WeaponHudState {
  selected: SpecialWeaponId | null;
  name: string;
  icon: string;
  shortCode: string;
  mode: SpecialWeaponMode | null;
  ammo: number;
  maxAmmo: number;
  /** 0..1：距离下一发弹药的进度（弹药已满为 1） */
  reloadProgress: number;
  heat: number;
  overheated: boolean;
  charge: number;
  /** 0..1：剩余冷却比例（0 = 可以开火） */
  cooldown: number;
  ready: boolean;
  slots: WeaponHudSlot[];
}

export interface WeaponSaveState {
  unlocked: SpecialWeaponId[];
  selected: SpecialWeaponId | null;
  ammo: Partial<Record<SpecialWeaponId, number>>;
}

/** 发射基准：position 为机头挂点附近，quaternion 为机体朝向（本地 -Z 为前方） */
export interface WeaponMuzzle {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/** 单件武器的运行时状态 */
export interface WeaponRuntime {
  id: SpecialWeaponId;
  level: number;
  stats: SpecialWeaponStats;
  ammo: number;
  /** 已累积的装填时间（秒） */
  reloadTimer: number;
  /** 剩余冷却（秒） */
  cooldownTimer: number;
  heat: number;
  overheated: boolean;
  charge: number;
  charging: boolean;
}

/** 推算载机速度时的上限：超过视为瞬移（复活 / 读档） */
const MAX_CARRY_SPEED = 400;

export class WeaponSystem {
  private readonly particleSystem: ParticleSystem | null;
  private readonly fx: WeaponFx | null;
  private readonly runtimes = new Map<SpecialWeaponId, WeaponRuntime>();
  private readonly levels = new Map<SpecialWeaponId, number>();
  private unlocked: SpecialWeaponId[] = [];
  private selected: SpecialWeaponId | null = null;
  private targetProvider: (() => readonly CombatTarget[]) | null = null;
  private surfaceSampler: SurfaceSampler | null = null;

  // 扳机：边沿在 setTriggerHeld 时记录，update 中消费（同一帧内按下又松开也不会丢）
  private triggerHeld = false;
  private pressQueued = false;
  private releaseQueued = false;
  /** 切换武器 / 过热后需要松开扳机才能再次开火 */
  private triggerLatched = false;

  // 共享上下文与各武器控制器
  private readonly snapshot = new TargetSnapshotBuffer();
  private snapshotFrame = -1;
  private frame = 0;
  private readonly context: WeaponContext;
  private readonly projectiles: ProjectileController;
  private readonly laser: LaserController;
  private readonly railgun: RailgunController;
  private readonly emp: EmpController;

  // 载机运动估计（让枪口特效跟随飞机）
  private readonly lastMuzzle = new THREE.Vector3();
  private lastMuzzleValid = false;
  private readonly carrySample = new THREE.Vector3();
  private readonly fireFrame: FireFrame = createFireFrame();

  public onFired?: (id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3) => void;
  public onImpact?: (id: SpecialWeaponId, position: THREE.Vector3, scale: number) => void;
  public onEmpPulse?: (center: THREE.Vector3, radius: number, stunSeconds: number) => void;
  public onOverheat?: () => void;
  public onChargeStart?: () => void;
  public onDryFire?: (id: SpecialWeaponId) => void;
  /** 扩展：持续光束停止（松开扳机 / 过热 / 切换武器），用于停止激光循环音 */
  public onBeamEnd?: (id: SpecialWeaponId) => void;

  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null) {
    this.particleSystem = particleSystem;
    this.fx = scene ? new WeaponFx(scene) : null;

    for (const id of SPECIAL_WEAPON_IDS) {
      this.levels.set(id, 0);
    }

    const system = this;
    this.context = {
      fx: this.fx,
      particleSystem: this.particleSystem,
      get surfaceSampler(): SurfaceSampler | null {
        return system.surfaceSampler;
      },
      getSnapshot: () => this.ensureSnapshot(),
      emitFired: (id, position, direction) => this.onFired?.(id, position, direction),
      emitImpact: (id, position, scale) => this.onImpact?.(id, position, scale),
      emitEmpPulse: (center, radius, stunSeconds) => this.onEmpPulse?.(center, radius, stunSeconds),
      emitOverheat: () => {
        // 过热后必须松开扳机才能再次照射
        this.triggerLatched = this.triggerHeld;
        this.onOverheat?.();
      },
      emitBeamEnd: (id) => this.onBeamEnd?.(id),
      emitChargeStart: () => this.onChargeStart?.(),
      emitDryFire: (id) => this.onDryFire?.(id),
      attachFx: () => this.fx?.attach(),
    };
    this.projectiles = new ProjectileController(this.context);
    this.laser = new LaserController(this.context);
    this.railgun = new RailgunController(this.context);
    this.emp = new EmpController(this.context);
  }

  // ---------------------------------------------------------------------------
  // 解锁与选择
  // ---------------------------------------------------------------------------

  /** 设置已解锁武器：按 SPECIAL_WEAPON_IDS 顺序去重；新解锁的武器满弹药；选择不在列表中时选第一件 */
  public setUnlocked(ids: readonly SpecialWeaponId[]): void {
    const wanted = new Set<SpecialWeaponId>();
    for (const id of ids ?? []) {
      if (isSpecialWeaponId(id)) wanted.add(id);
    }
    const next = SPECIAL_WEAPON_IDS.filter((id) => wanted.has(id));

    for (const id of this.unlocked) {
      if (!wanted.has(id)) {
        if (this.selected === id) this.stopActiveWeapon(id, false);
        this.runtimes.delete(id);
      }
    }
    for (const id of next) {
      if (!this.runtimes.has(id)) {
        this.runtimes.set(id, this.createRuntime(id));
      }
    }
    this.unlocked = next;

    if (this.selected === null || !wanted.has(this.selected)) {
      const previous = this.selected;
      this.selected = next.length > 0 ? next[0] : null;
      if (this.selected !== previous) this.latchTrigger();
    }
  }

  public getUnlocked(): SpecialWeaponId[] {
    return [...this.unlocked];
  }

  public isUnlocked(id: SpecialWeaponId): boolean {
    return this.runtimes.has(id);
  }

  public getSelected(): SpecialWeaponId | null {
    return this.selected;
  }

  /** 选择武器；未解锁返回 false */
  public select(id: SpecialWeaponId): boolean {
    if (!isSpecialWeaponId(id) || !this.runtimes.has(id)) {
      return false;
    }
    if (this.selected !== id) {
      if (this.selected) this.stopActiveWeapon(this.selected, true);
      this.selected = id;
      this.latchTrigger();
    }
    return true;
  }

  /** 在已解锁列表中循环切换，返回新的选择 */
  public selectNext(): SpecialWeaponId | null {
    if (this.unlocked.length === 0) {
      return null;
    }
    const index = this.selected ? this.unlocked.indexOf(this.selected) : -1;
    const next = this.unlocked[(index + 1) % this.unlocked.length];
    this.select(next);
    return this.selected;
  }

  /** 按 SPECIAL_WEAPON_IDS 的 0 基序号选择（1-5 数字键 → 0-4）；未解锁返回 false */
  public selectIndex(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= SPECIAL_WEAPON_IDS.length) {
      return false;
    }
    return this.select(SPECIAL_WEAPON_IDS[index]);
  }

  // ---------------------------------------------------------------------------
  // 升级 / 目标 / 地形
  // ---------------------------------------------------------------------------

  /** 设置升级等级（0..5）。弹药上限提高时，原本满弹的武器保持满弹 */
  public setUpgradeLevel(id: SpecialWeaponId, level: number): void {
    if (!isSpecialWeaponId(id)) return;
    const clamped = clampWeaponUpgradeLevel(level);
    this.levels.set(id, clamped);
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    const wasFull = runtime.ammo >= runtime.stats.maxAmmo;
    runtime.level = clamped;
    runtime.stats = getSpecialWeaponStats(id, clamped);
    if (!Number.isFinite(runtime.stats.maxAmmo)) {
      runtime.ammo = Infinity;
    } else if (wasFull || !Number.isFinite(runtime.ammo)) {
      runtime.ammo = runtime.stats.maxAmmo;
    } else {
      runtime.ammo = Math.min(runtime.ammo, runtime.stats.maxAmmo);
    }
  }

  public getUpgradeLevel(id: SpecialWeaponId): number {
    return this.levels.get(id) ?? 0;
  }

  /** 当前（含升级）数值；未解锁的武器按已记录的等级返回 */
  public getStats(id: SpecialWeaponId): SpecialWeaponStats {
    return getSpecialWeaponStats(id, this.getUpgradeLevel(id));
  }

  /** 目标提供者：返回敌方 + 平民 + 友军目标，系统自行过滤 */
  public setTargetProvider(provider: () => readonly CombatTarget[]): void {
    this.targetProvider = typeof provider === 'function' ? provider : null;
  }

  /** 扩展：地表采样（TerrainGenerator.sampleSurface），火箭 / 导弹触地爆炸、光束被地形遮挡 */
  public setSurfaceSampler(sampler: SurfaceSampler | null): void {
    this.surfaceSampler = typeof sampler === 'function' ? sampler : null;
  }

  /** 扩展：特效密度（低画质 0.4 左右，默认 1） */
  public setEffectDensity(density: number): void {
    this.fx?.setDensity(density);
  }

  // ---------------------------------------------------------------------------
  // 扳机
  // ---------------------------------------------------------------------------

  /**
   * salvo / pulse：按下沿开火；beam：按住持续照射；charge：按住蓄力、松开发射
   */
  public setTriggerHeld(held: boolean): void {
    const next = held === true;
    if (next === this.triggerHeld) return;
    this.triggerHeld = next;
    if (next) {
      this.pressQueued = true;
    } else {
      this.releaseQueued = true;
    }
  }

  private latchTrigger(): void {
    this.pressQueued = false;
    this.triggerLatched = this.triggerHeld;
  }

  // ---------------------------------------------------------------------------
  // 运行时
  // ---------------------------------------------------------------------------

  private createRuntime(id: SpecialWeaponId): WeaponRuntime {
    const level = this.levels.get(id) ?? 0;
    const stats = getSpecialWeaponStats(id, level);
    return {
      id,
      level,
      stats,
      ammo: stats.maxAmmo,
      reloadTimer: 0,
      cooldownTimer: 0,
      heat: 0,
      overheated: false,
      charge: 0,
      charging: false,
    };
  }

  /** 扩展：补满所有已解锁武器（关卡开始 / 复活），清空热量与冷却 */
  public refill(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.ammo = runtime.stats.maxAmmo;
      runtime.reloadTimer = 0;
      runtime.cooldownTimer = 0;
      runtime.heat = 0;
      runtime.overheated = false;
    }
  }

  /** 每帧最多抓取一次目标快照（只在真正需要命中判定时调用提供者） */
  private ensureSnapshot(): TargetSnapshotBuffer {
    if (this.snapshotFrame !== this.frame) {
      this.snapshotFrame = this.frame;
      let targets: readonly CombatTarget[] = [];
      if (this.targetProvider) {
        try {
          targets = this.targetProvider() ?? [];
        } catch {
          targets = [];
        }
      }
      this.snapshot.capture(targets);
    }
    return this.snapshot;
  }

  /** 是否正在持续照射（激光） */
  public isBeamActive(): boolean {
    return this.laser.isActive();
  }

  /** 在途弹体数量（火箭 + 微型导弹，含排队待发射的不计） */
  public getActiveProjectileCount(): number {
    return this.projectiles.getActiveCount();
  }

  /** 切换 / 移除武器时停止它的持续动作：激光熄灭、轨道炮蓄力取消 */
  private stopActiveWeapon(id: SpecialWeaponId, emitEvents: boolean): void {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    if (SPECIAL_WEAPON_CONFIGS[id].mode === 'beam') {
      if (emitEvents) this.laser.stop(id);
      else this.laser.reset();
    }
    if (runtime.charging) {
      this.railgun.cancel(runtime, emitEvents);
    }
  }

  // ---------------------------------------------------------------------------
  // 每帧更新
  // ---------------------------------------------------------------------------

  public update(deltaTime: number, muzzle: WeaponMuzzle): void {
    const dt = Number.isFinite(deltaTime) && deltaTime > 0 ? deltaTime : 0;
    this.frame++;
    this.prepareFrame(dt, muzzle);
    this.fx?.update(dt);

    // 1) 弹药装填与冷却（所有已解锁武器后台进行）
    for (const runtime of this.runtimes.values()) {
      runtime.cooldownTimer = Math.max(0, runtime.cooldownTimer - dt);
      const { maxAmmo, reloadTime } = runtime.stats;
      if (!Number.isFinite(maxAmmo)) continue;
      if (runtime.ammo >= maxAmmo) {
        runtime.ammo = maxAmmo;
        runtime.reloadTimer = 0;
        continue;
      }
      runtime.reloadTimer += dt;
      if (reloadTime <= 0) {
        runtime.ammo = maxAmmo;
        runtime.reloadTimer = 0;
        continue;
      }
      while (runtime.reloadTimer >= reloadTime && runtime.ammo < maxAmmo) {
        runtime.reloadTimer -= reloadTime;
        runtime.ammo = Math.min(maxAmmo, runtime.ammo + 1);
      }
      if (runtime.ammo >= maxAmmo) runtime.reloadTimer = 0;
    }

    // 2) 扳机
    if (this.releaseQueued) {
      this.triggerLatched = false;
    }
    if (this.triggerLatched) {
      this.pressQueued = false;
    }
    const selected = this.selected ? this.runtimes.get(this.selected) : undefined;
    const laserRuntime = this.runtimes.get('laser');
    let laserWantsFire = false;

    if (selected) {
      const mode = SPECIAL_WEAPON_CONFIGS[selected.id].mode;
      switch (mode) {
        case 'salvo':
          if (this.pressQueued) this.fireSalvo(selected);
          break;
        case 'pulse':
          if (this.pressQueued) this.firePulse(selected);
          break;
        case 'beam':
          if (this.pressQueued && selected.overheated) {
            this.onDryFire?.(selected.id);
          }
          laserWantsFire =
            !this.triggerLatched && (this.triggerHeld || this.pressQueued) && !selected.overheated;
          break;
        case 'charge':
          this.handleCharge(selected, dt);
          break;
      }
    }

    // 激光每帧推进（未选中时也要散热）
    if (laserRuntime) {
      this.laser.step(
        dt,
        laserRuntime,
        this.fireFrame,
        laserWantsFire && selected === laserRuntime
      );
    }

    this.pressQueued = false;
    this.releaseQueued = false;

    // 3) 在途弹体
    this.projectiles.update(dt, this.fireFrame);
  }

  /** 校验枪口、推算前向与载机速度 */
  private prepareFrame(dt: number, muzzle: WeaponMuzzle): void {
    const frame = this.fireFrame;
    const position = muzzle?.position;
    const quaternion = muzzle?.quaternion;
    frame.valid = false;
    if (!position || !quaternion || !isFiniteVector(position)) {
      this.lastMuzzleValid = false;
      return;
    }
    const { x, y, z, w } = quaternion;
    if (![x, y, z, w].every(Number.isFinite)) {
      this.lastMuzzleValid = false;
      return;
    }
    frame.position.copy(position);
    frame.quaternion.copy(quaternion).normalize();
    frame.forward.set(0, 0, -1).applyQuaternion(frame.quaternion);
    if (!isFiniteVector(frame.forward) || frame.forward.lengthSq() < 1e-8) {
      this.lastMuzzleValid = false;
      return;
    }
    frame.forward.normalize();
    frame.valid = true;

    if (this.lastMuzzleValid && dt > 0) {
      this.carrySample.subVectors(position, this.lastMuzzle).divideScalar(dt);
      if (!isFiniteVector(this.carrySample) || this.carrySample.length() > MAX_CARRY_SPEED) {
        frame.carry.set(0, 0, 0);
      } else {
        frame.carry.lerp(this.carrySample, Math.min(1, dt * 12));
      }
    } else if (!this.lastMuzzleValid) {
      frame.carry.set(0, 0, 0);
    }
    this.lastMuzzle.copy(position);
    this.lastMuzzleValid = true;
  }

  private canFire(runtime: WeaponRuntime): boolean {
    return runtime.ammo >= 1 && runtime.cooldownTimer <= 0;
  }

  private consumeShot(runtime: WeaponRuntime): void {
    if (Number.isFinite(runtime.ammo)) {
      runtime.ammo = Math.max(0, runtime.ammo - 1);
    }
    runtime.cooldownTimer = runtime.stats.cooldown;
  }

  private fireSalvo(runtime: WeaponRuntime): void {
    if (!this.canFire(runtime) || !this.fireFrame.valid) {
      this.onDryFire?.(runtime.id);
      return;
    }
    const id = runtime.id === 'swarm' ? 'swarm' : 'rockets';
    const queued = this.projectiles.fireSalvo(id, runtime, this.fireFrame);
    if (queued > 0) {
      this.consumeShot(runtime);
    } else {
      this.onDryFire?.(runtime.id);
    }
  }

  private firePulse(runtime: WeaponRuntime): void {
    if (!this.canFire(runtime) || !this.fireFrame.valid) {
      this.onDryFire?.(runtime.id);
      return;
    }
    this.consumeShot(runtime);
    this.emp.pulse(runtime, this.fireFrame);
  }

  /** 蓄力武器：按下开始蓄力，按住累积，松开发射（蓄力不足取消） */
  private handleCharge(runtime: WeaponRuntime, dt: number): void {
    if (this.pressQueued && !runtime.charging) {
      if (this.canFire(runtime) && this.fireFrame.valid) {
        this.railgun.begin(runtime);
      } else {
        this.onDryFire?.(runtime.id);
      }
    }
    if (runtime.charging) {
      // 本帧内已松开：按松开前的蓄力发射，不再累积
      if (this.releaseQueued && !this.triggerHeld) {
        if (this.railgun.release(runtime, this.fireFrame)) {
          this.consumeShot(runtime);
        }
      } else {
        this.railgun.updateCharge(dt, runtime, this.fireFrame);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private isReady(runtime: WeaponRuntime): boolean {
    const mode = SPECIAL_WEAPON_CONFIGS[runtime.id].mode;
    if (mode === 'beam') {
      return !runtime.overheated;
    }
    return this.canFire(runtime);
  }

  public getHudState(): WeaponHudState {
    const slots: WeaponHudSlot[] = this.unlocked.map((id) => {
      const config = SPECIAL_WEAPON_CONFIGS[id];
      const runtime = this.runtimes.get(id);
      return {
        id,
        icon: config.icon,
        shortCode: config.shortCode,
        selected: id === this.selected,
        ready: runtime ? this.isReady(runtime) : false,
      };
    });

    const runtime = this.selected ? this.runtimes.get(this.selected) : undefined;
    if (!runtime) {
      return {
        selected: null,
        name: '',
        icon: '',
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
        slots,
      };
    }

    const config = SPECIAL_WEAPON_CONFIGS[runtime.id];
    const { maxAmmo, reloadTime, cooldown } = runtime.stats;
    let reloadProgress = 1;
    if (Number.isFinite(maxAmmo) && runtime.ammo < maxAmmo) {
      reloadProgress = reloadTime > 0 ? clamp01(runtime.reloadTimer / reloadTime) : 1;
    }
    return {
      selected: runtime.id,
      name: config.name,
      icon: config.icon,
      shortCode: config.shortCode,
      mode: config.mode,
      ammo: runtime.ammo,
      maxAmmo,
      reloadProgress,
      heat: clamp01(runtime.heat),
      overheated: runtime.overheated,
      charge: clamp01(runtime.charge),
      cooldown: cooldown > 0 ? clamp01(runtime.cooldownTimer / cooldown) : 0,
      ready: this.isReady(runtime),
      slots,
    };
  }

  // ---------------------------------------------------------------------------
  // 存档
  // ---------------------------------------------------------------------------

  /** 导出：只保存有限弹药（热量武器的 Infinity 不写入，JSON 安全） */
  public exportState(): WeaponSaveState {
    const ammo: Partial<Record<SpecialWeaponId, number>> = {};
    for (const id of this.unlocked) {
      const runtime = this.runtimes.get(id);
      if (runtime && Number.isFinite(runtime.ammo)) {
        ammo[id] = runtime.ammo;
      }
    }
    return { unlocked: [...this.unlocked], selected: this.selected, ammo };
  }

  /**
   * 导入：校验并规范化；缺失 / 非法弹药按满弹处理。会清除在途弹体与蓄力 / 热量状态。
   * 请先 setUpgradeLevel 再 importState（弹药按当前等级的上限钳制）。
   */
  public importState(state: WeaponSaveState): void {
    if (!state || typeof state !== 'object') return;
    this.clear();
    const unlocked = Array.isArray(state.unlocked) ? state.unlocked.filter(isSpecialWeaponId) : [];
    this.setUnlocked(unlocked);

    const ammo: Partial<Record<string, unknown>> =
      state.ammo && typeof state.ammo === 'object' ? state.ammo : {};
    for (const runtime of this.runtimes.values()) {
      const maxAmmo = runtime.stats.maxAmmo;
      const saved = ammo[runtime.id];
      if (!Number.isFinite(maxAmmo)) {
        runtime.ammo = Infinity;
      } else if (typeof saved === 'number' && Number.isFinite(saved)) {
        runtime.ammo = Math.max(0, Math.min(maxAmmo, saved));
      } else {
        runtime.ammo = maxAmmo;
      }
      runtime.reloadTimer = 0;
      runtime.cooldownTimer = 0;
      runtime.heat = 0;
      runtime.overheated = false;
      runtime.charge = 0;
      runtime.charging = false;
    }

    if (isSpecialWeaponId(state.selected) && this.runtimes.has(state.selected)) {
      this.selected = state.selected;
    }
    this.latchTrigger();
  }

  // ---------------------------------------------------------------------------
  // 生命周期
  // ---------------------------------------------------------------------------

  /** 移除在途弹体 / 光束 / 蓄力与所有特效（弹药保留） */
  public clear(): void {
    this.projectiles.clear();
    this.laser.reset();
    for (const runtime of this.runtimes.values()) {
      runtime.charging = false;
      runtime.charge = 0;
    }
    this.fx?.clear();
    this.snapshot.reset();
    this.snapshotFrame = -1;
    this.lastMuzzleValid = false;
    this.fireFrame.carry.set(0, 0, 0);
  }

  public dispose(): void {
    this.clear();
    this.fx?.dispose();
    this.targetProvider = null;
    this.surfaceSampler = null;
    this.onFired = undefined;
    this.onImpact = undefined;
    this.onEmpPulse = undefined;
    this.onOverheat = undefined;
    this.onChargeStart = undefined;
    this.onDryFire = undefined;
    this.onBeamEnd = undefined;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, value));
}
