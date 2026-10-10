import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GAME_CONSTANTS } from '@/config';
import { EventBus } from '@/core/EventBus';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { createEnemyMesh } from '@/features/aircraft/AircraftMeshFactory';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';

/**
 * 玩家导弹的伤害（W6）：单发 80，取自 GAME_CONSTANTS.MISSILE.DAMAGE（CombatSystem 里没有字面量），
 * 一发击落 60 血的侦察机。用真实的 CombatSystem / MissileSystem / EnemyAI，只看命中回调报出的伤害。
 */

interface MissileHit {
  target: THREE.Object3D;
  damage: number;
  source: string;
}

describe('player missile damage', () => {
  let scene: THREE.Scene;
  let particleSystem: ParticleSystem;
  let combatSystem: CombatSystem;
  const originalDamage = GAME_CONSTANTS.MISSILE.DAMAGE;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    particleSystem = new ParticleSystem(scene);
    combatSystem = new CombatSystem(scene, particleSystem, new THREE.Group());
    combatSystem.init();
  });

  afterEach(() => {
    GAME_CONSTANTS.MISSILE.DAMAGE = originalDamage;
    combatSystem.dispose();
    particleSystem.dispose();
    EventBus.clear();
  });

  /** 在目标身边发射一枚玩家导弹，返回本次碰撞结算报出的敌方命中 */
  function missileHitsOn(target: THREE.Object3D): MissileHit[] {
    const hits: MissileHit[] = [];
    const launch = target.position.clone().add(new THREE.Vector3(0, 0, 1.5));
    combatSystem.getMissileSystem().fire(launch, new THREE.Vector3(0, 0, -1), target);
    combatSystem.checkProjectileCollisions(
      [target],
      [],
      (hitTarget, damage, source) => {
        hits.push({ target: hitTarget, damage, source });
      },
      () => {
        throw new Error('the player should not be hit by their own missile');
      },
      () => {
        throw new Error('a friendly should not be hit in this test');
      }
    );
    return hits;
  }

  function plainTarget(): THREE.Object3D {
    const target = new THREE.Object3D();
    target.position.set(40, 300, -200);
    scene.add(target);
    return target;
  }

  it('is 80 in the game constants', () => {
    expect(GAME_CONSTANTS.MISSILE.DAMAGE).toBe(80);
  });

  it('starts the player with 3 missiles and caps the stock at 5', () => {
    expect(GAME_CONSTANTS.MISSILE.STARTING_MISSILES).toBe(3);
    expect(GAME_CONSTANTS.MISSILE.MAX_MISSILES).toBe(5);
    expect(GAME_CONSTANTS.MISSILE.MAX_RESPAWN_MISSILES).toBeLessThanOrEqual(
      GAME_CONSTANTS.MISSILE.MAX_MISSILES
    );
  });

  it('deals 80 to the target a missile reaches, reported as a missile hit', () => {
    const target = plainTarget();

    const hits = missileHitsOn(target);

    expect(hits).toHaveLength(1);
    expect(hits[0].target).toBe(target);
    expect(hits[0].damage).toBe(80);
    expect(hits[0].source).toBe('missile');
  });

  it('reads the damage from GAME_CONSTANTS.MISSILE.DAMAGE rather than a literal', () => {
    GAME_CONSTANTS.MISSILE.DAMAGE = 137;

    const hits = missileHitsOn(plainTarget());

    expect(hits).toHaveLength(1);
    expect(hits[0].damage).toBe(137);
  });

  it.each([
    [1, 80],
    [1.5, 120],
    [2, 160],
  ])('scales with the damage multiplier: x%s gives %s', (multiplier, expected) => {
    combatSystem.setDamageMultiplier(multiplier);

    const hits = missileHitsOn(plainTarget());

    expect(hits).toHaveLength(1);
    expect(hits[0].damage).toBeCloseTo(expected, 9);
  });

  it('deals its damage once per missile', () => {
    const target = plainTarget();

    const first = missileHitsOn(target);
    // 同一枚导弹已经用掉：再结算一次不会再报命中
    const again: MissileHit[] = [];
    combatSystem.checkProjectileCollisions(
      [target],
      [],
      (hitTarget, damage, source) => {
        again.push({ target: hitTarget, damage, source });
      },
      () => undefined,
      () => undefined
    );

    expect(first).toHaveLength(1);
    expect(again).toHaveLength(0);
  });

  describe('against a Scout', () => {
    function scout(): EnemyAI {
      const config = ENEMY_CONFIGS[EnemyType.SCOUT];
      const mesh = createEnemyMesh(config);
      mesh.position.set(0, 300, -250);
      scene.add(mesh);
      return new EnemyAI(mesh, config, scene);
    }

    it('faces a Scout with 60 hit points, the weakest jet', () => {
      const enemy = scout();

      expect(enemy.getHealth()).toEqual({ current: 60, max: 60 });
      const weakest = Math.min(...Object.values(ENEMY_CONFIGS).map((config) => config.health));
      expect(weakest).toBe(60);
    });

    it('kills it with one missile', () => {
      const enemy = scout();
      expect(enemy.isAlive()).toBe(true);

      const hits = missileHitsOn(enemy.getMesh());
      expect(hits).toHaveLength(1);
      enemy.takeDamage(hits[0].damage);

      expect(enemy.isAlive()).toBe(false);
      expect(enemy.getHealth().current).toBe(0);
    });

    it('survived one missile at the previous 50 damage, so the constant is what makes it one', () => {
      // 改动前单发 50：侦察机吃一发还剩 10 血
      GAME_CONSTANTS.MISSILE.DAMAGE = 50;
      const enemy = scout();

      const hits = missileHitsOn(enemy.getMesh());
      enemy.takeDamage(hits[0].damage);

      expect(enemy.isAlive()).toBe(true);
      expect(enemy.getHealth().current).toBe(10);
    });
  });
});
