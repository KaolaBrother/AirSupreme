import * as THREE from 'three';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitEntity } from './UnitEntity';
import { isFiniteVector } from './UnitMissiles';

/**
 * 单位之间的内部弹道（不经过玩家 / 敌机的子弹池）：
 * - 炮弹 / 曳光弹 / 火箭弹：命中与否在开火时按精度判定，飞抵后结算伤害；
 * - 炸弹：受重力下落，经过玩家附近会命中玩家，落地后对范围内友军 / 平民单位造成伤害；
 * - 高炮爆烟：纯视觉的高空黑烟团（每个烟团独立材质以便单独淡出，数量固定池化）。
 * 所有网格池化，每帧零分配。
 */

export type UnitShotKind = 'shell' | 'tracer' | 'rocket';

export interface UnitShotEnv {
  readonly playerPosition: THREE.Vector3;
  readonly particleSystem: ParticleSystem | null;
  sampleSurface(x: number, z: number): { y: number; water: boolean };
  onShotImpact(target: UnitEntity, damage: number, position: THREE.Vector3): void;
  onBombImpact(position: THREE.Vector3, damage: number, radius: number, water: boolean): void;
  onBombHitsPlayer(damage: number, position: THREE.Vector3): void;
}

interface UnitShot {
  active: boolean;
  readonly mesh: THREE.Mesh;
  kind: UnitShotKind;
  readonly velocity: THREE.Vector3;
  life: number;
  damage: number;
  target: UnitEntity | null;
  hit: boolean;
  trailTimer: number;
}

interface UnitBomb {
  active: boolean;
  readonly mesh: THREE.Group;
  readonly velocity: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  trailTimer: number;
}

interface FlakPuff {
  active: boolean;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  scale: number;
  /** 不规则拉伸，打破完美球形轮廓 */
  readonly stretch: THREE.Vector3;
}

const FORWARD = new THREE.Vector3(0, 0, 1);
const GRAVITY = 9.8;
const PUFF_HOT = new THREE.Color(0xffa14a);
const PUFF_SMOKE = new THREE.Color(0x2b2b2e);
const ROCKET_TRAIL = new THREE.Color(0.75, 0.74, 0.72);

export class UnitShotPool {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly shots: UnitShot[] = [];
  private readonly bombs: UnitBomb[] = [];
  private readonly puffs: FlakPuff[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly shotGeometries: Record<UnitShotKind, THREE.BufferGeometry>;
  private readonly shotMaterials: Record<UnitShotKind, THREE.Material>;
  private readonly aim = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, shotCapacity = 56, bombCapacity = 18, puffCapacity = 30) {
    this.scene = scene;
    this.root.name = 'UnitShots';

    const tracerGeometry = new THREE.BoxGeometry(0.22, 0.22, 4.8);
    const shellGeometry = new THREE.BoxGeometry(0.42, 0.42, 2.4);
    const rocketGeometry = new THREE.CylinderGeometry(0.14, 0.18, 1.6, 6);
    rocketGeometry.rotateX(Math.PI / 2);
    const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    const shellMaterial = new THREE.MeshBasicMaterial({ color: 0xffefc4 });
    const rocketMaterial = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
    this.shotGeometries = { tracer: tracerGeometry, shell: shellGeometry, rocket: rocketGeometry };
    this.shotMaterials = { tracer: tracerMaterial, shell: shellMaterial, rocket: rocketMaterial };
    this.geometries.push(tracerGeometry, shellGeometry, rocketGeometry);
    this.materials.push(tracerMaterial, shellMaterial, rocketMaterial);

    for (let i = 0; i < shotCapacity; i++) {
      const mesh = new THREE.Mesh(tracerGeometry, tracerMaterial);
      mesh.visible = false;
      mesh.name = 'UNIT_SHOT';
      this.root.add(mesh);
      this.shots.push({
        active: false,
        mesh,
        kind: 'tracer',
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 0,
        target: null,
        hit: false,
        trailTimer: 0,
      });
    }

    const bombBody = new THREE.CylinderGeometry(0.32, 0.32, 2.2, 8);
    bombBody.rotateX(Math.PI / 2);
    const bombNose = new THREE.SphereGeometry(0.32, 8, 6);
    bombNose.translate(0, 0, 1.1);
    const bombFin = new THREE.BoxGeometry(0.9, 0.05, 0.45);
    bombFin.translate(0, 0, -1.2);
    const bombFin2 = new THREE.BoxGeometry(0.05, 0.9, 0.45);
    bombFin2.translate(0, 0, -1.2);
    const bombMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2d31,
      roughness: 0.6,
      metalness: 0.4,
    });
    const bandMaterial = new THREE.MeshStandardMaterial({
      color: 0xc4252d,
      roughness: 0.5,
      emissive: 0x4a0406,
      emissiveIntensity: 0.6,
    });
    const bombBand = new THREE.CylinderGeometry(0.335, 0.335, 0.25, 8);
    bombBand.rotateX(Math.PI / 2);
    bombBand.translate(0, 0, 0.5);
    this.geometries.push(bombBody, bombNose, bombFin, bombFin2, bombBand);
    this.materials.push(bombMaterial, bandMaterial);
    for (let i = 0; i < bombCapacity; i++) {
      const mesh = new THREE.Group();
      mesh.name = 'UNIT_BOMB';
      mesh.add(new THREE.Mesh(bombBody, bombMaterial));
      mesh.add(new THREE.Mesh(bombNose, bombMaterial));
      mesh.add(new THREE.Mesh(bombFin, bombMaterial));
      mesh.add(new THREE.Mesh(bombFin2, bombMaterial));
      mesh.add(new THREE.Mesh(bombBand, bandMaterial));
      mesh.visible = false;
      this.root.add(mesh);
      this.bombs.push({
        active: false,
        mesh,
        velocity: new THREE.Vector3(),
        damage: 0,
        radius: 0,
        life: 0,
        trailTimer: 0,
      });
    }

    const puffGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.geometries.push(puffGeometry);
    for (let i = 0; i < puffCapacity; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: PUFF_SMOKE,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
      });
      this.materials.push(material);
      const mesh = new THREE.Mesh(puffGeometry, material);
      mesh.visible = false;
      mesh.renderOrder = 0;
      mesh.name = 'UNIT_FLAK_PUFF';
      this.root.add(mesh);
      this.puffs.push({
        active: false,
        mesh,
        material,
        life: 0,
        maxLife: 1,
        scale: 1,
        stretch: new THREE.Vector3(1, 1, 1),
      });
    }
  }

  /** 首次使用时才挂到场景；clear() 时摘下 */
  private ensureAttached(): void {
    if (this.root.parent !== this.scene) this.scene.add(this.root);
  }

  /**
   * 对单位开火（内部结算）。accuracy 0..1：命中概率；未命中时弹着点随机偏离目标。
   */
  fireAtUnit(
    kind: UnitShotKind,
    from: THREE.Vector3,
    target: UnitEntity,
    damage: number,
    accuracy: number,
    speed: number
  ): boolean {
    if (!isFiniteVector(from) || !target.isAlive()) return false;
    const shot = this.shots.find((entry) => !entry.active);
    if (!shot) return false;
    const distance = from.distanceTo(target.mesh.position);
    const time = distance / Math.max(1, speed);
    this.aim.copy(target.mesh.position).addScaledVector(target.velocity, time);
    const hit = Math.random() < THREE.MathUtils.clamp(accuracy, 0, 1);
    if (!hit) {
      const miss = target.hitRadius + 4 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      this.aim.x += Math.cos(angle) * miss;
      this.aim.z += Math.sin(angle) * miss;
    }
    return this.launchShot(shot, kind, from, this.aim, speed, damage, hit ? target : null);
  }

  /** 纯视觉弹道（例如近防炮拦截导弹、对空扫射的曳光） */
  fireVisual(kind: UnitShotKind, from: THREE.Vector3, to: THREE.Vector3, speed: number): boolean {
    if (!isFiniteVector(from) || !isFiniteVector(to)) return false;
    const shot = this.shots.find((entry) => !entry.active);
    if (!shot) return false;
    return this.launchShot(shot, kind, from, to, speed, 0, null);
  }

  private launchShot(
    shot: UnitShot,
    kind: UnitShotKind,
    from: THREE.Vector3,
    to: THREE.Vector3,
    speed: number,
    damage: number,
    target: UnitEntity | null
  ): boolean {
    this.tmp.subVectors(to, from);
    const distance = this.tmp.length();
    if (distance < 0.5 || !Number.isFinite(distance)) return false;
    this.ensureAttached();
    shot.active = true;
    shot.kind = kind;
    shot.mesh.geometry = this.shotGeometries[kind];
    shot.mesh.material = this.shotMaterials[kind];
    shot.mesh.position.copy(from);
    shot.velocity.copy(this.tmp).multiplyScalar(speed / distance);
    shot.mesh.quaternion.setFromUnitVectors(FORWARD, this.tmp.multiplyScalar(1 / distance));
    shot.life = distance / speed;
    shot.damage = damage;
    shot.target = target;
    shot.hit = target !== null;
    shot.trailTimer = 0;
    shot.mesh.visible = true;
    return true;
  }

  /** 投弹：初速继承轰炸机速度 */
  dropBomb(from: THREE.Vector3, velocity: THREE.Vector3, damage: number, radius: number): boolean {
    if (!isFiniteVector(from) || !isFiniteVector(velocity)) return false;
    const bomb = this.bombs.find((entry) => !entry.active);
    if (!bomb) return false;
    this.ensureAttached();
    bomb.active = true;
    bomb.mesh.position.copy(from);
    bomb.velocity.copy(velocity);
    bomb.damage = damage;
    bomb.radius = radius;
    bomb.life = 25;
    bomb.trailTimer = 0;
    bomb.mesh.visible = true;
    return true;
  }

  /** 高炮爆烟（纯视觉） */
  spawnPuff(position: THREE.Vector3, scale = 1): void {
    if (!isFiniteVector(position)) return;
    const puff = this.puffs.find((entry) => !entry.active);
    if (!puff) return;
    this.ensureAttached();
    puff.active = true;
    puff.maxLife = 1.3 + Math.random() * 0.5;
    puff.life = puff.maxLife;
    puff.scale = (2.2 + Math.random() * 1.2) * scale;
    puff.mesh.position.copy(position);
    puff.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    puff.stretch.set(
      0.75 + Math.random() * 0.5,
      0.65 + Math.random() * 0.4,
      0.75 + Math.random() * 0.5
    );
    puff.mesh.scale.copy(puff.stretch).multiplyScalar(puff.scale * 0.4);
    puff.material.color.copy(PUFF_HOT);
    puff.material.opacity = 0.95;
    puff.mesh.visible = true;
  }

  update(deltaTime: number, env: UnitShotEnv): void {
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.life -= deltaTime;
      shot.mesh.position.addScaledVector(shot.velocity, deltaTime);
      if (shot.kind === 'rocket' && env.particleSystem) {
        shot.trailTimer -= deltaTime;
        if (shot.trailTimer <= 0) {
          shot.trailTimer = 0.06;
          env.particleSystem.createTrail(shot.mesh.position, ROCKET_TRAIL);
        }
      }
      if (shot.life <= 0) {
        this.resolveShot(shot, env);
      }
    }

    for (const bomb of this.bombs) {
      if (!bomb.active) continue;
      bomb.life -= deltaTime;
      bomb.velocity.y -= GRAVITY * deltaTime;
      bomb.mesh.position.addScaledVector(bomb.velocity, deltaTime);
      if (!isFiniteVector(bomb.mesh.position) || bomb.life <= 0) {
        this.deactivateBomb(bomb);
        continue;
      }
      this.tmp.copy(bomb.velocity).normalize();
      bomb.mesh.quaternion.setFromUnitVectors(FORWARD, this.tmp);
      // 擦过玩家 → 直接命中
      if (bomb.mesh.position.distanceTo(env.playerPosition) < 8) {
        env.onBombHitsPlayer(bomb.damage, bomb.mesh.position);
        env.particleSystem?.createExplosion(bomb.mesh.position, 1.2, 'enemy');
        this.deactivateBomb(bomb);
        continue;
      }
      const surface = env.sampleSurface(bomb.mesh.position.x, bomb.mesh.position.z);
      if (bomb.mesh.position.y <= surface.y) {
        bomb.mesh.position.y = surface.y;
        if (env.particleSystem) {
          if (surface.water) {
            env.particleSystem.createWaterImpact(bomb.mesh.position, 2);
            env.particleSystem.createWaterImpact(bomb.mesh.position, 1.6);
          } else {
            env.particleSystem.createExplosion(bomb.mesh.position, 1.5, 'enemy');
            env.particleSystem.createGroundImpact(bomb.mesh.position, 1.8, 'ground');
          }
        }
        env.onBombImpact(bomb.mesh.position, bomb.damage, bomb.radius, surface.water);
        this.deactivateBomb(bomb);
      }
    }

    for (const puff of this.puffs) {
      if (!puff.active) continue;
      puff.life -= deltaTime;
      if (puff.life <= 0) {
        puff.active = false;
        puff.mesh.visible = false;
        continue;
      }
      const t = 1 - puff.life / puff.maxLife;
      puff.mesh.scale.copy(puff.stretch).multiplyScalar(puff.scale * (0.4 + 0.6 * Math.sqrt(t)));
      if (t < 0.12) {
        puff.material.color.copy(PUFF_HOT).lerp(PUFF_SMOKE, t / 0.12);
      } else {
        puff.material.color.copy(PUFF_SMOKE);
      }
      puff.material.opacity = 0.9 * Math.pow(1 - t, 1.4);
      puff.mesh.position.y += deltaTime * 1.5;
    }
  }

  private resolveShot(shot: UnitShot, env: UnitShotEnv): void {
    const position = shot.mesh.position;
    if (shot.hit && shot.target && shot.target.isAlive()) {
      env.onShotImpact(shot.target, shot.damage, position);
      env.particleSystem?.createHit(position, shot.kind === 'tracer' ? 0.8 : 1.3, 'enemy');
    } else if (env.particleSystem && shot.damage > 0) {
      const surface = env.sampleSurface(position.x, position.z);
      if (position.y <= surface.y + 6) {
        if (surface.water) env.particleSystem.createWaterImpact(position, 0.9);
        else env.particleSystem.createGroundImpact(position, 0.9, 'ground');
      }
    }
    shot.active = false;
    shot.mesh.visible = false;
    shot.target = null;
  }

  private deactivateBomb(bomb: UnitBomb): void {
    bomb.active = false;
    bomb.mesh.visible = false;
  }

  /** 目标单位移除时取消其未结算弹道的命中 */
  forgetUnit(unit: UnitEntity): void {
    for (const shot of this.shots) {
      if (shot.target === unit) {
        shot.target = null;
        shot.hit = false;
      }
    }
  }

  clear(): void {
    for (const shot of this.shots) {
      shot.active = false;
      shot.mesh.visible = false;
      shot.target = null;
    }
    for (const bomb of this.bombs) this.deactivateBomb(bomb);
    for (const puff of this.puffs) {
      puff.active = false;
      puff.mesh.visible = false;
    }
    this.scene.remove(this.root);
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.root);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.shots.length = 0;
    this.bombs.length = 0;
    this.puffs.length = 0;
  }
}
