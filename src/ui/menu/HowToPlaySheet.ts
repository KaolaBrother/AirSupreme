import { tr, type LocalizedText } from '@/i18n';
import { HUD_COLORS } from '@/ui/theme/hudTokens';
import { el } from './dom';
import { MenuSheet, type SheetOpener } from './MenuSheet';

/**
 * 操作说明面板：键盘 / 触屏两页，默认显示与当前设备相符的那一页。
 * 内容与 InputHandler 的实际按键、index.html 的触控按键簇一致；改按键时两处一起改。
 */

export type HowToPlayView = 'keyboard' | 'touch';

interface KeyEntry {
  /** 按键（字符串原样显示，双语对象按语言取） */
  keys: ReadonlyArray<string | LocalizedText>;
  joiner?: string;
  action: LocalizedText;
  /** 这一条下面的补充说明 */
  note?: LocalizedText;
}

interface KeyGroup {
  title: LocalizedText;
  entries: readonly KeyEntry[];
}

const MISSILE_NOTE: LocalizedText = {
  en: 'The seeker is always on. Keep a target inside the ring; when the ring turns green you have a lock.',
  zh: '导引头一直在工作。把目标保持在锁定环内，环变绿就是锁定完成。',
};

/** 触屏机炮的辅助瞄准（GAME_CONSTANTS.GUN_ASSIST，只在触控设备上启用） */
const GUN_ASSIST_NOTE: LocalizedText = {
  en: 'Aim assist: when a target is close to your nose, the gun cross slides onto it and your shots follow.',
  zh: '辅助瞄准：目标靠近机头时，机炮十字会滑到目标上，子弹跟着十字走。',
};

const KEYBOARD_GROUPS: readonly KeyGroup[] = [
  {
    title: { en: 'Flight', zh: '飞行' },
    entries: [
      {
        keys: ['W', 'S'],
        action: {
          en: 'Pitch (nose up / down). ↑ / ↓ work too.',
          zh: '俯仰（机头上下），↑ / ↓ 也可以',
        },
      },
      { keys: ['A', 'D'], action: { en: 'Yaw (nose left / right)', zh: '偏航（机头左右）' } },
      { keys: ['Q', 'E'], action: { en: 'Roll (bank the wings)', zh: '翻滚（机翼倾斜）' } },
      {
        // 加速只认左侧的 Shift / Ctrl，右 Shift 是导弹：键帽写明左右（两种语言同一写法），
        // 说明里再用文字说一遍
        keys: ['L Shift', 'L Ctrl'],
        action: { en: 'Boost: hold left Shift or left Ctrl', zh: '加速：按住左 Shift 或左 Ctrl' },
      },
    ],
  },
  {
    title: { en: 'Weapons', zh: '武器' },
    entries: [
      {
        keys: [{ en: 'Space', zh: '空格' }],
        action: { en: 'Fire guns (hold to keep firing)', zh: '开火（按住连射）' },
      },
      {
        keys: ['M', 'R Shift'],
        action: {
          en: 'Missile: fire when the ring is green (M or right Shift)',
          zh: '导弹：环变绿后发射（M 或右 Shift）',
        },
        note: MISSILE_NOTE,
      },
      { keys: ['F'], action: { en: 'Special weapon (tap or hold)', zh: '特殊武器（点按或长按）' } },
      { keys: ['Tab', 'X'], action: { en: 'Cycle special weapon', zh: '切换特殊武器' } },
      {
        keys: ['1', '5'],
        joiner: ' – ',
        action: { en: 'Select special weapon', zh: '选择特殊武器' },
      },
      { keys: ['G'], action: { en: 'Drop flares', zh: '投放热焰弹' } },
    ],
  },
  {
    title: { en: 'View and system', zh: '视角与系统' },
    entries: [
      { keys: ['V'], action: { en: 'First / third-person view', zh: '切换第一 / 第三人称' } },
      {
        keys: ['N'],
        action: { en: 'Level map (or click the radar)', zh: '关卡地图（也可以点击雷达）' },
      },
      {
        keys: ['Esc', 'P'],
        action: {
          en: 'Pause menu: upgrades, settings and Save & Exit',
          zh: '暂停菜单：升级、设置、保存并退出',
        },
      },
      { keys: ['U'], action: { en: 'Upgrades (pauses the game)', zh: '升级（同时暂停游戏）' } },
    ],
  },
];

interface TouchButton {
  id: string;
  label: LocalizedText;
  action: LocalizedText;
  /** 这一条下面的补充说明 */
  note?: LocalizedText;
  /** 与 index.html 的按键簇一致：中心到簇右下角的距离与直径（px，未缩放） */
  x: number;
  y: number;
  size: number;
  color: string;
}

const TOUCH_BUTTONS: readonly TouchButton[] = [
  {
    id: 'fire',
    label: { en: 'FIRE', zh: '开火' },
    action: { en: 'Guns. Hold to keep firing.', zh: '机炮，按住连射。' },
    note: GUN_ASSIST_NOTE,
    x: 44,
    y: 44,
    size: 72,
    color: HUD_COLORS.threat,
  },
  {
    id: 'missile',
    label: { en: 'MSL', zh: '导弹' },
    action: {
      en: 'Missile. Tap when the ring is green.',
      zh: '导弹。锁定环变绿后点按发射。',
    },
    note: MISSILE_NOTE,
    x: 132,
    y: 36,
    size: 58,
    color: HUD_COLORS.weapon,
  },
  {
    id: 'special',
    label: { en: 'SPEC', zh: '特武' },
    action: { en: 'Special weapon. Tap or hold.', zh: '特殊武器，可点按或长按。' },
    x: 116,
    y: 112,
    size: 60,
    color: HUD_COLORS.weapon,
  },
  {
    id: 'cycle',
    label: { en: 'SWAP', zh: '切换' },
    action: { en: 'Switch to the next special weapon.', zh: '切换到下一种特殊武器。' },
    x: 196,
    y: 108,
    size: 44,
    color: HUD_COLORS.sys,
  },
  {
    id: 'flare',
    label: { en: 'FLARE', zh: '热焰' },
    action: { en: 'Drop flares to shake off missiles.', zh: '投放热焰弹，甩掉来袭导弹。' },
    x: 40,
    y: 130,
    size: 54,
    color: HUD_COLORS.ally,
  },
  {
    id: 'boost',
    label: { en: 'BOOST', zh: '加速' },
    action: {
      en: 'Tap to latch boost on, tap again for off.',
      zh: '点一下开启加速，再点一下关闭。',
    },
    x: 216,
    y: 34,
    size: 54,
    color: HUD_COLORS.lock,
  },
  {
    id: 'view',
    label: { en: 'VIEW', zh: '视角' },
    action: { en: 'First / third-person view.', zh: '切换第一 / 第三人称。' },
    x: 120,
    y: 186,
    size: 44,
    color: HUD_COLORS.sys,
  },
  {
    id: 'pause',
    label: { en: 'PAUSE', zh: '暂停' },
    action: {
      en: 'Opens the pause menu: upgrades, settings and Save & Exit.',
      zh: '打开暂停菜单：升级、设置、保存并退出都在这里。',
    },
    x: 40,
    y: 204,
    size: 44,
    color: HUD_COLORS.sys,
  },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | number>>
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

export interface HowToPlaySheetOptions {
  reducedMotion: boolean;
  /** 默认显示哪一页（触屏设备为 touch） */
  defaultView: HowToPlayView;
  onOpenChange?: (open: boolean) => void;
}

export class HowToPlaySheet {
  public readonly sheet: MenuSheet;

  private view: HowToPlayView;
  private readonly defaultView: HowToPlayView;
  /** 页签栏：在面板标题与正文之间，不随正文滚动 */
  private tabs: HTMLElement | null = null;

  constructor(options: HowToPlaySheetOptions) {
    this.defaultView = options.defaultView;
    this.view = options.defaultView;
    this.sheet = new MenuSheet({
      id: 'howto-sheet',
      variant: 'panel',
      reducedMotion: options.reducedMotion,
      onOpenChange: options.onOpenChange,
    });
    this.render();
  }

  public open(opener: SheetOpener): void {
    // 每次打开回到与设备相符的那一页
    this.selectView(this.defaultView);
    this.sheet.open(opener);
  }

  /**
   * 按当前语言重建内容。两页都在文档里，未选中的那页 hidden（标准的页签结构）；
   * 焦点在页签上时放回对应页签。
   */
  public render(): void {
    const body = this.sheet.body;
    const active = document.activeElement;
    const tabFocused = active instanceof HTMLElement && this.tabs?.contains(active) === true;

    this.sheet.setHeading(
      tr({ en: 'Flight manual', zh: '飞行手册' }),
      tr({ en: 'How to Play', zh: '操作说明' }),
      tr({ en: 'Close how to play', zh: '关闭操作说明' })
    );

    const tabs = el('div', 'hp-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', tr({ en: 'Control scheme', zh: '操作方式' }));
    const views: ReadonlyArray<readonly [HowToPlayView, string]> = [
      ['keyboard', tr({ en: 'Keyboard', zh: '键盘' })],
      ['touch', tr({ en: 'Touch', zh: '触屏' })],
    ];
    const panels: HTMLElement[] = [];
    for (const [view, label] of views) {
      const tab = el('button', 'hp-tab', label);
      tab.type = 'button';
      tab.id = `howto-tab-${view}`;
      tab.dataset.view = view;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `howto-panel-${view}`);
      tab.addEventListener('click', () => this.selectView(view, true));
      tabs.append(tab);

      // controls-info：按键图例的稳定类名（键盘页就是原来菜单底部的那张操作说明）
      const panel = el('div', view === 'keyboard' ? 'hp-panel controls-info' : 'hp-panel');
      panel.id = `howto-panel-${view}`;
      panel.dataset.panel = view;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      if (view === 'keyboard') {
        panel.append(...KEYBOARD_GROUPS.map((group) => this.createKeyGroup(group)));
      } else {
        panel.append(...this.createTouchView());
      }
      panels.push(panel);
    }
    // 左右方向键在两个页签之间切换
    tabs.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.selectView(this.view === 'keyboard' ? 'touch' : 'keyboard', true);
      }
    });

    // 页签栏放在标题与正文之间（不随正文滚动），正文里只有两张页面
    this.tabs?.remove();
    this.tabs = tabs;
    body.before(tabs);
    body.replaceChildren(...panels);
    this.applyView();
    if (tabFocused) {
      tabs.querySelector<HTMLElement>(`#howto-tab-${this.view}`)?.focus({ preventScroll: true });
    }
  }

  public dispose(): void {
    this.sheet.dispose();
  }

  /** 把当前页反映到页签（选中态、roving tabindex）与两张页面（hidden）上 */
  private applyView(): void {
    const tabs = this.tabs?.querySelectorAll<HTMLElement>('.hp-tab') ?? [];
    for (const tab of Array.from(tabs)) {
      const selected = tab.dataset.view === this.view;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of Array.from(this.sheet.body.querySelectorAll<HTMLElement>('.hp-panel'))) {
      panel.hidden = panel.dataset.panel !== this.view;
    }
  }

  private selectView(view: HowToPlayView, focusTab: boolean = false): void {
    if (view !== this.view) {
      this.view = view;
      this.applyView();
      this.sheet.body.scrollTop = 0;
    }
    if (focusTab) {
      this.tabs?.querySelector<HTMLElement>(`#howto-tab-${view}`)?.focus({ preventScroll: true });
    }
  }

  // ───────────────────────────── 键盘 ─────────────────────────────

  private createKeyGroup(group: KeyGroup): HTMLElement {
    // 各段之间的空白文本节点：textContent / 读屏里标题、按键、说明各自成词，不会连成一串
    const section = el('section', 'hp-group');
    section.append(el('h3', 'st-group-title', tr(group.title)), ' ');
    const list = el('dl', 'hp-keys');
    for (const entry of group.entries) {
      const row = el('div', 'hp-row');
      const keys = el('dt', 'hp-row-keys');
      entry.keys.forEach((key, index) => {
        if (index > 0) {
          keys.append(el('span', 'hp-joiner', entry.joiner ?? ' / '));
        }
        keys.append(el('kbd', 'hp-key', tr(key)));
      });
      const action = el('dd', 'hp-row-action', tr(entry.action));
      row.append(keys, ' ', action);
      list.append(row, ' ');
      if (entry.note) {
        list.append(el('div', 'hp-note', tr(entry.note)), ' ');
      }
    }
    section.append(list);
    return section;
  }

  // ───────────────────────────── 触屏 ─────────────────────────────

  private createTouchView(): HTMLElement[] {
    const figure = el('figure', 'hp-figure');
    figure.append(this.createTouchDiagram());
    figure.append(
      el(
        'figcaption',
        'hp-figcaption',
        tr({
          en: 'Left thumb flies, right thumb fights.',
          zh: '左手拇指飞行，右手拇指作战。',
        })
      )
    );

    const stick = el('section', 'hp-group');
    stick.append(el('h3', 'st-group-title', tr({ en: 'Left thumb', zh: '左手拇指' })));
    stick.append(
      el(
        'p',
        'hp-text',
        tr({
          en: 'Touch anywhere in the lower-left area: a floating stick appears under your thumb. Slide up or down to pitch, left or right to turn.',
          zh: '在屏幕左下区域任意位置按下，浮动摇杆就出现在拇指下方。上下滑动控制俯仰，左右滑动控制转向。',
        })
      )
    );

    const buttons = el('section', 'hp-group');
    buttons.append(el('h3', 'st-group-title', tr({ en: 'Right-hand buttons', zh: '右手按键' })));
    const list = el('dl', 'hp-keys');
    for (const button of TOUCH_BUTTONS) {
      const row = el('div', 'hp-row');
      const term = el('dt', 'hp-row-keys');
      const chip = el('span', 'hp-chip', tr(button.label));
      chip.style.setProperty('--hp-chip', button.color);
      term.append(chip);
      row.append(term, ' ', el('dd', 'hp-row-action', tr(button.action)));
      list.append(row);
      if (button.note) {
        list.append(el('div', 'hp-note', tr(button.note)));
      }
    }
    buttons.append(list);

    const radar = el('section', 'hp-group');
    radar.append(el('h3', 'st-group-title', tr({ en: 'Radar', zh: '雷达' })));
    radar.append(
      el(
        'p',
        'hp-text',
        tr({ en: 'Tap the radar to open the level map.', zh: '点一下雷达，打开关卡地图。' })
      )
    );

    return [figure, stick, buttons, radar];
  }

  /** 触屏布局示意图：左侧摇杆触摸区 + 右下角的按键簇（位置取自实际布局） */
  private createTouchDiagram(): SVGSVGElement {
    const width = 480;
    const height = 270;
    const root = svg('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: 'hp-diagram',
      role: 'img',
      'aria-label': tr({
        en: 'Touch layout: stick area on the left, button cluster on the lower right, radar in the upper left',
        zh: '触屏布局：左侧是摇杆区域，右下角是按键簇，左上角是雷达',
      }),
    });

    root.append(
      svg('rect', { x: 1, y: 1, width: width - 2, height: height - 2, rx: 16, class: 'hp-d-frame' })
    );

    // 摇杆触摸区：屏幕左侧 42% 宽、从 38% 高处到底边
    const zoneTop = height * 0.38;
    const zoneWidth = width * 0.42;
    root.append(
      svg('rect', {
        x: 8,
        y: zoneTop,
        width: zoneWidth - 8,
        height: height - zoneTop - 8,
        rx: 10,
        class: 'hp-d-zone',
      })
    );
    const stickX = zoneWidth * 0.46;
    const stickY = zoneTop + (height - zoneTop) * 0.52;
    root.append(svg('circle', { cx: stickX, cy: stickY, r: 34, class: 'hp-d-stick' }));
    root.append(svg('circle', { cx: stickX + 9, cy: stickY - 8, r: 14, class: 'hp-d-knob' }));
    const zoneLabel = svg('text', {
      x: zoneWidth / 2 + 4,
      y: zoneTop + 20,
      class: 'hp-d-label',
      'text-anchor': 'middle',
    });
    zoneLabel.textContent = tr({ en: 'STICK: ANYWHERE HERE', zh: '摇杆：此区域任意位置' });
    root.append(zoneLabel);

    // 雷达
    root.append(svg('circle', { cx: 46, cy: 46, r: 30, class: 'hp-d-radar' }));
    root.append(svg('circle', { cx: 46, cy: 46, r: 15, class: 'hp-d-radar-ring' }));
    const radarLabel = svg('text', {
      x: 86,
      y: 50,
      class: 'hp-d-label',
      'text-anchor': 'start',
    });
    radarLabel.textContent = tr({ en: 'RADAR: TAP FOR MAP', zh: '雷达：点按看地图' });
    root.append(radarLabel);

    // 按键簇：以右下角为原点，按实际位置缩放
    const scale = 0.86;
    const originX = width - 14;
    const originY = height - 12;
    for (const button of TOUCH_BUTTONS) {
      const cx = originX - button.x * scale;
      const cy = originY - button.y * scale;
      const radius = (button.size / 2) * scale;
      const disc = svg('circle', { cx, cy, r: radius, class: 'hp-d-button' });
      disc.style.stroke = button.color;
      root.append(disc);
      const label = svg('text', {
        x: cx,
        y: cy + 3.5,
        class: 'hp-d-button-label',
        'text-anchor': 'middle',
      });
      label.textContent = tr(button.label);
      root.append(label);
    }
    return root;
  }
}
