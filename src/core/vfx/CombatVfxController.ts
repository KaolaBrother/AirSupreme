import * as THREE from 'three';
import type { PlayerViewController } from '@/core/camera/PlayerViewController';
import type { SpecialWeaponsController } from '@/core/combat/SpecialWeaponsController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { ScreenEffectsInput } from '@/features/effects/postfx/ScreenEffectsState';
import type { EnemyAI } from '@/features/enemy/EnemyAI';
import { ContrailController } from './ContrailController';

export interface CombatVfxDeps {
  scene: THREE.Scene;
  setScreenEffects(effects: ScreenEffectsInput): void;
  view: PlayerViewController;
  weapons: SpecialWeaponsController;
  getParticleSystem(): ParticleSystem | null;
  playerAircraft: THREE.Object3D;
}

/** 受损冒烟的发射间隔（秒，约 7 Hz） */
const DAMAGE_SMOKE_INTERVAL = 0.14;
/** 远处敌方枪口焰不绘制（米），节省粒子预算 */
const REMOTE_MUZZLE_RANGE = 450;
/** 特效密度刷新间隔（秒）：粒子预算随画质预设 / 自动降级变化 */
const DENSITY_POLL_INTERVAL = 2;

/**
 * 战斗视觉反馈（VFX 批次的接线）：
 * - 屏幕效果：低血量暗角（随血量）、加力速度线；受击 / 闪白 / EMP 由事件处直接触发；
 * - 受损冒烟：玩家与残血敌机（ParticleSystem.createDamageSmoke）；
 * - 翼尖尾迹：玩家常驻，敌机与僚机按存活列表对账；
 * - 枪口焰 / 拾取爆闪等一次性特效；
 * - 特殊武器特效密度 ← 粒子预算（getBudget，随画质预设）。
 */
export class CombatVfxController {
  private readonly contrails = new ContrailController();
  private readonly contrailTargets: THREE.Object3D[] = [];
  private readonly smokePosition = new THREE.Vector3();
  private readonly muzzleDirection = new THREE.Vector3();
  private readonly screenLevels: { lowHealth: number; speed: number } = {
    lowHealth: 0,
    speed: 0,
  };
  private damageSmokeTimer = 0;
  private densityPollTimer = 0;

  constructor(private readonly deps: CombatVfxDeps) {}

  /** 尾迹系统按需加载（移动端拖尾池更小） */
  public ensureLoaded(maxTrails: number): Promise<void> {
    return this.contrails.ensureLoaded(this.deps.scene, maxTrails).then(() => {
      this.contrails.attachPlayer(this.deps.playerAircraft);
    });
  }

  /** 粒子预算 → 特效密度：性能档约 0.45，平衡约 0.65，画质 1 */
  public computeEffectDensity(): number {
    const particles = this.deps.getParticleSystem();
    if (!particles) return 1;
    return THREE.MathUtils.clamp(particles.getBudget() / 3000, 0.35, 1);
  }

  /**
   * 模拟步长：屏幕效果、受损冒烟、尾迹对账与加力增强、特效密度刷新。
   * enemyMeshes / friendlyMeshes 为协调器复用的存活列表。
   */
  public update(
    deltaTime: number,
    healthPercent: number,
    enemies: readonly EnemyAI[],
    enemyMeshes: readonly THREE.Object3D[],
    friendlyMeshes: readonly THREE.Object3D[]
  ): void {
    const player = this.deps.playerAircraft;
    const flight = this.deps.view.getFlightState();
    // 复用同一个输入对象（逐帧调用，不分配）
    const levels = this.screenLevels;
    levels.lowHealth = player.visible && healthPercent < 0.35 ? (0.35 - healthPercent) / 0.35 : 0;
    levels.speed = flight.boosting ? 0.35 + 0.65 * flight.speedRatio : 0;
    this.deps.setScreenEffects(levels);

    const particles = this.deps.getParticleSystem();
    this.damageSmokeTimer -= deltaTime;
    if (particles && this.damageSmokeTimer <= 0) {
      this.damageSmokeTimer = DAMAGE_SMOKE_INTERVAL;
      if (player.visible && healthPercent < 0.4) {
        // 发动机舱附近冒烟（机体局部 +Z 为机尾）
        this.smokePosition.set(0, 0.2, 1.6).applyQuaternion(player.quaternion).add(player.position);
        particles.createDamageSmoke(this.smokePosition, 1 - healthPercent / 0.4);
      }
      for (const enemy of enemies) {
        if (!enemy.isAlive()) continue;
        const health = enemy.getHealth();
        if (health.max > 0 && health.current / health.max < 0.4) {
          particles.createDamageSmoke(enemy.getMesh().position, 0.6);
        }
      }
    }

    const targets = this.contrailTargets;
    targets.length = 0;
    for (const mesh of enemyMeshes) targets.push(mesh);
    for (const mesh of friendlyMeshes) targets.push(mesh);
    this.contrails.sync(targets, deltaTime);
    this.contrails.setPlayerBoost(flight.boosting ? 0.6 + 0.4 * flight.speedRatio : 0);

    this.densityPollTimer -= deltaTime;
    if (particles && this.densityPollTimer <= 0) {
      this.densityPollTimer = DENSITY_POLL_INTERVAL;
      this.deps.weapons.setEffectDensity(this.computeEffectDensity());
    }
  }

  /** 渲染帧：尾迹按插值后的机体位置采样（平滑） */
  public renderUpdate(renderDeltaTime: number): void {
    this.contrails.update(renderDeltaTime);
  }

  /** 敌方 / 友军开火的枪口焰（只在玩家附近绘制） */
  public muzzleFlashNear(position: THREE.Vector3, direction: THREE.Vector3): void {
    const particles = this.deps.getParticleSystem();
    const player = this.deps.playerAircraft;
    if (
      !particles ||
      position.distanceToSquared(player.position) > REMOTE_MUZZLE_RANGE * REMOTE_MUZZLE_RANGE
    ) {
      return;
    }
    this.muzzleDirection.copy(direction);
    if (this.muzzleDirection.lengthSq() < 1e-6) return;
    this.muzzleDirection.normalize();
    particles.createMuzzleFlash(position, this.muzzleDirection, 0.45);
  }

  /** 气球道具被击破：在气球处拾取爆闪 */
  public pickupBurstAt(balloon: unknown): void {
    const candidate = balloon as { getMesh?: () => THREE.Object3D } | null;
    if (!candidate || typeof candidate.getMesh !== 'function') return;
    this.deps.getParticleSystem()?.createPickupBurst(candidate.getMesh().position);
  }

  /** 换关：解除所有非玩家尾迹 */
  public detachAllTrails(): void {
    this.contrails.detachAll();
  }

  /** 玩家瞬移（关卡出生点 / 读档）后清空拖尾 */
  public clearTrails(): void {
    this.contrails.clearTrails();
  }

  public dispose(): void {
    this.contrails.dispose();
    this.contrailTargets.length = 0;
  }
}
