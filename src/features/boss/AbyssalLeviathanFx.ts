import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  applyVerticalGradient,
  createGlowMaterial,
  createGlowSprite,
  isFiniteVector,
  type HazardProbeResult,
} from './MagmaColossusHazards';

/**
 * 深渊利维坦的专属特效 / 危险物：
 * - AbyssalLeviathanMineField：漂浮触发水雷（可被击毁的独立目标，接近后闪烁预警再起爆）。
 * - AbyssalLeviathanShards：破冰上浮时四散的冰块碎片。
 * - AbyssalLeviathanWake：艇体航行时的 V 形尾流（潜航时用来追踪位置）。
 * - AbyssalLeviathanLaneMarker：冲撞航道预警（水面红色长条）。
 */

// ---------------------------------------------------------------------------------------------
// 水雷
// ---------------------------------------------------------------------------------------------

export interface LeviathanMineSpec {
  blastRadius: number;
  triggerRadius: number;
  damage: number;
  lifetime: number;
  armTime: number;
  health: number;
}

type MineState = 'idle' | 'floating' | 'armed' | 'blast';

interface MineSlot {
  root: THREE.Group;
  body: THREE.Mesh;
  cap: THREE.Mesh;
  capMaterial: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  warning: THREE.Mesh;
  warningMaterial: THREE.MeshBasicMaterial;
  state: MineState;
  harmless: boolean;
  hp: number;
  age: number;
  timer: number;
  seed: number;
  position: THREE.Vector3;
  spec: LeviathanMineSpec;
}

const MINE_BLAST_WINDOW = 0.24;

export class AbyssalLeviathanMineField {
  /** 起爆回调（harmless = 被玩家击毁的哑爆） */
  public onDetonate?: (position: THREE.Vector3, harmless: boolean, blastRadius: number) => void;
  /** 进入引信倒计时 */
  public onArm?: (position: THREE.Vector3) => void;

  private readonly root: THREE.Group;
  private readonly slots: MineSlot[] = [];
  private readonly bySlotMesh = new Map<THREE.Object3D, MineSlot>();
  private readonly bodyGeometry: THREE.BufferGeometry;
  private readonly capGeometry: THREE.SphereGeometry;
  private readonly warningGeometry: THREE.RingGeometry;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly glowMaterials: THREE.SpriteMaterial[] = [];
  private readonly temp = new THREE.Vector3();

  constructor(parent: THREE.Object3D, capacity: number, size: number) {
    this.root = new THREE.Group();
    this.root.name = 'leviathan_mines';
    parent.add(this.root);

    // 带触角的球形水雷（合并为单个几何体）
    const parts: THREE.BufferGeometry[] = [new THREE.IcosahedronGeometry(size, 1)];
    const axes: Array<[number, number, number]> = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0.7, 0.7, 0],
      [-0.7, 0.7, 0],
      [0, 0.7, 0.7],
      [0, 0.7, -0.7],
    ];
    const up = new THREE.Vector3(0, 1, 0);
    for (const [x, y, z] of axes) {
      const dir = new THREE.Vector3(x, y, z).normalize();
      const horn = new THREE.CylinderGeometry(
        size * 0.12,
        size * 0.16,
        size * 0.7,
        6
      ).toNonIndexed();
      horn.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
      horn.translate(dir.x * size * 1.05, dir.y * size * 1.05, dir.z * size * 1.05);
      parts.push(horn);
    }
    this.bodyGeometry = mergeGeometries(parts, false) ?? new THREE.IcosahedronGeometry(size, 1);
    for (const part of parts) part.dispose();
    this.capGeometry = new THREE.SphereGeometry(size * 0.32, 10, 8);
    this.warningGeometry = new THREE.RingGeometry(0.9, 1, 40, 1);
    this.warningGeometry.rotateX(-Math.PI / 2);
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x23292e,
      roughness: 0.5,
      metalness: 0.7,
      flatShading: true,
      emissive: 0x220406,
      emissiveIntensity: 0.6,
    });

    for (let i = 0; i < capacity; i++) {
      const slotRoot = new THREE.Group();
      slotRoot.name = `leviathan_mine_${i}`;
      slotRoot.visible = false;
      const body = new THREE.Mesh(this.bodyGeometry, this.bodyMaterial);
      body.name = `leviathan_mine_body_${i}`;
      body.userData.hitRadius = size * 2.4;
      // 供控制器在导弹锁定时过滤（水雷可被击毁，但不应抢走对 Boss 本体的锁定）
      body.userData.bossHazardTarget = true;
      const capMaterial = new THREE.MeshStandardMaterial({
        color: 0x330608,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0xff2a2a,
        emissiveIntensity: 1,
      });
      const cap = new THREE.Mesh(this.capGeometry, capMaterial);
      cap.position.y = size * 0.95;
      const glow = createGlowSprite(0xff3030, size * 6, 0.6, 'glow', false);
      glow.position.y = size * 1.1;
      this.glowMaterials.push(glow.material);
      const warningMaterial = createGlowMaterial(0xff4030, 0, {
        side: THREE.DoubleSide,
        fog: false,
      });
      const warning = new THREE.Mesh(this.warningGeometry, warningMaterial);
      warning.visible = false;
      warning.frustumCulled = false;
      warning.renderOrder = 0;
      slotRoot.add(body, cap, glow, warning);
      this.root.add(slotRoot);
      const slot: MineSlot = {
        root: slotRoot,
        body,
        cap,
        capMaterial,
        glow,
        warning,
        warningMaterial,
        state: 'idle',
        harmless: false,
        hp: 1,
        age: 0,
        timer: 0,
        seed: i * 1.913,
        position: new THREE.Vector3(),
        spec: { blastRadius: 1, triggerRadius: 1, damage: 0, lifetime: 1, armTime: 0.5, health: 1 },
      };
      this.slots.push(slot);
      this.bySlotMesh.set(body, slot);
    }
  }

  public spawn(position: THREE.Vector3, spec: LeviathanMineSpec): boolean {
    if (!isFiniteVector(position)) return false;
    const slot = this.slots.find((entry) => entry.state === 'idle');
    if (!slot) return false;
    slot.state = 'floating';
    slot.harmless = false;
    slot.spec = { ...spec };
    slot.hp = Math.max(1, spec.health);
    slot.age = 0;
    slot.timer = 0;
    slot.position.copy(position);
    slot.root.position.copy(position);
    slot.root.visible = true;
    slot.body.visible = true;
    slot.cap.visible = true;
    slot.glow.visible = true;
    slot.warning.visible = false;
    slot.warning.scale.set(spec.blastRadius, 1, spec.blastRadius);
    return true;
  }

  /** triggers：可触发水雷的目标位置（玩家 / 友军），只读引用 */
  public update(deltaTime: number, triggers: readonly THREE.Vector3[]): void {
    for (const slot of this.slots) {
      if (slot.state === 'idle') continue;
      slot.age += deltaTime;
      const t = slot.age;

      if (slot.state === 'blast') {
        slot.timer -= deltaTime;
        if (slot.timer <= 0) this.release(slot);
        continue;
      }

      // 漂浮起伏 + 自转
      slot.root.position.set(
        slot.position.x,
        slot.position.y + Math.sin(t * 1.7 + slot.seed) * 0.9,
        slot.position.z
      );
      slot.body.rotation.y = t * 0.4 + slot.seed;
      slot.body.rotation.z = Math.sin(t * 1.3 + slot.seed) * 0.12;

      if (slot.state === 'floating') {
        // 慢速闪烁：水面上的“发光点”
        const blink = Math.pow(Math.max(0, Math.sin(t * 3.4 + slot.seed)), 6);
        slot.capMaterial.emissiveIntensity = 0.6 + blink * 3.2;
        slot.glow.material.opacity = 0.25 + blink * 0.6;
        if (t > slot.spec.lifetime) {
          this.release(slot);
          continue;
        }
        for (const trigger of triggers) {
          if (!isFiniteVector(trigger)) continue;
          if (trigger.distanceToSquared(slot.position) <= slot.spec.triggerRadius ** 2) {
            slot.state = 'armed';
            slot.timer = slot.spec.armTime;
            slot.warning.visible = true;
            this.onArm?.(slot.position);
            break;
          }
        }
        continue;
      }

      // armed：急促闪烁 + 爆炸半径圈
      slot.timer -= deltaTime;
      const fast = 0.5 + 0.5 * Math.sin(t * 38);
      slot.capMaterial.emissiveIntensity = 1.5 + fast * 4;
      slot.glow.material.opacity = 0.5 + fast * 0.5;
      const glowSize = slot.spec.blastRadius * (0.5 + 0.3 * fast);
      slot.glow.scale.set(glowSize, glowSize, 1);
      slot.warningMaterial.opacity = 0.35 + 0.5 * fast;
      if (slot.timer <= 0) this.detonate(slot, false);
    }
  }

  private detonate(slot: MineSlot, harmless: boolean): void {
    slot.state = 'blast';
    slot.harmless = harmless;
    slot.timer = MINE_BLAST_WINDOW;
    slot.body.visible = false;
    slot.cap.visible = false;
    slot.glow.visible = false;
    slot.warning.visible = false;
    this.onDetonate?.(slot.position, harmless, slot.spec.blastRadius);
  }

  private release(slot: MineSlot): void {
    slot.state = 'idle';
    slot.root.visible = false;
    slot.warning.visible = false;
  }

  public isMine(part: THREE.Object3D): boolean {
    return this.bySlotMesh.has(part);
  }

  /** 玩家击中水雷；返回 true 表示命中了一枚有效水雷 */
  public damage(part: THREE.Object3D, amount: number): boolean {
    const slot = this.bySlotMesh.get(part);
    if (!slot || (slot.state !== 'floating' && slot.state !== 'armed')) return false;
    if (!Number.isFinite(amount) || amount <= 0) return true;
    slot.hp -= amount;
    if (slot.hp <= 0) this.detonate(slot, true);
    return true;
  }

  /** 把可被击中的水雷网格追加到 out */
  public collectTargets(out: THREE.Object3D[]): void {
    for (const slot of this.slots) {
      if (slot.state === 'floating' || slot.state === 'armed') out.push(slot.body);
    }
  }

  public probe(target: THREE.Vector3, targetRadius: number, out: HazardProbeResult): void {
    for (const slot of this.slots) {
      if (slot.state !== 'blast' || slot.harmless || slot.spec.damage <= 0) continue;
      const reach = slot.spec.blastRadius + targetRadius;
      if (this.temp.subVectors(target, slot.position).lengthSq() > reach * reach) continue;
      if (slot.spec.damage > out.damage) {
        out.damage = slot.spec.damage;
        out.profile = 'flak-hit';
        out.position.copy(slot.position);
      }
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.state === 'floating' || slot.state === 'armed') count++;
    return count;
  }

  public clear(): void {
    for (const slot of this.slots) this.release(slot);
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    for (const slot of this.slots) {
      slot.capMaterial.dispose();
      slot.warningMaterial.dispose();
    }
    for (const material of this.glowMaterials) material.dispose();
    this.bodyGeometry.dispose();
    this.capGeometry.dispose();
    this.warningGeometry.dispose();
    this.bodyMaterial.dispose();
    this.slots.length = 0;
    this.bySlotMesh.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// 冰块碎片
// ---------------------------------------------------------------------------------------------

interface ShardSlot {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

export class AbyssalLeviathanShards {
  private readonly root: THREE.Group;
  private readonly slots: ShardSlot[] = [];
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly spinQuat = new THREE.Quaternion();
  private cursor = 0;

  constructor(parent: THREE.Object3D, capacity: number, size: number) {
    this.root = new THREE.Group();
    this.root.name = 'leviathan_ice_shards';
    parent.add(this.root);
    this.geometry = new THREE.TetrahedronGeometry(size, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xe8f8ff,
      roughness: 0.15,
      metalness: 0.05,
      flatShading: true,
      emissive: 0x6fc4e6,
      emissiveIntensity: 0.35,
    });
    for (let i = 0; i < capacity; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.name = `leviathan_ice_shard_${i}`;
      mesh.visible = false;
      this.root.add(mesh);
      this.slots.push({
        mesh,
        velocity: new THREE.Vector3(),
        axis: new THREE.Vector3(0, 1, 0),
        spin: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        active: false,
      });
    }
  }

  public burst(center: THREE.Vector3, count: number, radius: number, speed: number): void {
    if (!isFiniteVector(center) || this.slots.length === 0) return;
    for (let n = 0; n < count; n++) {
      const slot = this.slots[this.cursor];
      this.cursor = (this.cursor + 1) % this.slots.length;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      slot.mesh.position.set(
        center.x + Math.cos(angle) * r,
        center.y + Math.random() * radius * 0.2,
        center.z + Math.sin(angle) * r * 1.6
      );
      slot.velocity.set(
        Math.cos(angle) * speed * (0.3 + Math.random() * 0.5),
        speed * (0.7 + Math.random() * 0.6),
        Math.sin(angle) * speed * (0.3 + Math.random() * 0.5)
      );
      slot.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      slot.spin = (Math.random() - 0.5) * 9;
      slot.maxLife = 2.4 + Math.random() * 1.2;
      slot.life = slot.maxLife;
      slot.size = 0.6 + Math.random() * 1.2;
      slot.mesh.scale.setScalar(slot.size);
      slot.mesh.visible = true;
      slot.active = true;
    }
  }

  public update(deltaTime: number, seaY: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.life -= deltaTime;
      slot.velocity.y -= 32 * deltaTime;
      slot.mesh.position.addScaledVector(slot.velocity, deltaTime);
      this.spinQuat.setFromAxisAngle(slot.axis, slot.spin * deltaTime);
      slot.mesh.quaternion.multiply(this.spinQuat);
      const fade = Math.min(1, slot.life / 0.5);
      slot.mesh.scale.setScalar(Math.max(0.01, slot.size * fade));
      if (slot.life <= 0 || (slot.mesh.position.y < seaY - 4 && slot.velocity.y < 0)) {
        slot.active = false;
        slot.mesh.visible = false;
      }
    }
  }

  public clear(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.mesh.visible = false;
    }
  }

  public dispose(): void {
    this.clear();
    this.root.parent?.remove(this.root);
    this.geometry.dispose();
    this.material.dispose();
    this.slots.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// V 形尾流
// ---------------------------------------------------------------------------------------------

export class AbyssalLeviathanWake {
  private readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;

  constructor(parent: THREE.Object3D, length: number, width: number) {
    // 两条从艏部向后张开的泡沫带 + 中间螺旋桨涡流带
    const positions: number[] = [];
    const colors: number[] = [];
    const quad = (
      ax: number,
      az: number,
      bx: number,
      bz: number,
      halfWidth: number,
      brightA: number,
      brightB: number
    ): void => {
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.max(1e-6, Math.sqrt(dx * dx + dz * dz));
      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;
      const verts = [
        [ax - nx, az - nz, brightA],
        [ax + nx, az + nz, brightA],
        [bx + nx * 2.2, bz + nz * 2.2, brightB],
        [ax - nx, az - nz, brightA],
        [bx + nx * 2.2, bz + nz * 2.2, brightB],
        [bx - nx * 2.2, bz - nz * 2.2, brightB],
      ];
      for (const [x, z, c] of verts) {
        positions.push(x, 0, z);
        colors.push(c, c, c);
      }
    };
    const spread = width * 0.5;
    quad(0, 0, spread, -length, width * 0.05, 1, 0);
    quad(0, 0, -spread, -length, width * 0.05, 1, 0);
    quad(0, -length * 0.42, 0, -length * 1.05, width * 0.06, 0.8, 0);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.material = createGlowMaterial(0xdff6ff, 0, {
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'leviathan_wake';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** apex：艏部在水面的投影；intensity 0..1 */
  public update(apex: THREE.Vector3, yaw: number, intensity: number): void {
    const visible = intensity > 0.02 && isFiniteVector(apex);
    this.mesh.visible = visible;
    if (!visible) return;
    this.mesh.position.set(apex.x, apex.y + 0.4, apex.z);
    this.mesh.rotation.set(0, yaw, 0);
    this.material.opacity = Math.min(0.7, intensity * 0.7);
  }

  public dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// 冲撞航道预警
// ---------------------------------------------------------------------------------------------

export class AbyssalLeviathanLaneMarker {
  private readonly root: THREE.Group;
  private readonly fillGeometry: THREE.PlaneGeometry;
  private readonly edgeGeometry: THREE.BoxGeometry;
  private readonly fillMaterial: THREE.MeshBasicMaterial;
  private readonly edgeMaterial: THREE.MeshBasicMaterial;
  private readonly fill: THREE.Mesh;
  private readonly edges: THREE.Mesh[] = [];
  private time = 0;

  constructor(parent: THREE.Object3D) {
    this.root = new THREE.Group();
    this.root.name = 'leviathan_ram_lane';
    this.root.visible = false;
    parent.add(this.root);
    this.fillGeometry = new THREE.PlaneGeometry(1, 1, 1, 8);
    this.fillGeometry.rotateX(-Math.PI / 2);
    this.fillGeometry.translate(0, 0, 0.5);
    // 沿航道由近及远渐隐（借用竖直渐变：先把 z 映射到 y 再换回）
    this.fillGeometry.rotateX(-Math.PI / 2);
    applyVerticalGradient(this.fillGeometry, 0xffffff, 0x1a0000, 0.8);
    this.fillGeometry.rotateX(Math.PI / 2);
    this.fillMaterial = createGlowMaterial(0xff2a20, 0, {
      side: THREE.DoubleSide,
      fog: false,
      vertexColors: true,
    });
    this.fill = new THREE.Mesh(this.fillGeometry, this.fillMaterial);
    this.fill.frustumCulled = false;
    this.fill.renderOrder = 0;
    this.edgeGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.edgeGeometry.translate(0, 0, 0.5);
    this.edgeMaterial = createGlowMaterial(0xff4a30, 0, { fog: false });
    this.root.add(this.fill);
    for (let i = 0; i < 2; i++) {
      const edge = new THREE.Mesh(this.edgeGeometry, this.edgeMaterial);
      edge.frustumCulled = false;
      edge.renderOrder = 0;
      this.edges.push(edge);
      this.root.add(edge);
    }
  }

  public show(start: THREE.Vector3, yaw: number, length: number, width: number): void {
    if (!isFiniteVector(start)) return;
    this.root.visible = true;
    this.root.position.set(start.x, start.y + 0.8, start.z);
    this.root.rotation.set(0, yaw, 0);
    this.fill.scale.set(width, 1, length);
    this.edges.forEach((edge, i) => {
      edge.position.set((i === 0 ? 1 : -1) * width * 0.5, 0, 0);
      edge.scale.set(width * 0.03, 1.2, length);
    });
    this.time = 0;
  }

  /** 跟随艇体（预警期间艇体仍在调整航向） */
  public follow(start: THREE.Vector3, yaw: number): void {
    if (!this.root.visible || !isFiniteVector(start)) return;
    this.root.position.set(start.x, start.y + 0.8, start.z);
    this.root.rotation.set(0, yaw, 0);
  }

  public update(deltaTime: number, progress: number): void {
    if (!this.root.visible) return;
    this.time += deltaTime;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (9 + 18 * progress));
    this.fillMaterial.opacity = 0.18 + 0.35 * progress + 0.12 * pulse;
    this.edgeMaterial.opacity = 0.45 + 0.45 * pulse;
  }

  public hide(): void {
    this.root.visible = false;
    this.fillMaterial.opacity = 0;
    this.edgeMaterial.opacity = 0;
  }

  public dispose(): void {
    this.hide();
    this.root.parent?.remove(this.root);
    this.fillGeometry.dispose();
    this.edgeGeometry.dispose();
    this.fillMaterial.dispose();
    this.edgeMaterial.dispose();
  }
}
