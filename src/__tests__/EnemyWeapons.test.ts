import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { GameConfig } from '@/config';
import { EventBus, GameEventType } from '@/core/EventBus';
import { Faction } from '@/core/Faction';
import { CombatSystem } from '@/core/systems/CombatSystem';
import { ProjectilePool } from '@/features/combat/ProjectilePool';
import { ParticleSystem } from '@/features/effects/ParticleSystem';
import { EnemyType } from '@/features/enemy/EnemyTypes';
import type { EnemyWeaponKind } from '@/features/enemy/EnemyWeapons';
import {
  DEG,
  DT,
  SystemRig,
  breathe,
  groupBursts,
  pointAround,
  seededRandom,
  type SystemRigOptions,
  type SystemShot,
} from './enemyFleetRig';

/**
 * 敌机的三种弹（规格 §3 与 §2.3、§2.7）：普通机炮弹、重型机的高炮弹（约 60 米/秒的红橙色大光球）、
 * 狙击机的长枪弹（约 320 米/秒）。这里只走公开入口：子弹池的 fire / update / checkCollisions，
 * 以及 ENEMY_FIRED 事件 → CombatSystem 这条真实路径。
 */

const KINDS: EnemyWeaponKind[] = ['bullet', 'heavy-shell', 'lance'];
const MUZZLE = new THREE.Vector3(0, 300, 0);
const AHEAD = new THREE.Vector3(0, 0, 1);

let scene: THREE.Scene;
let pool: ProjectilePool | null = null;
let poolSizeSpy: MockInstance | null = null;

function makePool(size?: number): ProjectilePool {
  pool?.dispose();
  poolSizeSpy?.mockRestore();
  poolSizeSpy = null;
  if (size !== undefined) {
    poolSizeSpy = vi.spyOn(GameConfig, 'getProjectilePoolSize').mockReturnValue(size);
  }
  pool = new ProjectilePool(scene);
  return pool;
}

beforeEach(() => {
  EventBus.clear();
  scene = new THREE.Scene();
});

afterEach(() => {
  pool?.dispose();
  pool = null;
  poolSizeSpy?.mockRestore();
  poolSizeSpy = null;
  EventBus.clear();
});

/** 池里位于某一点的活跃子弹（刚发射的子弹就在枪口） */
function activeAt(current: ProjectilePool, point: THREE.Vector3): THREE.Mesh[] {
  return current.getActiveProjectiles().filter((mesh) => mesh.position.distanceTo(point) < 1e-6);
}

function fireKind(
  current: ProjectilePool,
  kind: EnemyWeaponKind | undefined,
  origin: THREE.Vector3 = MUZZLE,
  direction: THREE.Vector3 = AHEAD,
  damage = 10,
  owner?: THREE.Object3D
): THREE.Mesh {
  current.fire(origin, direction, damage, owner, Faction.ENEMY, kind);
  const [mesh] = activeAt(current, origin);
  if (!mesh) throw new Error(`no live ${kind ?? 'default'} round at the muzzle after fire()`);
  return mesh;
}

/** 一发子弹每秒实际飞多远（用子弹池自己的 update 量出来） */
function flownSpeed(kind: EnemyWeaponKind | undefined): number {
  const current = makePool();
  const mesh = fireKind(current, kind);
  const start = mesh.position.clone();
  for (let i = 0; i < 6; i++) current.update(DT);
  return mesh.position.distanceTo(start) / (6 * DT);
}

/** 弹体本身（不含光晕与拖尾）的长宽高，米 */
function bodySize(mesh: THREE.Mesh): THREE.Vector3 {
  const box = new THREE.Box3().setFromBufferAttribute(
    mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  );
  return box.getSize(new THREE.Vector3()).multiply(mesh.scale);
}

function hueOf(color: THREE.Color): { h: number; s: number; l: number } {
  const out = { h: 0, s: 0, l: 0 };
  color.getHSL(out, THREE.SRGBColorSpace);
  return { h: out.h * 360, s: out.s, l: out.l };
}

function bodyColor(mesh: THREE.Mesh): THREE.Color {
  return (mesh.material as THREE.MeshBasicMaterial).color;
}

/** 把一发子弹飞到命中或消失为止；返回命中的时刻与伤害（没打中为 null） */
function flyUntilHit(
  current: ProjectilePool,
  targets: THREE.Object3D[],
  dt: number,
  maxSeconds = 12
): { time: number; damage: number; target: THREE.Object3D } | null {
  let hit: { time: number; damage: number; target: THREE.Object3D } | null = null;
  let time = 0;
  while (time < maxSeconds && current.getActiveProjectiles().length > 0 && !hit) {
    current.update(dt);
    time += dt;
    current.checkCollisions(targets, (target, _projectile, damage) => {
      hit = { time, damage, target };
    });
  }
  return hit;
}

function makeTarget(position: THREE.Vector3, hitRadius?: number): THREE.Group {
  const target = new THREE.Group();
  target.position.copy(position);
  if (hitRadius !== undefined) target.userData.hitRadius = hitRadius;
  scene.add(target);
  target.updateMatrixWorld(true);
  return target;
}

describe('the three enemy projectile kinds fly at different speeds', () => {
  it('a heavy shell is slow (about 60 m/s), a lance is fast (about 320 m/s), a gun round sits between', () => {
    const bullet = flownSpeed('bullet');
    const shell = flownSpeed('heavy-shell');
    const lance = flownSpeed('lance');
    expect(shell, 'heavy shell speed').toBeGreaterThan(50);
    expect(shell).toBeLessThan(70);
    expect(lance, 'lance speed').toBeGreaterThan(280);
    expect(lance).toBeLessThan(360);
    expect(shell, 'shell slower than a gun round').toBeLessThan(bullet * 0.75);
    expect(lance, 'lance much faster than a gun round').toBeGreaterThan(bullet * 2.5);
  });

  it('a round fired without a kind (wingmen, old payloads) is a plain gun round', () => {
    expect(flownSpeed(undefined)).toBeCloseTo(flownSpeed('bullet'), 6);
  });

  it.each(KINDS)(
    '%s flies straight down the direction it was fired in, at a steady speed',
    (kind) => {
      const current = makePool();
      // 故意给一个没归一化的方向
      const direction = new THREE.Vector3(2, 1.5, -6);
      const unit = direction.clone().normalize();
      const mesh = fireKind(current, kind, MUZZLE, direction);
      const steps: number[] = [];
      let previous = mesh.position.clone();
      for (let i = 0; i < 30; i++) {
        current.update(DT);
        const moved = mesh.position.clone().sub(previous);
        steps.push(moved.length());
        expect(moved.normalize().angleTo(unit), 'off the firing line (radians)').toBeLessThan(1e-6);
        previous = mesh.position.clone();
      }
      expect(Math.max(...steps) - Math.min(...steps), 'speed change in flight').toBeLessThan(1e-6);
    }
  );

  it.each(KINDS)('%s does not fly for ever: it is gone within ten seconds', (kind) => {
    const current = makePool();
    fireKind(current, kind);
    let time = 0;
    while (current.getActiveProjectiles().length > 0 && time < 20) {
      current.update(DT);
      time += DT;
    }
    expect(time, 'seconds until it left the pool').toBeLessThan(10);
    expect(time, 'it does fly for a while first').toBeGreaterThan(1);
  });
});

describe('the three kinds look different (jsdom: geometry, size, colour)', () => {
  function looks(): Record<
    EnemyWeaponKind,
    { size: THREE.Vector3; color: THREE.Color; mesh: THREE.Mesh }
  > {
    const current = makePool();
    const result = {} as Record<
      EnemyWeaponKind,
      { size: THREE.Vector3; color: THREE.Color; mesh: THREE.Mesh }
    >;
    KINDS.forEach((kind, index) => {
      const mesh = fireKind(current, kind, new THREE.Vector3(index * 50, 300, 0));
      result[kind] = { size: bodySize(mesh), color: bodyColor(mesh).clone(), mesh };
    });
    return result;
  }

  it('no two kinds share a shape', () => {
    const look = looks();
    for (let a = 0; a < KINDS.length; a++) {
      for (let b = a + 1; b < KINDS.length; b++) {
        const first = look[KINDS[a]].size;
        const second = look[KINDS[b]].size;
        const widthRatio = Math.max(first.x, second.x) / Math.min(first.x, second.x);
        const lengthRatio = Math.max(first.z, second.z) / Math.min(first.z, second.z);
        expect(
          Math.max(widthRatio, lengthRatio),
          `${KINDS[a]} vs ${KINDS[b]}: size ratio`
        ).toBeGreaterThan(1.5);
      }
    }
  });

  it('the heavy shell is a large, round, glowing red-orange orb', () => {
    const { 'heavy-shell': shell, bullet } = looks();
    const widest = Math.max(shell.size.x, shell.size.y, shell.size.z);
    const narrowest = Math.min(shell.size.x, shell.size.y, shell.size.z);
    expect(widest / narrowest, 'round').toBeLessThan(1.25);
    expect(narrowest, 'at least 2 m across').toBeGreaterThanOrEqual(2);
    expect(narrowest, 'several times the size of a gun round').toBeGreaterThan(
      Math.max(bullet.size.x, bullet.size.y, bullet.size.z) * 3
    );
    const { h, s, l } = hueOf(shell.color);
    expect(h, 'hue (degrees): red-orange').toBeGreaterThan(5);
    expect(h).toBeLessThan(35);
    expect(s, 'saturated').toBeGreaterThan(0.6);
    expect(l, 'bright').toBeGreaterThan(0.4);
    // 发光：不受光照影响的自发光材质，或带一圈光晕
    const material = shell.mesh.material as THREE.Material;
    const halo = shell.mesh.children.some(
      (child) => child instanceof THREE.Sprite && child.visible
    );
    expect(material instanceof THREE.MeshBasicMaterial || halo, 'glows').toBe(true);
  });

  it('the lance is long and thin and points the way it flies', () => {
    const current = makePool();
    const direction = new THREE.Vector3(1, 0.2, -0.4).normalize();
    const mesh = fireKind(current, 'lance', MUZZLE, direction);
    const size = bodySize(mesh);
    expect(size.z, 'length (m)').toBeGreaterThan(5);
    expect(size.z / Math.max(size.x, size.y), 'length to width').toBeGreaterThan(8);
    const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    expect(nose.angleTo(direction) / DEG, 'long axis vs flight direction (degrees)').toBeLessThan(
      0.5
    );

    const { bullet, 'heavy-shell': shell, lance } = looks();
    expect(lance.size.z).toBeGreaterThan(bullet.size.z * 3);
    expect(lance.size.z).toBeGreaterThan(shell.size.z);
    expect(Math.max(lance.size.x, lance.size.y), 'thinner than the shell').toBeLessThan(
      shell.size.x / 4
    );
  });

  it('a recycled projectile takes the look and the speed of its new kind (pool of one)', () => {
    const fresh: Record<string, { size: THREE.Vector3; hex: number; speed: number }> = {};
    for (const kind of KINDS) {
      const current = makePool();
      const mesh = fireKind(current, kind);
      fresh[kind] = { size: bodySize(mesh), hex: bodyColor(mesh).getHex(), speed: 0 };
      const start = mesh.position.clone();
      current.update(DT);
      fresh[kind].speed = mesh.position.distanceTo(start) / DT;
    }
    const current = makePool(1);
    const order: EnemyWeaponKind[] = [
      'heavy-shell',
      'lance',
      'bullet',
      'heavy-shell',
      'bullet',
      'lance',
    ];
    order.forEach((kind, index) => {
      const origin = new THREE.Vector3(index * 30, 300, 0);
      const mesh = fireKind(current, kind, origin);
      expect(current.getActiveProjectiles().length).toBe(1);
      const size = bodySize(mesh);
      expect(
        size.distanceTo(fresh[kind].size),
        `${kind} after ${order[index - 1] ?? 'nothing'}: size`
      ).toBeLessThan(1e-6);
      expect(bodyColor(mesh).getHex()).toBe(fresh[kind].hex);
      const start = mesh.position.clone();
      current.update(DT);
      expect(mesh.position.distanceTo(start) / DT).toBeCloseTo(fresh[kind].speed, 6);
    });
  });
});

describe('the lance is fast and still collides: no tunnelling', () => {
  const FRAME_TIMES: Array<[string, number]> = [
    ['1/60 s', 1 / 60],
    ['1/30 s', 1 / 30],
    ['1/20 s', 1 / 20],
    ['0.1 s', 0.1],
  ];
  const RADII: Array<[string, number | undefined]> = [
    ['no declared radius (5 m)', undefined],
    ['a Scout-sized 3.75 m', 3.75],
    ['a small 2 m', 2],
  ];

  it.each(FRAME_TIMES)(
    'frame time %s: a lance aimed at a target hits it at every range',
    (_label, dt) => {
      const lanceSpeed = flownSpeed('lance');
      for (const [label, radius] of RADII) {
        let fired = 0;
        // 距离取很密的一串不规则值：让目标落在一步飞行的各个相位上
        for (let distance = 30; distance < 640; distance += 7.31) {
          const current = makePool(4);
          const target = makeTarget(MUZZLE.clone().addScaledVector(AHEAD, distance), radius);
          fireKind(current, 'lance', MUZZLE, AHEAD, 23);
          const hit = flyUntilHit(current, [target], dt);
          fired++;
          expect(hit, `${label}, target ${distance.toFixed(1)} m away`).not.toBeNull();
          expect(hit?.damage).toBe(23);
          expect(hit?.target).toBe(target);
          // 不早不晚：在它真正飞到目标附近的那一步命中
          const reach = (radius ?? 5) + 1;
          expect(hit?.time ?? 0).toBeGreaterThan((distance - reach) / lanceSpeed - 1e-9);
          expect(hit?.time ?? 0).toBeLessThan((distance + reach) / lanceSpeed + dt + 1e-9);
          expect(current.getActiveProjectiles().length, 'the lance is used up by the hit').toBe(0);
          scene.remove(target);
        }
        expect(fired).toBeGreaterThan(80);
      }
    }
  );

  it.each(FRAME_TIMES)(
    'frame time %s: a lance on a slanted line still hits a target it passes through',
    (_label, dt) => {
      const direction = new THREE.Vector3(0.6, -0.25, 0.75).normalize();
      for (let distance = 45; distance < 600; distance += 13.7) {
        const current = makePool(4);
        // 目标偏离弹道 1.5 米：仍在机体之内
        const side = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const target = makeTarget(
          MUZZLE.clone().addScaledVector(direction, distance).addScaledVector(side, 1.5),
          3.75
        );
        fireKind(current, 'lance', MUZZLE, direction, 20);
        expect(
          flyUntilHit(current, [target], dt),
          `target ${distance.toFixed(1)} m away`
        ).not.toBeNull();
        scene.remove(target);
      }
    }
  );

  it.each(FRAME_TIMES)(
    'frame time %s: a lance passing well clear of a target does not hit it',
    (_label, dt) => {
      for (let distance = 30; distance < 600; distance += 11.3) {
        const current = makePool(4);
        // 目标命中半径 5 米，弹道从 8 米外擦过
        const target = makeTarget(
          MUZZLE.clone()
            .addScaledVector(AHEAD, distance)
            .add(new THREE.Vector3(8, 0, 0))
        );
        fireKind(current, 'lance', MUZZLE, AHEAD, 20);
        expect(
          flyUntilHit(current, [target], dt),
          `target ${distance.toFixed(1)} m away`
        ).toBeNull();
        scene.remove(target);
      }
    }
  );

  it('a lance does not hit the jet that fired it, and hits the first target on its line only', () => {
    const current = makePool(4);
    const owner = makeTarget(MUZZLE.clone());
    const near = makeTarget(MUZZLE.clone().addScaledVector(AHEAD, 180));
    const far = makeTarget(MUZZLE.clone().addScaledVector(AHEAD, 320));
    fireKind(current, 'lance', MUZZLE, AHEAD, 20, owner);
    const hits: THREE.Object3D[] = [];
    for (let i = 0; i < 240; i++) {
      current.update(DT);
      current.checkCollisions([owner, far, near], (target) => hits.push(target));
    }
    expect(hits).toEqual([near]);
  });

  it.each(FRAME_TIMES)(
    'frame time %s: through the combat system a lance fired at the player lands with its damage',
    (_label, dt) => {
      for (let distance = 60; distance < 600; distance += 23.9) {
        EventBus.clear();
        const particles = new ParticleSystem(scene);
        const playerMesh = new THREE.Group();
        playerMesh.position.copy(MUZZLE).addScaledVector(AHEAD, distance);
        scene.add(playerMesh);
        playerMesh.updateMatrixWorld(true);
        const combat = new CombatSystem(scene, particles, playerMesh);
        combat.init();
        const owner = new THREE.Group();
        owner.position.copy(MUZZLE);
        EventBus.emit(GameEventType.ENEMY_FIRED, {
          position: MUZZLE.clone(),
          direction: AHEAD.clone(),
          damage: 31,
          faction: Faction.ENEMY,
          owner,
          weapon: 'lance',
        });
        const landed: Array<{ damage: number; source: string }> = [];
        for (let time = 0; time < 4; time += dt) {
          combat.update(dt);
          combat.checkProjectileCollisions(
            [],
            [],
            () => undefined,
            (damage, source) => landed.push({ damage, source }),
            () => undefined
          );
        }
        expect(landed, `player ${distance.toFixed(1)} m away`).toEqual([
          { damage: 31, source: 'enemy-bullet' },
        ]);
        combat.dispose();
        particles.dispose();
        scene.remove(playerMesh);
      }
    }
  );

  it.each([
    ['heavy-shell', 1 / 60],
    ['heavy-shell', 1 / 30],
    ['bullet', 1 / 60],
    ['bullet', 1 / 30],
  ] as const)('a %s on target still hits (frame time %s s)', (kind, dt) => {
    for (let distance = 30; distance < 340; distance += 9.7) {
      const current = makePool(4);
      const target = makeTarget(MUZZLE.clone().addScaledVector(AHEAD, distance));
      fireKind(current, kind, MUZZLE, AHEAD, 9);
      const hit = flyUntilHit(current, [target], dt);
      expect(hit?.damage, `target ${distance.toFixed(1)} m away`).toBe(9);
      scene.remove(target);
    }
  });
});

describe('a full pool does not silently lose the new shot', () => {
  /** 往池里放 size 发普通子弹，分几步发出去，全都还在飞 */
  function fill(current: ProjectilePool, size: number): void {
    for (let i = 0; i < size; i++) {
      current.fire(
        new THREE.Vector3(-400 + i * 7, 250, -300),
        new THREE.Vector3(0, 0, -1),
        5,
        undefined,
        Faction.ENEMY,
        'bullet'
      );
      if (i % 8 === 7) current.update(DT);
    }
    expect(current.getActiveProjectiles().length, 'rounds in flight').toBe(size);
  }

  it.each([80, 12, 1])('pool of %s: one more round of each kind is fired, not dropped', (size) => {
    const speeds = Object.fromEntries(KINDS.map((kind) => [kind, flownSpeed(kind)]));
    for (const kind of KINDS) {
      const current = makePool(size);
      fill(current, size);
      const mesh = fireKind(current, kind, MUZZLE, AHEAD, 17);
      expect(current.getActiveProjectiles().length, 'the pool did not grow').toBe(size);
      // 它是真的那一发：按这个弹种的速度飞，带着这一发的伤害
      const start = mesh.position.clone();
      current.update(DT);
      expect(mesh.position.distanceTo(start) / DT).toBeCloseTo(speeds[kind], 6);
      const target = makeTarget(MUZZLE.clone().addScaledVector(AHEAD, 40));
      const hit = flyUntilHit(current, [target], DT);
      expect(hit?.damage, `${kind} into a full pool of ${size}`).toBe(17);
      scene.remove(target);
    }
  });

  it('a five-shell fan fired into a full pool of 80 arrives complete', () => {
    const current = makePool(80);
    fill(current, 80);
    const directions = [-8, -4, 0, 4, 8].map(
      (angle) => new THREE.Vector3(Math.sin(angle * DEG), 0, Math.cos(angle * DEG))
    );
    for (const direction of directions) {
      current.fire(MUZZLE, direction, 12, undefined, Faction.ENEMY, 'heavy-shell');
    }
    expect(activeAt(current, MUZZLE).length, 'shells at the muzzle').toBe(5);
    expect(current.getActiveProjectiles().length).toBe(80);
    // 飞出去之后五发各走各的方向
    for (let i = 0; i < 30; i++) current.update(DT);
    for (const direction of directions) {
      const expected = MUZZLE.clone().addScaledVector(direction, flownSpeedOf(current, direction));
      expect(
        current.getActiveProjectiles().some((mesh) => mesh.position.distanceTo(expected) < 0.01),
        'a shell on each line of the fan'
      ).toBe(true);
    }

    /** 沿某个方向飞行的那一发离枪口多远 */
    function flownSpeedOf(active: ProjectilePool, direction: THREE.Vector3): number {
      const along = active
        .getActiveProjectiles()
        .map((mesh) => mesh.position.clone().sub(MUZZLE))
        .filter(
          (offset) => offset.length() > 1 && offset.clone().normalize().angleTo(direction) < 1e-4
        )
        .map((offset) => offset.length());
      return along.length > 0 ? along[0] : Number.NaN;
    }
  });

  it('shots fired just before the pool overflowed are still flying after it', () => {
    const current = makePool(80);
    fill(current, 72);
    for (let i = 0; i < 30; i++) current.update(DT);
    // 刚发出去的八发（各种弹都有）
    const fresh = Array.from({ length: 8 }, (_unused, index) =>
      fireKind(current, KINDS[index % 3], new THREE.Vector3(index * 9, 280, 60))
    );
    expect(current.getActiveProjectiles().length, 'pool is full').toBe(80);
    for (let i = 0; i < 12; i++) {
      fireKind(current, KINDS[i % 3], new THREE.Vector3(i * 9, 320, 100));
    }
    for (const mesh of fresh) expect(mesh.visible, 'a fresh round was thrown away').toBe(true);
    for (const mesh of fresh) expect(current.getActiveProjectiles()).toContain(mesh);
    expect(current.getActiveProjectiles().length).toBe(80);
  });
});

// ---------------------------------------------------------------------------------------------
// 真实交战：EnemySystem 发 ENEMY_FIRED，CombatSystem 收下并让子弹飞
// ---------------------------------------------------------------------------------------------

class LiveFight {
  public readonly rig: SystemRig;
  public readonly particles: ParticleSystem;
  public readonly combat: CombatSystem;
  public readonly playerMesh = new THREE.Group();
  public readonly hits: Array<{ time: number; damage: number }> = [];

  constructor(options: SystemRigOptions) {
    this.rig = new SystemRig(options);
    this.particles = new ParticleSystem(this.rig.scene);
    this.rig.scene.add(this.playerMesh);
    this.combat = new CombatSystem(this.rig.scene, this.particles, this.playerMesh);
    this.combat.init();
  }

  /** 一步：敌机行动（可能开火）→ 回调 → 子弹前进并判定是否打中玩家 */
  public step(afterJets?: (fired: SystemShot[]) => void): void {
    const before = this.rig.shots.length;
    this.rig.step();
    afterJets?.(this.rig.shots.slice(before));
    this.playerMesh.position.copy(this.rig.player.position);
    this.playerMesh.updateMatrixWorld(true);
    this.combat.update(DT);
    this.combat.checkProjectileCollisions(
      [],
      [],
      () => undefined,
      (damage) => this.hits.push({ time: this.rig.time, damage }),
      () => undefined
    );
  }

  public dispose(): void {
    this.combat.dispose();
    this.particles.dispose();
    this.rig.dispose();
  }
}

const ARMED: EnemyType[] = [
  EnemyType.SCOUT,
  EnemyType.FIGHTER,
  EnemyType.HEAVY,
  EnemyType.SNIPER,
  EnemyType.ACE,
];

describe('live fire: ENEMY_FIRED through the combat system', () => {
  let fight: LiveFight | null = null;
  let randomSpy: MockInstance | null = null;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandom(20261012));
  });

  afterEach(() => {
    fight?.dispose();
    fight = null;
    randomSpy?.mockRestore();
    randomSpy = null;
  });

  function startFight(level: number, poolSize: number, types: EnemyType[] = ARMED): LiveFight {
    poolSizeSpy = vi.spyOn(GameConfig, 'getProjectilePoolSize').mockReturnValue(poolSize);
    fight = new LiveFight({ level, difficulty: 3 });
    types.forEach((type, index) => {
      fight?.rig.spawn(
        type,
        pointAround(fight.rig.player, 380, (index * (360 / types.length) + 20) * DEG)
      );
    });
    return fight;
  }

  it.each([
    [80, 6],
    [12, 6],
    [12, 1],
  ])(
    'shared pool of %s at level %s: every shot the jets fire becomes a projectile, even with the pool full',
    async (poolSize, level) => {
      const current = startFight(level, poolSize, [...ARMED, EnemyType.HEAVY, EnemyType.FIGHTER]);
      const enemyPool = current.combat.getEnemyProjectilePool();
      current.rig.pilot = (rig) => rig.turnPlayer(0.3 * DT);
      let fired = 0;
      let lost = 0;
      let firedWhileFull = 0;
      const steps = Math.round(60 / DT);
      for (let i = 0; i < steps; i++) {
        const activeBefore = enemyPool.getActiveProjectiles().length;
        current.step((shots) => {
          if (shots.length === 0) return;
          fired += shots.length;
          if (activeBefore + shots.length > poolSize) firedWhileFull += shots.length;
          // 这一步发出的每一发都应该在池里、在各自的枪口上
          const muzzles: THREE.Vector3[] = [];
          for (const shot of shots) {
            if (!muzzles.some((muzzle) => muzzle.distanceTo(shot.payload.position) < 1e-6)) {
              muzzles.push(shot.payload.position);
            }
          }
          for (const muzzle of muzzles) {
            const expected = shots.filter(
              (shot) => shot.payload.position.distanceTo(muzzle) < 1e-6
            ).length;
            lost += Math.max(0, expected - activeAt(enemyPool, muzzle).length);
          }
        });
        if (i % 600 === 599) await breathe();
      }
      expect(fired, 'shots fired in a minute').toBeGreaterThan(60);
      expect(lost, 'shots that never became a projectile').toBe(0);
      if (poolSize < 80) {
        expect(firedWhileFull, 'shots fired into a full pool').toBeGreaterThan(20);
      }
    }
  );

  it('the event carries what damage accounting needs: muzzle, unit direction, damage, shooter, kind and true speed', async () => {
    const realSpeed = Object.fromEntries(KINDS.map((kind) => [kind, flownSpeed(kind)]));
    pool?.dispose();
    pool = null;
    const current = startFight(6, 300);
    current.rig.pilot = (rig) => rig.turnPlayer(0.25 * DT);
    let farthestMuzzle = 0;
    const steps = Math.round(70 / DT);
    for (let i = 0; i < steps; i++) {
      current.step((fired) => {
        for (const shot of fired) {
          const owner = shot.payload.owner;
          if (owner) {
            farthestMuzzle = Math.max(
              farthestMuzzle,
              shot.payload.position.distanceTo(owner.position)
            );
          }
        }
      });
      if (i % 600 === 599) await breathe();
    }
    // 出膛位置在开火那架敌机身上（最大的机体长 43 米）
    expect(farthestMuzzle, 'farthest muzzle from its jet (m)').toBeLessThan(45);
    const { shots } = current.rig;
    expect(shots.length).toBeGreaterThan(80);
    const kindsByType = new Map<string, Set<string>>();
    for (const shot of shots) {
      const { payload } = shot;
      expect(payload.faction).toBe(Faction.ENEMY);
      expect(shot.jet, 'owner is the mesh of a live enemy jet').not.toBeNull();
      const type = shot.jet?.getConfig().type ?? '';
      expect(payload.owner?.name, 'the owner mesh is named after its type').toBe(type);
      expect(Number.isFinite(payload.position.lengthSq())).toBe(true);
      expect(Math.abs(payload.direction.length() - 1), 'unit direction').toBeLessThan(1e-3);
      expect(payload.damage).toBeGreaterThan(0);
      expect(Number.isFinite(payload.damage)).toBe(true);
      const kind = payload.weapon ?? 'bullet';
      expect(KINDS).toContain(kind);
      // 弹速：缺省按普通子弹；给出来就必须是这一发真正的飞行速度
      expect(payload.speed ?? realSpeed.bullet, `${kind} speed in the event`).toBeCloseTo(
        realSpeed[kind],
        3
      );
      const seen = kindsByType.get(type) ?? new Set<string>();
      seen.add(kind);
      kindsByType.set(type, seen);
    }
    expect([...(kindsByType.get(EnemyType.SCOUT) ?? [])]).toEqual(['bullet']);
    expect([...(kindsByType.get(EnemyType.FIGHTER) ?? [])]).toEqual(['bullet']);
    expect([...(kindsByType.get(EnemyType.ACE) ?? [])]).toEqual(['bullet']);
    expect([...(kindsByType.get(EnemyType.SNIPER) ?? [])]).toEqual(['lance']);
    expect(kindsByType.get(EnemyType.HEAVY)?.has('heavy-shell')).toBe(true);
    expect(kindsByType.get(EnemyType.HEAVY)?.has('lance')).toBe(false);
  });

  it.each([
    [1, 3],
    [6, 5],
  ])(
    'level %s: a flak fan of %s shells is one audible shot, the rest are marked quiet',
    async (level, fanSize) => {
      const current = startFight(level, 300, [EnemyType.HEAVY, EnemyType.HEAVY, EnemyType.FIGHTER]);
      // 玩家盘旋：重型机飞得慢，直飞会把它们甩在射程之外
      current.rig.pilot = (rig) => rig.turnPlayer(0.35 * DT);
      const steps = Math.round(60 / DT);
      for (let i = 0; i < steps; i++) {
        current.step();
        if (i % 600 === 599) await breathe();
      }
      const shells = current.rig.shots.filter((shot) => shot.payload.weapon === 'heavy-shell');
      const fans = groupBursts(shells, 0.5);
      expect(fans.length, 'fans fired').toBeGreaterThan(8);
      for (const fan of fans) {
        expect(fan.length, 'shells in the fan').toBe(fanSize);
        expect(fan.filter((shot) => shot.payload.quiet !== true).length, 'audible shells').toBe(1);
        expect(fan[0].payload.quiet === true, 'the audible one is the first').toBe(false);
      }
    }
  );

  it('every hit on the player can be traced to a recorded shot: same damage, right place at that time', async () => {
    const traced = new Set<string>();
    let hits = 0;
    // 三场不同种子的交战：单独一场里直飞的玩家挨几发要看那一场怎么打
    for (const seed of [20261012, 20261013, 20261014]) {
      fight?.dispose();
      fight = null;
      randomSpy?.mockImplementation(seededRandom(seed));
      const current = startFight(6, 300);
      // 玩家直飞：会挨到各种弹
      const steps = Math.round(90 / DT);
      for (let i = 0; i < steps; i++) {
        current.step();
        if (i % 600 === 599) await breathe();
      }
      hits += current.hits.length;
      for (const hit of current.hits) {
        // 玩家在命中那一刻的位置：之后每步直飞，倒推回去
        const stepsSince = Math.round((current.rig.time - hit.time) / DT);
        const playerThen = current.rig.player.position
          .clone()
          .addScaledVector(current.rig.player.velocity, -stepsSince * DT);
        let best = Infinity;
        let bestKind = '';
        for (const shot of current.rig.shots) {
          if (shot.time > hit.time || Math.abs(shot.payload.damage - hit.damage) > 1e-6) continue;
          const speed = shot.payload.speed ?? 100;
          const predicted = shot.payload.position
            .clone()
            .addScaledVector(shot.payload.direction, speed * (hit.time - shot.time));
          const miss = predicted.distanceTo(playerThen);
          if (miss < best) {
            best = miss;
            bestKind = shot.payload.weapon ?? 'bullet';
          }
        }
        // 命中半径 5 米 + 弹体半径 + 高速弹一步的行程
        expect(
          best,
          `seed ${seed}: hit of ${hit.damage} at t=${hit.time.toFixed(2)}: nearest matching shot (m)`
        ).toBeLessThan(12);
        traced.add(bestKind);
      }
    }
    expect(hits, 'hits on the player in three 90 s fights').toBeGreaterThan(5);
    expect(traced.size, 'kinds of round that hit').toBeGreaterThanOrEqual(2);
  });
});
