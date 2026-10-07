import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { getVfxTextures } from './ParticleSystem';

/** 漩涡/光环层动画参数 */
interface PortalLayer {
  mesh: Mesh;
  material: MeshBasicMaterial;
  size: number;
  spinSpeed: number;
  baseOpacity: number;
}

const PARTICLE_COUNT = 100;
const PARTICLE_MAX_RADIUS = 12;

const COLOR_CYAN = new Color(0x46e8ff);
const COLOR_MAGENTA = new Color(0xff5af0);
const COLOR_WHITE = new Color(0xffffff);

/**
 * 敌人生成传送门效果
 * 高能量旋涡之门：多层反向旋转的漩涡/光环、脉动透镜光核、
 * 内旋粒子（青→品红→白）、垂直光柱，开启与出舱时的扩散闪光。
 * 持续 5 秒（扩张 → 保持 → 消散），生命周期与公共 API 与旧版一致。
 */
export class SpawnPortal {
  private group: Group;

  private layers: PortalLayer[] = [];
  private coreGlow!: Sprite;
  private coreGlowMaterial!: SpriteMaterial;
  private shaft!: Mesh;
  private shaftMaterial!: MeshBasicMaterial;

  private planeGeometry!: PlaneGeometry;
  private shaftGeometry!: CylinderGeometry;

  // 开启 / 出舱闪光（单组复用）
  private flashSprite!: Sprite;
  private flashSpriteMaterial!: SpriteMaterial;
  private flashRing!: Mesh;
  private flashRingMaterial!: MeshBasicMaterial;
  private flashTimer: number = -1; // <0 表示未播放
  private static readonly FLASH_DURATION = 0.5;
  private openFlashFired: boolean = false;
  private emergeFlashFired: boolean = false;

  private particleSystem!: Points;
  private particleMaterial!: PointsMaterial;
  private particleAngles = new Float32Array(PARTICLE_COUNT);
  private particleRadii = new Float32Array(PARTICLE_COUNT);
  private particleHeights = new Float32Array(PARTICLE_COUNT);
  private particleSpeeds = new Float32Array(PARTICLE_COUNT);
  private readonly particleColor = new Color();

  private lifetime: number = 0;
  private maxLifetime: number = 5; // 5秒生成时间
  private isComplete: boolean = false;

  private onComplete?: () => void;

  constructor(position: Vector3, onComplete?: () => void) {
    this.onComplete = onComplete;
    this.group = new Group();
    this.group.position.copy(position);

    this.createPortalEffect();
    this.createParticles();
  }

  /**
   * 创建传送门视觉效果
   */
  private createPortalEffect(): void {
    const textures = getVfxTextures();
    this.planeGeometry = new PlaneGeometry(1, 1);

    const addLayer = (
      map: typeof textures.swirl,
      size: number,
      color: number,
      spinSpeed: number,
      baseOpacity: number,
      yOffset: number
    ): void => {
      const material = new MeshBasicMaterial({
        map,
        color,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(this.planeGeometry, material);
      mesh.rotation.x = -Math.PI / 2; // 水平放置；rotation.z 为面内自旋
      mesh.position.y = yOffset;
      mesh.scale.setScalar(0.001);
      this.group.add(mesh);
      this.layers.push({ mesh, material, size, spinSpeed, baseOpacity });
    };

    // 三层漩涡：不同尺寸/颜色/转速（含反向）
    addLayer(textures.swirl, 16, 0x37e6ff, 0.9, 0.85, 0);
    addLayer(textures.swirl, 12, 0xff4ef0, -1.4, 0.75, 0.25);
    addLayer(textures.swirl, 20, 0x9db8ff, 0.55, 0.4, -0.25);
    // 两道锐利光环：反向旋转
    addLayer(textures.ring, 17, 0x66f1ff, -0.8, 0.9, 0.12);
    addLayer(textures.ring, 13.5, 0xff7af4, 1.3, 0.8, -0.12);

    // 中央透镜光核（脉动）
    this.coreGlowMaterial = new SpriteMaterial({
      map: textures.glow,
      color: 0xbef6ff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.coreGlow = new Sprite(this.coreGlowMaterial);
    this.coreGlow.scale.setScalar(0.001);
    this.group.add(this.coreGlow);

    // 垂直光柱
    this.shaftGeometry = new CylinderGeometry(2.4, 3.4, 44, 18, 1, true);
    this.shaftMaterial = new MeshBasicMaterial({
      color: 0x6fe8ff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.shaft = new Mesh(this.shaftGeometry, this.shaftMaterial);
    this.group.add(this.shaft);

    // 闪光组件（开门 / 出舱时复用）
    this.flashSpriteMaterial = new SpriteMaterial({
      map: textures.glow,
      color: 0xeafdff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.flashSprite = new Sprite(this.flashSpriteMaterial);
    this.flashSprite.visible = false;
    this.group.add(this.flashSprite);

    this.flashRingMaterial = new MeshBasicMaterial({
      map: textures.ring,
      color: 0x9af3ff,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.flashRing = new Mesh(this.planeGeometry, this.flashRingMaterial);
    this.flashRing.rotation.x = -Math.PI / 2;
    this.flashRing.visible = false;
    this.group.add(this.flashRing);
  }

  /**
   * 创建内旋粒子系统
   */
  private createParticles(): void {
    const textures = getVfxTextures();
    const geometry = new BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particleAngles[i] = Math.random() * Math.PI * 2;
      this.particleRadii[i] = 2 + Math.random() * (PARTICLE_MAX_RADIUS - 2);
      this.particleHeights[i] = (Math.random() - 0.5) * 9;
      this.particleSpeeds[i] = 0.7 + Math.random() * 1.1;

      const i3 = i * 3;
      positions[i3] = Math.cos(this.particleAngles[i]) * this.particleRadii[i];
      positions[i3 + 1] = this.particleHeights[i];
      positions[i3 + 2] = Math.sin(this.particleAngles[i]) * this.particleRadii[i];
      colors[i3] = COLOR_CYAN.r;
      colors[i3 + 1] = COLOR_CYAN.g;
      colors[i3 + 2] = COLOR_CYAN.b;
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));

    this.particleMaterial = new PointsMaterial({
      size: 1.05,
      map: textures.glow,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particleSystem = new Points(geometry, this.particleMaterial);
    this.particleSystem.visible = false; // 初始隐藏
    this.group.add(this.particleSystem);
  }

  private triggerFlash(scaleBoost: number): void {
    this.flashTimer = 0;
    this.flashSprite.visible = true;
    this.flashRing.visible = true;
    this.flashSprite.userData.boost = scaleBoost;
  }

  private updateFlash(deltaTime: number): void {
    if (this.flashTimer < 0) return;

    this.flashTimer += deltaTime;
    const t = this.flashTimer / SpawnPortal.FLASH_DURATION;
    if (t >= 1) {
      this.flashTimer = -1;
      this.flashSprite.visible = false;
      this.flashRing.visible = false;
      return;
    }

    const boost = (this.flashSprite.userData.boost as number) ?? 1;
    const eased = 1 - Math.pow(1 - t, 3);
    const fade = Math.pow(1 - t, 1.4);

    const spriteScale = (4 + eased * 18) * boost;
    this.flashSprite.scale.set(spriteScale, spriteScale, 1);
    this.flashSpriteMaterial.opacity = fade;

    const ringScale = (3 + eased * 26) * boost;
    this.flashRing.scale.setScalar(ringScale);
    this.flashRingMaterial.opacity = fade * 0.9;
  }

  /**
   * 更新传送门动画
   */
  public update(deltaTime: number): void {
    if (this.isComplete) return;

    this.lifetime += deltaTime;
    const progress = this.lifetime / this.maxLifetime;

    // 开门闪光
    if (!this.openFlashFired && this.lifetime > 0.05) {
      this.openFlashFired = true;
      this.triggerFlash(1);
    }
    // 出舱闪光（保持段尾声，飞机现身时刻）
    if (!this.emergeFlashFired && progress >= 0.78) {
      this.emergeFlashFired = true;
      this.triggerFlash(1.35);
    }
    this.updateFlash(deltaTime);

    // 1. 扩张（0~2 秒，easeOutBack 弹性入场）
    const expandProgress = Math.min(1, progress / 0.4);
    const expandScale = Math.max(0.001, this.easeOutBack(expandProgress));

    // 4. 收缩消散（4~5 秒）
    const fadeProgress = progress > 0.8 ? (progress - 0.8) / 0.2 : 0;
    const fade = 1 - fadeProgress;
    const master = expandScale * (0.35 + 0.65 * fade);
    const opacityMaster = fade;

    // 2. 漩涡层：反向自旋 + 脉动 + 色彩微闪
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      layer.mesh.rotation.z += layer.spinSpeed * deltaTime;
      const pulse = 1 + Math.sin(this.lifetime * (3.2 + i * 0.7) + i * 1.3) * 0.06;
      layer.mesh.scale.setScalar(layer.size * master * pulse);
      const shimmer = 0.92 + Math.sin(this.lifetime * (5 + i * 1.1) + i) * 0.08;
      layer.material.opacity = layer.baseOpacity * opacityMaster * shimmer;
    }

    // 中央光核：呼吸脉动
    const corePulse = 1 + Math.sin(this.lifetime * 4) * 0.18;
    const coreScale = 9 * master * corePulse;
    this.coreGlow.scale.set(coreScale, coreScale, 1);
    this.coreGlowMaterial.opacity = 0.95 * opacityMaster;

    // 垂直光柱：微弱呼吸
    this.shaft.scale.set(master, 1, master);
    this.shaftMaterial.opacity =
      0.14 * opacityMaster * (0.8 + Math.sin(this.lifetime * 2.6) * 0.2);

    // 3. 内旋粒子（0.4~4.25 秒窗口）
    if (progress > 0.08 && progress < 0.85) {
      this.particleSystem.visible = true;

      const positions = this.particleSystem.geometry.attributes.position.array as Float32Array;
      const colors = this.particleSystem.geometry.attributes.color.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // 越靠近中心转得越快、吸得越快
        const pull = 1 - this.particleRadii[i] / PARTICLE_MAX_RADIUS;
        this.particleAngles[i] += (1.4 + pull * 3.4) * this.particleSpeeds[i] * deltaTime;
        this.particleRadii[i] -= (2.2 + pull * 4.5) * this.particleSpeeds[i] * deltaTime;
        this.particleHeights[i] *= Math.max(0, 1 - deltaTime * 1.6);

        if (this.particleRadii[i] < 0.45) {
          this.particleAngles[i] = Math.random() * Math.PI * 2;
          this.particleRadii[i] = PARTICLE_MAX_RADIUS * (0.75 + Math.random() * 0.25);
          this.particleHeights[i] = (Math.random() - 0.5) * 9;
        }

        const i3 = i * 3;
        positions[i3] = Math.cos(this.particleAngles[i]) * this.particleRadii[i];
        positions[i3 + 1] = this.particleHeights[i];
        positions[i3 + 2] = Math.sin(this.particleAngles[i]) * this.particleRadii[i];

        // 色彩渐变：青 → 品红 → 白（越靠近中心越炽白）
        const heat = Math.min(1, Math.max(0, 1 - this.particleRadii[i] / PARTICLE_MAX_RADIUS));
        if (heat < 0.65) {
          this.particleColor.copy(COLOR_CYAN).lerp(COLOR_MAGENTA, heat / 0.65);
        } else {
          this.particleColor.copy(COLOR_MAGENTA).lerp(COLOR_WHITE, (heat - 0.65) / 0.35);
        }
        colors[i3] = this.particleColor.r;
        colors[i3 + 1] = this.particleColor.g;
        colors[i3 + 2] = this.particleColor.b;
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
      this.particleSystem.geometry.attributes.color.needsUpdate = true;
      this.particleMaterial.opacity = 0.95 * opacityMaster;
    } else {
      this.particleSystem.visible = false;
    }

    // 完成检查
    if (this.lifetime >= this.maxLifetime) {
      this.isComplete = true;
      this.onComplete?.();
    }
  }

  /**
   * 弹性缓动函数
   */
  private easeOutBack(t: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  /**
   * 获取传送门的 Group
   */
  public getMesh(): Group {
    return this.group;
  }

  /**
   * 是否完成
   */
  public isFinished(): boolean {
    return this.isComplete;
  }

  /**
   * 销毁传送门
   */
  public dispose(): void {
    this.group.removeFromParent();

    for (const layer of this.layers) {
      layer.material.dispose();
    }
    this.layers = [];

    this.coreGlowMaterial.dispose();
    this.shaftMaterial.dispose();
    this.flashSpriteMaterial.dispose();
    this.flashRingMaterial.dispose();
    this.particleMaterial.dispose();

    this.planeGeometry.dispose();
    this.shaftGeometry.dispose();
    this.particleSystem.geometry.dispose();
  }
}
