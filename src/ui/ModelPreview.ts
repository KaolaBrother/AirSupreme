import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Sprite,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { BossType, BOSS_CONFIGS, type BossConfig } from '@/features/boss/BossTypes';
import { onLocaleChange, tr } from '@/i18n';

// 包围球取景：模型统一缩放到这个包围球半径，相机按视场角后退到横纵都容得下整个球
const PREVIEW_FIT_RADIUS = 3.1;
/** 包围球外留的边距（倍数） */
const PREVIEW_FRAME_MARGIN = 1.08;
/** 相机俯视方向（原先固定在 (0, 2, 8)） */
const PREVIEW_VIEW_DIRECTION = new Vector3(0, 2, 8).normalize();
/** 取景区与画布上沿、与名称标签之间留的间距（px） */
const PREVIEW_REGION_PADDING_PX = 8;

interface AircraftMeshFactoryModule {
  createPlayerMesh: () => Group;
  createEnemyMesh: (config: (typeof ENEMY_CONFIGS)[EnemyType]) => Group;
}

/**
 * 每个 Boss 的预览模型工厂：与战斗中使用的模型同源，按需加载（与第 1-5 关一致）。
 * Record 保证新增 Boss 时必须给出预览模型，不会再退回重型轰炸机。
 */
const BOSS_MESH_LOADERS: Readonly<Record<BossType, (config: BossConfig) => Promise<Group>>> = {
  [BossType.HEAVY_BOMBER]: async (config) =>
    (await import('@/features/boss/BossAI')).createBossMesh(config),
  [BossType.DESERT_FORTRESS]: async (config) =>
    (await import('@/features/boss/DesertFortressAI')).createDesertFortressMesh(config),
  [BossType.OCTOPUS_WARSHIP]: async (config) =>
    (await import('@/features/boss/OctopusWarshipAI')).createOctopusWarshipMesh(config),
  [BossType.MISSILE_DESTROYER]: async (config) =>
    (await import('@/features/boss/MissileDestroyerAI')).createMissileDestroyerMesh(config),
  [BossType.SKY_CARRIER]: async (config) =>
    (await import('@/features/boss/SkyCarrierAI')).createSkyCarrierMesh(config),
  [BossType.MAGMA_COLOSSUS]: async (config) =>
    (await import('@/features/boss/MagmaColossusMesh')).createMagmaColossusMesh(config),
  [BossType.ABYSSAL_LEVIATHAN]: async (config) =>
    (await import('@/features/boss/AbyssalLeviathanMesh')).createAbyssalLeviathanMesh(config),
  [BossType.TEMPEST_ZEPPELIN]: async (config) =>
    (await import('@/features/boss/TempestZeppelinMesh')).createTempestZeppelinMesh(config),
  [BossType.PHANTOM_WING]: async (config) =>
    (await import('@/features/boss/PhantomWingMesh')).createPhantomWingMesh(config),
  [BossType.ORACLE_PRIME]: async (config) =>
    (await import('@/features/boss/OraclePrimeMesh')).createOraclePrimeMesh(config),
};

type Renderable = Object3D & {
  geometry?: BufferGeometry;
  material?: Material | Material[];
};

const scratchBox = new Box3();

/**
 * 只按可见的几何体求包围盒：隐藏的部件（未触发的熔岩斑块、隐形的瞳孔光晕等）与
 * 加色光晕 Sprite 不参与取景，否则大模型会被一圈看不见的东西撑大、显得过小。
 */
function computeVisibleBounds(root: Object3D, target: Box3): Box3 {
  target.makeEmpty();
  root.updateWorldMatrix(true, true);
  root.traverseVisible((object) => {
    if (object instanceof Sprite) {
      return;
    }
    if (object instanceof InstancedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox) {
        target.union(scratchBox.copy(object.boundingBox).applyMatrix4(object.matrixWorld));
      }
      return;
    }
    const geometry = (object as Renderable).geometry;
    if (!geometry || !geometry.getAttribute('position')) {
      return;
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (geometry.boundingBox) {
      target.union(scratchBox.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld));
    }
  });
  return target;
}

/**
 * 释放预览模型：几何体、材质与 InstancedMesh 的实例缓冲（同一资源只释放一次）。
 * 跳过 userData.sharedResource 标记的共享资源；Sprite 共用 three 内置平面几何体，不释放；
 * 纹理都是跨模型共享的（光晕 / 导弹涂装），不在这里释放。
 */
function disposePreviewTree(root: Object3D): void {
  const seen = new Set<object>();
  root.traverse((object) => {
    if (object.userData.sharedResource === true) {
      return;
    }
    if (object instanceof InstancedMesh) {
      object.dispose();
    }
    const renderable = object as Renderable;
    const geometry = renderable.geometry;
    if (geometry && !(object instanceof Sprite) && !seen.has(geometry)) {
      seen.add(geometry);
      if (geometry.userData.sharedResource !== true) {
        geometry.dispose();
      }
    }
    const material = renderable.material;
    const materials = material === undefined ? [] : Array.isArray(material) ? material : [material];
    for (const entry of materials) {
      if (seen.has(entry) || entry.userData.sharedResource === true) {
        continue;
      }
      seen.add(entry);
      entry.dispose();
    }
  });
}

interface AircraftInfo {
  id: string;
  name: string;
  type: 'player' | 'enemy' | 'boss' | 'missile';
  createMesh: () => Group | Promise<Group>;
}

export class ModelPreview {
  private container: HTMLDivElement;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private currentMesh: Group | null = null;
  private currentIndex: number = 0;
  private aircrafts: AircraftInfo[] = [];
  private animationId: number = 0;
  private autoRotate: boolean = true;
  private nameDisplay: HTMLDivElement;
  private onBack?: () => void;
  private resizeHandler!: () => void;
  private meshLoadSequence: number = 0;
  private aircraftMeshFactoryPromise: Promise<AircraftMeshFactoryModule> | null = null;
  private readonly unsubscribeLocale: () => void;

  constructor() {
    this.container = this.createContainer();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
    this.applyStaticText();

    this.nameDisplay = this.createNameDisplay();

    this.scene = new Scene();
    this.scene.background = new Color(0x1a1a2e);

    this.camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    this.setupLighting();
    this.setupAircrafts();
    this.setupControls();

    this.resizeHandler = () => this.resizeRenderer();
    window.addEventListener('resize', this.resizeHandler);
    this.unsubscribeLocale = onLocaleChange(() => this.handleLocaleChange());
  }

  /** 页头 / 按钮 / 提示文字按当前语言写入 */
  private applyStaticText(): void {
    const setText = (id: string, text: string): void => {
      const element = this.container.querySelector(`#${id}`);
      if (element) {
        element.textContent = text;
      }
    };
    setText('preview-header', tr({ en: '✈️ Aircraft Model Preview', zh: '✈️ 飞机模型预览' }));
    setText('rotate-toggle', this.getRotateLabel());
    setText(
      'preview-touch-hint',
      tr({
        en: '💡 Swipe to switch models · drag to rotate',
        zh: '💡 滑动屏幕切换模型 / 拖拽旋转',
      })
    );
    setText('back-btn', tr({ en: '← Back to Main Menu', zh: '← 返回主菜单' }));
  }

  private getRotateLabel(): string {
    return this.autoRotate
      ? tr({ en: '🔄 Auto-rotate: On', zh: '🔄 自动旋转: 开' })
      : tr({ en: '🔄 Auto-rotate: Off', zh: '🔄 自动旋转: 关' });
  }

  /** 语言切换：重写静态文字，并按新语言重建机型列表（名称在建表时取值） */
  private handleLocaleChange(): void {
    this.applyStaticText();
    this.aircrafts = [];
    this.setupAircrafts();
    const current = this.aircrafts[this.currentIndex];
    if (current && this.currentMesh) {
      this.nameDisplay.textContent = current.name;
      // 新语言的名称可能改变标签高度：重新取景
      this.frameCamera();
    }
  }

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'model-preview';
    container.innerHTML = `
      <style>
        #model-preview {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(8, 14, 24, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1001;
          font-family: var(--hud-font, 'Arial', sans-serif);
          color: var(--hud-text, #eef8ff);
        }

        .preview-header {
          font-size: 36px;
          font-weight: bold;
          letter-spacing: 0.12em;
          margin-bottom: 20px;
          color: var(--hud-sys, #8fe4ff);
          text-shadow: 0 0 15px rgba(143, 228, 255, 0.45);
        }

        .preview-body,
        .preview-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* 视口不够高时由画布让出高度（与画布直接放在页面列里时一致） */
        .preview-body {
          width: 100%;
          min-height: 0;
        }

        .preview-canvas-container {
          position: relative;
          width: 80%;
          max-width: 600px;
          height: 400px;
          border-radius: var(--hud-radius, 12px);
          overflow: hidden;
          border: 1px solid var(--hud-edge, rgba(143, 228, 255, 0.28));
          box-shadow: var(--hud-shadow, 0 12px 24px rgba(0, 0, 0, 0.28));
        }

        .preview-canvas-container canvas {
          display: block;
        }

        /* 名称标签按内容宽度单行显示（放不下才换行）；相机取景只用标签上方的区域 */
        .aircraft-name {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: max-content;
          max-width: calc(100% - 24px);
          box-sizing: border-box;
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
          background: var(--hud-glass, rgba(8, 14, 24, 0.72));
          border: 1px solid var(--hud-edge, rgba(143, 228, 255, 0.28));
          padding: 10px 30px;
          border-radius: var(--hud-radius, 12px);
        }

        .nav-controls {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-top: 30px;
        }

        .nav-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 1px solid var(--hud-edge, rgba(143, 228, 255, 0.28));
          background: var(--hud-glass, rgba(8, 14, 24, 0.72));
          color: var(--hud-text, #eef8ff);
          font-size: 28px;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .nav-btn:hover {
          border-color: var(--hud-sys, #8fe4ff);
          box-shadow: 0 0 16px rgba(143, 228, 255, 0.28);
        }

        .page-indicator {
          font-size: 18px;
          min-width: 100px;
          text-align: center;
        }

        .back-btn {
          margin-top: 30px;
          padding: 15px 40px;
          font-size: 20px;
          font-weight: bold;
          border: 1px solid var(--hud-edge, rgba(143, 228, 255, 0.28));
          border-radius: var(--hud-radius, 12px);
          background: var(--hud-glass, rgba(8, 14, 24, 0.72));
          color: var(--hud-text, #eef8ff);
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: var(--hud-shadow, 0 12px 24px rgba(0, 0, 0, 0.28));
        }

        .back-btn:hover {
          border-color: var(--hud-sys, #8fe4ff);
          box-shadow: 0 0 16px rgba(143, 228, 255, 0.28);
        }

        .touch-hint {
          margin-top: 15px;
          font-size: 14px;
          opacity: 0.7;
        }

        .rotate-toggle {
          margin-top: 15px;
          padding: 10px 25px;
          font-size: 16px;
          border: 1px solid var(--hud-edge, rgba(143, 228, 255, 0.28));
          border-radius: var(--hud-radius, 12px);
          background: var(--hud-glass, rgba(8, 14, 24, 0.72));
          color: var(--hud-text, #eef8ff);
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .rotate-toggle:hover {
          border-color: var(--hud-sys, #8fe4ff);
        }

        @media (max-width: 600px) {
          .aircraft-name {
            bottom: 12px;
            font-size: 18px;
            padding: 6px 16px;
          }
        }

        /* 横握手机等矮视口：画布在左、按钮列在右，画布占满标题以下的高度 */
        @media (orientation: landscape) and (max-height: 520px) {
          #model-preview {
            justify-content: flex-start;
            padding: 10px 16px;
            box-sizing: border-box;
          }

          .preview-header {
            font-size: 22px;
            margin-bottom: 8px;
          }

          .preview-body {
            flex: 1 1 auto;
            min-height: 0;
            flex-direction: row;
            align-items: stretch;
            justify-content: center;
            gap: 16px;
          }

          .preview-canvas-container {
            flex: 1 1 0;
            width: auto;
            max-width: 560px;
            height: auto;
            min-height: 0;
          }

          .preview-controls {
            flex: 0 0 auto;
            justify-content: center;
          }

          .nav-controls {
            margin-top: 0;
            gap: 12px;
          }

          .nav-btn {
            width: 48px;
            height: 48px;
            font-size: 22px;
          }

          .back-btn {
            margin-top: 16px;
            padding: 10px 24px;
            font-size: 16px;
          }

          .aircraft-name {
            bottom: 10px;
            font-size: 18px;
            padding: 6px 18px;
          }
        }
      </style>

      <div class="preview-header" id="preview-header"></div>
      <div class="preview-body">
        <div class="preview-canvas-container" id="canvas-container"></div>
        <div class="preview-controls">
          <div class="nav-controls">
            <button class="nav-btn" id="prev-btn">◀</button>
            <div class="page-indicator" id="page-indicator">1 / 9</div>
            <button class="nav-btn" id="next-btn">▶</button>
          </div>
          <button class="rotate-toggle" id="rotate-toggle"></button>
          <div class="touch-hint" id="preview-touch-hint"></div>
          <button class="back-btn" id="back-btn"></button>
        </div>
      </div>
    `;

    return container;
  }

  private createNameDisplay(): HTMLDivElement {
    const display = document.createElement('div');
    display.className = 'aircraft-name';
    display.id = 'aircraft-name';
    return display;
  }

  private setupLighting(): void {
    // 偏高的环境光让深色船体（八爪鱼战舰、空中航母）在深色背景上仍可读
    const ambientLight = new AmbientLight(0xffffff, 0.78);
    this.scene.add(ambientLight);

    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const backLight = new DirectionalLight(0x6688ff, 0.5);
    backLight.position.set(-5, 5, -5);
    this.scene.add(backLight);
  }

  private setupAircrafts(): void {
    // 玩家飞机 - 使用工厂函数
    this.aircrafts.push({
      id: 'player',
      name: tr({ en: 'Player jet', zh: '玩家飞机' }),
      type: 'player',
      createMesh: async () => {
        const { createPlayerMesh } = await this.loadAircraftMeshFactory();
        return createPlayerMesh();
      },
    });

    // 敌机 - 使用工厂函数
    const enemyTypes = Object.values(EnemyType);
    for (const type of enemyTypes) {
      const config = ENEMY_CONFIGS[type];
      this.aircrafts.push({
        id: type,
        name: tr(config.name),
        type: 'enemy',
        createMesh: async () => {
          const { createEnemyMesh } = await this.loadAircraftMeshFactory();
          return createEnemyMesh(config);
        },
      });
    }

    // Boss：每个 Boss 用自己的模型（第 6-10 关不再退回重型轰炸机）
    const bossTypes = Object.values(BossType);
    for (const type of bossTypes) {
      const config = BOSS_CONFIGS[type];
      const loadMesh = BOSS_MESH_LOADERS[type];
      this.aircrafts.push({
        id: type,
        name: tr(config.name),
        type: 'boss',
        createMesh: () => loadMesh(config),
      });
    }

    // 导弹：直接复用战斗模型的视觉装配工厂，与实战外观完全一致
    this.aircrafts.push({
      id: 'player_missile',
      name: tr({ en: 'Player missile', zh: '玩家导弹' }),
      type: 'missile',
      createMesh: async () => {
        const module = await import('@/features/combat/MissileSystem');
        return module.createMissileVisualMesh();
      },
    });

    this.aircrafts.push({
      id: 'boss_missile',
      name: tr({ en: 'Boss missile', zh: 'Boss 导弹' }),
      type: 'missile',
      createMesh: async () => {
        const module = await import('@/features/boss/BossMissileSystem');
        return module.createBossMissileVisualMesh();
      },
    });
  }

  private loadAircraftMeshFactory(): Promise<AircraftMeshFactoryModule> {
    if (!this.aircraftMeshFactoryPromise) {
      this.aircraftMeshFactoryPromise = import('@/features/aircraft/AircraftMeshFactory');
    }

    return this.aircraftMeshFactoryPromise;
  }

  private setupControls(): void {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const rotateToggle = document.getElementById('rotate-toggle');
    const canvasContainer = document.getElementById('canvas-container');

    prevBtn?.addEventListener('click', () => this.showPrevious());
    nextBtn?.addEventListener('click', () => this.showNext());
    backBtn?.addEventListener('click', () => this.hide());
    rotateToggle?.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      if (rotateToggle) {
        rotateToggle.textContent = this.getRotateLabel();
      }
    });

    let touchStartX = 0;
    canvasContainer?.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });

    canvasContainer?.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          this.showNext();
        } else {
          this.showPrevious();
        }
      }
    });

    let isDragging = false;
    let previousMouseX = 0;

    canvasContainer?.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMouseX = e.clientX;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging && this.currentMesh) {
        const deltaX = e.clientX - previousMouseX;
        this.currentMesh.rotation.y += deltaX * 0.01;
        previousMouseX = e.clientX;
      }
    });

    if (canvasContainer) {
      canvasContainer.appendChild(this.renderer.domElement);
      canvasContainer.appendChild(this.nameDisplay);
    }
  }

  private resizeRenderer(): void {
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      const width = canvasContainer.clientWidth;
      const height = canvasContainer.clientHeight;
      if (width > 0 && height > 0) {
        this.camera.aspect = width / height;
      }
      this.frameCamera();
      this.renderer.setSize(width, height);
    }
  }

  /**
   * 包围球取景：模型已缩放到半径 PREVIEW_FIT_RADIUS 的包围球（绕中心自转也不出球），相机沿固定
   * 俯视方向后退到整个球放得进名称标签上方的取景区（横向为整个画布宽）。投影中心用 setViewOffset
   * 平移到取景区中心（镜头平移，透视方向不变），模型因此完整显示在标签上方。
   * 画布尚未布局（隐藏 / 无布局的测试环境）时按整个画布取景。
   */
  private frameCamera(): void {
    const canvasContainer = this.renderer.domElement.parentElement;
    const width = canvasContainer?.clientWidth ?? 0;
    const height = canvasContainer?.clientHeight ?? 0;
    const tanHalfVertical = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    // 包围球轮廓半径对应的视角正切
    let fitTan: number;
    if (width > 0 && height > 0) {
      const pad = PREVIEW_REGION_PADDING_PX;
      // 标签相对画布容器（定位祖先）的上沿；标签未布局时取画布底边。取景区至少留半个画布
      const labelTop = this.nameDisplay.offsetHeight > 0 ? this.nameDisplay.offsetTop : height;
      const regionBottom = Math.min(height - pad, Math.max(height * 0.5, labelTop - pad));
      const regionHeight = Math.max(1, regionBottom - pad);
      // 取景区中心在画布上半部：虚拟全画幅以它为中心向下延伸到画布底边，画布是其底部子窗口
      const centerY = (pad + regionBottom) / 2;
      const fullHeight = 2 * (height - centerY);
      this.camera.setViewOffset(width, fullHeight, 0, fullHeight - height, width, height);
      // 视场角覆盖全画幅高度：取景区的半高 / 半宽（像素）按全画幅换算成视角正切
      fitTan = (Math.min(regionHeight, width) / fullHeight) * tanHalfVertical;
    } else {
      this.camera.clearViewOffset();
      const aspect =
        Number.isFinite(this.camera.aspect) && this.camera.aspect > 0 ? this.camera.aspect : 1;
      fitTan = Math.min(1, aspect) * tanHalfVertical;
    }
    const distance = (PREVIEW_FIT_RADIUS * PREVIEW_FRAME_MARGIN) / Math.sin(Math.atan(fitTan));
    this.camera.position.copy(PREVIEW_VIEW_DIRECTION).multiplyScalar(distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private async showAircraft(index: number): Promise<void> {
    this.disposeCurrentMesh();
    const loadSequence = ++this.meshLoadSequence;

    this.currentIndex = index;
    const aircraft = this.aircrafts[index];
    this.nameDisplay.textContent = tr(
      { en: 'Loading: {name}', zh: '加载中: {name}' },
      { name: aircraft.name }
    );
    const indicator = document.getElementById('page-indicator');
    if (indicator) {
      indicator.textContent = `${index + 1} / ${this.aircrafts.length}`;
    }

    const mesh = await aircraft.createMesh();
    if (loadSequence !== this.meshLoadSequence || this.container.style.display === 'none') {
      disposePreviewTree(mesh);
      return;
    }

    // 包围球取景：按可见几何体的包围盒求包围球，把模型统一缩放到固定半径并移到原点。
    // 缩放 / 平移放在中间的取景组上，不改动工厂组自带的变换（如八爪鱼战舰 scale=5）；
    // 外层包装组负责旋转（渲染循环旋转 currentMesh），模型绕几何中心转动
    const bounds = computeVisibleBounds(mesh, new Box3());
    const fit = new Group();
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new Vector3());
      const radius = bounds.getSize(new Vector3()).length() / 2;
      const fitScale = radius > 0 && Number.isFinite(radius) ? PREVIEW_FIT_RADIUS / radius : 1;
      fit.scale.setScalar(fitScale);
      fit.position.copy(center).multiplyScalar(-fitScale);
    }
    fit.add(mesh);

    const wrapper = new Group();
    wrapper.add(fit);

    this.currentMesh = wrapper;
    this.scene.add(wrapper);
    // 先写名称再取景：取景区按标签（可能换行）的实际高度计算
    this.nameDisplay.textContent = aircraft.name;
    this.frameCamera();
  }

  private disposeCurrentMesh(): void {
    if (!this.currentMesh) {
      return;
    }

    this.scene.remove(this.currentMesh);
    disposePreviewTree(this.currentMesh);
    this.currentMesh = null;
  }

  private showNext(): void {
    const nextIndex = (this.currentIndex + 1) % this.aircrafts.length;
    this.showAircraft(nextIndex);
  }

  private showPrevious(): void {
    const prevIndex = (this.currentIndex - 1 + this.aircrafts.length) % this.aircrafts.length;
    this.showAircraft(prevIndex);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    if (this.currentMesh && this.autoRotate) {
      this.currentMesh.rotation.y += 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setOnBack(callback: () => void): void {
    this.onBack = callback;
  }

  public show(): void {
    this.container.style.display = 'flex';
    void this.showAircraft(0);
    requestAnimationFrame(() => {
      this.resizeRenderer();
      this.animate();
    });
  }

  public hide(): void {
    this.container.style.display = 'none';
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.disposeCurrentMesh();
    this.onBack?.();
  }

  public dispose(): void {
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.unsubscribeLocale();
    window.removeEventListener('resize', this.resizeHandler);
    this.disposeCurrentMesh();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.container.remove();
  }
}
