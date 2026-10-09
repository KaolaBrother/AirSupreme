import type { Object3D, Vector3 } from 'three';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { BossMissileSystem } from '@/features/boss/BossMissileSystem';

export type BossHitProfile = 'player' | 'enemy' | 'boss';
export type BossHeavyImpactProfile = 'boss-cannon' | 'laser' | 'flak-hit' | 'boss-armor';

export interface BossHitFeedbackDeps {
  particleSystem: ParticleSystem;
  audioManager: AudioManager;
  playerSystem: PlayerSystem;
  playerAircraft: Object3D;
  enemySystem: EnemySystem;
}

/**
 * Boss 战通用的命中反馈与 Boss 导弹命中结算（第 1-5 关与第 6-10 关 Boss 共用）：
 * 粒子 + 音效分层（重武器冲击 / 命中层 / 装甲火花），以及 Boss 导弹击中玩家或僚机。
 */
export class BossHitFeedback {
  /** Boss 导弹的命中候选（玩家 + 僚机），逐帧复用 */
  private readonly missileTargets: Object3D[] = [];

  constructor(private readonly deps: BossHitFeedbackDeps) {}

  public createDamageFeedback(
    position: Vector3,
    intensity: number = 1,
    profile: BossHitProfile = 'boss',
    hitTone: 'bullet' | 'missile' | 'heavy' | 'flak' | 'environment' = 'bullet'
  ): void {
    this.deps.particleSystem.createHit(position, intensity, profile);
    this.deps.audioManager.playHit(intensity, profile, hitTone);
  }

  public createHeavyDamageFeedback(
    position: Vector3,
    intensity: number = 1,
    profile: BossHeavyImpactProfile = 'boss-cannon'
  ): void {
    const clampedIntensity = Math.max(0.75, Math.min(2.2, intensity));
    this.deps.particleSystem.createHeavyWeaponImpact(position, clampedIntensity, profile);
    this.deps.audioManager.playHeavyWeaponImpact(profile, clampedIntensity);
  }

  public createWeaponHitFeedback(
    position: Vector3,
    heavyIntensity: number,
    weaponProfile: BossHeavyImpactProfile,
    hitIntensity: number,
    hitProfile: BossHitProfile
  ): void {
    this.createHeavyDamageFeedback(position, heavyIntensity, weaponProfile);
    const hitTone =
      weaponProfile === 'flak-hit' ? 'flak' : weaponProfile === 'laser' ? 'bullet' : 'heavy';
    this.createDamageFeedback(position, hitIntensity, hitProfile, hitTone);
  }

  public createArmorHitFeedback(
    position: Vector3,
    heavyIntensity: number,
    withHitLayer: boolean = false
  ): void {
    this.createHeavyDamageFeedback(position, heavyIntensity, 'boss-armor');
    if (withHitLayer) {
      this.createDamageFeedback(position, Math.max(0.9, heavyIntensity * 0.86), 'boss', 'heavy');
    }
  }

  public createBossMissileDestroyedFeedback(
    position: Vector3,
    scale: number,
    sourceProfile: BossHitProfile = 'enemy'
  ): void {
    const worldPos = position.clone();
    this.deps.particleSystem.createBossMissileExplosion(worldPos, scale);
    this.deps.audioManager.playMissileExplosion(sourceProfile);
    this.createHeavyDamageFeedback(worldPos, Math.max(0.78, scale), 'boss-cannon');
  }

  public getTargetHitProfile(target: Object3D): 'player' | 'enemy' {
    return target === this.deps.playerAircraft ? 'player' : 'enemy';
  }

  /**
   * Boss 导弹命中玩家（护盾时只有特效）或友军僚机。伤害取导弹系统报告的单发伤害
   * （Boss 配置的 missileDamage，已按难度调整）。
   */
  public checkBossMissileHits(
    bossMissileSystem: BossMissileSystem | null,
    friendlyMeshes: readonly Object3D[]
  ): void {
    if (!bossMissileSystem) {
      return;
    }

    const { playerAircraft, playerSystem, enemySystem } = this.deps;
    const targets = this.missileTargets;
    targets.length = 0;
    targets.push(playerAircraft);
    for (const mesh of friendlyMeshes) targets.push(mesh);
    bossMissileSystem.checkCollisions(targets, (target: Object3D, damage: number) => {
      const isPlayerTarget = target === playerAircraft;
      const hitProfile: BossHitProfile = isPlayerTarget ? 'player' : 'enemy';

      this.deps.particleSystem.createBossMissileExplosion(target.position.clone(), 1.15);
      this.deps.audioManager.playMissileExplosion(isPlayerTarget ? 'player' : 'enemy');
      this.createWeaponHitFeedback(
        target.position,
        isPlayerTarget ? 1.22 : 0.98,
        'boss-cannon',
        isPlayerTarget ? 0.96 : 0.82,
        hitProfile
      );
      if (isPlayerTarget) {
        if (!playerSystem.isShieldActive()) {
          playerSystem.takeCombatDamage(damage, { suppressDefaultFeedback: true });
        }
        return;
      }

      const friendly = enemySystem
        .getFriendlyAIs()
        .find((candidate) => candidate.getMesh() === target);
      friendly?.takeDamage(damage);
    });
  }
}
