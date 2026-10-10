import type { MenuHeroScene } from './MenuHeroScene';

type MenuHeroSceneModule = typeof import('./MenuHeroScene');

/**
 * 标题画面实时 3D 主机的控制器（不导入 three）：按需加载 MenuHeroScene，
 * 画好第一帧后淡入；菜单隐藏 / 进入机库 / 开始游戏时整个释放（WebGL 上下文归还），
 * 页面不可见时停掉渲染循环。加载或创建失败时什么也不显示，CSS 背景层照常工作。
 */

/** 菜单出现后多久再开始加载主机：让出入场动画那几百毫秒 */
const START_DELAY_MS = 380;
/** 着色器交给驱动后等多久再画首帧（支持并行编译的驱动此时多半已编好） */
const WARMUP_MS = 140;
/** 连续失败这么多次后本页面不再尝试（设备不支持 / 上下文被拒绝） */
const MAX_FAILURES = 2;

export interface MenuHeroOptions {
  reducedMotion: boolean;
  /** 触屏设备的像素比上限更低（iPad 级 GPU 也要稳定 60 帧） */
  touchDevice: boolean;
}

function hasWebGL(): boolean {
  return (
    typeof WebGLRenderingContext !== 'undefined' || typeof WebGL2RenderingContext !== 'undefined'
  );
}

export class MenuHero {
  private scene: MenuHeroScene | null = null;
  private modulePromise: Promise<MenuHeroSceneModule> | null = null;
  /** 每次 start / stop 递增：异步加载回来时发现代数变了就放弃 */
  private generation = 0;
  private wanted = false;
  private failures = 0;
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private readonly handleVisibility = (): void => this.syncRunning();
  private readonly handleResize = (): void => this.syncSize();

  constructor(
    private readonly host: HTMLElement,
    private readonly options: MenuHeroOptions
  ) {}

  /** 菜单显示 / 从机库返回：稍后加载并创建场景（已在运行则忽略） */
  public start(): void {
    if (this.disposed || this.wanted) {
      return;
    }
    this.wanted = true;
    if (!hasWebGL() || this.failures >= MAX_FAILURES) {
      return;
    }
    const generation = ++this.generation;
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      void this.load(generation);
    }, START_DELAY_MS);
  }

  /** 菜单隐藏 / 进入机库 / 开始游戏：立即释放场景与 WebGL 上下文 */
  public stop(): void {
    if (!this.wanted) {
      return;
    }
    this.wanted = false;
    this.generation++;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.teardown();
  }

  /** 进入战场的过场：加力冲出画面（场景还没加载好时没有可播的，直接略过） */
  public launch(): void {
    this.scene?.launch();
  }

  /** 指针位置（-1..1）：镜头轻微跟随，场景自己做平滑 */
  public setPointer(x: number, y: number): void {
    this.scene?.setPointer(x, y);
  }

  private async load(generation: number): Promise<void> {
    try {
      this.modulePromise ??= import('./MenuHeroScene');
      const module = await this.modulePromise;
      if (generation !== this.generation || !this.wanted || this.disposed) {
        return;
      }
      const scene = new module.MenuHeroScene({
        host: this.host,
        maxPixelRatio: this.options.touchDevice ? 1.5 : 2,
        reducedMotion: this.options.reducedMotion,
        onContextLost: () => this.handleContextLost(),
      });
      this.scene = scene;
      this.observeSize();
      this.warmupTimer = setTimeout(() => {
        this.warmupTimer = null;
        if (this.scene !== scene) {
          return;
        }
        this.syncSize();
        scene.renderStill();
        this.syncRunning();
        // 首帧已经在画布里：淡入
        this.host.classList.add('is-live');
      }, WARMUP_MS);
    } catch (error) {
      this.modulePromise = null;
      if (generation === this.generation) {
        this.failures++;
        this.teardown();
      }
      console.warn('[MenuHero] 3D hero unavailable, keeping the static backdrop', error);
    }
  }

  private handleContextLost(): void {
    this.failures++;
    this.teardown();
  }

  /** 页面可见且菜单需要它时才跑渲染循环 */
  private syncRunning(): void {
    const scene = this.scene;
    if (!scene) {
      return;
    }
    if (this.wanted && document.visibilityState !== 'hidden') {
      scene.start();
    } else {
      scene.stop();
    }
  }

  private observeSize(): void {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.host);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private syncSize(): void {
    this.scene?.resize(this.host.clientWidth, this.host.clientHeight);
  }

  private teardown(): void {
    if (this.startTimer !== null) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    if (this.warmupTimer !== null) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.handleResize);
    this.host.classList.remove('is-live');
    this.scene?.dispose();
    this.scene = null;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.stop();
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.teardown();
  }
}
