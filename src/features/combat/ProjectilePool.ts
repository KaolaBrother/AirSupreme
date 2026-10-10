import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
} from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import { getVfxTextures } from '@/features/effects/ParticleSystem';
import { getDeclaredHitRadius } from '@/core/CombatContracts';
import {
  ENEMY_WEAPON_SPECS,
  isEnemyWeaponKind,
  type EnemyWeaponKind,
} from '@/features/enemy/EnemyWeapons';

/**
 * 环境命中面：固定高度（旧行为），或按 (x, z) 采样的地表高度（第 6-10 关的高耸地形）。
 */
export type ProjectileImpactSurface = number | ((x: number, z: number) => number);

/** 命中阈值（米）：目标未声明 userData.hitRadius 时沿用旧的 5 米 */
const DEFAULT_COLLISION_THRESHOLD = 5;
/** 声明了很小命中半径的部件也至少按 2 米判定，避免高速子弹穿过 */
const MIN_COLLISION_THRESHOLD = 2;

/** 子弹是否撞上环境面（支持固定高度与地表采样两种形式） */
export function isBelowImpactSurface(
  position: Vector3,
  surface: ProjectileImpactSurface | undefined
): boolean {
  if (typeof surface === 'number') {
    return position.y <= surface;
  }
  if (typeof surface === 'function') {
    const surfaceY = surface(position.x, position.z);
    return Number.isFinite(surfaceY) && position.y <= surfaceY;
  }
  return false;
}

/**
 * 子弹数据
 */
interface Projectile {
  mesh: Mesh;
  glow: Sprite; // 曳光弹光晕
  tail: Group; // 弹道拖尾（交叉双面片）
  direction: Vector3;
  speed: number;
  /** 弹种：普通子弹，或敌机的高炮弹 / 长枪弹（各自的弹速、射程、大小与外观） */
  kind: EnemyWeaponKind;
  /** 最大飞行距离（米） */
  maxDistance: number;
  /** 弹体自身的命中半径（米），叠加到目标的命中半径上 */
  radius: number;
  /** 高速弹：命中判定用“上一步位置 → 当前位置”的线段，避免一步越过目标 */
  swept: boolean;
  previousPosition: Vector3;
  active: boolean;
  startPosition: Vector3;
  damage: number; // 伤害值
  owner?: Object3D; // 发射者，用于防止子弹立即碰撞到发射者
  baseScale: Vector3;
  baseOpacity: number;
  pulseOffset: number;
  widthPulseScale: number;
  lengthPulseScale: number;
  opacityPulseScale: number;
  pulseFrequency: number;
  stretchFrequency: number;
  travelLengthBoost: number;
  travelWidthBoost: number;
}

const FORWARD = new Vector3(0, 0, 1);
const targetWorldPosition = new Vector3();
const sweepSegment = new Vector3();
const sweepToTarget = new Vector3();

/** 点到线段 (from → to) 的最近距离 */
function distanceToSegment(point: Vector3, from: Vector3, to: Vector3): number {
  sweepSegment.subVectors(to, from);
  const lengthSq = sweepSegment.lengthSq();
  if (!(lengthSq > 1e-10)) return point.distanceTo(to);
  sweepToTarget.subVectors(point, from);
  const t = Math.min(1, Math.max(0, sweepToTarget.dot(sweepSegment) / lengthSq));
  sweepToTarget.copy(from).addScaledVector(sweepSegment, t);
  return point.distanceTo(sweepToTarget);
}

/** 光晕精灵相对弹体中心的前移量（弹体本地 Z，单位随弹体缩放） */
const DEFAULT_GLOW_OFFSET_Z = 0.1;
/** 敌机高炮弹的外观：球体缩放（半径 0.5 的球 → 直径 SHELL_SCALE 米）、球体颜色、弹芯光晕 */
const SHELL_SCALE = 4.6;
const SHELL_BODY_COLOR = 0xff3210;
/** 弹芯光晕的大小（相对球体直径）与前移量（相对球体直径，留在球体之内） */
const SHELL_CORE_SCALE = 1.15;
const SHELL_CORE_OFFSET_Z = 0.3;

/**
 * 子弹对象池
 * 使用对象池模式避免频繁创建/销毁对象
 */
export class ProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: Scene;
  private playerGeometry: BoxGeometry;
  private enemyGeometry: OctahedronGeometry;
  private friendlyGeometry: BoxGeometry;
  private shellGeometry: SphereGeometry;
  private lanceGeometry: BoxGeometry;
  private tailGeometry: PlaneGeometry;
  // 各阵营共享的光晕/拖尾材质（避免 600+ 材质实例）
  private playerGlowMaterial: SpriteMaterial;
  private enemyGlowMaterial: SpriteMaterial;
  private friendlyGlowMaterial: SpriteMaterial;
  private shellGlowMaterial: SpriteMaterial;
  private lanceGlowMaterial: SpriteMaterial;
  private playerTailMaterial: MeshBasicMaterial;
  private enemyTailMaterial: MeshBasicMaterial;
  private friendlyTailMaterial: MeshBasicMaterial;
  private lanceTailMaterial: MeshBasicMaterial;

  constructor(scene: Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();
    const textures = getVfxTextures();

    this.playerGeometry = new BoxGeometry(0.12, 0.12, 1.4);
    this.enemyGeometry = new OctahedronGeometry(0.22, 0);
    this.friendlyGeometry = new BoxGeometry(0.14, 0.14, 1.05);
    // 敌机高炮弹：发光圆球；长枪弹：细长的针
    this.shellGeometry = new SphereGeometry(0.5, 16, 12);
    this.lanceGeometry = new BoxGeometry(0.16, 0.16, 3.2);

    // 拖尾面片：预旋转为沿 Z 轴展开，v=0（亮端）朝 +Z（弹头方向）
    this.tailGeometry = new PlaneGeometry(1, 1);
    this.tailGeometry.rotateX(-Math.PI / 2);

    const makeGlowMaterial = (color: number): SpriteMaterial =>
      new SpriteMaterial({
        map: textures.glow,
        color,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      });
    const makeTailMaterial = (color: number): MeshBasicMaterial =>
      new MeshBasicMaterial({
        map: textures.tail,
        color,
        transparent: true,
        opacity: 0.8,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });

    this.playerGlowMaterial = makeGlowMaterial(0xffe08a);
    this.enemyGlowMaterial = makeGlowMaterial(0xff7a30);
    this.friendlyGlowMaterial = makeGlowMaterial(0x8af4ff);
    // 高炮弹的炽热弹芯：淡黄白色，叠在红橙色的球体上
    this.shellGlowMaterial = makeGlowMaterial(0xffe2b0);
    this.lanceGlowMaterial = makeGlowMaterial(0xff3020);
    this.playerTailMaterial = makeTailMaterial(0xffc96a);
    this.enemyTailMaterial = makeTailMaterial(0xff5a1e);
    this.friendlyTailMaterial = makeTailMaterial(0x6ce8ff);
    this.lanceTailMaterial = makeTailMaterial(0xff2a1a);

    const material = new MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    for (let i = 0; i < poolSize; i++) {
      const mesh = new Mesh(this.playerGeometry, material.clone());
      mesh.visible = false;

      const glow = new Sprite(this.playerGlowMaterial);
      glow.position.z = DEFAULT_GLOW_OFFSET_Z;
      mesh.add(glow);

      const tail = new Group();
      const tailPlaneA = new Mesh(this.tailGeometry, this.playerTailMaterial);
      const tailPlaneB = new Mesh(this.tailGeometry, this.playerTailMaterial);
      tailPlaneB.rotation.z = Math.PI / 2;
      tail.add(tailPlaneA, tailPlaneB);
      mesh.add(tail);

      this.scene.add(mesh);

      this.pool.push({
        mesh,
        glow,
        tail,
        direction: new Vector3(),
        speed: GAME_CONSTANTS.PROJECTILE.SPEED,
        kind: 'bullet',
        maxDistance: this.maxDistance,
        radius: 0,
        swept: false,
        previousPosition: new Vector3(),
        active: false,
        startPosition: new Vector3(),
        damage: 10,
        baseScale: new Vector3(1, 1, 1),
        baseOpacity: 0.9,
        pulseOffset: Math.random() * Math.PI * 2,
        widthPulseScale: 0.08,
        lengthPulseScale: 0.1,
        opacityPulseScale: 0.08,
        pulseFrequency: 0.18,
        stretchFrequency: 0.12,
        travelLengthBoost: 0.1,
        travelWidthBoost: 0,
      });
    }
  }

  /**
   * 给曳光弹换装：阵营专属的光晕与拖尾
   */
  private applyTracerDress(
    projectile: Projectile,
    glowMaterial: SpriteMaterial,
    tailMaterial: MeshBasicMaterial,
    glowScale: number,
    tailWidth: number,
    tailLength: number,
    tailCenterZ: number,
    glowOffsetZ: number = DEFAULT_GLOW_OFFSET_Z
  ): void {
    projectile.glow.material = glowMaterial;
    projectile.glow.scale.set(glowScale, glowScale, 1);
    projectile.glow.position.z = glowOffsetZ;
    for (const tailPlane of projectile.tail.children) {
      (tailPlane as Mesh).material = tailMaterial;
    }
    projectile.tail.scale.set(tailWidth, tailWidth, tailLength);
    projectile.tail.position.z = tailCenterZ;
  }

  /**
   * 发射子弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   * @param faction 子弹阵营（用于伤害检测）
   * @param kind 弹种（缺省普通子弹）：敌机的高炮弹 / 长枪弹有自己的弹速、射程、大小与外观
   */
  public fire(
    origin: Vector3,
    direction: Vector3,
    damage: number,
    owner?: Object3D,
    faction?: string,
    kind?: EnemyWeaponKind
  ): void {
    // 找到未激活的子弹；池满时回收飞得最远（最接近射程尽头）的那一发，新的一发不丢
    const projectile = this.acquire();
    if (!projectile) return;

    const weapon: EnemyWeaponKind = isEnemyWeaponKind(kind) ? kind : 'bullet';
    const spec = ENEMY_WEAPON_SPECS[weapon];
    projectile.kind = weapon;
    projectile.speed = spec.speed;
    projectile.maxDistance = weapon === 'bullet' ? this.maxDistance : spec.maxDistance;
    projectile.radius = spec.radius;
    projectile.swept = spec.swept;

    projectile.mesh.position.copy(origin);
    projectile.previousPosition.copy(origin);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(origin);
    projectile.damage = damage; // 设置伤害
    projectile.owner = owner; // 记录发射者
    projectile.mesh.userData.faction = faction; // 设置阵营
    this.applyProjectileVisual(projectile, faction);
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /** 取一发空闲子弹；没有空闲时回收已飞过射程比例最大的活跃子弹 */
  private acquire(): Projectile | null {
    let oldest: Projectile | null = null;
    let oldestFraction = -1;
    for (const projectile of this.pool) {
      if (!projectile.active) return projectile;
      const travelled = projectile.mesh.position.distanceTo(projectile.startPosition);
      const fraction = projectile.maxDistance > 0 ? travelled / projectile.maxDistance : 1;
      if (fraction > oldestFraction) {
        oldestFraction = fraction;
        oldest = projectile;
      }
    }
    if (oldest) this.deactivate(oldest);
    return oldest;
  }

  /**
   * 更新所有子弹
   */
  public update(
    deltaTime: number,
    impactHeight?: ProjectileImpactSurface,
    onEnvironmentHit?: (position: Vector3) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动子弹
      projectile.previousPosition.copy(projectile.mesh.position);
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * deltaTime);
      this.updateProjectileVisual(projectile);

      if (isBelowImpactSurface(projectile.mesh.position, impactHeight)) {
        onEnvironmentHit?.(projectile.mesh.position.clone());
        this.deactivate(projectile);
        continue;
      }

      // 检查是否超出最大距离
      const distance = projectile.mesh.position.distanceTo(projectile.startPosition);
      if (distance > projectile.maxDistance) {
        this.deactivate(projectile);
      }
    }
  }

  /**
   * 检查碰撞：命中半径取目标声明的 userData.hitRadius（大型舰船 / Boss 部件），
   * 未声明时沿用 5 米。
   */
  public checkCollisions(
    targets: Object3D[],
    onHit: (target: Object3D, projectile: Mesh, damage: number) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      for (const target of targets) {
        if (!target.visible) continue;

        if (projectile.owner && target === projectile.owner) continue;

        target.getWorldPosition(targetWorldPosition);

        // 高速弹（长枪弹）按本步扫过的线段判定；其余按当前位置
        const distance = projectile.swept
          ? distanceToSegment(
              targetWorldPosition,
              projectile.previousPosition,
              projectile.mesh.position
            )
          : projectile.mesh.position.distanceTo(targetWorldPosition);
        const collisionThreshold =
          Math.max(
            MIN_COLLISION_THRESHOLD,
            getDeclaredHitRadius(target, DEFAULT_COLLISION_THRESHOLD)
          ) + projectile.radius;

        if (distance < collisionThreshold) {
          onHit(target, projectile.mesh, projectile.damage);
          this.deactivate(projectile);
          break;
        }
      }
    }
  }

  /**
   * 自定义命中判定（例如单位系统的 hitTest）：对每颗活跃子弹调用 test，
   * 返回 true 表示命中并回收该子弹。position 为子弹世界坐标（只读，勿保存引用）。
   */
  public consumeHits(
    test: (position: Vector3, damage: number, faction: string | undefined, owner?: Object3D) => boolean
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;
      const faction = projectile.mesh.userData.faction as string | undefined;
      if (test(projectile.mesh.position, projectile.damage, faction, projectile.owner)) {
        this.deactivate(projectile);
      }
    }
  }

  /** 是否存在活跃子弹（无子弹时可跳过逐弹判定） */
  public hasActiveProjectiles(): boolean {
    for (const projectile of this.pool) {
      if (projectile.active) return true;
    }
    return false;
  }

  /**
   * 停用子弹
   */
  private deactivate(projectile: Projectile): void {
    projectile.mesh.visible = false;
    projectile.active = false;
    projectile.mesh.scale.setScalar(1);
  }

  private applyProjectileVisual(projectile: Projectile, faction?: string): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    if (projectile.kind === 'heavy-shell') {
      // 高炮弹：又大又慢的红橙色光球（直径约 4.6 米），中心一团炽热的黄白色弹芯，缓慢脉动，
      // 没有拖尾——250 米外也是一个看得清的红球，和机炮的小曳光弹一眼分得开。
      // 球体用普通混合、不透明：在明亮的天空 / 地表前仍然是红橙色（加色混合会被洗成黄白）。
      projectile.mesh.geometry = this.shellGeometry;
      material.color.set(SHELL_BODY_COLOR);
      projectile.baseOpacity = 1;
      projectile.baseScale.set(SHELL_SCALE, SHELL_SCALE, SHELL_SCALE);
      projectile.widthPulseScale = 0.12;
      projectile.lengthPulseScale = -0.12;
      projectile.opacityPulseScale = 0.05;
      projectile.pulseFrequency = 0.2;
      projectile.stretchFrequency = 0.2;
      projectile.travelLengthBoost = 0;
      projectile.travelWidthBoost = 0;
      // 弹芯光晕放在球心前方（朝飞行方向）：迎面飞来的炮弹，光晕比球心离镜头更近，
      // 透明物体按远近排序后它画在球体之上
      this.applyTracerDress(
        projectile,
        this.shellGlowMaterial,
        this.enemyTailMaterial,
        SHELL_CORE_SCALE,
        0.001,
        0.001,
        0,
        SHELL_CORE_OFFSET_Z
      );
    } else if (projectile.kind === 'lance') {
      // 长枪弹：细长的红白色针 + 很长的拖尾
      projectile.mesh.geometry = this.lanceGeometry;
      material.color.set(0xffe2d6);
      projectile.baseOpacity = 1;
      projectile.baseScale.set(1.2, 1.2, 2.6);
      projectile.widthPulseScale = 0.04;
      projectile.lengthPulseScale = 0.06;
      projectile.opacityPulseScale = 0.02;
      projectile.pulseFrequency = 0.1;
      projectile.stretchFrequency = 0.08;
      projectile.travelLengthBoost = 0.3;
      projectile.travelWidthBoost = 0;
      this.applyTracerDress(
        projectile,
        this.lanceGlowMaterial,
        this.lanceTailMaterial,
        1.6,
        0.6,
        3.2,
        -3.1
      );
    } else if (faction === 'ENEMY') {
      projectile.mesh.geometry = this.enemyGeometry;
      material.color.set(0xff7f36);
      projectile.baseOpacity = 0.82;
      projectile.baseScale.set(0.96, 0.96, 1.18);
      projectile.widthPulseScale = 0.18;
      projectile.lengthPulseScale = 0.08;
      projectile.opacityPulseScale = 0.14;
      projectile.pulseFrequency = 0.14;
      projectile.stretchFrequency = 0.1;
      projectile.travelLengthBoost = 0.06;
      projectile.travelWidthBoost = 0.08;
      // 灼热等离子团：大光晕 + 短宽尾
      this.applyTracerDress(
        projectile,
        this.enemyGlowMaterial,
        this.enemyTailMaterial,
        1.05,
        0.7,
        1.1,
        -0.78
      );
    } else if (faction === 'FRIENDLY') {
      projectile.mesh.geometry = this.friendlyGeometry;
      material.color.set(0x74f4ff);
      projectile.baseOpacity = 0.84;
      projectile.baseScale.set(0.72, 0.72, 1.72);
      projectile.widthPulseScale = 0.09;
      projectile.lengthPulseScale = 0.16;
      projectile.opacityPulseScale = 0.09;
      projectile.pulseFrequency = 0.16;
      projectile.stretchFrequency = 0.11;
      projectile.travelLengthBoost = 0.16;
      projectile.travelWidthBoost = -0.04;
      // 青色能量束：冷光晕 + 修长尾
      this.applyTracerDress(
        projectile,
        this.friendlyGlowMaterial,
        this.friendlyTailMaterial,
        1.1,
        0.5,
        1.3,
        -1.18
      );
    } else {
      projectile.mesh.geometry = this.playerGeometry;
      material.color.set(0xfff4aa);
      projectile.baseOpacity = 0.96;
      projectile.baseScale.set(0.56, 0.56, 2.18);
      projectile.widthPulseScale = 0.06;
      projectile.lengthPulseScale = 0.24;
      projectile.opacityPulseScale = 0.07;
      projectile.pulseFrequency = 0.22;
      projectile.stretchFrequency = 0.16;
      projectile.travelLengthBoost = 0.22;
      projectile.travelWidthBoost = -0.06;
      // 暖金曳光：明亮光晕 + 长拖尾
      this.applyTracerDress(
        projectile,
        this.playerGlowMaterial,
        this.playerTailMaterial,
        1.5,
        0.5,
        1.6,
        -1.5
      );
    }

    material.opacity = projectile.baseOpacity;
    projectile.mesh.quaternion.setFromUnitVectors(FORWARD, projectile.direction);
    projectile.mesh.scale.copy(projectile.baseScale);
  }

  private updateProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    const travel = projectile.mesh.position.distanceTo(projectile.startPosition);
    const travelAlpha = Math.min(1, travel / 70);
    const pulse = Math.sin(travel * projectile.pulseFrequency + projectile.pulseOffset);
    const stretchPulse = Math.sin(
      travel * projectile.stretchFrequency + projectile.pulseOffset * 0.7
    );
    const widthResponse = 1 + travelAlpha * projectile.travelWidthBoost;
    const lengthResponse = 1 + travelAlpha * projectile.travelLengthBoost;

    material.opacity = Math.min(
      1,
      projectile.baseOpacity * (0.92 + travelAlpha * 0.08 + pulse * projectile.opacityPulseScale)
    );
    projectile.mesh.scale.set(
      projectile.baseScale.x * widthResponse * (1 - stretchPulse * projectile.widthPulseScale),
      projectile.baseScale.y * widthResponse * (1 - stretchPulse * projectile.widthPulseScale),
      projectile.baseScale.z * lengthResponse * (1 + stretchPulse * projectile.lengthPulseScale)
    );
  }

  public getActiveProjectiles(): Mesh[] {
    return this.pool.filter((p) => p.active).map((p) => p.mesh);
  }

  public clear(): void {
    for (const projectile of this.pool) {
      projectile.mesh.visible = false;
      projectile.active = false;
    }
  }

  public dispose(): void {
    for (const projectile of this.pool) {
      this.scene.remove(projectile.mesh);
      (projectile.mesh.material as Material).dispose();
    }
    this.playerGeometry.dispose();
    this.enemyGeometry.dispose();
    this.friendlyGeometry.dispose();
    this.shellGeometry.dispose();
    this.lanceGeometry.dispose();
    this.tailGeometry.dispose();
    this.playerGlowMaterial.dispose();
    this.enemyGlowMaterial.dispose();
    this.friendlyGlowMaterial.dispose();
    this.shellGlowMaterial.dispose();
    this.lanceGlowMaterial.dispose();
    this.playerTailMaterial.dispose();
    this.enemyTailMaterial.dispose();
    this.friendlyTailMaterial.dispose();
    this.lanceTailMaterial.dispose();
    this.pool = [];
  }
}
