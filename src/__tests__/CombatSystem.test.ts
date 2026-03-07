import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

describe('CombatSystem', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('should use PLAYER_FIRED payload damage for projectile collisions', () => {
    const scene = new THREE.Scene();
    const particleSystem = new ParticleSystem(scene);
    const playerMesh = new THREE.Group();
    const combatSystem = new CombatSystem(scene, particleSystem, playerMesh);
    combatSystem.init();

    const enemyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial()
    );
    enemyMesh.position.set(0, 0, 0);
    scene.add(enemyMesh);

    EventBus.emit(GameEventType.PLAYER_FIRED, {
      position: new THREE.Vector3(0, 0, 0),
      direction: new THREE.Vector3(0, 0, -1),
      damage: 21,
    });

    let hitDamage = 0;
    combatSystem.checkProjectileCollisions(
      [enemyMesh],
      [],
      (_target, damage) => {
        hitDamage = damage;
      },
      () => {
        throw new Error('Player should not be hit in this test');
      },
      () => {
        throw new Error('Friendly should not be hit in this test');
      }
    );

    expect(hitDamage).toBe(21);

    combatSystem.dispose();
    particleSystem.dispose();
    scene.remove(enemyMesh);
    enemyMesh.geometry.dispose();
    (enemyMesh.material as THREE.Material).dispose();
  });
});
