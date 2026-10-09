import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameCoordinator } from '@/core/GameCoordinator';
import { GameSessionState } from '@/core/GameSessionState';
import {
  BOSS_CONFIGS,
  BossType,
  EYE_CONFIG,
  FLAK_CANNON_CONFIG,
  type BossConfig,
} from '@/features/boss/BossTypes';
import { DesertFortressAI, createDesertFortressMesh } from '@/features/boss/DesertFortressAI';
import { EyeSystem } from '@/features/boss/EyeSystem';
import { FlakCannonSystem } from '@/features/boss/FlakCannonSystem';
import { MissileDestroyerAI, createMissileDestroyerMesh } from '@/features/boss/MissileDestroyerAI';
import { OctopusWarshipAI, createOctopusWarshipMesh } from '@/features/boss/OctopusWarshipAI';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';

/**
 * 高炮 / 眼睛光弹伤害随难度（打磨批次 P）：FlakCannonSystem(…, damage) 与 EyeSystem(scene, damage)
 * 用传入的伤害；第 2、4 关 Boss 把 config.damage 交给高炮，第 3 关把 config.eyeDamage 交给眼睛；
 * Boss 战按难度档缩放这些基础值——Very Easy < Normal < Expert，“普通”档仍是 15 / 20。
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

/** 发射一发高炮弹并立即引爆，返回 onExplode 与 AOE 命中收到的伤害 */
function flakDamage(system: FlakCannonSystem, scene: THREE.Scene, explode: number[]): number[] {
  const target = new THREE.Object3D();
  target.position.set(0, 100, -200);
  scene.add(target);
  system.fire(new THREE.Vector3(0, 0, 0), target.position.clone());
  system.forceExplodeAll();
  const hits: number[] = [];
  // 高炮弹在目标附近引爆：目标在爆炸半径内
  system.checkAoeCollisions([target], (_hit, damage) => hits.push(damage));
  target.removeFromParent();
  expect(explode.length, 'exploded').toBeGreaterThan(0);
  return hits;
}

/** 让眼睛开火一轮，返回 onFire 收到的伤害 */
function eyeShots(system: EyeSystem, bossMesh: THREE.Group): number[] {
  const shots: number[] = [];
  system.onFire = (_position, _direction, damage) => shots.push(damage);
  system.update(EYE_CONFIG.FIRE_INTERVAL + 0.1, bossMesh.position, new THREE.Vector3(0, 120, 200));
  return shots;
}

describe('flak and eye damage', () => {
  let scene: THREE.Scene;
  let canvasSpy: { mockRestore(): void } | null = null;

  beforeEach(() => {
    scene = new THREE.Scene();
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    canvasSpy?.mockRestore();
    canvasSpy = null;
  });

  describe('FlakCannonSystem(scene, radius, onExplode, damage)', () => {
    it.each([7, 15, 23.5])('a shell explodes for the damage it was built with (%s)', (damage) => {
      const explode: number[] = [];
      const system = new FlakCannonSystem(
        scene,
        FLAK_CANNON_CONFIG.AOE_RADIUS,
        (_p, _r, d) => {
          explode.push(d);
        },
        damage
      );
      const hits = flakDamage(system, scene, explode);
      expect(explode).toEqual([damage]);
      expect(hits).toEqual([damage]);
      system.dispose();
    });

    it.each([undefined, Number.NaN, -3])('defaults to FLAK_CANNON_CONFIG.DAMAGE (%s)', (damage) => {
      const explode: number[] = [];
      const system = new FlakCannonSystem(
        scene,
        FLAK_CANNON_CONFIG.AOE_RADIUS,
        (_p, _r, d) => explode.push(d),
        damage as number
      );
      flakDamage(system, scene, explode);
      expect(explode).toEqual([FLAK_CANNON_CONFIG.DAMAGE]);
      system.dispose();
    });
  });

  describe('EyeSystem(scene, damage)', () => {
    function eyes(damage?: number): { system: EyeSystem; mesh: THREE.Group } {
      const mesh = new THREE.Group();
      mesh.position.set(0, 120, 0);
      scene.add(mesh);
      const system = damage === undefined ? new EyeSystem(scene) : new EyeSystem(scene, damage);
      system.createEyes(mesh);
      mesh.updateMatrixWorld(true);
      return { system, mesh };
    }

    it.each([9, 20, 31])('every eye bolt deals the damage it was built with (%i)', (damage) => {
      const { system, mesh } = eyes(damage);
      expect(system.getDamage()).toBe(damage);
      const shots = eyeShots(system, mesh);
      expect(shots.length).toBeGreaterThan(0);
      expect(new Set(shots)).toEqual(new Set([damage]));
      system.dispose();
    });

    it('defaults to EYE_CONFIG.DAMAGE', () => {
      const { system } = eyes();
      expect(system.getDamage()).toBe(EYE_CONFIG.DAMAGE);
      system.dispose();
    });
  });

  describe('the bosses hand their config damage to these systems', () => {
    const particles = (): ParticleSystem => autoStub<ParticleSystem>();

    it.each<
      [
        BossType,
        typeof DesertFortressAI | typeof MissileDestroyerAI,
        (c: BossConfig) => THREE.Group,
      ]
    >([
      [BossType.DESERT_FORTRESS, DesertFortressAI, createDesertFortressMesh],
      [BossType.MISSILE_DESTROYER, MissileDestroyerAI, createMissileDestroyerMesh],
    ])('%s: flak shells use config.damage', (type, Ai, createMesh) => {
      const config: BossConfig = { ...BOSS_CONFIGS[type], damage: 33 };
      const mesh = createMesh(config);
      scene.add(mesh);
      const boss = new Ai(mesh, config, scene, particles());
      const explode: number[] = [];
      boss.onFlakExplode = (_p, _r, damage) => explode.push(damage);
      try {
        const flak = boss.getFlakCannonSystem();
        flakDamage(flak, scene, explode);
        expect(explode).toEqual([33]);
      } finally {
        boss.dispose();
      }
    });

    it('OCTOPUS_WARSHIP: eye bolts use config.eyeDamage', () => {
      const config: BossConfig = { ...BOSS_CONFIGS[BossType.OCTOPUS_WARSHIP], eyeDamage: 44 };
      const mesh = createOctopusWarshipMesh(config);
      scene.add(mesh);
      const boss = new OctopusWarshipAI(mesh, config, particles());
      boss.init();
      try {
        expect(boss.getEyeDamage()).toBe(44);
        mesh.updateMatrixWorld(true);
        const shots = eyeShots(boss.getEyeSystem(), mesh);
        expect(shots.length).toBeGreaterThan(0);
        expect(new Set(shots)).toEqual(new Set([44]));
      } finally {
        boss.dispose();
      }
    });
  });

  describe('difficulty scaling in the boss fight (GameCoordinator.getAdjustedBossConfig)', () => {
    function adjusted(type: BossType, difficulty: number): BossConfig {
      const session = new GameSessionState();
      session.setDifficulty(difficulty);
      session.setLevel(
        type === BossType.DESERT_FORTRESS ? 2 : type === BossType.OCTOPUS_WARSHIP ? 3 : 4
      );
      const coordinator = Object.create(GameCoordinator.prototype) as Record<string, unknown>;
      coordinator.sessionState = session;
      const method = (GameCoordinator.prototype as unknown as Record<string, unknown>)
        .getAdjustedBossConfig as (config: BossConfig) => BossConfig;
      return method.call(coordinator, BOSS_CONFIGS[type]);
    }

    it.each([BossType.DESERT_FORTRESS, BossType.MISSILE_DESTROYER])(
      '%s flak: Very Easy < Normal < Expert, and 15 on Normal',
      (type) => {
        const [veryEasy, normal, expert] = [1, 3, 5].map((tier) => adjusted(type, tier).damage);
        expect(veryEasy).toBeLessThan(normal);
        expect(normal).toBeLessThan(expert);
        expect(normal).toBe(15);
      }
    );

    it('OCTOPUS_WARSHIP eye bolts: Very Easy < Normal < Expert, and 20 on Normal', () => {
      const [veryEasy, normal, expert] = [1, 3, 5].map(
        (tier) => adjusted(BossType.OCTOPUS_WARSHIP, tier).eyeDamage as number
      );
      expect(veryEasy).toBeLessThan(normal);
      expect(normal).toBeLessThan(expert);
      expect(normal).toBe(20);
    });
  });
});
