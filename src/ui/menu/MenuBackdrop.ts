import { copyCanvas, paintCirrus, paintCloudBand, type CloudBandStyle } from './cloudPainter';
import { el } from './dom';

/**
 * 标题画面的基础背景层（纯 CSS + 2D 画布，不依赖 WebGL）：黄昏天空渐变、星点、落日光晕、
 * 四层视差云带、偶尔掠过镜头的云絮、航电风格的角标与航向带。
 * 实时 3D 主机（MenuHero）叠在 heroSlot 里；它加载失败时这一层单独也是完整的画面。
 *
 * 动画全部是 CSS 的 transform / opacity 动画；容器 display:none 时浏览器自动停掉。
 * 这里唯一的脚本动画是鼠标视差（只改两个 CSS 变量，按帧节流）。
 */

const TILE_WIDTH = 1024;

interface BandSpec {
  name: 'cirrus' | 'far' | 'mid' | 'near';
  height: number;
  style: CloudBandStyle | null;
}

const BANDS: readonly BandSpec[] = [
  { name: 'cirrus', height: 160, style: null },
  {
    name: 'far',
    height: 176,
    style: {
      seed: 11,
      puffs: 46,
      top: 0.34,
      radius: [0.1, 0.24],
      filled: true,
      lit: '#ffdcae',
      body: '#93a3bd',
      shade: '#4d6182',
    },
  },
  {
    name: 'mid',
    height: 288,
    style: {
      seed: 29,
      puffs: 44,
      top: 0.2,
      radius: [0.14, 0.34],
      filled: true,
      lit: '#f2c79c',
      body: '#51688a',
      shade: '#1c2c47',
    },
  },
  {
    name: 'near',
    height: 288,
    style: {
      seed: 53,
      puffs: 30,
      top: 0.24,
      radius: [0.22, 0.46],
      filled: true,
      lit: '#7f96b6',
      body: '#22334d',
      shade: '#070e1b',
    },
  },
];

/** 用 box-shadow 画一批星点（单位 vw / vh，随视口缩放）；固定种子，每次相同 */
function buildStarShadows(count: number, seed: number): string {
  let state = seed;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (random() * 100).toFixed(2);
    // 越靠近天顶越密，接近地平线就没有了
    const y = (Math.pow(random(), 1.7) * 46).toFixed(2);
    const size = random() < 0.16 ? 1 : 0;
    const alpha = (0.35 + random() * 0.6).toFixed(2);
    shadows.push(`${x}vw ${y}vh 0 ${size}px rgba(226, 244, 255, ${alpha})`);
  }
  return shadows.join(', ');
}

export class MenuBackdrop {
  public readonly root: HTMLDivElement;
  /** 实时 3D 主机的画布挂在这里（位于中景云与近景云之间） */
  public readonly heroSlot: HTMLDivElement;

  private readonly canvases: HTMLCanvasElement[] = [];
  private pointerFrame = 0;
  private pointerX = 0;
  private pointerY = 0;
  private parallaxTarget: HTMLElement | null = null;
  private pointerListener: ((event: PointerEvent) => void) | null = null;

  constructor() {
    this.root = el('div', 'tm-backdrop');
    this.root.setAttribute('aria-hidden', 'true');

    const scene = el('div', 'tm-scene');
    scene.append(el('div', 'tm-sky'));

    const starsA = el('div', 'tm-stars tm-stars-a');
    starsA.style.boxShadow = buildStarShadows(46, 7);
    const starsB = el('div', 'tm-stars tm-stars-b');
    starsB.style.boxShadow = buildStarShadows(34, 91);
    scene.append(starsA, starsB, el('div', 'tm-sun'), el('div', 'tm-flare'));

    this.heroSlot = el('div', 'tm-hero-slot');
    for (const band of BANDS) {
      if (band.name === 'near') {
        scene.append(this.heroSlot);
      }
      scene.append(this.createBand(band));
      if (band.name === 'far') {
        scene.append(el('div', 'tm-haze'));
      }
    }
    scene.append(el('div', 'tm-gust tm-gust-a'), el('div', 'tm-gust tm-gust-b'));

    this.root.append(scene, el('div', 'tm-shade'), el('div', 'tm-scan'), this.createHud());
  }

  /** 一条云带 = 两份相同的贴图首尾相接，CSS 动画平移半个自身宽度后无缝循环 */
  private createBand(spec: BandSpec): HTMLDivElement {
    const band = el('div', `tm-band tm-band-${spec.name}`);
    const track = el('div', 'tm-band-track');
    const first = document.createElement('canvas');
    first.width = TILE_WIDTH;
    first.height = spec.height;
    const painted = spec.style
      ? paintCloudBand(first, spec.style)
      : paintCirrus(first, 5, '#ffe9d2');
    if (painted) {
      const second = document.createElement('canvas');
      second.width = TILE_WIDTH;
      second.height = spec.height;
      copyCanvas(first, second);
      track.append(first, second);
      this.canvases.push(first, second);
      band.classList.add('is-painted');
    }
    band.append(track);
    return band;
  }

  /** 航电点缀：四个角标 + 顶部缓慢滚动的航向带（纯装饰） */
  private createHud(): HTMLDivElement {
    const hud = el('div', 'tm-hud');
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      hud.append(el('span', `tm-corner tm-corner-${corner}`));
    }

    const tape = el('div', 'tm-tape');
    const track = el('div', 'tm-tape-track');
    for (let copy = 0; copy < 2; copy++) {
      for (let heading = 0; heading < 360; heading += 10) {
        const tick = el('span', 'tm-tape-tick', String(heading).padStart(3, '0'));
        if (heading % 30 === 0) {
          tick.classList.add('is-major');
        }
        track.append(tick);
      }
    }
    tape.append(track, el('span', 'tm-tape-caret'));
    hud.append(tape);
    return hud;
  }

  /**
   * 鼠标视差：指针位置写成 --tm-px / --tm-py（-1..1），各层按深度取不同的位移。
   * 只在能悬停的精确指针上启用（触屏没有“悬停”位置）；减少动态效果时不启用。
   * onChange 把同一个位置转给 3D 主机的镜头。
   */
  public enableParallax(target: HTMLElement, onChange?: (x: number, y: number) => void): void {
    if (this.pointerListener || typeof window.matchMedia !== 'function') {
      return;
    }
    let fine = false;
    try {
      fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
      fine = false;
    }
    if (!fine) {
      return;
    }
    this.parallaxTarget = target;
    this.pointerListener = (event: PointerEvent): void => {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      this.pointerX = Math.max(-1, Math.min(1, (event.clientX / width) * 2 - 1));
      this.pointerY = Math.max(-1, Math.min(1, (event.clientY / height) * 2 - 1));
      if (!this.pointerFrame) {
        this.pointerFrame = requestAnimationFrame(() => {
          this.pointerFrame = 0;
          this.root.style.setProperty('--tm-px', this.pointerX.toFixed(3));
          this.root.style.setProperty('--tm-py', this.pointerY.toFixed(3));
          onChange?.(this.pointerX, this.pointerY);
        });
      }
    };
    target.addEventListener('pointermove', this.pointerListener, { passive: true });
  }

  public disableParallax(): void {
    if (this.pointerListener && this.parallaxTarget) {
      this.parallaxTarget.removeEventListener('pointermove', this.pointerListener);
    }
    this.pointerListener = null;
    this.parallaxTarget = null;
    if (this.pointerFrame) {
      cancelAnimationFrame(this.pointerFrame);
      this.pointerFrame = 0;
    }
  }

  public dispose(): void {
    this.disableParallax();
    // 画布尺寸清零：立即交还位图内存
    for (const canvas of this.canvases) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.canvases.length = 0;
    this.root.remove();
  }
}
