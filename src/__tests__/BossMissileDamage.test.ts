import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BossHitFeedback } from '@/core/boss/BossHitFeedback';
import type { EnemySystem } from '@/core/systems/EnemySystem';
import type { PlayerSystem } from '@/core/systems/PlayerSystem';
import type { AudioManager } from '@/core/Audio/AudioManager';
import { AbyssalLeviathanAI, createAbyssalLeviathanMesh } from '@/features/boss/AbyssalLeviathanAI';
import { BossAI, createBossMesh } from '@/features/boss/BossAI';
import { BossMissileSystem } from '@/features/boss/BossMissileSystem';
import {
  BOSS_CONFIGS,
  BOSS_MISSILE_CONFIG,
  BossType,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { DesertFortressAI, createDesertFortressMesh } from '@/features/boss/DesertFortressAI';
import { MagmaColossusAI, createMagmaColossusMesh } from '@/features/boss/MagmaColossusAI';
import { MissileDestroyerAI, createMissileDestroyerMesh } from '@/features/boss/MissileDestroyerAI';
import { OraclePrimeAI, createOraclePrimeMesh } from '@/features/boss/OraclePrimeAI';
import { PhantomWingAI, createPhantomWingMesh } from '@/features/boss/PhantomWingAI';
import { SkyCarrierAI, createSkyCarrierMesh } from '@/features/boss/SkyCarrierAI';
import { TempestZeppelinAI, createTempestZeppelinMesh } from '@/features/boss/TempestZeppelinAI';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';

/**
 * Boss 导弹伤害（终验修复第 2 波 G2）：new BossMissileSystem(scene, particles, damage)——命中时把这个
 * 伤害交给 onHit；每个发射导弹的 Boss 都把自己配置的 config.missileDamage 交给导弹系统；
 * Boss 战的命中结算（BossHitFeedback）按导弹系统报告的伤害扣玩家 / 僚机的血。
 * 难度档 → 单发伤害的顺序见 CoordinatorWiring.test.ts。
 */

/** 任意方法都是 vi.fn() 的替身 */
function autoStub<T>(): T {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        let method = methods.get(key);
        if (!method) {
          method = vi.fn();
          methods.set(key, method);
        }
        return method;
      },
    }
  ) as T;
}

/** 在 target 身上发射一枚导弹并做一次命中检测，返回 onHit 收到的伤害 */
function hitDamage(system: BossMissileSystem, scene: THREE.Scene, at: THREE.Vector3): number[] {
  const target = new THREE.Object3D();
  target.position.copy(at).add(new THREE.Vector3(0, 2, 0));
  scene.add(target);
  system.fire(at.clone(), target);
  const damage: number[] = [];
  system.checkCollisions([target], (_hit, amount) => {
    damage.push(amount);
  });
  target.removeFromParent();
  return damage;
}

type BossCtor = new (
  mesh: THREE.Group,
  config: BossConfig,
  scene: THREE.Scene,
  particleSystem: ParticleSystem
) => { getMissileSystem(): BossMissileSystem | null; dispose(): void };

const MISSILE_BOSSES: ReadonlyArray<
  [type: BossType, Ai: BossCtor, createMesh: (config: BossConfig) => THREE.Group]
> = [
  [BossType.HEAVY_BOMBER, BossAI, createBossMesh],
  [BossType.DESERT_FORTRESS, DesertFortressAI, createDesertFortressMesh],
  [BossType.MISSILE_DESTROYER, MissileDestroyerAI, createMissileDestroyerMesh],
  [BossType.SKY_CARRIER, SkyCarrierAI, createSkyCarrierMesh],
  [BossType.MAGMA_COLOSSUS, MagmaColossusAI, createMagmaColossusMesh],
  [BossType.ABYSSAL_LEVIATHAN, AbyssalLeviathanAI, createAbyssalLeviathanMesh],
  [BossType.TEMPEST_ZEPPELIN, TempestZeppelinAI, createTempestZeppelinMesh],
  [BossType.PHANTOM_WING, PhantomWingAI, createPhantomWingMesh],
  [BossType.ORACLE_PRIME, OraclePrimeAI, createOraclePrimeMesh],
];

describe('boss missile damage', () => {
  let scene: THREE.Scene;
  let particles: ParticleSystem;
  /** 只还原本文件的画布替身（全局 setup 里的尾迹替身不能被 restoreAllMocks 清掉） */
  let canvasSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    scene = new THREE.Scene();
    particles = autoStub<ParticleSystem>();
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    canvasSpy?.mockRestore();
    canvasSpy = null;
  });

  describe('BossMissileSystem(scene, particles, damage)', () => {
    it.each([1, 37, 90, 155])('a hit delivers the damage it was built with (%i)', (damage) => {
      const system = new BossMissileSystem(scene, particles, damage);
      expect(hitDamage(system, scene, new THREE.Vector3(0, 100, 0))).toEqual([damage]);
      system.dispose();
    });

    it('defaults to the base boss missile damage', () => {
      const system = new BossMissileSystem(scene, particles);
      expect(hitDamage(system, scene, new THREE.Vector3(5, 80, 5))).toEqual([
        BOSS_MISSILE_CONFIG.DAMAGE,
      ]);
      system.dispose();
    });

    it.each([Number.NaN, Infinity, -10])('falls back to the base damage for %s', (damage) => {
      const system = new BossMissileSystem(scene, particles, damage);
      expect(hitDamage(system, scene, new THREE.Vector3(0, 90, 0))).toEqual([
        BOSS_MISSILE_CONFIG.DAMAGE,
      ]);
      system.dispose();
    });
  });

  describe('each missile-firing boss hands its config.missileDamage to its missiles', () => {
    it('covers every boss that fires missiles', () => {
      const firing = Object.values(BossType).filter((type) => BOSS_CONFIGS[type].missileDamage > 0);
      expect(new Set(MISSILE_BOSSES.map(([type]) => type))).toEqual(new Set(firing));
    });

    it.each(MISSILE_BOSSES)('%s', (type, Ai, createMesh) => {
      const config: BossConfig = { ...BOSS_CONFIGS[type], missileDamage: 77 };
      const mesh = createMesh(config);
      mesh.position.set(0, 160, -300);
      scene.add(mesh);
      const boss = new Ai(mesh, config, scene, particles);
      try {
        const missiles = boss.getMissileSystem();
        expect(missiles).toBeInstanceOf(BossMissileSystem);
        expect(
          hitDamage(missiles as BossMissileSystem, scene, new THREE.Vector3(30, 140, -200))
        ).toEqual([77]);
      } finally {
        boss.dispose();
      }
    });
  });

  describe('BossHitFeedback applies the reported damage', () => {
    function feedbackRig(shield: boolean) {
      const playerAircraft = new THREE.Group();
      playerAircraft.position.set(0, 120, 0);
      scene.add(playerAircraft);
      const friendlyMesh = new THREE.Group();
      friendlyMesh.position.set(300, 120, 0);
      scene.add(friendlyMesh);
      const friendly = { getMesh: () => friendlyMesh, takeDamage: vi.fn() };
      const playerSystem = {
        isShieldActive: () => shield,
        takeCombatDamage: vi.fn(),
      };
      const feedback = new BossHitFeedback({
        particleSystem: particles,
        audioManager: autoStub<AudioManager>(),
        playerSystem: playerSystem as unknown as PlayerSystem,
        playerAircraft,
        enemySystem: { getFriendlyAIs: () => [friendly] } as unknown as EnemySystem,
      });
      return { feedback, playerAircraft, friendlyMesh, friendly, playerSystem };
    }

    it('hits on the player cost exactly the missile damage', () => {
      const rig = feedbackRig(false);
      const system = new BossMissileSystem(scene, particles, 63);
      system.fire(rig.playerAircraft.position.clone(), rig.playerAircraft);
      rig.feedback.checkBossMissileHits(system, [rig.friendlyMesh]);
      expect(rig.playerSystem.takeCombatDamage).toHaveBeenCalledTimes(1);
      expect(rig.playerSystem.takeCombatDamage.mock.calls[0][0]).toBe(63);
      system.dispose();
    });

    it('the shield still blocks the damage', () => {
      const rig = feedbackRig(true);
      const system = new BossMissileSystem(scene, particles, 63);
      system.fire(rig.playerAircraft.position.clone(), rig.playerAircraft);
      rig.feedback.checkBossMissileHits(system, [rig.friendlyMesh]);
      expect(rig.playerSystem.takeCombatDamage).not.toHaveBeenCalled();
      system.dispose();
    });

    it('hits on a wingman cost exactly the missile damage', () => {
      const rig = feedbackRig(false);
      const system = new BossMissileSystem(scene, particles, 41);
      system.fire(rig.friendlyMesh.position.clone(), rig.friendlyMesh);
      rig.feedback.checkBossMissileHits(system, [rig.friendlyMesh]);
      expect(rig.friendly.takeDamage).toHaveBeenCalledWith(41);
      expect(rig.playerSystem.takeCombatDamage).not.toHaveBeenCalled();
      system.dispose();
    });
  });
});
