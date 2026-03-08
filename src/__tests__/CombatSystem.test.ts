import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { EventBus, GameEventType } from '@/core/EventBus';
import { Faction } from '@/core/Faction';
import { ParticleSystem } from '@/features/effects/ParticleSystem';

describe('CombatSystem', () => {
  beforeEach(() => {
    EventBus.clear();
  });

  it('should use PLAYER_FIRED payload damage and player source for projectile collisions', () => {
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
    let hitSource = '';
    combatSystem.checkProjectileCollisions(
      [enemyMesh],
      [],
      (_target, damage, source) => {
        hitDamage = damage;
        hitSource = source;
      },
      () => {
        throw new Error('Player should not be hit in this test');
      },
      () => {
        throw new Error('Friendly should not be hit in this test');
      }
    );

    expect(hitDamage).toBe(21);
    expect(hitSource).toBe('player-bullet');

    combatSystem.dispose();
    particleSystem.dispose();
    scene.remove(enemyMesh);
    enemyMesh.geometry.dispose();
    (enemyMesh.material as THREE.Material).dispose();
  });

  it('should expose enemy, friendly, and boss projectile sources through collision callbacks', () => {
    const scene = new THREE.Scene();
    const particleSystem = new ParticleSystem(scene);
    const playerMesh = new THREE.Group();
    const combatSystem = new CombatSystem(scene, particleSystem, playerMesh);
    combatSystem.init();

    const enemyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial()
    );
    const friendlyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial()
    );
    scene.add(enemyMesh, friendlyMesh);

    const enemySources: string[] = [];
    const playerSources: string[] = [];
    const friendlySources: string[] = [];

    enemyMesh.position.set(0, 0, 0);
    playerMesh.position.set(100, 0, 0);
    friendlyMesh.position.set(200, 0, 0);
    EventBus.emit(GameEventType.FRIENDLY_FIRED, {
      position: enemyMesh.position.clone(),
      direction: new THREE.Vector3(0, 0, -1),
      damage: 8,
      faction: Faction.FRIENDLY,
    });
    combatSystem.checkProjectileCollisions(
      [enemyMesh],
      [friendlyMesh],
      (_target, _damage, source) => enemySources.push(source),
      (_damage, source) => playerSources.push(source),
      (_target, _damage, source) => friendlySources.push(source)
    );

    enemyMesh.position.set(200, 0, 0);
    playerMesh.position.set(0, 0, 0);
    friendlyMesh.position.set(300, 0, 0);
    EventBus.emit(GameEventType.ENEMY_FIRED, {
      position: playerMesh.position.clone(),
      direction: new THREE.Vector3(0, 0, -1),
      damage: 9,
      faction: Faction.ENEMY,
    });
    combatSystem.checkProjectileCollisions(
      [enemyMesh],
      [friendlyMesh],
      (_target, _damage, source) => enemySources.push(source),
      (_damage, source) => playerSources.push(source),
      (_target, _damage, source) => friendlySources.push(source)
    );

    playerMesh.position.set(300, 0, 0);
    friendlyMesh.position.set(0, 0, 0);
    enemyMesh.position.set(200, 0, 0);
    combatSystem
      .getBossProjectilePool()
      .fire(friendlyMesh.position.clone(), new THREE.Vector3(0, 0, -1), 18, undefined, Faction.ENEMY);
    combatSystem.checkProjectileCollisions(
      [enemyMesh],
      [friendlyMesh],
      (_target, _damage, source) => enemySources.push(source),
      (_damage, source) => playerSources.push(source),
      (_target, _damage, source) => friendlySources.push(source)
    );

    expect(enemySources).toContain('friendly-bullet');
    expect(playerSources).toContain('enemy-bullet');
    expect(friendlySources).toContain('boss-projectile');

    combatSystem.dispose();
    particleSystem.dispose();
    enemyMesh.geometry.dispose();
    friendlyMesh.geometry.dispose();
    (enemyMesh.material as THREE.Material).dispose();
    (friendlyMesh.material as THREE.Material).dispose();
  });
});
