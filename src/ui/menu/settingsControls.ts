import { el } from './dom';

/**
 * 设置面板里的四种控件：步进器、分段选择、音量格条、开关。
 * 都是 44px 以上的触控目标；键盘上左右方向键调整数值（上下方向键由面板用来换行）。
 * 每个可聚焦元素带 data-focus-key，语言切换重建面板后据此把焦点放回原处。
 */

// ───────────────────────────── 步进器 ─────────────────────────────

export interface StepperOptions {
  key: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** 数值下方的刻度格数（难度 5 格、生命 9 格…）；0 = 不显示 */
  pips?: number;
  /** 左右方向键是否调整数值（默认是）；暂停菜单不接管方向键，传 false */
  arrowKeys?: boolean;
  onStep: (direction: 1 | -1) => void;
}

export interface StepperHandle {
  root: HTMLDivElement;
  /** pipsOn：点亮的刻度数；atMin / atMax：到头的一侧按钮变暗并不再响应 */
  set(text: string, state: { atMin: boolean; atMax: boolean; pipsOn?: number }): void;
}

function stepButton(
  key: string,
  direction: 1 | -1,
  label: string,
  onStep: (direction: 1 | -1) => void
): HTMLButtonElement {
  // 文字是 + / -（稳定、与语言无关）；看到的加减号由 CSS 画，读屏读 aria-label
  const button = el('button', 'st-step', direction === 1 ? '+' : '-');
  button.type = 'button';
  button.dataset.step = String(direction);
  button.dataset.focusKey = `${key}:${direction === 1 ? 'inc' : 'dec'}`;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    // 到头后用 aria-disabled 而不是 disabled：按钮保留焦点，键盘用户不会被甩出去
    if (button.getAttribute('aria-disabled') === 'true') {
      return;
    }
    onStep(direction);
  });
  return button;
}

/** 左右方向键 = 点击减 / 加按钮（点击会冒泡，和鼠标 / 触摸走同一条路径） */
function bindArrowSteps(
  root: HTMLElement,
  decrease: HTMLButtonElement,
  increase: HTMLButtonElement
): void {
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      decrease.click();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      increase.click();
    }
  });
}

export function createStepper(options: StepperOptions): StepperHandle {
  const root = el('div', 'st-stepper');
  const decrease = stepButton(options.key, -1, options.decreaseLabel, options.onStep);
  const increase = stepButton(options.key, 1, options.increaseLabel, options.onStep);

  const readout = el('div', 'st-readout');
  const value = el('span', 'st-value setting-value');
  value.id = `${options.key}-value`;
  value.setAttribute('aria-live', 'polite');
  readout.append(value);

  const pips: HTMLSpanElement[] = [];
  if (options.pips && options.pips > 0) {
    const row = el('span', 'st-pips');
    row.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < options.pips; i++) {
      const pip = el('span', 'st-pip');
      pips.push(pip);
      row.append(pip);
    }
    readout.append(row);
  }

  root.append(decrease, readout, increase);
  if (options.arrowKeys !== false) {
    bindArrowSteps(root, decrease, increase);
  }

  return {
    root,
    set(text, state) {
      value.textContent = text;
      decrease.setAttribute('aria-disabled', state.atMin ? 'true' : 'false');
      increase.setAttribute('aria-disabled', state.atMax ? 'true' : 'false');
      const on = state.pipsOn ?? 0;
      pips.forEach((pip, index) => pip.classList.toggle('is-on', index < on));
    },
  };
}

// ───────────────────────────── 分段选择 ─────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedOptions<T extends string> {
  key: string;
  /** 行标签元素的 id（radiogroup 的无障碍名称） */
  labelledBy: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  onSelect: (value: T) => void;
}

export interface SegmentedHandle<T extends string> {
  root: HTMLDivElement;
  set(value: T): void;
}

export function createSegmented<T extends string>(
  options: SegmentedOptions<T>
): SegmentedHandle<T> {
  const root = el('div', 'st-seg');
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-labelledby', options.labelledBy);
  root.style.setProperty('--st-seg-count', String(options.options.length));
  if (options.options.length >= 4) {
    root.dataset.dense = '';
  }

  const buttons = options.options.map((option) => {
    const button = el('button', 'st-seg-opt', option.label);
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.dataset.value = option.value;
    button.dataset.focusKey = `${options.key}:${option.value}`;
    button.addEventListener('click', () => options.onSelect(option.value));
    root.append(button);
    return button;
  });

  // 左右方向键切换到相邻选项（到头循环），焦点跟着走
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const current = buttons.findIndex((button) => button.getAttribute('aria-checked') === 'true');
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = buttons[(Math.max(0, current) + step + buttons.length) % buttons.length];
    event.preventDefault();
    next.click();
    // 语言切换会重建面板：重建后的焦点由面板按 data-focus-key 放回，这里只管没重建的情况
    if (next.isConnected) {
      next.focus();
    }
  });

  return {
    root,
    set(value) {
      for (const button of buttons) {
        const checked = button.dataset.value === value;
        button.setAttribute('aria-checked', checked ? 'true' : 'false');
        button.tabIndex = checked ? 0 : -1;
      }
    },
  };
}

// ───────────────────────────── 音量格条 ─────────────────────────────

/** 音量按 10% 一档（与原来的 - / + 步进一致） */
const METER_CELLS = 10;

export interface MeterOptions {
  key: string;
  /** 滑杆的无障碍名称（如“音效音量”） */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  /** value：0..1，已对齐到 10% */
  onChange: (value: number) => void;
}

export interface MeterHandle {
  root: HTMLDivElement;
  set(value: number): void;
}

function snapUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.round(value * METER_CELLS) / METER_CELLS));
}

/**
 * 音量：十格音量条（点哪格到哪格，可以按住拖动）+ 两侧的减 / 加按钮 + 百分比读数。
 * 语义与键盘交给一个盖在格条上的原生 range（左右方向键 / Home / End）。
 */
export function createMeter(options: MeterOptions): MeterHandle {
  const root = el('div', 'st-meter');
  let current = 0;

  const commit = (next: number): void => {
    const snapped = snapUnit(next);
    if (snapped !== current) {
      options.onChange(snapped);
    }
  };
  const step = (direction: 1 | -1): void => commit(current + direction / METER_CELLS);
  const decrease = stepButton(options.key, -1, options.decreaseLabel, step);
  const increase = stepButton(options.key, 1, options.increaseLabel, step);

  const track = el('div', 'st-meter-track');
  const input = el('input', 'st-meter-input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = String(100 / METER_CELLS);
  input.dataset.focusKey = `${options.key}:range`;
  input.setAttribute('aria-label', options.label);

  const cells = el('span', 'st-meter-cells');
  cells.setAttribute('aria-hidden', 'true');
  const cellNodes: HTMLSpanElement[] = [];
  for (let i = 0; i < METER_CELLS; i++) {
    const cell = el('span', 'st-cell');
    cell.style.setProperty('--st-cell', String(i));
    cellNodes.push(cell);
    cells.append(cell);
  }
  track.append(input, cells);

  const value = el('span', 'st-value st-value-num setting-value');
  value.id = `${options.key}-value`;

  /**
   * 开始菜单音乐靠 document 上的 click 来同步音量（MenuMusic.handleClick）。
   * 键盘与拖动改音量不会产生 click，这里补发一个，保证音乐音量随改随变。
   */
  const notifyClickListeners = (): void => {
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  // 键盘（原生 range）
  input.addEventListener('input', () => {
    commit(Number(input.value) / 100);
    notifyClickListeners();
  });

  // 指针：点到哪一格就亮到哪一格；按住横向拖动连续调整
  const valueAt = (clientX: number): number => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) {
      return current;
    }
    const fraction = (clientX - rect.left) / rect.width;
    if (fraction <= 0.02) {
      return 0;
    }
    return Math.min(1, Math.ceil(fraction * METER_CELLS - 1e-6) / METER_CELLS);
  };
  let dragging = false;
  track.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      // 测试环境 / 旧浏览器没有指针捕获
    }
    input.focus({ preventScroll: true });
    commit(valueAt(event.clientX));
  });
  track.addEventListener('pointermove', (event) => {
    if (dragging) {
      commit(valueAt(event.clientX));
    }
  });
  const endDrag = (): void => {
    if (dragging) {
      dragging = false;
      notifyClickListeners();
    }
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  root.append(decrease, track, increase, value);

  return {
    root,
    set(next) {
      current = snapUnit(next);
      const percent = Math.round(current * 100);
      input.value = String(percent);
      input.setAttribute('aria-valuetext', `${percent}%`);
      value.textContent = `${percent}%`;
      const lit = Math.round(current * METER_CELLS);
      cellNodes.forEach((cell, index) => cell.classList.toggle('is-on', index < lit));
      decrease.setAttribute('aria-disabled', current <= 0 ? 'true' : 'false');
      increase.setAttribute('aria-disabled', current >= 1 ? 'true' : 'false');
    },
  };
}

// ───────────────────────────── 开关 ─────────────────────────────

export interface SwitchOptions {
  key: string;
  labelledBy: string;
  onToggle: (next: boolean) => void;
}

export interface SwitchHandle {
  root: HTMLButtonElement;
  set(on: boolean, text: string): void;
}

export function createSwitch(options: SwitchOptions): SwitchHandle {
  const root = el('button', 'st-switch');
  root.type = 'button';
  root.setAttribute('role', 'switch');
  root.setAttribute('aria-labelledby', options.labelledBy);
  root.dataset.focusKey = `${options.key}:switch`;
  let checked = false;

  const text = el('span', 'st-switch-text setting-value');
  text.id = `${options.key}-value`;
  const track = el('span', 'st-switch-track');
  track.append(el('span', 'st-switch-knob'));
  root.append(text, track);

  root.addEventListener('click', () => options.onToggle(!checked));
  root.addEventListener('keydown', (event) => {
    // 左 = 关，右 = 开（与其它控件的左右调整一致）
    if (event.key === 'ArrowLeft' && checked) {
      event.preventDefault();
      root.click();
    } else if (event.key === 'ArrowRight' && !checked) {
      event.preventDefault();
      root.click();
    }
  });

  return {
    root,
    set(on, label) {
      checked = on;
      root.setAttribute('aria-checked', on ? 'true' : 'false');
      text.textContent = label;
    },
  };
}
