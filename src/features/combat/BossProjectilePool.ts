import {
  AdditiveBlending,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
} from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import { getVfxTextures } from '@/features/effects/ParticleSystem';

/**
 * Boss炮弹数据
 */
interface Projectile {
  mesh: Mesh;
  glow: Sprite; // 加色能量核心
  crackleA: Sprite; // 能量电弧火花（抖动）
  crackleB: Sprite;
  embers: Sprite[]; // 尾部余烬串
  direction: Vector3;
  speed: number;
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
  rippleFrequency: number;
  travelLengthBoost: number;
  travelWidthBoost: number;
}

/** 余烬基础尺寸（本地坐标，由后向前递减） */
const EMBER_SIZES = [0.6, 0.45, 0.32];
const EMBER_Z = [-0.9, -1.25, -1.6];

const FORWARD = new Vector3(0, 0, 1);

/**
 * Boss炮弹对象池
 * 使用更大的几何体和红橙色，区别于普通敌人炮弹
 */
export class BossProjectilePool {
  private pool: Projectile[] = [];
  private maxDistance: number;
  private scene: Scene;
  private shellGeometry: BoxGeometry;
  // 所有炮弹共享的特效材质（动画走 sprite 缩放/位置，避免逐弹材质实例）
  private glowMaterial: SpriteMaterial;
  private crackleMaterial: SpriteMaterial;
  private emberMaterial: SpriteMaterial;

  constructor(scene: Scene) {
    this.scene = scene;
    this.maxDistance = GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE;

    const poolSize = GameConfig.getProjectilePoolSize();
    const textures = getVfxTextures();

    this.shellGeometry = new BoxGeometry(0.34, 0.34, 1.85);
    const material = new MeshBasicMaterial({
      color: 0xd83a20,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    });

    this.glowMaterial = new SpriteMaterial({
      map: textures.glow,
      color: 0xff4a22,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.crackleMaterial = new SpriteMaterial({
      map: textures.spark,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.emberMaterial = new SpriteMaterial({
      map: textures.glow,
      color: 0xff8a3a,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < poolSize; i++) {
      const mesh = new Mesh(this.shellGeometry, material.clone());
      mesh.visible = false;

      const glow = new Sprite(this.glowMaterial);
      glow.scale.set(1.6, 1.6, 1);
      mesh.add(glow);

      const crackleA = new Sprite(this.crackleMaterial);
      crackleA.scale.set(0.5, 0.5, 1);
      mesh.add(crackleA);

      const crackleB = new Sprite(this.crackleMaterial);
      crackleB.scale.set(0.4, 0.4, 1);
      mesh.add(crackleB);

      const embers: Sprite[] = [];
      for (let e = 0; e < EMBER_SIZES.length; e++) {
        const ember = new Sprite(this.emberMaterial);
        ember.scale.set(EMBER_SIZES[e], EMBER_SIZES[e], 1);
        ember.position.z = EMBER_Z[e];
        mesh.add(ember);
        embers.push(ember);
      }

      this.scene.add(mesh);

      this.pool.push({
        mesh,
        glow,
        crackleA,
        crackleB,
        embers,
        direction: new Vector3(),
        speed: GAME_CONSTANTS.PROJECTILE.SPEED,
        active: false,
        startPosition: new Vector3(),
        damage: 10,
        baseScale: new Vector3(1, 1, 1),
        baseOpacity: 0.94,
        pulseOffset: Math.random() * Math.PI * 2,
        widthPulseScale: 0.08,
        lengthPulseScale: 0.12,
        opacityPulseScale: 0.08,
        pulseFrequency: 0.09,
        rippleFrequency: 0.06,
        travelLengthBoost: 0.1,
        travelWidthBoost: 0.04,
      });
    }
  }

  /**
   * 发射炮弹
   * @param origin 发射位置
   * @param direction 发射方向
   * @param damage 伤害值
   * @param owner 发射者（用于防止立即碰撞）
   * @param faction 炮弹阵营（用于伤害检测）
   */
  public fire(
    origin: Vector3,
    direction: Vector3,
    damage: number,
    owner?: Object3D,
    faction?: string
  ): void {
    // 找到未激活的炮弹
    const projectile = this.pool.find((p) => !p.active);
    if (!projectile) return;

    projectile.mesh.position.copy(origin);
    projectile.direction.copy(direction).normalize();
    projectile.startPosition.copy(origin);
    projectile.damage = damage; // 设置伤害
    projectile.owner = owner; // 记录发射者
    projectile.mesh.userData.faction = faction; // 设置阵营
    this.applyProjectileVisual(projectile);
    projectile.mesh.visible = true;
    projectile.active = true;
  }

  /**
   * 更新所有炮弹
   */
  public update(
    deltaTime: number,
    impactHeight?: number,
    onEnvironmentHit?: (position: Vector3) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      // 移动炮弹
      projectile.mesh.position.addScaledVector(projectile.direction, projectile.speed * deltaTime);
      this.updateProjectileVisual(projectile);

      if (
        typeof impactHeight === 'number'
        && projectile.mesh.position.y <= impactHeight
      ) {
        onEnvironmentHit?.(projectile.mesh.position.clone());
        this.deactivate(projectile);
        continue;
      }

      // 检查是否超出最大距离
      const distance = projectile.mesh.position.distanceTo(projectile.startPosition);
      if (distance > this.maxDistance) {
        this.deactivate(projectile);
      }
    }
  }

  /**
   * 检查碰撞
   */
  public checkCollisions(
    targets: Object3D[],
    onHit: (target: Object3D, projectile: Mesh, damage: number) => void
  ): void {
    for (const projectile of this.pool) {
      if (!projectile.active) continue;

      for (const target of targets) {
        if (!target.visible) continue;

        // 跳过发射者自己，防止炮弹立即碰撞到发射者
        if (projectile.owner && target === projectile.owner) continue;

        const distance = projectile.mesh.position.distanceTo(target.position);
        const collisionThreshold = 8; // Boss炮弹更大，碰撞距离也更大

        if (distance < collisionThreshold) {
          onHit(target, projectile.mesh, projectile.damage);
          this.deactivate(projectile);
          break;
        }
      }
    }
  }

  /**
   * 停用炮弹
   */
  private deactivate(projectile: Projectile): void {
    projectile.mesh.visible = false;
    projectile.active = false;
    projectile.mesh.scale.setScalar(1);
  }

  private applyProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    projectile.mesh.geometry = this.shellGeometry;
    material.color.set(0xe04c2d);
    projectile.baseOpacity = 0.95;
    projectile.baseScale.set(1.2, 1.2, 3.1);
    projectile.widthPulseScale = 0.12;
    projectile.lengthPulseScale = 0.18;
    projectile.opacityPulseScale = 0.09;
    projectile.pulseFrequency = 0.075;
    projectile.rippleFrequency = 0.048;
    projectile.travelLengthBoost = 0.22;
    projectile.travelWidthBoost = 0.1;
    material.opacity = projectile.baseOpacity;
    projectile.mesh.quaternion.setFromUnitVectors(FORWARD, projectile.direction);
    projectile.mesh.scale.copy(projectile.baseScale);
  }

  private updateProjectileVisual(projectile: Projectile): void {
    const material = projectile.mesh.material as MeshBasicMaterial;
    const travel = projectile.mesh.position.distanceTo(projectile.startPosition);
    const travelAlpha = Math.min(1, travel / 90);
    const pulse = Math.sin(travel * projectile.pulseFrequency + projectile.pulseOffset);
    const stretchPulse = Math.sin(travel * projectile.rippleFrequency + projectile.pulseOffset * 0.6);
    const widthResponse = 1 + travelAlpha * projectile.travelWidthBoost;
    const lengthResponse = 1 + travelAlpha * projectile.travelLengthBoost;

    material.opacity = Math.min(
      1,
      projectile.baseOpacity * (0.94 + travelAlpha * 0.1 + pulse * projectile.opacityPulseScale)
    );
    projectile.mesh.scale.set(
      projectile.baseScale.x * widthResponse * (1 - stretchPulse * projectile.widthPulseScale),
      projectile.baseScale.y * widthResponse * (1 - stretchPulse * projectile.widthPulseScale),
      projectile.baseScale.z * lengthResponse * (1 + stretchPulse * projectile.lengthPulseScale)
    );

    // 能量特效动画：全部由 travel 推导，零分配、确定性抖动
    const phase = travel * 2.1 + projectile.pulseOffset * 5;

    // 脉冲发光核心
    const glowScale = 1.45 + 0.35 * Math.sin(travel * 0.6 + projectile.pulseOffset);
    projectile.glow.scale.set(glowScale, glowScale, 1);

    // 电弧火花：围绕弹体小幅乱跳
    projectile.crackleA.position.set(
      Math.sin(phase * 1.7) * 0.26,
      Math.cos(phase * 1.3) * 0.26,
      0.35 + Math.sin(phase) * 0.4
    );
    const crackleScaleA = 0.38 + 0.26 * (0.5 + 0.5 * Math.sin(phase * 3.1));
    projectile.crackleA.scale.set(crackleScaleA, crackleScaleA, 1);

    projectile.crackleB.position.set(
      Math.cos(phase * 2.3 + 1.1) * 0.24,
      Math.sin(phase * 1.9 + 0.6) * 0.24,
      -0.25 + Math.cos(phase * 1.4) * 0.35
    );
    const crackleScaleB = 0.3 + 0.22 * (0.5 + 0.5 * Math.cos(phase * 2.7 + 0.8));
    projectile.crackleB.scale.set(crackleScaleB, crackleScaleB, 1);

    // 尾部余烬串：依次闪烁，拉出能量尾迹
    for (let i = 0; i < projectile.embers.length; i++) {
      const flicker = 0.72 + 0.34 * Math.sin(phase * 2.3 + i * 1.9);
      const emberScale = EMBER_SIZES[i] * flicker;
      projectile.embers[i].scale.set(emberScale, emberScale, 1);
    }
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
    this.shellGeometry.dispose();
    this.glowMaterial.dispose();
    this.crackleMaterial.dispose();
    this.emberMaterial.dispose();
    this.pool = [];
  }
}
