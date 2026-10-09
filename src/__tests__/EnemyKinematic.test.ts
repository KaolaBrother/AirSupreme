import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyAI } from '@/features/enemy/EnemyAI';
import { ENEMY_CONFIGS, EnemyType } from '@/features/enemy/EnemyTypes';
import { FriendlyAI } from '@/features/enemy/FriendlyAI';

/**
 * EnemyAI.updateKinematic(dt)（终验修复第 2 波 G2）：调用方写好 velocity 后，按速度积分位置、
 * 把机头转向速度方向（四元数），并照常记录渲染插值状态；不运行机动状态机、不开火。
 * 僚机编队飞行改用它（替代 applyStun 的权宜做法），FriendlyAI 的公开接口不变。
 */

interface EnemyAIInternals {
  currentState: unknown;
  stateTimer: number;
}

function internals(enemy: EnemyAI): EnemyAIInternals {
  return enemy as unknown as EnemyAIInternals;
}

/** 机体本地 +Z 为机头（EnemyAI 以 lookAt 速度方向定姿） */
function noseOf(mesh: THREE.Object3D): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
}

describe('EnemyAI.updateKinematic', () => {
  let scene: THREE.Scene;
  let mesh: THREE.Group;
  let enemy: EnemyAI;
  let randomSpy: { mockRestore(): void; mock: { calls: unknown[] } } | null = null;

  beforeEach(() => {
    scene = new THREE.Scene();
    mesh = new THREE.Group();
    mesh.position.set(10, 120, -40);
    scene.add(mesh);
    enemy = new EnemyAI(mesh, ENEMY_CONFIGS[EnemyType.FIGHTER], scene);
  });

  afterEach(() => {
    randomSpy?.mockRestore();
    randomSpy = null;
    enemy.dispose();
  });

  it('integrates the position from the current velocity', () => {
    enemy.velocity.set(30, 4, -40);
    const start = mesh.position.clone();
    enemy.updateKinematic(0.1);
    expect(mesh.position.x).toBeCloseTo(start.x + 3, 6);
    expect(mesh.position.y).toBeCloseTo(start.y + 0.4, 6);
    expect(mesh.position.z).toBeCloseTo(start.z - 4, 6);

    for (let i = 0; i < 9; i++) enemy.updateKinematic(0.1);
    expect(mesh.position.distanceTo(start)).toBeCloseTo(enemy.velocity.length(), 4);
  });

  it('turns the nose toward the velocity (quaternion, smoothly)', () => {
    enemy.velocity.set(-50, 0, 10);
    const direction = enemy.velocity.clone().normalize();
    const before = noseOf(mesh).dot(direction);
    enemy.updateKinematic(1 / 30);
    const afterOne = noseOf(mesh).dot(direction);
    expect(afterOne).toBeGreaterThan(before);
    for (let i = 0; i < 40; i++) enemy.updateKinematic(1 / 30);
    expect(noseOf(mesh).dot(direction)).toBeGreaterThan(0.999);
    expect(Math.abs(mesh.quaternion.length() - 1)).toBeLessThan(1e-6);
  });

  it('records the render interpolation like update() does', () => {
    enemy.velocity.set(0, 0, -60);
    enemy.updateKinematic(0.1);
    const previous = mesh.position.clone();
    enemy.updateKinematic(0.1);
    const current = mesh.position.clone();

    enemy.applyInterpolatedVisual(0);
    expect(mesh.position.distanceTo(previous)).toBeLessThan(1e-9);
    enemy.applyInterpolatedVisual(0.5);
    expect(mesh.position.distanceTo(previous.clone().lerp(current, 0.5))).toBeLessThan(1e-9);
    enemy.restoreCurrentVisual();
    expect(mesh.position.distanceTo(current)).toBeLessThan(1e-9);
  });

  it('leaves the manoeuvre state and its timer alone, however long it runs', () => {
    randomSpy = vi.spyOn(Math, 'random') as unknown as typeof randomSpy;
    const state = internals(enemy).currentState;
    const timer = internals(enemy).stateTimer;
    enemy.velocity.set(20, 0, -50);
    for (let i = 0; i < 3600; i++) enemy.updateKinematic(1 / 30);

    expect(internals(enemy).currentState).toBe(state);
    expect(internals(enemy).stateTimer).toBe(timer);
    expect(randomSpy?.mock.calls.length, 'no new manoeuvre was rolled').toBe(0);
  });

  it('never fires, while update() with a target dead ahead does', () => {
    const onFire = vi.fn();
    enemy.onFire = onFire;
    enemy.velocity.set(0, 0, -55);
    const target = mesh.position.clone().add(new THREE.Vector3(0, 0, -150));
    for (let i = 0; i < 300; i++) enemy.updateKinematic(1 / 30);
    expect(onFire).not.toHaveBeenCalled();

    // 对照：常规 update 在射界内会开火
    for (let i = 0; i < 300 && onFire.mock.calls.length === 0; i++) {
      target.copy(mesh.position).addScaledVector(enemy.velocity.clone().normalize(), 150);
      enemy.update(1 / 30, target, undefined, target);
    }
    expect(onFire).toHaveBeenCalled();
  });

  it('keeps the position finite when handed a non-finite velocity', () => {
    enemy.velocity.set(Number.NaN, 0, Infinity);
    for (let i = 0; i < 10; i++) enemy.updateKinematic(0.1);
    for (const value of mesh.position.toArray()) expect(Number.isFinite(value)).toBe(true);
    for (const value of enemy.velocity.toArray()) expect(Number.isFinite(value)).toBe(true);
  });
});

/** FriendlyAI 的公开接口（第 2 波不变）：编译期 + 运行期检查 */
interface FriendlyAIPublicApi {
  isFriendly: boolean;
  update(
    deltaTime: number,
    enemyMeshes: readonly THREE.Object3D[],
    playerPosition: THREE.Vector3,
    playerVelocity?: THREE.Vector3
  ): void;
  setFormationSlot(slot: number): void;
  getFormationSlot(): number;
  getMesh(): THREE.Group;
  getEnemy(): EnemyAI;
  isAlive(): boolean;
  getHealth(): { current: number; max: number };
  takeDamage(damage: number): void;
  dispose(): void;
}

describe('FriendlyAI public API (unchanged)', () => {
  it('keeps its methods and signatures', () => {
    const scene = new THREE.Scene();
    const friendly = new FriendlyAI(new THREE.Group(), ENEMY_CONFIGS[EnemyType.FIGHTER], scene);
    try {
      const api: FriendlyAIPublicApi = friendly;
      expect(api.isFriendly).toBe(true);
      for (const method of [
        'update',
        'setFormationSlot',
        'getFormationSlot',
        'getMesh',
        'getEnemy',
        'isAlive',
        'getHealth',
        'takeDamage',
        'dispose',
      ] as const) {
        expect(typeof api[method], method).toBe('function');
      }
      expect(api.getEnemy()).toBeInstanceOf(EnemyAI);
    } finally {
      friendly.dispose();
    }
  });

  it('flies idle formation through the kinematic step (no manoeuvre rolls, no fire)', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Group();
    mesh.position.set(-40, 110, 20);
    const friendly = new FriendlyAI(mesh, ENEMY_CONFIGS[EnemyType.FIGHTER], scene);
    const kinematic = vi.spyOn(friendly.getEnemy(), 'updateKinematic');
    const regular = vi.spyOn(friendly.getEnemy(), 'update');
    const onFire = vi.fn();
    friendly.getEnemy().onFire = onFire;
    try {
      const player = new THREE.Vector3(0, 100, 0);
      const velocity = new THREE.Vector3(0, 0, -45);
      for (let i = 0; i < 90; i++) {
        player.addScaledVector(velocity, 1 / 30);
        friendly.update(1 / 30, [], player, velocity);
      }
      expect(kinematic).toHaveBeenCalledTimes(90);
      expect(regular).not.toHaveBeenCalled();
      expect(onFire).not.toHaveBeenCalled();
    } finally {
      kinematic.mockRestore();
      regular.mockRestore();
      friendly.dispose();
    }
  });
});
