import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { PowerUpType, POWER_UP_CONFIGS } from './PowerUpSystem';

/**
 * 气球道具
 * 浮在空中，被打破后获得道具
 */
export class BalloonPowerUp {
  private mesh: Group;
  private config: { type: PowerUpType; icon: string; isRandom: boolean };

  // 气球组件
  private rotatingParts!: Group;
  private balloon!: Mesh;
  private string!: Mesh;
  private iconSprite?: Sprite;

  // 浮动参数
  private baseY: number;
  private time: number = 0;
  private floatAmount: number = 0.8;
  private bobSpeed: number = 2;

  // 生成无敌时间（防止刚生成就被打破）
  private spawnInvincibleTimer: number = 0.5; // 0.5秒无敌时间

  constructor(position: Vector3, type: PowerUpType, icon?: string) {
    this.config = {
      type,
      icon: icon || (!icon ? '?' : POWER_UP_CONFIGS[type].icon),
      isRandom: !icon
    };

    this.baseY = position.y;
    this.mesh = new Group();
    this.mesh.position.copy(position);
    this.createBalloon();
  }

  /**
   * 创建气球模型
   */
  private createBalloon(): void {
    const config = this.config;

    // 气球本体（较大）- 改为亮白色，更明显
    const balloonGeometry = new SphereGeometry(3, 16, 16);
    const balloonMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x4444ff,  // 添加蓝色自发光
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.7,
    });
    this.balloon = new Mesh(balloonGeometry, balloonMaterial);
    this.balloon.scale.set(1, 1.2, 1); // 拉长一点

    // 气球绳子
    const stringGeometry = new CylinderGeometry(0.1, 0.1, 2);
    const stringMaterial = new MeshStandardMaterial({
      color: 0xcccccc,
    });
    this.string = new Mesh(stringGeometry, stringMaterial);
    this.string.position.y = -2.5;

    this.rotatingParts = new Group();
    this.rotatingParts.add(this.string);
    this.rotatingParts.add(this.balloon);
    this.mesh.add(this.rotatingParts);

    // 气球道具图标/问号（使用文本纹理）- 放大并提高位置避免被气球遮挡
    const iconCanvas = document.createElement('canvas');
    iconCanvas.width = 128; // 放大一倍（64 → 128）
    iconCanvas.height = 128;
    const ctx = iconCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // 绘制背景（白色圆形）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2); // 放大一倍
    ctx.fill();

    // 绘制图标/问号 - 放大字体
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 64px Arial'; // 放大一倍（32 → 64）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.icon, 64, 64);

    // 创建纹理
    const iconTexture = new CanvasTexture(iconCanvas);
    const iconMaterial = new SpriteMaterial({
      map: iconTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    const icon = new Sprite(iconMaterial);
    icon.scale.set(5, 5, 1); // 放大一倍（2.5 → 5）
    icon.position.y = 5.5; // 提高位置（3.5 → 5.5）避免被气球遮挡

    this.iconSprite = icon;
    this.mesh.add(icon);
  }

  /**
   * 更新气球动画
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;

    // 更新无敌时间
    if (this.spawnInvincibleTimer > 0) {
      this.spawnInvincibleTimer -= deltaTime;
    }

    // 上下浮动
    const yOffset = Math.sin(this.time * this.bobSpeed) * this.floatAmount;
    this.mesh.position.y = this.baseY + yOffset;

    // 缓慢旋转气球本体；图标作为 Sprite 保持朝向相机
    this.rotatingParts.rotation.y += deltaTime * 0.5;

    // 彩虹闪烁效果 - 颜色不断变化
    const hue = (this.time * 0.5) % 1; // 色相循环
    const color = new Color().setHSL(hue, 1, 0.5);

    const material = this.balloon.material as MeshStandardMaterial;
    material.emissive = color;
    material.emissiveIntensity = 0.4 + Math.sin(this.time * 4) * 0.2; // 0.2 到 0.6 闪烁

    // 基础颜色保持白色
    material.color.setHex(0xffffff);
  }

  /**
   * 获取网格
   */
  public getMesh(): Group {
    return this.mesh;
  }

  /**
   * 获取配置
   */
  public getConfig(): { type: PowerUpType; icon: string; isRandom: boolean } {
    return this.config;
  }

  /**
   * 获取气球高度（用于碰撞检测）
   */
  public getBalloonHeight(): number {
    return 5; // 气球中心高度
  }

  /**
   * 检查是否可以被打破（无敌时间已过）
   */
  public canBeHit(): boolean {
    return this.spawnInvincibleTimer <= 0;
  }

  /**
   * 销毁气球（创建爆炸效果）
   */
  public dispose(scene: Scene): void {
    // TODO: 添加爆炸粒子效果
    scene.remove(this.mesh);

    // 释放几何体和材质
    this.balloon.geometry.dispose();
    (this.balloon.material as Material).dispose();

    this.string.geometry.dispose();
    (this.string.material as Material).dispose();

    if (this.iconSprite) {
      const iconMaterial = this.iconSprite.material as SpriteMaterial;
      iconMaterial.map?.dispose();
      iconMaterial.dispose();
      this.iconSprite.removeFromParent();
      this.iconSprite = undefined;
    }
  }
}
