import * as THREE from 'three';
import { EnemyAI } from './EnemyAI';
import { EnemyConfig } from './EnemyTypes';

/**
 * 编队位（玩家水平航向坐标系，米）：0 号在左、1 号在右，之后左右交替向外、向后错开。
 * 位于机翼线前方约 38 米：16:9 追尾视角里僚机落在画面两侧约三分之一处（避开四角 HUD 面板），
 * 又远离相机与座机之间的视线走廊。
 */
const SLOT_LATERAL = 40;
const SLOT_AHEAD = 38;
const SLOT_UP = 6;
const SLOT_RANK_LATERAL = 35;
const SLOT_RANK_BACK = 25;
const SLOT_RANK_UP = 4;

/** 编队位在玩家水平航向坐标系中的偏移（米）：along 向前、lateral 向右、up 向上 */
export interface FormationSlotOffset {
  /** -1 = 左侧，1 = 右侧 */
  side: number;
  along: number;
  lateral: number;
  up: number;
}

/**
 * 第 slot 号编队位的偏移（写入 out 并返回，不分配）：偶数号在左、奇数号在右，每排再向外、
 * 向后、向上错开。编队布局只在这里定义，EnemySystem 的友机入场点也按它取值。
 */
export function getFormationSlotOffset(
  slot: number,
  out: FormationSlotOffset
): FormationSlotOffset {
  const safeSlot = Number.isInteger(slot) && slot >= 0 ? slot : 0;
  const side = safeSlot % 2 === 0 ? -1 : 1;
  const rank = Math.floor(safeSlot / 2);
  out.side = side;
  out.along = SLOT_AHEAD - rank * SLOT_RANK_BACK;
  out.lateral = side * (SLOT_LATERAL + rank * SLOT_RANK_LATERAL);
  out.up = SLOT_UP + rank * SLOT_RANK_UP;
  return out;
}

/**
 * 追尾相机视线走廊（同一坐标系）：座机后 60 米（相机在后 15 米）到前 35 米、横向 ±28 米。
 * 空闲僚机不停留在走廊内，也不横穿走廊；需要换边时从走廊后方（相机之后，画面外）或前方绕行。
 */
const CORRIDOR_BACK = 60;
const CORRIDOR_FRONT = 35;
const CORRIDOR_HALF_WIDTH = 28;
/** 绕行航路点超出走廊前后端的距离（米）；右侧编队位再多错开一段，两架换边时航线不交汇 */
const CORRIDOR_DETOUR = 18;
const CORRIDOR_DETOUR_STAGGER = 22;

/** 编队飞行：位置误差增益（1/s）、修正速度上限（m/s）、最低速度、转向角速度（rad/s）、加速度 */
const FORMATION_GAIN = 0.6;
/** 已在视线走廊内时的让出增益（更快离开画面中央） */
const FORMATION_ESCAPE_GAIN = 1.4;
const FORMATION_MAX_CLOSURE = 45;
const FORMATION_MIN_SPEED = 18;
const FORMATION_TURN_RATE = 2;
const FORMATION_ACCEL = 25;
/** 爬升 / 俯冲指令的最大坡度（竖直速度 / 水平速度） */
const FORMATION_MAX_SLOPE = 0.7;
/** 玩家水平速度低于此值（m/s）时沿用上一次航向 */
const HEADING_MIN_SPEED = 2;

// 逐帧复用的临时对象（所有僚机共享，update 内同步使用）
const tmpSelf = new THREE.Vector3();
const tmpCandidate = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpDesired = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpSlot: FormationSlotOffset = { side: -1, along: 0, lateral: 0, up: 0 };
/** Liang–Barsky 裁剪区间（crossesCorridor 内部使用） */
const clipRange = { t0: 0, t1: 1 };

function isFiniteVector(vector: THREE.Vector3): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 点（along, lateral）是否在相机视线走廊内 */
function insideCorridor(along: number, lateral: number): boolean {
  return (
    along > -CORRIDOR_BACK && along < CORRIDOR_FRONT && Math.abs(lateral) < CORRIDOR_HALF_WIDTH
  );
}

function clipEdge(p: number, q: number): boolean {
  if (Math.abs(p) < 1e-9) {
    return q >= 0;
  }
  const r = q / p;
  if (p < 0) {
    if (r > clipRange.t1) return false;
    if (r > clipRange.t0) clipRange.t0 = r;
  } else {
    if (r < clipRange.t0) return false;
    if (r < clipRange.t1) clipRange.t1 = r;
  }
  return true;
}

/** 线段 (a0, l0) → (a1, l1) 是否穿过相机视线走廊（Liang–Barsky 裁剪） */
function crossesCorridor(a0: number, l0: number, a1: number, l1: number): boolean {
  clipRange.t0 = 0;
  clipRange.t1 = 1;
  const da = a1 - a0;
  const dl = l1 - l0;
  return (
    clipEdge(-da, a0 + CORRIDOR_BACK) &&
    clipEdge(da, CORRIDOR_FRONT - a0) &&
    clipEdge(-dl, l0 + CORRIDOR_HALF_WIDTH) &&
    clipEdge(dl, CORRIDOR_HALF_WIDTH - l0)
  );
}

export class FriendlyAI {
  private enemy: EnemyAI;
  public isFriendly: boolean = true;
  /** 编队位序号：0 = 左翼、1 = 右翼、2 = 左二……（EnemySystem 入场时分配） */
  private formationSlot: number = 0;
  /** 当前攻击目标的世界坐标（复用；EnemyAI 持有其引用作为追踪点） */
  private readonly targetPosition = new THREE.Vector3();
  /** 玩家水平航向（单位向量）；玩家几乎不动时沿用上一次 */
  private readonly playerHeading = new THREE.Vector3(0, 0, -1);

  constructor(mesh: THREE.Group, config: EnemyConfig, scene: THREE.Scene) {
    this.enemy = new EnemyAI(mesh, config, scene);

    mesh.userData.isFriendly = true;

    this.enemy.onFire = (
      _position: THREE.Vector3,
      _direction: THREE.Vector3,
      _damage: number
    ) => {};
  }

  /**
   * 有敌机（或 Boss 本体 / 部件等额外目标）时照旧追击最近的目标；没有目标时飞向编队位。
   * playerVelocity：由相邻两步玩家位置推算的速度（EnemySystem 提供），用于航向与速度前馈；
   * 缺省时沿用上一次航向、不做前馈。
   */
  public update(
    deltaTime: number,
    enemyMeshes: readonly THREE.Object3D[],
    playerPosition: THREE.Vector3,
    playerVelocity?: THREE.Vector3
  ): void {
    const nearestEnemy = this.findNearestEnemy(enemyMeshes);

    if (nearestEnemy) {
      nearestEnemy.getWorldPosition(this.targetPosition);
      this.enemy.update(deltaTime, this.targetPosition, undefined, this.targetPosition);
    } else {
      this.flyFormation(deltaTime, playerPosition, playerVelocity);
    }
  }

  private findNearestEnemy(enemyMeshes: readonly THREE.Object3D[]): THREE.Object3D | null {
    let nearest: THREE.Object3D | null = null;
    let minDistanceSq = Infinity;

    const self = this.enemy.getMesh();
    self.getWorldPosition(tmpSelf);

    for (let i = 0; i < enemyMeshes.length; i++) {
      const enemyMesh = enemyMeshes[i];
      if (enemyMesh === self) continue;

      enemyMesh.getWorldPosition(tmpCandidate);
      const distanceSq = tmpSelf.distanceToSquared(tmpCandidate);

      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        nearest = enemyMesh;
      }
    }

    return nearest;
  }

  /**
   * 空闲时保持编队：目标为编队位；若僚机在相机视线走廊内，先就近横向让出；若直飞编队位会穿过
   * 走廊，则先飞到走廊后方 / 前方的绕行航路点。期望速度 = 玩家速度 + 位置误差修正，
   * 再以有限角速度与加速度平滑转向。
   */
  private flyFormation(
    deltaTime: number,
    playerPosition: THREE.Vector3,
    playerVelocity?: THREE.Vector3
  ): void {
    const position = this.enemy.getMesh().position;
    if (!(deltaTime > 0) || !isFiniteVector(position) || !isFiniteVector(playerPosition)) {
      // 非法输入：交还 EnemyAI（它会自行处理 NaN 位置）
      this.enemy.update(deltaTime, playerPosition, undefined, null);
      return;
    }

    const lead = playerVelocity && isFiniteVector(playerVelocity) ? playerVelocity : null;
    if (lead) {
      const horizontalSpeed = Math.hypot(lead.x, lead.z);
      if (horizontalSpeed > HEADING_MIN_SPEED) {
        this.playerHeading.set(lead.x / horizontalSpeed, 0, lead.z / horizontalSpeed);
      }
    }
    const forwardX = this.playerHeading.x;
    const forwardZ = this.playerHeading.z;
    // 右侧向量：前向 (fx, fz) → (-fz, fx)
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // 僚机在玩家航向坐标系中的位置（along 向前为正，lateral 向右为正）
    const dx = position.x - playerPosition.x;
    const dz = position.z - playerPosition.z;
    const along = dx * forwardX + dz * forwardZ;
    const lateral = dx * rightX + dz * rightZ;

    const slot = getFormationSlotOffset(this.formationSlot, tmpSlot);
    const side = slot.side;
    const slotLateral = slot.lateral;
    const slotAlong = slot.along;
    const slotUp = slot.up;

    let targetAlong = slotAlong;
    let targetLateral = slotLateral;
    let gain = FORMATION_GAIN;
    const detour = CORRIDOR_DETOUR + (side > 0 ? CORRIDOR_DETOUR_STAGGER : 0);
    if (insideCorridor(along, lateral)) {
      // 已在视线走廊内：保持前后位置，就近横向让出
      const out = Math.abs(lateral) > 2 ? Math.sign(lateral) : side;
      targetAlong = along;
      targetLateral = out * Math.abs(slotLateral);
      gain = FORMATION_ESCAPE_GAIN;
    } else if (crossesCorridor(along, lateral, slotAlong, slotLateral)) {
      if (along <= -CORRIDOR_BACK) {
        // 在走廊后方（相机之后，画面外）：先横移到本侧，再沿本侧追上
        targetAlong = -CORRIDOR_BACK - detour;
      } else if (along >= CORRIDOR_FRONT) {
        // 在走廊前方：在座机前方远处横穿
        targetAlong = CORRIDOR_FRONT + detour;
      } else {
        // 在走廊另一侧：沿当前一侧前出到走廊前方，再横穿
        targetAlong = CORRIDOR_FRONT + detour;
        targetLateral = Math.sign(lateral) * Math.max(Math.abs(lateral), Math.abs(slotLateral));
      }
    }

    tmpTarget.set(
      playerPosition.x + forwardX * targetAlong + rightX * targetLateral,
      playerPosition.y + slotUp,
      playerPosition.z + forwardZ * targetAlong + rightZ * targetLateral
    );

    // 期望速度 = 玩家速度（前馈）+ 位置误差修正（限幅）
    const desired = tmpDesired.subVectors(tmpTarget, position);
    const error = desired.length();
    desired.multiplyScalar(error > 1e-6 ? Math.min(gain, FORMATION_MAX_CLOSURE / error) : 0);
    if (lead) {
      desired.add(lead);
    }
    const horizontal = Math.hypot(desired.x, desired.z);
    desired.y = clamp(
      desired.y,
      -horizontal * FORMATION_MAX_SLOPE,
      horizontal * FORMATION_MAX_SLOPE
    );
    const leadSpeed = lead ? lead.length() : 0;
    const maxSpeed = Math.max(this.enemy.getConfig().speed, leadSpeed) + FORMATION_MAX_CLOSURE;
    const desiredSpeed = clamp(desired.length(), FORMATION_MIN_SPEED, maxSpeed);
    this.steerTowards(desired, desiredSpeed, deltaTime);

    // 运动学步进：按刚写好的速度积分（地形避让 / 朝向 / 插值照常），不跑机动状态机、不开火；
    // 遇敌后 update 从冻结的机动状态照常接管追击
    this.enemy.updateKinematic(deltaTime);
  }

  /** 以有限角速度与加速度把当前速度转向期望方向 / 速度（不瞬间掉头） */
  private steerTowards(desired: THREE.Vector3, desiredSpeed: number, deltaTime: number): void {
    const velocity = this.enemy.velocity;
    let speed = velocity.length();
    const direction = tmpDirection;
    if (Number.isFinite(speed) && speed > 1e-3) {
      direction.copy(velocity).multiplyScalar(1 / speed);
    } else {
      speed = 0;
      direction.copy(desired);
      if (direction.lengthSq() < 1e-6) {
        direction.copy(this.playerHeading);
      }
      direction.normalize();
    }

    const desiredLength = desired.length();
    if (desiredLength > 1e-3) {
      desired.multiplyScalar(1 / desiredLength);
      const angle = Math.acos(clamp(direction.dot(desired), -1, 1));
      const maxTurn = FORMATION_TURN_RATE * deltaTime;
      if (angle <= maxTurn) {
        direction.copy(desired);
      } else {
        tmpAxis.crossVectors(direction, desired);
        if (tmpAxis.lengthSq() < 1e-10) {
          // 正好反向：绕竖轴水平掉头（机头竖直时绕水平轴）
          tmpAxis.set(0, 1, 0);
          if (Math.abs(direction.y) > 0.99) tmpAxis.set(1, 0, 0);
        }
        direction.applyAxisAngle(tmpAxis.normalize(), maxTurn);
      }
    }

    const maxDelta = FORMATION_ACCEL * deltaTime;
    speed += clamp(desiredSpeed - speed, -maxDelta, maxDelta);
    velocity.copy(direction).multiplyScalar(speed);
  }

  /** EnemySystem 入场时分配的编队位（0 = 左翼、1 = 右翼、2 = 左二……） */
  public setFormationSlot(slot: number): void {
    this.formationSlot = Number.isInteger(slot) && slot >= 0 ? slot : 0;
  }

  public getFormationSlot(): number {
    return this.formationSlot;
  }

  public getMesh(): THREE.Group {
    return this.enemy.getMesh();
  }

  public getEnemy(): EnemyAI {
    return this.enemy;
  }

  public isAlive(): boolean {
    return this.enemy.isAlive();
  }

  public getHealth(): { current: number; max: number } {
    return this.enemy.getHealth();
  }

  public takeDamage(damage: number): void {
    this.enemy.takeDamage(damage);
  }

  public dispose(): void {
    this.enemy.dispose();
  }
}
