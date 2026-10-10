import {
  CHEVRON_MAX_HEIGHT_PX,
  CHEVRON_MAX_WIDTH_PX,
  type ChevronFootprint,
} from '@/ui/OffscreenChevron';

/**
 * 屏幕外箭头的避让区：敌方目标箭头（EnemyHealthBars）与 Boss 导弹箭头（BossMissileIndicator）
 * 各持有一个实例，用同一套规则。
 *
 * 这些元素都叠在两个箭头层之上，落在它们下面的箭头会被整个挡住：
 * - 雷达盘（#radar-minimap）；
 * - 触控布局下的摇杆（#joystick）和每个可见的按键（.touch-btn）；
 * - HUD 面板：得分 / 速度 / 强化 / 右上状态 / 生命条，以及顶部消息栈（#hud-top-stack）里
 *   正在显示的每一块（Boss 阶段条、简报、事件目标……）。
 *
 * 约每秒量一次这些元素的位置（不逐帧读布局）；触摸按下 / 抬起时浮动摇杆会移位，另外补量一次。
 * 箭头连同距离标签碰到任何一块避让区（外扩 8px）时，朝屏幕中心移出去：沿屏幕边滑到空位，
 * 或向内越过遮挡，取位移较小的一个；指向不变，整枚箭头留在屏幕内。
 * 移出一块又碰到下一块时接着移（两块之间的窄缝放不下箭头），取走得通的路里位移最小的。
 * 雷达盘单独成块时只横向滑到盘朝屏幕中心的一侧，高度不变。
 * 桌面没有触控控件（#mobile-controls 不显示），避让区只有雷达盘和 HUD 面板。
 */
const RADAR_ELEMENT_ID = 'radar-minimap';
const TOUCH_CONTROLS_ID = 'mobile-controls';
const TOUCH_STICK_ID = 'joystick';
const TOUCH_BUTTON_SELECTOR = '.touch-btn';
const HUD_PANEL_IDS = ['hud-score', 'hud-speed', 'hud-upgrades', 'hud-status', 'hud-health'];
const HUD_TOP_STACK_ID = 'hud-top-stack';
const AVOID_MARGIN_PX = 8;
const AVOID_RECT_REFRESH_UPDATES = 30;
/** 摇杆松手后缓动回原位（index.html：0.18 秒）：等这么多次刷新再量 */
const AVOID_SETTLE_UPDATES = 15;
/**
 * 雷达盘 + 摇杆 + 8 个按键 + 5 块 HUD 面板 + 顶部消息栈里的几块，留一点余量；
 * 每块 4 个数（left, top, right, bottom）
 */
const AVOID_MAX_RECTS = 24;
const AVOID_MAX_PASSES = 3;
/** 换出口的滞回：另一个出口近出这么多才换，目标方位在两个出口的分界附近时箭头不来回跳 */
const AVOID_SWITCH_BIAS_PX = 24;
const AVOID_EPSILON_PX = 0.01;
/** 整枚箭头离视口边的最小距离 */
const ARROW_VIEWPORT_INSET_PX = 4;

/** 箭头中心离屏幕边的比例（贴边位置） */
export const CHEVRON_EDGE_PADDING = 0.08;

/** 避让时选中的出口（调用方记在每个箭头上，用于滞回） */
export const CHEVRON_EXIT_NONE = 0;
const EXIT_HORIZONTAL = 1;
const EXIT_VERTICAL = 2;
export type ChevronAvoidExit =
  | typeof CHEVRON_EXIT_NONE
  | typeof EXIT_HORIZONTAL
  | typeof EXIT_VERTICAL;

/** 避让区的来源（决定它怎么与别的块合并、怎么出） */
const KIND_RADAR = 0;
const KIND_STICK = 1;
const KIND_BUTTON = 2;
const KIND_PANEL = 3;
type AvoidKind = typeof KIND_RADAR | typeof KIND_STICK | typeof KIND_BUTTON | typeof KIND_PANEL;

const TOUCH_LAYOUT_EVENTS = ['touchstart', 'touchend', 'touchcancel'] as const;

export class ChevronAvoidance {
  /** 待摆放箭头的占位（箭头加距离标签）：调用 resolve 前由调用方用 measureChevronFootprint 填好 */
  public readonly footprint: ChevronFootprint = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  /** resolve 的结果：移出避让区后的箭头中心（px）与走的出口 */
  public x: number = 0;
  public y: number = 0;
  public exit: ChevronAvoidExit = CHEVRON_EXIT_NONE;

  // 避让区（left, top, right, bottom，已外扩留白；相距太近的已并成一块）
  private readonly rects = new Float32Array(AVOID_MAX_RECTS * 4);
  // 每块避让区是否优先横向出（1 = 雷达盘单独成块；与别的遮挡并成一块后为 0）
  private readonly sideways = new Uint8Array(AVOID_MAX_RECTS);
  // 每块避让区是否含 HUD 面板（1 = 是）：这类块不并进单独成块的雷达盘
  private readonly panel = new Uint8Array(AVOID_MAX_RECTS);
  // 每块避让区是否只由触控按键组成（1 = 是）：按键与按键总是并成一簇
  private readonly button = new Uint8Array(AVOID_MAX_RECTS);
  private count: number = 0;
  private age: number = AVOID_RECT_REFRESH_UPDATES;
  // resolve 用：箭头中心的活动范围，以及已找到的最近空位的位移
  private minX: number = 0;
  private maxX: number = 0;
  private minY: number = 0;
  private maxY: number = 0;
  private bestCost: number = 0;
  private attached: boolean = false;

  /** 开始监听触摸与窗口变化（只用来提前重量避让区）；重复调用无效果 */
  public attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    // 捕获阶段：摇杆区自己的监听会拦住冒泡，这里只记一个“该重量了”，不碰事件
    for (const type of TOUCH_LAYOUT_EVENTS) {
      window.addEventListener(type, this.onTouchLayoutChange, { capture: true, passive: true });
    }
    window.addEventListener('resize', this.invalidate);
  }

  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.attached = false;
    for (const type of TOUCH_LAYOUT_EVENTS) {
      window.removeEventListener(type, this.onTouchLayoutChange, { capture: true });
    }
    window.removeEventListener('resize', this.invalidate);
  }

  /** 下一次 refresh 立即重量（窗口变化；或隔了一段时间没有调用 refresh 之后） */
  public readonly invalidate = (): void => {
    this.age = AVOID_RECT_REFRESH_UPDATES;
  };

  /**
   * 浮动摇杆按下时移到落点、抬起后缓动回原位：按下后的下一次刷新就重量避让区，
   * 抬起则等它回到位再量。
   */
  private readonly onTouchLayoutChange = (event: Event): void => {
    const wanted =
      event.type === 'touchstart'
        ? AVOID_RECT_REFRESH_UPDATES
        : AVOID_RECT_REFRESH_UPDATES - AVOID_SETTLE_UPDATES;
    this.age = Math.max(this.age, wanted);
  };

  /**
   * 每次更新箭头前调用一次。避让区只在布局变化时才变：约每秒量一次（触摸按下 / 抬起、
   * 窗口变化时提前），不逐帧读取布局。触控控件整组不显示（桌面）时不量摇杆和按键。
   */
  public refresh(): void {
    this.age += 1;
    if (this.age < AVOID_RECT_REFRESH_UPDATES) {
      return;
    }
    this.age = 0;
    this.count = 0;
    this.addRect(document.getElementById(RADAR_ELEMENT_ID), KIND_RADAR);

    const controls = document.getElementById(TOUCH_CONTROLS_ID);
    const controlsRect = controls?.getBoundingClientRect();
    if (controls && controlsRect && controlsRect.width > 0 && controlsRect.height > 0) {
      this.addRect(document.getElementById(TOUCH_STICK_ID), KIND_STICK);
      const buttons = controls.querySelectorAll(TOUCH_BUTTON_SELECTOR);
      for (let index = 0; index < buttons.length; index++) {
        this.addRect(buttons[index], KIND_BUTTON);
      }
    }

    for (let index = 0; index < HUD_PANEL_IDS.length; index++) {
      this.addRect(document.getElementById(HUD_PANEL_IDS[index]), KIND_PANEL);
    }
    // 消息栈本身横跨一整行，只量里面正在显示的每一块
    const stackItems = document.getElementById(HUD_TOP_STACK_ID)?.children;
    if (stackItems) {
      for (let index = 0; index < stackItems.length; index++) {
        this.addRect(stackItems[index], KIND_PANEL);
      }
    }
    this.mergeRects();
  }

  /**
   * 把箭头中心 (x, y)（px）移到不碰任何避让区的位置，结果写入 x / y / exit。
   * 占位取 footprint。每块避让区有两个朝屏幕中心的出口：
   * 横向（遮挡在左半屏就往右出，否则往左）与纵向（在上半屏就往下出，否则往上），
   * 取位移较小、且不越出活动范围的一个；previousExit 是这枚箭头上一次走的出口，另一个出口
   * 要近出一截才换。出口那边还有别的块时接着往外走（最多连走 AVOID_MAX_PASSES 步），
   * 在走得通的路里取总位移最小的；exit 记的是第一步走的出口。
   * 哪条路都走不通（遮挡几乎占满屏幕）时留在原位。
   */
  public resolve(x: number, y: number, previousExit: ChevronAvoidExit): void {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const footprint = this.footprint;
    this.x = x;
    this.y = y;
    this.exit = CHEVRON_EXIT_NONE;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !(viewportWidth > 0) ||
      !(viewportHeight > 0)
    ) {
      return;
    }

    // 箭头中心的活动范围：不比贴边位置更靠外，且整枚箭头（含标签）留在视口内
    this.minX = Math.max(
      viewportWidth * CHEVRON_EDGE_PADDING,
      ARROW_VIEWPORT_INSET_PX - footprint.minX
    );
    this.maxX = Math.min(
      viewportWidth * (1 - CHEVRON_EDGE_PADDING),
      viewportWidth - ARROW_VIEWPORT_INSET_PX - footprint.maxX
    );
    this.minY = Math.max(
      viewportHeight * CHEVRON_EDGE_PADDING,
      ARROW_VIEWPORT_INSET_PX - footprint.minY
    );
    this.maxY = Math.min(
      viewportHeight * (1 - CHEVRON_EDGE_PADDING),
      viewportHeight - ARROW_VIEWPORT_INSET_PX - footprint.maxY
    );
    if (this.minX <= this.maxX) {
      x = Math.max(this.minX, Math.min(this.maxX, x));
    }
    if (this.minY <= this.maxY) {
      y = Math.max(this.minY, Math.min(this.maxY, y));
    }

    this.x = x;
    this.y = y;
    this.bestCost = Number.POSITIVE_INFINITY;
    this.search(x, y, 0, CHEVRON_EXIT_NONE, previousExit, AVOID_MAX_PASSES);
  }

  /**
   * 从 (x, y) 起找不碰任何避让区的位置：碰到一块就分别试它的两个出口，再从出口接着找，
   * 最多连走 passes 步；每找到一个比已知更近的空位就写入 x / y / exit。
   * cost 是这条路已经走过的位移（第一步沿用上一次的出口时减去滞回量，位移相同时横向优先），
   * firstExit 是这条路第一步走的出口。
   */
  private search(
    x: number,
    y: number,
    cost: number,
    firstExit: ChevronAvoidExit,
    previousExit: ChevronAvoidExit,
    passes: number
  ): void {
    if (cost >= this.bestCost) {
      return;
    }
    const rects = this.rects;
    const footprint = this.footprint;
    let hit = -1;
    for (let index = 0; index < this.count; index++) {
      const offset = index * 4;
      if (
        x + footprint.maxX > rects[offset] + AVOID_EPSILON_PX &&
        x + footprint.minX < rects[offset + 2] - AVOID_EPSILON_PX &&
        y + footprint.maxY > rects[offset + 1] + AVOID_EPSILON_PX &&
        y + footprint.minY < rects[offset + 3] - AVOID_EPSILON_PX
      ) {
        hit = offset;
        break;
      }
    }
    if (hit < 0) {
      this.bestCost = cost;
      this.x = x;
      this.y = y;
      this.exit = firstExit;
      return;
    }
    if (passes <= 0) {
      return;
    }
    const left = rects[hit];
    const top = rects[hit + 1];
    const right = rects[hit + 2];
    const bottom = rects[hit + 3];
    const exitX = left + right < window.innerWidth ? right - footprint.minX : left - footprint.maxX;
    const exitY =
      top + bottom < window.innerHeight ? bottom - footprint.minY : top - footprint.maxY;
    const canExitX = exitX >= this.minX && exitX <= this.maxX;
    const canExitY = exitY >= this.minY && exitY <= this.maxY;
    const first = firstExit === CHEVRON_EXIT_NONE;
    if (canExitX) {
      // 滞回：沿用上一次的出口，除非另一个出口近出一截
      const bias = first && previousExit === EXIT_HORIZONTAL ? AVOID_SWITCH_BIAS_PX : 0;
      this.search(
        exitX,
        y,
        cost + Math.abs(exitX - x) - bias,
        first ? EXIT_HORIZONTAL : firstExit,
        previousExit,
        passes - 1
      );
    }
    // 雷达盘单独成块：能横向出就不纵向出
    if (canExitY && !(canExitX && this.sideways[hit >> 2] === 1)) {
      const bias = first && previousExit === EXIT_VERTICAL ? AVOID_SWITCH_BIAS_PX : 0;
      this.search(
        x,
        exitY,
        cost + Math.abs(exitY - y) - bias,
        first ? EXIT_VERTICAL : firstExit,
        previousExit,
        passes - 1
      );
    }
  }

  /**
   * 量一个元素并记为避让区（外扩留白，再向外取到整像素：箭头按整像素落位，留白不被小数吃掉）；
   * 不存在、不显示（空矩形）或坐标非有限的跳过。kind：雷达盘（单独成块时优先横向出）/ 摇杆 /
   * 触控按键 / HUD 面板。
   */
  private addRect(element: Element | null, kind: AvoidKind): void {
    if (!element || this.count >= AVOID_MAX_RECTS) {
      return;
    }
    const rect = element.getBoundingClientRect();
    if (
      !(rect.width > 0) ||
      !(rect.height > 0) ||
      !Number.isFinite(rect.left) ||
      !Number.isFinite(rect.top)
    ) {
      return;
    }
    const offset = this.count * 4;
    this.rects[offset] = Math.floor(rect.left - AVOID_MARGIN_PX);
    this.rects[offset + 1] = Math.floor(rect.top - AVOID_MARGIN_PX);
    this.rects[offset + 2] = Math.ceil(rect.right + AVOID_MARGIN_PX);
    this.rects[offset + 3] = Math.ceil(rect.bottom + AVOID_MARGIN_PX);
    this.sideways[this.count] = kind === KIND_RADAR ? 1 : 0;
    this.panel[this.count] = kind === KIND_PANEL ? 1 : 0;
    this.button[this.count] = kind === KIND_BUTTON ? 1 : 0;
    this.count += 1;
  }

  /**
   * 两块避让区之间的空隙放不下一枚箭头（含距离标签）就并成一块（取外接矩形）：
   * 按键与按键总是并成一整簇，箭头不会从一个按键下面被推到另一个按键下面。
   * 其余的块（摇杆、雷达盘、HUD 面板、已并好的按键簇）排成一列 / 一行时同样并成一块；
   * 但并成外接矩形会多盖住一块放得下箭头的空角时就不并，留给 resolve 逐块移出：
   * 左列面板 + 顶部居中的卡片会盖住整块屏幕中部，竖屏手机上摇杆 + 按键簇会盖住摇杆上方的空位。
   */
  private mergeRects(): void {
    // 先把按键并成簇，再并其余的：摇杆、雷达盘、HUD 面板比的是整个按键簇，不是其中某一个按键
    this.mergePass(true);
    this.mergePass(false);
  }

  /** buttonsOnly：这一遍只并按键与按键（不看空角）；否则按上面的规则并所有的块 */
  private mergePass(buttonsOnly: boolean): void {
    const rects = this.rects;
    const sideways = this.sideways;
    const panel = this.panel;
    const button = this.button;
    let count = this.count;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < count && !merged; i++) {
        const a = i * 4;
        for (let j = i + 1; j < count; j++) {
          const b = j * 4;
          if (
            rects[b] - rects[a + 2] >= CHEVRON_MAX_WIDTH_PX ||
            rects[a] - rects[b + 2] >= CHEVRON_MAX_WIDTH_PX ||
            rects[b + 1] - rects[a + 3] >= CHEVRON_MAX_HEIGHT_PX ||
            rects[a + 1] - rects[b + 3] >= CHEVRON_MAX_HEIGHT_PX
          ) {
            continue;
          }
          if (buttonsOnly) {
            if ((button[i] & button[j]) === 0) {
              continue;
            }
          } else if (
            // HUD 面板不并进单独成块的雷达盘（雷达盘照旧只横向出）
            ((panel[i] | panel[j]) === 1 && (sideways[i] | sideways[j]) === 1) ||
            // 任何两块都不并出多盖空角的外接矩形
            this.mergeCoversFreeCorner(a, b)
          ) {
            continue;
          }
          rects[a] = Math.min(rects[a], rects[b]);
          rects[a + 1] = Math.min(rects[a + 1], rects[b + 1]);
          rects[a + 2] = Math.max(rects[a + 2], rects[b + 2]);
          rects[a + 3] = Math.max(rects[a + 3], rects[b + 3]);
          // 并进了别的遮挡就不再只横向出，也不再是纯按键簇
          sideways[i] &= sideways[j];
          panel[i] |= panel[j];
          button[i] &= button[j];
          // 用最后一块填掉 j 的位置
          count -= 1;
          const last = count * 4;
          rects[b] = rects[last];
          rects[b + 1] = rects[last + 1];
          rects[b + 2] = rects[last + 2];
          rects[b + 3] = rects[last + 3];
          sideways[j] = sideways[count];
          panel[j] = panel[count];
          button[j] = button[count];
          merged = true;
          break;
        }
      }
    }
    this.count = count;
  }

  /**
   * 两块避让区（a、b 是它们在 rects 里的偏移）的外接矩形有没有一个空角放得下一枚箭头。
   * 外接矩形的每个角：贴着那条竖边的块和贴着那条横边的块不是同一块时，这个角是空的，
   * 空角的宽、高就是两块在这两条边上的差。
   */
  private mergeCoversFreeCorner(a: number, b: number): boolean {
    const rects = this.rects;
    const left = rects[a] - rects[b];
    const top = rects[a + 1] - rects[b + 1];
    const right = rects[a + 2] - rects[b + 2];
    const bottom = rects[a + 3] - rects[b + 3];
    const wide = (delta: number): boolean => Math.abs(delta) >= CHEVRON_MAX_WIDTH_PX;
    const tall = (delta: number): boolean => Math.abs(delta) >= CHEVRON_MAX_HEIGHT_PX;
    return (
      (left * top < 0 && wide(left) && tall(top)) ||
      (right * top > 0 && wide(right) && tall(top)) ||
      (left * bottom > 0 && wide(left) && tall(bottom)) ||
      (right * bottom < 0 && wide(right) && tall(bottom))
    );
  }
}
