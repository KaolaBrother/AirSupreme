import * as THREE from 'three';
import { GameConfig, GAME_CONSTANTS } from '@/config';

/**
 * 游戏场景
 * 管理Three.js场景、相机和渲染器
 */
export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  constructor() {
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(
      0x87CEEB,
      GAME_CONSTANTS.WORLD.FOG_NEAR,
      GAME_CONSTANTS.WORLD.FOG_FAR
    );

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
    this.renderer.setPixelRatio(GameConfig.getPixelRatio());
    this.renderer.shadowMap.enabled = GameConfig.getShadowEnabled();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // 设置场景
    this.setupLighting();
    this.setupSkybox();
    this.setupGround();
    this.setupResizeHandler();
  }

  /**
   * 设置光照
   */
  private setupLighting(): void {
    // 环境光
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    // 方向光（太阳）
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(100, 100, 50);
    sun.castShadow = GameConfig.getShadowEnabled();
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);

    // 半球光（天空和地面反射）
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d5c5c, 0.4);
    this.scene.add(hemi);
  }

  /**
   * 设置天空盒
   */
  private setupSkybox(): void {
    // 使用渐变色背景
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 创建渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1e3c72');    // 深蓝
    gradient.addColorStop(0.3, '#2a5298');  // 中蓝
    gradient.addColorStop(0.6, '#87CEEB');  // 天蓝
    gradient.addColorStop(1, '#ffffff');    // 白色

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
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
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -50;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /**
   * 设置窗口大小调整处理器
   */
  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
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
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
