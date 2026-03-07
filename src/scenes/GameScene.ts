import * as THREE from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';
import {
  DEFAULT_LEVEL_SCENE_CONFIG,
  LevelConfig,
  LevelEnvironmentConfig,
  LevelLightingConfig,
  LevelPostFxConfig,
} from '@/features/terrain/LevelConfig';

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
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
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
    ground.position.y = -70;
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
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

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
