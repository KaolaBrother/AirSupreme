import {
  AmbientLight,
  Box3,
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
import type { BufferGeometry, Matrix4, Object3D } from 'three';
import { GameConfig } from '@/config';
import { EnemyType, ENEMY_CONFIGS } from '@/features/enemy/EnemyTypes';
import { BossType, BOSS_CONFIGS, type BossConfig } from '@/features/boss/BossTypes';
import { onLocaleChange, tr, type LocalizedText } from '@/i18n';
import { MENU_ICONS } from './menu/menuIcons';
import { disposeModelTree, hideSignalLights, releaseRenderer } from './menu/modelDisposal';

// 包围球取景：模型统一缩放到这个包围球半径，相机按视场角后退到球的轮廓占展台短边的固定比例
const PREVIEW_FIT_RADIUS = 3.1;
/**
 * 包围球轮廓的直径占展台（画布容器）短边的比例。球是贴着顶点算的，所以机体最长的一面
 * 约占短边的这个比例，转到其它角度时略小（战机约 55%-68%）；四周留出的空当给取景框线和展台光环。
 */
const PREVIEW_FILL = 0.7;
/** 标签上方的取景区放不下上面的比例时（标签折成多行 / 很矮的视口），包围球外至少留的边距（倍数） */
const PREVIEW_FRAME_MARGIN = 1.08;
/** 展台光环：宽度是包围球直径的倍数，圆心在模型中心下方（直径的比例） */
const PREVIEW_RING_SCALE = 1.24;
const PREVIEW_RING_DROP = 0.21;
/** 相机俯视方向（原先固定在 (0, 2, 8)） */
const PREVIEW_VIEW_DIRECTION = new Vector3(0, 2, 8).normalize();
/** 取景区与画布上沿、与名称标签之间留的间距（px） */
const PREVIEW_REGION_PADDING_PX = 8;
/** 自动旋转的角速度（弧度 / 秒；原先每帧 0.01，即 60 帧时的 0.6） */
const AUTO_ROTATE_SPEED = 0.6;

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

const scratchVertex = new Vector3();

/**
 * 可见几何体上离 center 最远的顶点有多远：模型绕 center 怎么转都不出这个球。
 * 比包围盒对角线的一半紧得多（战机又长又扁，差三成左右），同样的展台里模型因此更大、
 * 各个模型的大小也更一致。实例化网格按整体包围盒的八个角估算（偏保守）。
 */
function computeVisibleRadius(root: Object3D, center: Vector3): number {
  let maxDistanceSq = 0;
  const reach = (point: Vector3, matrixWorld: Matrix4): void => {
    const distanceSq = point.applyMatrix4(matrixWorld).distanceToSquared(center);
    if (distanceSq > maxDistanceSq) {
      maxDistanceSq = distanceSq;
    }
  };
  root.traverseVisible((object) => {
    if (object instanceof Sprite) {
      return;
    }
    if (object instanceof InstancedMesh) {
      const box = object.boundingBox;
      if (box && !box.isEmpty()) {
        for (let corner = 0; corner < 8; corner++) {
          scratchVertex.set(
            corner & 1 ? box.max.x : box.min.x,
            corner & 2 ? box.max.y : box.min.y,
            corner & 4 ? box.max.z : box.min.z
          );
          reach(scratchVertex, object.matrixWorld);
        }
      }
      return;
    }
    const position = (object as Renderable).geometry?.getAttribute('position');
    if (!position) {
      return;
    }
    for (let index = 0; index < position.count; index++) {
      reach(scratchVertex.fromBufferAttribute(position, index), object.matrixWorld);
    }
  });
  return Math.sqrt(maxDistanceSq);
}

type AircraftCategory = 'player' | 'enemy' | 'boss' | 'missile';

interface AircraftInfo {
  id: string;
  name: string;
  type: AircraftCategory;
  createMesh: () => Group | Promise<Group>;
}

const CATEGORY_LABELS: Readonly<Record<AircraftCategory, LocalizedText>> = {
  player: { en: 'Player', zh: '玩家' },
  enemy: { en: 'Enemy', zh: '敌机' },
  boss: { en: 'Boss', zh: 'Boss' },
  missile: { en: 'Ordnance', zh: '弹药' },
};

/** 某个模型没能载入时名称标签上的文字 */
const LOAD_FAILED_LABEL: LocalizedText = { en: 'Could not load: {name}', zh: '无法加载：{name}' };

const PREVIEW_CSS = `
#model-preview {
  --mp-ice: var(--hud-sys, #8fe4ff);
  --mp-text: var(--hud-text, #eef8ff);
  --mp-muted: var(--hud-muted, rgba(183, 231, 255, 0.86));
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  padding:
    max(14px, env(safe-area-inset-top))
    max(18px, env(safe-area-inset-right))
    max(14px, env(safe-area-inset-bottom))
    max(18px, env(safe-area-inset-left));
  background:
    radial-gradient(ellipse 68% 52% at 50% 44%, rgba(143, 228, 255, 0.17) 0%, rgba(143, 228, 255, 0) 70%),
    linear-gradient(180deg, #0b1a30 0%, #07101e 52%, #04080f 100%);
  font-family: var(--hud-font, 'Arial', sans-serif);
  color: var(--mp-text);
  outline: none;
  -webkit-tap-highlight-color: transparent;
  animation: mp-in 0.26s ease both;
}

#model-preview,
#model-preview * {
  box-sizing: border-box;
}

@keyframes mp-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

#model-preview button {
  margin: 0;
  font-family: inherit;
  color: var(--mp-text);
  cursor: pointer;
  touch-action: manipulation;
}

#model-preview :focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

#model-preview .mi {
  display: inline-flex;
  flex: none;
  width: 22px;
  height: 22px;
}

#model-preview .mi svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------------------------------------------------------------- 页头 */
#model-preview .mp-top {
  flex: none;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 48px;
}

#model-preview .back-btn,
#model-preview .rotate-toggle,
#model-preview .nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  border: 1px solid rgba(143, 228, 255, 0.36);
  border-radius: 3px;
  background: rgba(8, 16, 28, 0.72);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: background 0.16s ease, border-color 0.16s ease, transform 0.12s ease;
}

#model-preview .back-btn {
  flex: none;
  padding: 0 16px 0 10px;
}

#model-preview .back-btn:active,
#model-preview .rotate-toggle:active,
#model-preview .nav-btn:active {
  transform: scale(0.95);
  background: rgba(143, 228, 255, 0.28);
}

#model-preview .mp-heading {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

#model-preview .mp-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--mp-ice);
  white-space: nowrap;
}

#model-preview .mp-kicker::before {
  content: '';
  flex: none;
  width: 16px;
  height: 2px;
  background: var(--mp-ice);
}

#model-preview .preview-header {
  margin: 4px 0 0;
  font-family: 'Arial Black', system-ui, 'Arial', sans-serif;
  font-stretch: 115%;
  font-size: 26px;
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f4fbff;
}

#model-preview .preview-header:lang(zh) {
  letter-spacing: 0.24em;
}

#model-preview .rotate-toggle {
  flex: none;
  padding: 0 14px 0 12px;
  color: var(--mp-muted);
}

#model-preview .rotate-toggle[aria-pressed='true'] {
  border-color: var(--mp-ice);
  background: rgba(143, 228, 255, 0.16);
  color: #ffffff;
}

#model-preview .rotate-toggle[aria-pressed='true'] .mi {
  color: var(--mp-ice);
}

/* ---------------------------------------------------------------- 展台 */
#model-preview .preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

#model-preview .preview-canvas-container {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 10px 0;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
}

#model-preview .preview-canvas-container:active {
  cursor: grabbing;
}

/* 四角的取景框线 */
#model-preview .preview-canvas-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(var(--mp-ice), var(--mp-ice)) left top / 22px 1px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) left top / 1px 22px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) right top / 22px 1px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) right top / 1px 22px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) left bottom / 22px 1px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) left bottom / 1px 22px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) right bottom / 22px 1px,
    linear-gradient(var(--mp-ice), var(--mp-ice)) right bottom / 1px 22px;
  background-repeat: no-repeat;
  opacity: 0.5;
  pointer-events: none;
}

/* 模型下方的全息展台光环：位置与宽度由取景（frameCamera）按模型的包围球写入，未取景时用后面的默认值 */
#model-preview .preview-canvas-container::after {
  content: '';
  position: absolute;
  left: 50%;
  top: var(--mp-ring-top, 60%);
  width: var(--mp-ring-width, min(74%, 66vh));
  aspect-ratio: 4.6 / 1;
  border: 1px solid rgba(143, 228, 255, 0.3);
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(143, 228, 255, 0.13) 0%, rgba(143, 228, 255, 0) 68%);
  box-shadow: 0 0 40px rgba(143, 228, 255, 0.12);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

#model-preview .preview-canvas-container canvas {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  display: block;
}

/* 名称标签按内容宽度单行显示（放不下才换行）；相机取景只用标签上方的区域 */
#model-preview .aircraft-name {
  position: absolute;
  bottom: 14px;
  left: 50%;
  z-index: 2;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 24px);
  padding: 9px 26px;
  border: 1px solid rgba(143, 228, 255, 0.32);
  border-bottom: 2px solid var(--mp-ice);
  background: rgba(8, 14, 24, 0.78);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

/* ---------------------------------------------------------------- 底栏 */
#model-preview .preview-controls {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

#model-preview .nav-controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

#model-preview .nav-btn {
  width: 58px;
  height: 50px;
  padding: 0;
  color: var(--mp-ice);
}

#model-preview .mp-readout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 124px;
}

#model-preview .mp-type {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--mp-ice);
}

#model-preview .mp-type[data-type='enemy'] { color: var(--hud-threat, #ff4d4d); }
#model-preview .mp-type[data-type='boss'] { color: var(--hud-weapon, #ffb347); }
#model-preview .mp-type[data-type='missile'] { color: var(--hud-ally, #f4d35e); }

#model-preview .page-indicator {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}

#model-preview .touch-hint {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(183, 231, 255, 0.62);
  text-align: center;
}

@media (hover: hover) {
  #model-preview .back-btn:hover,
  #model-preview .rotate-toggle:hover,
  #model-preview .nav-btn:hover {
    border-color: var(--mp-ice);
    background: rgba(143, 228, 255, 0.2);
  }
}

/* 窄屏：自动旋转只留图标，名称收一号 */
@media (max-width: 600px) {
  #model-preview .mp-top {
    gap: 10px;
  }

  /* 页头只剩返回、标题、旋转三样：小标题放不下（会压到旋转按钮下面） */
  #model-preview .mp-kicker {
    display: none;
  }

  #model-preview .preview-header {
    margin-top: 0;
    font-size: 20px;
  }

  #model-preview .rotate-label {
    display: none;
  }

  #model-preview .rotate-toggle {
    width: 46px;
    padding: 0;
  }

  #model-preview .aircraft-name {
    bottom: 12px;
    padding: 6px 16px;
    font-size: 18px;
  }
}

/* 横握手机等矮视口：页头压扁、提示收起，高度都让给展台 */
@media (orientation: landscape) and (max-height: 520px) {
  #model-preview {
    padding-top: max(8px, env(safe-area-inset-top));
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }

  #model-preview .mp-kicker,
  #model-preview .touch-hint {
    display: none;
  }

  #model-preview .mp-top {
    min-height: 44px;
  }

  #model-preview .preview-header {
    margin-top: 0;
    font-size: 20px;
  }

  #model-preview .back-btn,
  #model-preview .rotate-toggle {
    min-height: 44px;
  }

  #model-preview .preview-canvas-container {
    margin: 6px 0 0;
  }

  /* 翻页控件挪进页头那一行（自动旋转按钮左侧），底栏的高度让给展台 */
  #model-preview .preview-controls {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    right: calc(max(18px, env(safe-area-inset-right)) + 58px);
  }

  #model-preview .nav-controls {
    gap: 8px;
  }

  #model-preview .nav-btn {
    width: 48px;
    height: 44px;
    min-height: 44px;
  }

  #model-preview .mp-readout {
    min-width: 92px;
  }

  #model-preview .rotate-label {
    display: none;
  }

  #model-preview .rotate-toggle {
    width: 46px;
    padding: 0;
  }

  #model-preview .aircraft-name {
    bottom: 8px;
    padding: 5px 18px;
    font-size: 17px;
  }
}

@media (prefers-reduced-motion: reduce) {
  #model-preview,
  #model-preview * {
    animation: none !important;
    transition: none !important;
  }
}
`;

/**
 * 机库（模型预览）：全屏展台，逐个查看玩家机、敌机、Boss 与导弹的战斗模型。
 * 渲染器只在显示期间存在——show() 创建、hide() 释放（上下文一并归还），
 * 所以它不会和标题画面的主机或对局的渲染器同时占着 WebGL 上下文。
 */
export class ModelPreview {
  private container: HTMLDivElement;
  private canvasContainer: HTMLDivElement;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer | null = null;
  private currentMesh: Group | null = null;
  private currentIndex: number = 0;
  private aircrafts: AircraftInfo[] = [];
  private animationId: number = 0;
  private lastFrameTime: number = 0;
  private autoRotate: boolean = true;
  private shown: boolean = false;
  private nameDisplay: HTMLDivElement;
  private onBack?: () => void;
  private meshLoadSequence: number = 0;
  private aircraftMeshFactoryPromise: Promise<AircraftMeshFactoryModule> | null = null;
  private readonly unsubscribeLocale: () => void;

  private dragging: boolean = false;
  private previousMouseX: number = 0;
  private readonly resizeHandler = (): void => this.resizeRenderer();
  private readonly handleKeydown = (event: KeyboardEvent): void => this.onKeydown(event);
  private readonly handleDragMove = (event: MouseEvent): void => {
    if (this.dragging && this.currentMesh) {
      this.currentMesh.rotation.y += (event.clientX - this.previousMouseX) * 0.01;
      this.previousMouseX = event.clientX;
    }
  };
  private readonly handleDragEnd = (): void => this.stopDragging();

  constructor() {
    this.container = this.createContainer();
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
    this.canvasContainer = this.container.querySelector<HTMLDivElement>(
      '#canvas-container'
    ) as HTMLDivElement;
    this.applyStaticText();

    this.nameDisplay = this.createNameDisplay();
    this.canvasContainer.appendChild(this.nameDisplay);

    // 背景透明：展台的光晕与框线由 CSS 画在画布后面
    this.scene = new Scene();

    this.camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 0, 0);

    this.setupLighting();
    this.setupAircrafts();
    this.setupControls();

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
    const setLabel = (id: string, label: string): void => {
      this.container.querySelector(`#${id}`)?.setAttribute('aria-label', label);
    };
    this.container.setAttribute('aria-label', tr({ en: 'Hangar', zh: '机库' }));
    setText('preview-kicker', tr({ en: 'Model preview', zh: '模型预览' }));
    setText('preview-header', tr({ en: 'Hangar', zh: '机库' }));
    setText('rotate-label', this.getRotateLabel());
    setText(
      'preview-touch-hint',
      GameConfig.isMobile
        ? tr({ en: 'Swipe to switch models', zh: '左右滑动切换模型' })
        : tr({
            en: 'Drag to rotate · Left / Right to switch · Esc to go back',
            zh: '拖拽旋转 · 左右方向键切换 · Esc 返回',
          })
    );
    setText('back-label', tr({ en: 'Main Menu', zh: '主菜单' }));
    setLabel('back-btn', tr({ en: 'Back to main menu', zh: '返回主菜单' }));
    setLabel('prev-btn', tr({ en: 'Previous model', zh: '上一个模型' }));
    setLabel('next-btn', tr({ en: 'Next model', zh: '下一个模型' }));
    this.renderCategory();
  }

  private getRotateLabel(): string {
    return this.autoRotate
      ? tr({ en: 'Auto-rotate: On', zh: '自动旋转：开' })
      : tr({ en: 'Auto-rotate: Off', zh: '自动旋转：关' });
  }

  /** 当前模型的类别（玩家 / 敌机 / Boss / 弹药） */
  private renderCategory(): void {
    const tag = this.container.querySelector<HTMLElement>('#aircraft-type');
    const current = this.aircrafts[this.currentIndex];
    if (tag && current) {
      tag.dataset.type = current.type;
      tag.textContent = tr(CATEGORY_LABELS[current.type]);
    }
  }

  /** 语言切换：重写静态文字，并按新语言重建机型列表（名称在建表时取值） */
  private handleLocaleChange(): void {
    this.aircrafts = [];
    this.setupAircrafts();
    this.applyStaticText();
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
    container.tabIndex = -1;
    container.setAttribute('role', 'region');
    // 图标是代码里的常量 SVG；所有文字由 applyStaticText 用 textContent 写入
    container.innerHTML = `
      <style>${PREVIEW_CSS}</style>
      <header class="mp-top">
        <button type="button" class="back-btn" id="back-btn">
          <span class="mi" aria-hidden="true">${MENU_ICONS.chevronLeft}</span>
          <span id="back-label"></span>
        </button>
        <div class="mp-heading">
          <div class="mp-kicker" id="preview-kicker"></div>
          <h2 class="preview-header" id="preview-header"></h2>
        </div>
        <button type="button" class="rotate-toggle" id="rotate-toggle" aria-pressed="true">
          <span class="mi" aria-hidden="true">${MENU_ICONS.rotate}</span>
          <span class="rotate-label" id="rotate-label"></span>
        </button>
      </header>
      <div class="preview-body">
        <div class="preview-canvas-container" id="canvas-container"></div>
        <div class="preview-controls">
          <div class="nav-controls">
            <button type="button" class="nav-btn" id="prev-btn">
              <span class="mi" aria-hidden="true">${MENU_ICONS.chevronLeft}</span>
            </button>
            <div class="mp-readout">
              <div class="mp-type" id="aircraft-type"></div>
              <div class="page-indicator" id="page-indicator">1 / 9</div>
            </div>
            <button type="button" class="nav-btn" id="next-btn">
              <span class="mi" aria-hidden="true">${MENU_ICONS.chevronRight}</span>
            </button>
          </div>
          <div class="touch-hint" id="preview-touch-hint"></div>
        </div>
      </div>
    `;

    return container;
  }

  private createNameDisplay(): HTMLDivElement {
    const display = document.createElement('div');
    display.className = 'aircraft-name';
    display.id = 'aircraft-name';
    display.setAttribute('aria-live', 'polite');
    return display;
  }

  private setupLighting(): void {
    // 强度按物理光照单位取值（漫反射 = 反照率 × 照度 / π）：原先的 0.78 / 1 / 0.5 下模型发灰发暗。
    // 偏高的环境光让深色船体（八爪鱼战舰、空中航母）在深色背景上仍可读
    const ambientLight = new AmbientLight(0xffffff, 1.25);
    this.scene.add(ambientLight);

    // 主光：右前上方，略偏暖
    const directionalLight = new DirectionalLight(0xfff2e0, 2.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // 轮廓光：左后方的冷色，把机体从深色背景里勾出来
    const backLight = new DirectionalLight(0x7fb4ff, 1.5);
    backLight.position.set(-5, 5, -5);
    this.scene.add(backLight);

    // 低位补光：机腹与挂架不至于全黑
    const fillLight = new DirectionalLight(0x9fdcff, 0.5);
    fillLight.position.set(-6, -3, 6);
    this.scene.add(fillLight);
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

  /**
   * 载入成功（或还在路上）的那一次留着共用；失败的那一次不留，下次翻到这一页会再 import() 一遍
   * （与 StartMenu 载入机库模块的做法一致）。
   * 注意浏览器自己的模块表也可能记住下载失败（Chrome 如此），那种情况要刷新页面才会重新下载
   */
  private loadAircraftMeshFactory(): Promise<AircraftMeshFactoryModule> {
    if (!this.aircraftMeshFactoryPromise) {
      const modulePromise = import('@/features/aircraft/AircraftMeshFactory');
      this.aircraftMeshFactoryPromise = modulePromise;
      modulePromise.catch(() => {
        if (this.aircraftMeshFactoryPromise === modulePromise) {
          this.aircraftMeshFactoryPromise = null;
        }
      });
    }

    return this.aircraftMeshFactoryPromise;
  }

  private setupControls(): void {
    const byId = (id: string): HTMLElement | null => this.container.querySelector(`#${id}`);
    const rotateToggle = byId('rotate-toggle');
    const canvasContainer = this.canvasContainer;

    byId('prev-btn')?.addEventListener('click', () => this.showPrevious());
    byId('next-btn')?.addEventListener('click', () => this.showNext());
    byId('back-btn')?.addEventListener('click', () => this.hide());
    rotateToggle?.addEventListener('click', () => {
      this.autoRotate = !this.autoRotate;
      rotateToggle.setAttribute('aria-pressed', this.autoRotate ? 'true' : 'false');
      const label = byId('rotate-label');
      if (label) {
        label.textContent = this.getRotateLabel();
      }
    });

    let touchStartX = 0;
    canvasContainer.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.touches[0].clientX;
      },
      { passive: true }
    );

    canvasContainer.addEventListener(
      'touchend',
      (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            this.showNext();
          } else {
            this.showPrevious();
          }
        }
      },
      { passive: true }
    );

    // 鼠标拖拽旋转：按下时才在 document 上监听移动 / 松开，松开即摘掉
    canvasContainer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) {
        return;
      }
      this.dragging = true;
      this.previousMouseX = e.clientX;
      document.addEventListener('mousemove', this.handleDragMove);
      document.addEventListener('mouseup', this.handleDragEnd);
    });
  }

  private stopDragging(): void {
    this.dragging = false;
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
  }

  /** 机库打开时的按键：左右方向键切换模型，Esc 返回主菜单 */
  private onKeydown(event: KeyboardEvent): void {
    if (!this.shown || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showPrevious();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.showNext();
    }
  }

  /** 渲染器只在机库打开期间存在：像素比封顶（触屏 1.5），画布放进展台 */
  private ensureRenderer(): WebGLRenderer {
    if (this.renderer) {
      return this.renderer;
    }
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    const ratio = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
    renderer.setPixelRatio(Math.min(Math.max(ratio, 1), GameConfig.isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    this.canvasContainer.insertBefore(renderer.domElement, this.nameDisplay);
    this.renderer = renderer;
    return renderer;
  }

  private releaseRenderer(): void {
    if (this.renderer) {
      releaseRenderer(this.renderer);
      this.renderer = null;
    }
  }

  private resizeRenderer(): void {
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
    }
    this.frameCamera();
    this.renderer?.setSize(width, height);
  }

  /**
   * 包围球取景：模型已缩放到半径 PREVIEW_FIT_RADIUS 的包围球（绕中心自转也不出球），相机沿固定
   * 俯视方向后退到球的轮廓直径等于展台短边的 PREVIEW_FILL——各个模型、各种屏幕上大小一致。
   * 球心在名称标签上方取景区（横向为整个画布宽）的中心：投影中心用 setViewOffset 平移过去
   * （镜头平移，透视方向不变）；取景区放不下这个直径时（标签折行 / 很矮的视口）缩到放得下并留边，
   * 模型因此总是完整显示在标签上方。展台光环跟着球的大小与位置走。
   * 画布尚未布局（隐藏 / 无布局的测试环境）时按整个画布取景。
   */
  private frameCamera(): void {
    const width = this.canvasContainer.clientWidth;
    const height = this.canvasContainer.clientHeight;
    const tanHalfVertical = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const ring = this.canvasContainer.style;
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
      // 球的轮廓直径（像素）：展台短边的固定比例，但不超出取景区（留边）
      const diameter = Math.min(
        PREVIEW_FILL * Math.min(width, height),
        Math.min(regionHeight, width) / PREVIEW_FRAME_MARGIN
      );
      // 视场角覆盖全画幅高度：球的半径（像素）按全画幅换算成视角正切
      fitTan = (diameter / fullHeight) * tanHalfVertical;
      ring.setProperty(
        '--mp-ring-width',
        `${Math.round(Math.min(diameter * PREVIEW_RING_SCALE, width - 2 * pad))}px`
      );
      ring.setProperty('--mp-ring-top', `${Math.round(centerY + diameter * PREVIEW_RING_DROP)}px`);
    } else {
      this.camera.clearViewOffset();
      const aspect =
        Number.isFinite(this.camera.aspect) && this.camera.aspect > 0 ? this.camera.aspect : 1;
      fitTan = PREVIEW_FILL * Math.min(1, aspect) * tanHalfVertical;
      ring.removeProperty('--mp-ring-width');
      ring.removeProperty('--mp-ring-top');
    }
    const distance = PREVIEW_FIT_RADIUS / Math.sin(Math.atan(fitTan));
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
    const indicator = this.container.querySelector('#page-indicator');
    if (indicator) {
      indicator.textContent = `${index + 1} / ${this.aircrafts.length}`;
    }
    this.renderCategory();

    let mesh: Group;
    try {
      mesh = await aircraft.createMesh();
    } catch (error) {
      // 模型的代码块没下载下来 / 工厂抛错：这一页写明加载失败，其余模型与返回照常可用
      if (loadSequence === this.meshLoadSequence && this.shown) {
        console.error(`Failed to load hangar model "${aircraft.name}"`, error);
        this.nameDisplay.textContent = tr(LOAD_FAILED_LABEL, { name: aircraft.name });
      }
      return;
    }
    if (loadSequence !== this.meshLoadSequence || !this.shown) {
      disposeModelTree(mesh);
      return;
    }

    // 按包围盒摆放的信号灯小球在这个距离上是悬在机体外的大圆点：机库里不显示（也不参与取景）
    hideSignalLights(mesh);

    // 包围球取景：球心取可见几何体包围盒的中心，半径取离它最远的顶点，把模型统一缩放到
    // 固定半径并移到原点。缩放 / 平移放在中间的取景组上，不改动工厂组自带的变换
    // （如八爪鱼战舰 scale=5）；外层包装组负责旋转（渲染循环旋转 currentMesh），模型绕几何中心转动
    const bounds = computeVisibleBounds(mesh, new Box3());
    const fit = new Group();
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new Vector3());
      const radius = computeVisibleRadius(mesh, center);
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
    disposeModelTree(this.currentMesh);
    this.currentMesh = null;
  }

  private showNext(): void {
    const nextIndex = (this.currentIndex + 1) % this.aircrafts.length;
    void this.showAircraft(nextIndex);
  }

  private showPrevious(): void {
    const prevIndex = (this.currentIndex - 1 + this.aircrafts.length) % this.aircrafts.length;
    void this.showAircraft(prevIndex);
  }

  private animate = (time: number = performance.now()): void => {
    if (!this.shown || !this.renderer) {
      return;
    }
    this.animationId = requestAnimationFrame(this.animate);

    // 按真实时间旋转（高刷新率屏幕上不会转得更快）；切回标签页后的大间隔封顶
    const dt = Math.min(Math.max((time - this.lastFrameTime) / 1000, 0), 0.1);
    this.lastFrameTime = time;
    if (this.currentMesh && this.autoRotate && !this.dragging) {
      this.currentMesh.rotation.y += AUTO_ROTATE_SPEED * dt;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setOnBack(callback: () => void): void {
    this.onBack = callback;
  }

  public show(): void {
    this.shown = true;
    this.container.style.display = 'flex';
    try {
      this.ensureRenderer();
    } catch (error) {
      // 浏览器不给 WebGL 上下文：不留下一个没有模型、按键也没接上的空机库——
      // 收起并通知调用方返回（onBack），错误照常抛出
      this.hide();
      throw error;
    }
    document.addEventListener('keydown', this.handleKeydown);
    void this.showAircraft(0);
    cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame((time) => {
      if (!this.shown) {
        return;
      }
      this.resizeRenderer();
      this.lastFrameTime = time;
      this.animate(time);
    });
    this.container.focus({ preventScroll: true });
  }

  public hide(): void {
    this.shown = false;
    this.container.style.display = 'none';
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    document.removeEventListener('keydown', this.handleKeydown);
    this.stopDragging();
    this.disposeCurrentMesh();
    // 归还 WebGL 上下文：回到标题画面后主机要用
    this.releaseRenderer();
    this.onBack?.();
  }

  public dispose(): void {
    this.shown = false;
    this.meshLoadSequence++;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    this.unsubscribeLocale();
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('keydown', this.handleKeydown);
    this.stopDragging();
    this.disposeCurrentMesh();
    this.releaseRenderer();
    this.container.remove();
  }
}
