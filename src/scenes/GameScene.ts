import * as THREE from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import {
  DEFAULT_LEVEL_SCENE_CONFIG,
  LevelConfig,
  LevelEnvironmentConfig,
  LevelLightingConfig,
  LevelPostFxConfig,
} from '@/features/terrain/LevelConfig';
import { PostFxPipeline } from '@/features/effects/postfx/PostFxPipeline';
import type { PostFxQualityOptions } from '@/features/effects/postfx/PostFxPipeline';
import { ScreenEffectsState } from '@/features/effects/postfx/ScreenEffectsState';
import type { ScreenEffectsInput } from '@/features/effects/postfx/ScreenEffectsState';
import { ScreenOverlay } from '@/features/effects/postfx/ScreenOverlay';

/**
 * 游戏场景
 * 管理Three.js场景、相机和渲染器
 */
export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private resizeHandler?: () => void;
  private ambientLight?: THREE.AmbientLight;
  private hemisphereLight?: THREE.HemisphereLight;
  private sunLight?: THREE.DirectionalLight;
  private ground?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private backgroundTexture?: THREE.CanvasTexture;
  private readonly backgroundCanvas: HTMLCanvasElement;
  private readonly backgroundContext: CanvasRenderingContext2D | null;
  // 后处理：画质驱动（性能档关闭），setPostFxEnabled 可显式覆盖
  private postFxPipeline: PostFxPipeline | null = null;
  private postFxOverride: boolean | null = null;
  private postFxQualityKey = '';
  private postFxFailed = false;
  private postFxGrade: LevelPostFxConfig = { ...DEFAULT_LEVEL_SCENE_CONFIG.postFx };
  private readonly screenEffects = new ScreenEffectsState();
  private screenOverlay: ScreenOverlay | null = null;
  private lastRenderTime = 0;

  constructor() {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, GAME_CONSTANTS.WORLD.FOG_NEAR, GAME_CONSTANTS.WORLD.FOG_FAR);
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCanvas.width = 2;
    this.backgroundCanvas.height = 512;
    this.backgroundContext = this.backgroundCanvas.getContext('2d');

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(
      GAME_CONSTANTS.CAMERA.FOV,
      window.innerWidth / window.innerHeight,
      GAME_CONSTANTS.CAMERA.NEAR,
      GAME_CONSTANTS.CAMERA.FAR
    );
    this.camera.position.set(0, 5, 10);

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: GameConfig.getAntialiasEnabled(),
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // 设置场景
    this.setupLighting();
    this.setupSkybox();
    this.setupGround();
    this.applySceneEnvironment();
    this.applyQualitySettings();
    this.setupResizeHandler();
  }

  /**
   * 设置光照
   */
  private setupLighting(): void {
    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    this.ambientLight = ambient;

    // 方向光（太阳）
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(100, 100, 50);
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.sunLight = sun;

    // 半球光（天空和地面反射）
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d5c5c, 0.4);
    this.scene.add(hemi);
    this.hemisphereLight = hemi;
  }

  /**
   * 设置天空盒
   */
  private setupSkybox(): void {
    if (!this.backgroundContext) {
      return;
    }

    const texture = new THREE.CanvasTexture(this.backgroundCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.backgroundTexture = texture;
    this.scene.background = texture;
    this.updateBackgroundGradient(DEFAULT_LEVEL_SCENE_CONFIG.environment.backgroundGradient);
  }

  /**
   * 设置地面（作为参考）
   */
  private setupGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(4400, 4400);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d5c5c,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    // worldscape 高度场的湖盆最深可达约 -92：底板下沉以免穿出湖床
    ground.position.y = -96;
    ground.renderOrder = -1;
    this.scene.add(ground);
    this.ground = ground;
  }

  /**
   * 运行时重新应用画质参数
   */
  public applyQualitySettings(): void {
    const shadowEnabled = GameConfig.getShadowEnabled();
    const sunShadowEnabled =
      shadowEnabled && (this.sunLight?.castShadow ?? DEFAULT_LEVEL_SCENE_CONFIG.lighting.shadowEnabled);

    this.renderer.setPixelRatio(GameConfig.getPixelRatio());
    this.renderer.shadowMap.enabled = sunShadowEnabled;
    this.renderer.shadowMap.needsUpdate = true;

    if (this.sunLight) {
      this.sunLight.castShadow = sunShadowEnabled;
    }

    if (this.ground) {
      this.ground.receiveShadow = sunShadowEnabled;
    }

    this.syncPostFxPipeline();
  }

  /**
   * 设置屏幕效果（各项 0..1）：damagePulse / flash / empFlash 为脉冲（取最大值后自动衰减），
   * lowHealth / speed 为持续量（平滑趋近目标值）。
   */
  public setScreenEffects(effects: ScreenEffectsInput): void {
    this.screenEffects.set(effects);
  }

  /**
   * 显式开启/关闭后处理（默认按画质：performance 关闭，balanced/quality 开启）
   */
  public setPostFxEnabled(enabled: boolean): void {
    this.postFxOverride = enabled;
    this.syncPostFxPipeline();
  }

  /** 后处理管线当前是否生效 */
  public isPostFxEnabled(): boolean {
    return this.postFxPipeline !== null;
  }

  private getPostFxQuality(): PostFxQualityOptions {
    const preset = GameConfig.getEffectiveQualityPreset();
    const antialias = GameConfig.getAntialiasEnabled();
    return {
      samples: antialias ? (preset === 'quality' ? 4 : 2) : 0,
      bloomResolution: preset === 'quality' && !GameConfig.isMobile ? 1 : 0.5,
    };
  }

  private syncPostFxPipeline(): void {
    const preset = GameConfig.getEffectiveQualityPreset();
    const wanted = !this.postFxFailed && (this.postFxOverride ?? preset !== 'performance');
    if (!wanted) {
      this.disposePostFxPipeline();
      return;
    }

    const quality = this.getPostFxQuality();
    const key = `${quality.samples}:${quality.bloomResolution}`;
    if (this.postFxPipeline && key === this.postFxQualityKey) {
      this.postFxPipeline.setSize(
        window.innerWidth,
        window.innerHeight,
        this.renderer.getPixelRatio()
      );
      return;
    }

    this.disposePostFxPipeline();
    if (!PostFxPipeline.isSupported(this.renderer)) {
      return;
    }
    try {
      this.postFxPipeline = new PostFxPipeline(this.renderer, this.scene, this.camera, quality);
      this.postFxPipeline.setGrade(this.postFxGrade);
      this.postFxQualityKey = key;
    } catch (error) {
      console.warn('[GameScene] post-processing unavailable, using direct rendering', error);
      this.postFxFailed = true;
      this.disposePostFxPipeline();
    }
  }

  private disposePostFxPipeline(): void {
    if (!this.postFxPipeline) {
      return;
    }
    this.postFxPipeline.dispose();
    this.postFxPipeline = null;
    this.postFxQualityKey = '';
  }

  /**
   * 按关卡配置应用场景环境参数
   */
  public applyLevelEnvironment(levelConfig: LevelConfig): void {
    this.applySceneEnvironment(
      levelConfig.environment,
      levelConfig.lighting,
      levelConfig.postFx
    );
  }

  /**
   * 运行时应用环境、光照与曝光
   */
  public applySceneEnvironment(
    environmentConfig: Partial<LevelEnvironmentConfig> = DEFAULT_LEVEL_SCENE_CONFIG.environment,
    lightingConfig: Partial<LevelLightingConfig> = DEFAULT_LEVEL_SCENE_CONFIG.lighting,
    postFxConfig: Partial<LevelPostFxConfig> = DEFAULT_LEVEL_SCENE_CONFIG.postFx
  ): void {
    const environment = {
      ...DEFAULT_LEVEL_SCENE_CONFIG.environment,
      ...environmentConfig,
    };
    const lighting = {
      ...DEFAULT_LEVEL_SCENE_CONFIG.lighting,
      ...lightingConfig,
      sunPosition: {
        ...DEFAULT_LEVEL_SCENE_CONFIG.lighting.sunPosition,
        ...(lightingConfig.sunPosition ?? {}),
      },
    };
    const postFx = {
      ...DEFAULT_LEVEL_SCENE_CONFIG.postFx,
      ...postFxConfig,
    };

    this.applyFog(environment);
    this.updateBackgroundGradient(environment.backgroundGradient);
    this.applyLighting(lighting);
    this.applyGroundPalette(environment, lighting);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = postFx.exposure;
    this.postFxGrade = postFx;
    this.postFxPipeline?.setGrade(postFx);
    this.applyQualitySettings();
  }

  /**
   * 设置窗口大小调整处理器
   */
  private setupResizeHandler(): void {
    this.resizeHandler = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.applyQualitySettings();
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  /**
   * 渲染场景
   */
  public render(): void {
    const now = performance.now();
    const deltaTime =
      this.lastRenderTime > 0 ? Math.min((now - this.lastRenderTime) / 1000, 0.1) : 0;
    this.lastRenderTime = now;
    const effects = this.screenEffects.update(deltaTime);

    if (this.postFxPipeline) {
      try {
        this.postFxPipeline.render(deltaTime, effects);
        return;
      } catch (error) {
        console.warn('[GameScene] post-processing failed, falling back to direct rendering', error);
        this.postFxFailed = true;
        this.disposePostFxPipeline();
      }
    }

    this.renderer.render(this.scene, this.camera);
    if (this.screenEffects.isActive()) {
      this.screenOverlay ??= new ScreenOverlay();
      this.screenOverlay.render(this.renderer, effects, this.camera.aspect);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    this.disposePostFxPipeline();
    this.screenOverlay?.dispose();
    this.screenOverlay = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.backgroundTexture?.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  private applyFog(config: LevelEnvironmentConfig): void {
    if (typeof config.fogDensity === 'number' && config.fogDensity > 0) {
      this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
      return;
    }

    this.scene.fog = new THREE.Fog(config.fogColor, config.fogNear, config.fogFar);
  }

  private updateBackgroundGradient(colors: [string, string, string, string]): void {
    if (!this.backgroundContext || !this.backgroundTexture) {
      return;
    }

    const gradient = this.backgroundContext.createLinearGradient(0, 0, 0, this.backgroundCanvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.3, colors[1]);
    gradient.addColorStop(0.6, colors[2]);
    gradient.addColorStop(1, colors[3]);

    this.backgroundContext.fillStyle = gradient;
    this.backgroundContext.fillRect(0, 0, this.backgroundCanvas.width, this.backgroundCanvas.height);
    this.backgroundTexture.needsUpdate = true;
  }

  private applyLighting(config: LevelLightingConfig): void {
    if (this.ambientLight) {
      this.ambientLight.color.setHex(config.ambientColor);
      this.ambientLight.intensity = config.ambientIntensity;
    }

    if (this.hemisphereLight) {
      this.hemisphereLight.color.setHex(config.hemisphereSkyColor);
      this.hemisphereLight.groundColor.setHex(config.hemisphereGroundColor);
      this.hemisphereLight.intensity = config.hemisphereIntensity;
    }

    if (this.sunLight) {
      this.sunLight.color.setHex(config.sunColor);
      this.sunLight.intensity = config.sunIntensity;
      this.sunLight.position.set(
        config.sunPosition.x,
        config.sunPosition.y,
        config.sunPosition.z
      );
      this.sunLight.castShadow = config.shadowEnabled;
      this.sunLight.shadow.mapSize.width = config.shadowMapSize;
      this.sunLight.shadow.mapSize.height = config.shadowMapSize;
      this.sunLight.shadow.camera.near = config.shadowCameraNear;
      this.sunLight.shadow.camera.far = config.shadowCameraFar;
      this.sunLight.shadow.bias = config.shadowBias ?? 0;
      this.sunLight.shadow.normalBias = config.shadowNormalBias ?? 0;
      this.sunLight.shadow.needsUpdate = true;
    }

    if (this.ground) {
      this.ground.receiveShadow = config.shadowEnabled;
    }
  }

  private applyGroundPalette(
    environmentConfig: LevelEnvironmentConfig,
    lightingConfig: LevelLightingConfig
  ): void {
    if (!this.ground) {
      return;
    }

    const groundMaterial = this.ground.material;
    const fogColor = new THREE.Color(environmentConfig.fogColor);
    const groundBounce = new THREE.Color(lightingConfig.hemisphereGroundColor);
    const ambientWash = new THREE.Color(lightingConfig.ambientColor);
    const sunTint = new THREE.Color(lightingConfig.sunColor);
    const surfaceProfile = environmentConfig.surfaceProfile;

    const baseGround = surfaceProfile?.groundBaseColor
      ? new THREE.Color(surfaceProfile.groundBaseColor)
      : fogColor.clone().lerp(groundBounce, 0.65).lerp(ambientWash, 0.18);
    const emissiveGround = surfaceProfile?.groundEmissiveColor
      ? new THREE.Color(surfaceProfile.groundEmissiveColor)
      : groundBounce.clone().lerp(sunTint, 0.2);

    groundMaterial.color.copy(baseGround);
    groundMaterial.emissive.copy(emissiveGround);
    groundMaterial.emissiveIntensity = THREE.MathUtils.clamp(
      0.03 + lightingConfig.ambientIntensity * 0.04 + lightingConfig.hemisphereIntensity * 0.03,
      0.03,
      surfaceProfile?.groundEmissiveColor ? 0.14 : 0.1
    );
    groundMaterial.roughness = 0.94;
    groundMaterial.metalness = 0.02;
    groundMaterial.needsUpdate = true;
  }
}
