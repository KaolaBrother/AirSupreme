import * as THREE from 'three';
import type { DecoyPoint } from '@/core/CombatContracts';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitEntity } from './UnitEntity';

/**
 * 单位导弹池（地空导弹车 / 护卫舰垂发 / 潜射导弹共用）
 *
 * - 比例导引简化版：瞄准目标预测点，转向速率受限（玩家急转可甩开，热焰弹是可靠解法）；
 * - 导引头锥角内出现热焰弹诱饵 → 立即改为追踪诱饵，被诱骗的导弹抵达诱饵后无害自爆；
 * - 近炸引信：进入近炸半径全额伤害；擦肩而过但最近距离足够近时破片伤害减半；
 * - 撞地 / 燃料耗尽 / EMP → 无害爆炸。
 * 网格、几何、材质全部池化；每帧零分配。
 */

export type UnitMissileTargetKind = 'player' | 'unit' | 'decoy' | 'none';

export interface UnitMissileLaunchOptions {
  maxSpeed: number;
  turnRate: number;
  life: number;
  /** 发射初速 */
  launchSpeed?: number;
  /** 发射后先竖直爬升的时间（潜射 / 垂发） */
  boostUpTime?: number;
}

export interface UnitMissileEnv {
  readonly playerPosition: THREE.Vector3;
  readonly playerVelocity: THREE.Vector3;
  readonly decoys: readonly DecoyPoint[];
  readonly particleSystem: ParticleSystem | null;
  sampleSurfaceY(x: number, z: number): number;
  onPlayerHit(damage: number, position: THREE.Vector3): void;
  onUnitHit(target: UnitEntity, damage: number, position: THREE.Vector3): void;
  onDetonate(position: THREE.Vector3, scale: number, harmless: boolean): void;
  onDecoyed?(position: THREE.Vector3): void;
}

interface UnitMissile {
  active: boolean;
  readonly mesh: THREE.Group;
  readonly glow: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly direction: THREE.Vector3;
  speed: number;
  maxSpeed: number;
  turnRate: number;
  life: number;
  age: number;
  boostUpTime: number;
  damage: number;
  targetKind: UnitMissileTargetKind;
  targetUnit: UnitEntity | null;
  decoyRef: DecoyPoint | null;
  readonly decoyPoint: THREE.Vector3;
  minDistance: number;
  lastDistance: number;
  trailTimer: number;
  readonly incoming: { position: THREE.Vector3; targetIsPlayer: boolean };
}

/** 导引头半锥角（度） */
export const UNIT_MISSILE_SEEKER_HALF_ANGLE_DEG = 50;
/** 导引头对诱饵的最大探测距离（米） */
export const UNIT_MISSILE_SEEKER_RANGE = 650;
/** 对玩家近炸半径（米） */
export const UNIT_MISSILE_PROXIMITY = 6.5;
/** 擦肩破片半径（米） */
export const UNIT_MISSILE_FRAGMENT_RADIUS = 13;

const SEEKER_COS = Math.cos(THREE.MathUtils.degToRad(UNIT_MISSILE_SEEKER_HALF_ANGLE_DEG));
const FORWARD = new THREE.Vector3(0, 0, 1);
const TRAIL_COLOR = new THREE.Color(0.86, 0.86, 0.88);

export class UnitMissilePool {
  private readonly scene: THREE.Scene;
  private readonly root = new THREE.Group();
  private readonly missiles: UnitMissile[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly incomingList: Array<{ position: THREE.Vector3; targetIsPlayer: boolean }> = [];

  private readonly aim = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly toDecoy = new THREE.Vector3();
  private readonly trailDir = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor(scene: THREE.Scene, capacity = 24) {
    this.scene = scene;
    this.root.name = 'UnitMissiles';
    const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.22, 3.4, 8);
    bodyGeometry.rotateX(Math.PI / 2);
    const noseGeometry = new THREE.ConeGeometry(0.2, 0.8, 8);
    noseGeometry.rotateX(Math.PI / 2);
    noseGeometry.translate(0, 0, 2.1);
    const finGeometry = new THREE.BoxGeometry(1.05, 0.05, 0.5);
    finGeometry.translate(0, 0, -1.45);
    const finGeometry2 = new THREE.BoxGeometry(0.05, 1.05, 0.5);
    finGeometry2.translate(0, 0, -1.45);
    const glowGeometry = new THREE.SphereGeometry(0.42, 8, 6);
    this.geometries.push(bodyGeometry, noseGeometry, finGeometry, finGeometry2, glowGeometry);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe9ecef,
      roughness: 0.45,
      metalness: 0.3,
    });
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0xc4252d,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x5a0508,
      emissiveIntensity: 0.8,
    });
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x30343a,
      roughness: 0.6,
      metalness: 0.3,
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb35a,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
    });
    this.materials.push(bodyMaterial, noseMaterial, finMaterial, glowMaterial);

    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Group();
      mesh.name = 'UNIT_MISSILE';
      mesh.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
      mesh.add(new THREE.Mesh(noseGeometry, noseMaterial));
      mesh.add(new THREE.Mesh(finGeometry, finMaterial));
      mesh.add(new THREE.Mesh(finGeometry2, finMaterial));
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.set(0, 0, -1.9);
      glow.scale.set(1, 1, 2.2);
      glow.renderOrder = 0;
      mesh.add(glow);
      mesh.visible = false;
      mesh.userData.unitMissile = true;
      this.root.add(mesh);
      const position = mesh.position;
      this.missiles.push({
        active: false,
        mesh,
        glow,
        position,
        direction: new THREE.Vector3(0, 0, 1),
        speed: 0,
        maxSpeed: 0,
        turnRate: 0,
        life: 0,
        age: 0,
        boostUpTime: 0,
        damage: 0,
        targetKind: 'none',
        targetUnit: null,
        decoyRef: null,
        decoyPoint: new THREE.Vector3(),
        minDistance: Infinity,
        lastDistance: Infinity,
        trailTimer: 0,
        incoming: { position: new THREE.Vector3(), targetIsPlayer: false },
      });
    }
    this.scene.add(this.root);
  }

  getActiveCount(): number {
    let count = 0;
    for (const missile of this.missiles) if (missile.active) count++;
    return count;
  }

  /** 发射；池满或参数非法返回 false */
  launch(
    from: THREE.Vector3,
    direction: THREE.Vector3,
    target: 'player' | UnitEntity,
    damage: number,
    options: UnitMissileLaunchOptions
  ): boolean {
    if (!isFiniteVector(from) || !isFiniteVector(direction)) return false;
    const missile = this.missiles.find((entry) => !entry.active);
    if (!missile) return false;
    missile.active = true;
    missile.position.copy(from);
    missile.direction.copy(direction);
    if (missile.direction.lengthSq() < 1e-8) missile.direction.set(0, 1, 0);
    missile.direction.normalize();
    missile.maxSpeed = options.maxSpeed;
    missile.speed = options.launchSpeed ?? options.maxSpeed * 0.4;
    missile.turnRate = options.turnRate;
    missile.life = options.life;
    missile.age = 0;
    missile.boostUpTime = options.boostUpTime ?? 0;
    missile.damage = damage;
    missile.targetKind = target === 'player' ? 'player' : 'unit';
    missile.targetUnit = target === 'player' ? null : target;
    missile.decoyRef = null;
    missile.minDistance = Infinity;
    missile.lastDistance = Infinity;
    missile.trailTimer = 0;
    missile.mesh.visible = true;
    missile.mesh.quaternion.setFromUnitVectors(FORWARD, missile.direction);
    return true;
  }

  update(deltaTime: number, env: UnitMissileEnv): void {
    for (const missile of this.missiles) {
      if (!missile.active) continue;
      missile.age += deltaTime;
      missile.life -= deltaTime;
      if (missile.life <= 0) {
        this.detonate(missile, env, true, 0.7);
        continue;
      }
      this.updateSeeker(missile, env);
      const hasAim = this.resolveAim(missile, env);
      missile.speed = Math.min(missile.maxSpeed, missile.speed + 70 * deltaTime);

      if (missile.age > missile.boostUpTime && hasAim) {
        this.desired.subVectors(this.aim, missile.position);
        const distance = this.desired.length();
        if (distance > 1e-4) {
          this.desired.multiplyScalar(1 / distance);
          this.steer(missile, this.desired, missile.turnRate * deltaTime);
        }
      }
      missile.position.addScaledVector(missile.direction, missile.speed * deltaTime);
      if (!isFiniteVector(missile.position)) {
        this.deactivate(missile);
        continue;
      }
      missile.mesh.quaternion.setFromUnitVectors(FORWARD, missile.direction);
      const flicker = 0.85 + Math.random() * 0.35;
      missile.glow.scale.set(flicker, flicker, 2.2 * flicker);

      // 尾烟
      missile.trailTimer -= deltaTime;
      if (missile.trailTimer <= 0 && env.particleSystem) {
        missile.trailTimer = 0.05;
        this.trailDir.copy(missile.direction);
        env.particleSystem.createMissileTrail(missile.position, this.trailDir, TRAIL_COLOR, 1.05);
      }

      if (this.checkFuze(missile, env)) continue;

      // 撞地
      const surfaceY = env.sampleSurfaceY(missile.position.x, missile.position.z);
      if (missile.age > 0.6 && missile.position.y <= surfaceY + 0.5) {
        missile.position.y = surfaceY + 0.5;
        this.detonate(missile, env, true, 0.9);
      }
    }
  }

  private updateSeeker(missile: UnitMissile, env: UnitMissileEnv): void {
    if (missile.targetKind === 'decoy') {
      // 诱饵仍存在 → 跟随其最新位置
      if (missile.decoyRef) {
        let stillActive = false;
        for (const decoy of env.decoys) {
          if (decoy === missile.decoyRef) {
            stillActive = true;
            break;
          }
        }
        if (stillActive && isFiniteVector(missile.decoyRef.position)) {
          missile.decoyPoint.copy(missile.decoyRef.position);
        } else {
          missile.decoyRef = null;
        }
      }
      return;
    }
    if (missile.targetKind !== 'player' && missile.targetKind !== 'unit') return;
    if (env.decoys.length === 0) return;
    let best: DecoyPoint | null = null;
    let bestScore = 0;
    for (const decoy of env.decoys) {
      if (!decoy || !(decoy.strength > 0.05) || !isFiniteVector(decoy.position)) continue;
      this.toDecoy.subVectors(decoy.position, missile.position);
      const distance = this.toDecoy.length();
      if (distance > UNIT_MISSILE_SEEKER_RANGE || distance < 1e-3) continue;
      const cos = this.toDecoy.dot(missile.direction) / distance;
      if (cos < SEEKER_COS) continue;
      const score = decoy.strength * (0.6 + 0.4 * cos);
      if (score > bestScore) {
        bestScore = score;
        best = decoy;
      }
    }
    if (best) {
      missile.targetKind = 'decoy';
      missile.targetUnit = null;
      missile.decoyRef = best;
      missile.decoyPoint.copy(best.position);
      env.onDecoyed?.(missile.position);
    }
  }

  private resolveAim(missile: UnitMissile, env: UnitMissileEnv): boolean {
    switch (missile.targetKind) {
      case 'player': {
        const distance = missile.position.distanceTo(env.playerPosition);
        const lead = Math.min(2, distance / Math.max(1, missile.speed)) * 0.85;
        this.aim.copy(env.playerPosition).addScaledVector(env.playerVelocity, lead);
        return isFiniteVector(this.aim);
      }
      case 'unit': {
        const target = missile.targetUnit;
        if (!target || !target.isAlive()) {
          missile.targetKind = 'none';
          missile.targetUnit = null;
          missile.life = Math.min(missile.life, 1.2);
          return false;
        }
        const distance = missile.position.distanceTo(target.mesh.position);
        const lead = Math.min(2, distance / Math.max(1, missile.speed)) * 0.8;
        this.aim.copy(target.mesh.position).addScaledVector(target.velocity, lead);
        return isFiniteVector(this.aim);
      }
      case 'decoy':
        this.aim.copy(missile.decoyPoint);
        return true;
      default:
        return false;
    }
  }

  private steer(missile: UnitMissile, desired: THREE.Vector3, maxTurn: number): void {
    const dot = THREE.MathUtils.clamp(missile.direction.dot(desired), -1, 1);
    const angle = Math.acos(dot);
    if (angle <= maxTurn) {
      missile.direction.copy(desired);
      return;
    }
    this.axis.crossVectors(missile.direction, desired);
    if (this.axis.lengthSq() < 1e-10) {
      // 正后方：任选一个垂直轴
      this.axis.set(0, 1, 0).cross(missile.direction);
      if (this.axis.lengthSq() < 1e-10) this.axis.set(1, 0, 0);
    }
    this.axis.normalize();
    this.rotation.setFromAxisAngle(this.axis, maxTurn);
    missile.direction.applyQuaternion(this.rotation).normalize();
  }

  /** 引信判定；返回 true 表示已起爆 */
  private checkFuze(missile: UnitMissile, env: UnitMissileEnv): boolean {
    switch (missile.targetKind) {
      case 'player': {
        const distance = missile.position.distanceTo(env.playerPosition);
        if (distance <= UNIT_MISSILE_PROXIMITY) {
          env.onPlayerHit(missile.damage, missile.position);
          this.detonate(missile, env, false, 1.2);
          return true;
        }
        missile.minDistance = Math.min(missile.minDistance, distance);
        const passing = distance > missile.lastDistance + 0.05;
        missile.lastDistance = distance;
        if (passing && missile.minDistance <= UNIT_MISSILE_FRAGMENT_RADIUS) {
          env.onPlayerHit(missile.damage * 0.5, missile.position);
          this.detonate(missile, env, false, 1.0);
          return true;
        }
        return false;
      }
      case 'unit': {
        const target = missile.targetUnit;
        if (!target) return false;
        const distance = missile.position.distanceTo(target.mesh.position);
        if (distance <= target.hitRadius + 2) {
          env.onUnitHit(target, missile.damage, missile.position);
          this.detonate(missile, env, false, 1.2);
          return true;
        }
        return false;
      }
      case 'decoy': {
        if (missile.position.distanceTo(missile.decoyPoint) <= 7) {
          this.detonate(missile, env, true, 0.9);
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  private detonate(
    missile: UnitMissile,
    env: UnitMissileEnv,
    harmless: boolean,
    scale: number
  ): void {
    env.particleSystem?.createMissileImpact(missile.position, scale);
    env.onDetonate(missile.position, scale, harmless);
    this.deactivate(missile);
  }

  private deactivate(missile: UnitMissile): void {
    missile.active = false;
    missile.mesh.visible = false;
    missile.targetUnit = null;
    missile.decoyRef = null;
    missile.targetKind = 'none';
  }

  /** 填充“来袭导弹”列表（复用条目对象，结果在下一次调用前有效） */
  getIncoming(): ReadonlyArray<{ position: THREE.Vector3; targetIsPlayer: boolean }> {
    this.incomingList.length = 0;
    for (const missile of this.missiles) {
      if (!missile.active) continue;
      missile.incoming.position.copy(missile.position);
      missile.incoming.targetIsPlayer = missile.targetKind === 'player';
      this.incomingList.push(missile.incoming);
    }
    return this.incomingList.slice();
  }

  /** 是否有导弹正在追踪玩家 */
  hasMissileTargetingPlayer(): boolean {
    for (const missile of this.missiles) {
      if (missile.active && missile.targetKind === 'player') return true;
    }
    return false;
  }

  /** EMP / 拦截：半径内导弹无害销毁，返回数量 */
  destroyInRadius(center: THREE.Vector3, radius: number, env: UnitMissileEnv, chance = 1): number {
    if (!isFiniteVector(center) || !(radius > 0)) return 0;
    let count = 0;
    const radiusSq = radius * radius;
    for (const missile of this.missiles) {
      if (!missile.active) continue;
      if (missile.position.distanceToSquared(center) > radiusSq) continue;
      if (chance < 1 && Math.random() > chance) continue;
      this.detonate(missile, env, true, 0.75);
      count++;
    }
    return count;
  }

  /** 找到半径内最近的一枚来袭导弹位置（近防炮瞄准用） */
  findNearest(center: THREE.Vector3, radius: number, out: THREE.Vector3): boolean {
    let bestSq = radius * radius;
    let found = false;
    for (const missile of this.missiles) {
      if (!missile.active || missile.targetKind === 'decoy') continue;
      const distanceSq = missile.position.distanceToSquared(center);
      if (distanceSq < bestSq) {
        bestSq = distanceSq;
        out.copy(missile.position);
        found = true;
      }
    }
    return found;
  }

  /** 目标单位死亡 / 移除时调用，避免悬挂引用 */
  forgetUnit(unit: UnitEntity): void {
    for (const missile of this.missiles) {
      if (missile.targetUnit === unit) {
        missile.targetUnit = null;
        missile.targetKind = 'none';
        missile.life = Math.min(missile.life, 1.2);
      }
    }
  }

  clear(): void {
    for (const missile of this.missiles) this.deactivate(missile);
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.root);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.missiles.length = 0;
  }
}

export function isFiniteVector(v: THREE.Vector3): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}
