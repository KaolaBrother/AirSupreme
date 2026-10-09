import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { SPECIAL_WEAPON_IDS } from '@/core/CombatContracts';
import { WeaponSystem, type WeaponHudState } from '@/features/weapons/WeaponSystem';
import { SPECIAL_WEAPON_CONFIGS } from '@/features/weapons/WeaponTypes';
import { HUD, type HudWeaponPanelState } from '@/ui/HUD';
import { setLocale } from '@/i18n';
import { RadarMinimap, type RadarBlipKind } from '@/ui/RadarMinimap';
import { resetLocale } from './i18nTestUtils';

/**
 * api-spec §9 HUD / RadarMinimap / index.html + integration-notes「Story UI + HUD」：
 * 武器面板（按模式显示弹药 / 热量 / 蓄能 / 冷却）、热焰弹、自动存档提示（由 hud.update(dt) 计时）、
 * 视角、Boss 阶段条（null 隐藏）、导弹告警分级、闪烁告警色调；雷达新点类型与量程倍率；
 * 移动端新按键。只断言 DOM 状态与文本，不看像素。
 */

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

interface SpecHudWeaponPanelState {
  visible: boolean;
  icon: string;
  name: string;
  shortCode: string;
  mode: 'salvo' | 'beam' | 'charge' | 'pulse' | null;
  ammo: number;
  maxAmmo: number;
  reloadProgress: number;
  heat: number;
  overheated: boolean;
  charge: number;
  cooldown: number;
  ready: boolean;
  slots: Array<{ icon: string; shortCode: string; selected: boolean; ready: boolean }>;
}

/** §9 HUD 新方法（属性写法 → 参数逆变检查） */
interface SpecHudAdditions {
  updateWeaponPanel: (state: SpecHudWeaponPanelState) => void;
  updateFlares: (charges: number, max: number, rechargeProgress: number) => void;
  showAutosave: (label?: string) => void;
  setCameraMode: (mode: 'third-person' | 'first-person') => void;
  setBossStatus: (label: string | null, phase?: { current: number; total: number }) => void;
  setMissileWarning: (level: 'none' | 'locking' | 'incoming') => void;
  flashWarning: (text: string, tone?: 'threat' | 'sys' | 'ally') => void;
}

const PANEL_STATE_MATCHES_SPEC: IsExact<HudWeaponPanelState, SpecHudWeaponPanelState> = true;

type SpecNewRadarKinds = 'enemy-ground' | 'enemy-sea' | 'neutral' | 'ally-unit';
const NEW_KINDS_ARE_RADAR_KINDS: [SpecNewRadarKinds] extends [RadarBlipKind] ? true : false = true;

const SPEC_HUD_METHODS: readonly (keyof SpecHudAdditions)[] = [
  'updateWeaponPanel',
  'updateFlares',
  'showAutosave',
  'setCameraMode',
  'setBossStatus',
  'setMissileWarning',
  'flashWarning',
];

/** integration-notes 的接线：updateWeaponPanel({ ...weapons.getHudState(), visible }) */
function toWeaponPanel(state: WeaponHudState): HudWeaponPanelState {
  return { ...state, visible: state.selected !== null };
}

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_HTML = readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
const MOBILE_BUTTON_IDS = ['camera-button', 'special-button', 'cycle-button', 'flare-button'];

// ---------------------------------------------------------------------------
// 视口 / DOM 工具
// ---------------------------------------------------------------------------

const restorers: Array<() => void> = [];

function overrideProperty(target: object, key: string, value: unknown): void {
  const own = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  restorers.push(() => {
    if (own) {
      Object.defineProperty(target, key, own);
    } else {
      delete (target as Record<string, unknown>)[key];
    }
  });
}

function useViewport(kind: 'desktop' | 'touch'): void {
  const touch = kind === 'touch';
  overrideProperty(window, 'innerWidth', touch ? 844 : 1280);
  overrideProperty(window, 'innerHeight', touch ? 390 : 800);
  overrideProperty(navigator, 'maxTouchPoints', touch ? 5 : 0);
  const previousTouchStart = window.ontouchstart;
  const previousMobile = GameConfig.isMobile;
  window.ontouchstart = touch ? () => undefined : null;
  GameConfig.isMobile = touch;
  restorers.push(() => {
    window.ontouchstart = previousTouchStart;
    GameConfig.isMobile = previousMobile;
  });
}

function restoreEnvironment(): void {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function isShown(element: Element | null): boolean {
  if (!(element instanceof HTMLElement) || !element.isConnected) {
    return false;
  }
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.style.display === 'none' || node.hidden) {
      return false;
    }
  }
  return true;
}

function hudText(): string {
  return byId('hud')?.textContent ?? '';
}

function mountShippedMobileControls(): void {
  const shipped = new DOMParser().parseFromString(INDEX_HTML, 'text/html');
  const controls = shipped.getElementById('mobile-controls');
  expect(controls, '#mobile-controls in index.html').not.toBeNull();
  document.body.appendChild(document.importNode(controls as HTMLElement, true));
}

function panelState(overrides: Partial<HudWeaponPanelState> = {}): HudWeaponPanelState {
  return {
    visible: true,
    icon: '🚀',
    name: 'Cluster Rockets',
    shortCode: 'RKT',
    mode: 'salvo',
    ammo: 2,
    maxAmmo: 3,
    reloadProgress: 0.5,
    heat: 0,
    overheated: false,
    charge: 0,
    cooldown: 0,
    ready: true,
    slots: [{ icon: '🚀', shortCode: 'RKT', selected: true, ready: true }],
    ...overrides,
  };
}

const LASER = { icon: '🔆', name: 'Pulse Laser', shortCode: 'LSR' };
const RAILGUN = { icon: '☄️', name: 'Railgun', shortCode: 'RLG' };
const EMP = { icon: '🌀', name: 'EMP', shortCode: 'EMP' };

type ModeCase = [label: string, state: HudWeaponPanelState, expectedText: string[]];

const OVERHEATED_LASER = panelState({
  ...LASER,
  mode: 'beam',
  ammo: Infinity,
  maxAmmo: Infinity,
  heat: 1,
  overheated: true,
  ready: false,
});
/** 过热提示（英文默认，中文可切换） */
const OVERHEATED_TEXT = { en: 'Overheated', zh: '过热' };

const MODE_CASES: readonly ModeCase[] = [
  ['salvo (ammo)', panelState({ ammo: 2, maxAmmo: 3 }), ['RKT', 'Cluster Rockets', '2/3']],
  [
    'beam (heat)',
    panelState({ ...LASER, mode: 'beam', ammo: Infinity, maxAmmo: Infinity, heat: 0.45 }),
    ['LSR', 'Pulse Laser', '45%'],
  ],
  ['beam (overheated)', OVERHEATED_LASER, ['LSR', OVERHEATED_TEXT.en]],
  [
    'charge (charging)',
    panelState({ ...RAILGUN, mode: 'charge', ammo: 3, maxAmmo: 4, charge: 0.5 }),
    ['RLG', 'Railgun', '50%', '3/4'],
  ],
  [
    'pulse (cooldown)',
    panelState({ ...EMP, mode: 'pulse', ammo: 2, maxAmmo: 3, cooldown: 0.4, ready: false }),
    ['EMP', '2/3'],
  ],
];

// ---------------------------------------------------------------------------
// HUD（桌面）
// ---------------------------------------------------------------------------

/** 用公共 API 收起全部战役面板（共享 HUD 时每个用例前调用） */
function resetCampaignPanels(hud: HUD): void {
  hud.updateWeaponPanel(panelState({ visible: false }));
  hud.updateFlares(0, 0, 0);
  hud.setBossStatus(null);
  hud.setMissileWarning('none');
  hud.update(60);
}

describe('HUD campaign panels on desktop (§9)', () => {
  // jsdom 下构造一个 HUD 约 50 ms：整组共享一个实例，用例之间只复位战役面板
  let hud: HUD;

  beforeAll(() => {
    document.body.innerHTML = '';
    useViewport('desktop');
    hud = new HUD();
    hud.init();
  });

  afterAll(() => {
    hud.dispose();
    document.body.innerHTML = '';
    restoreEnvironment();
  });

  beforeEach(() => {
    resetCampaignPanels(hud);
  });

  afterEach(() => {
    resetLocale();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('implements the §9 signatures', () => {
    const view: SpecHudAdditions = hud;
    expect(PANEL_STATE_MATCHES_SPEC).toBe(true);
    for (const method of SPEC_HUD_METHODS) {
      expect(typeof view[method], method).toBe('function');
    }
  });

  describe('updateWeaponPanel', () => {
    it('shows the panel only for a visible state', () => {
      expect(isShown(byId('hud-weapon-panel'))).toBe(false);
      hud.updateWeaponPanel(panelState({ visible: false }));
      expect(isShown(byId('hud-weapon-panel'))).toBe(false);
      hud.updateWeaponPanel(panelState());
      expect(isShown(byId('hud-weapon-panel'))).toBe(true);
      hud.updateWeaponPanel(panelState({ visible: false }));
      expect(isShown(byId('hud-weapon-panel'))).toBe(false);
    });

    it.each(MODE_CASES)('renders the %s readout', (_label, state, expectedText) => {
      hud.updateWeaponPanel(state);
      const panel = byId('hud-weapon-panel');
      expect(isShown(panel)).toBe(true);
      expect(panel?.getAttribute('data-mode')).toBe(state.mode);
      const text = panel?.textContent ?? '';
      for (const snippet of expectedText) {
        expect(text, `${state.mode} panel shows "${snippet}"`).toContain(snippet);
      }
      expect(hudText()).not.toMatch(/NaN|Infinity|undefined/);
    });

    it('words the overheat readout in the interface language', () => {
      hud.updateWeaponPanel(OVERHEATED_LASER);
      expect(byId('hud-weapon-panel')?.textContent).toContain(OVERHEATED_TEXT.en);
      setLocale('zh-CN');
      hud.updateWeaponPanel(OVERHEATED_LASER);
      const text = byId('hud-weapon-panel')?.textContent ?? '';
      expect(text).toContain(OVERHEATED_TEXT.zh);
      expect(text).not.toContain(OVERHEATED_TEXT.en);
    });

    it('marks the selected weapon among the rack slots', () => {
      hud.updateWeaponPanel(
        panelState({
          slots: [
            { icon: '🚀', shortCode: 'RKT', selected: false, ready: true },
            { icon: '🔆', shortCode: 'LSR', selected: true, ready: true },
            { icon: '🐝', shortCode: 'SWM', selected: false, ready: false },
          ],
        })
      );
      const panel = byId('hud-weapon-panel');
      const text = panel?.textContent ?? '';
      for (const code of ['RKT', 'LSR', 'SWM']) {
        expect(text).toContain(code);
      }
      const selected = Array.from(panel?.querySelectorAll('[data-selected="true"]') ?? []);
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toContain('LSR');
    });

    it.each(SPECIAL_WEAPON_IDS)('renders the live WeaponSystem state of %s', (id) => {
      const weapons = new WeaponSystem(null, null);
      try {
        weapons.setUnlocked([...SPECIAL_WEAPON_IDS]);
        expect(weapons.select(id)).toBe(true);
        hud.updateWeaponPanel(toWeaponPanel(weapons.getHudState()));
        const panel = byId('hud-weapon-panel');
        const config = SPECIAL_WEAPON_CONFIGS[id];
        expect(isShown(panel)).toBe(true);
        expect(panel?.getAttribute('data-mode')).toBe(config.mode);
        expect(panel?.textContent).toContain(config.shortCode);
        expect(panel?.textContent).toContain(config.name.en);
        expect(hudText()).not.toMatch(/NaN|Infinity|undefined/);

        setLocale('zh-CN');
        hud.updateWeaponPanel(toWeaponPanel(weapons.getHudState()));
        expect(panel?.textContent).toContain(config.name.zh);
        expect(panel?.textContent).toContain(config.shortCode);
        setLocale('en');

        weapons.setUnlocked([]);
        hud.updateWeaponPanel(toWeaponPanel(weapons.getHudState()));
        expect(isShown(panel)).toBe(false);
      } finally {
        weapons.dispose();
      }
    });
  });

  describe('updateFlares', () => {
    it('shows remaining / capacity and hides without capacity', () => {
      hud.updateFlares(2, 3, 0.4);
      const flares = byId('hud-flares');
      expect(isShown(flares)).toBe(true);
      expect(flares?.textContent).toContain('2/3');

      hud.updateFlares(0, 3, 0.9);
      expect(isShown(flares)).toBe(true);
      expect(flares?.textContent).toContain('0/3');

      hud.updateFlares(0, 0, 0);
      expect(isShown(flares)).toBe(false);
    });

    it('never shows more charges than capacity or NaN', () => {
      hud.updateFlares(5, 3, 0.5);
      expect(byId('hud-flares')?.textContent).toContain('3/3');
      hud.updateFlares(Number.NaN, 3, Number.NaN);
      expect(hudText()).not.toMatch(/NaN|Infinity|undefined/);
    });
  });

  describe('showAutosave', () => {
    it('appears with its label, then expires through update(dt)', () => {
      hud.showAutosave('第3波');
      const toast = byId('hud-autosave');
      expect(isShown(toast)).toBe(true);
      expect(toast?.textContent).toContain('第3波');

      hud.update(1);
      expect(isShown(toast)).toBe(true);
      for (let elapsed = 0; elapsed < 6; elapsed += 0.1) {
        hud.update(0.1);
      }
      expect(isShown(toast)).toBe(false);
    });

    it('freezes while update(dt) is not called (paused game)', () => {
      vi.useFakeTimers();
      hud.showAutosave('检查点');
      vi.advanceTimersByTime(60_000);
      expect(isShown(byId('hud-autosave'))).toBe(true);
      hud.update(10);
      expect(isShown(byId('hud-autosave'))).toBe(false);
    });

    it('restarts its timer when shown again and drops a stale label', () => {
      hud.showAutosave('第2波');
      hud.update(2);
      hud.showAutosave();
      hud.update(2);
      const toast = byId('hud-autosave');
      expect(isShown(toast)).toBe(true);
      expect(toast?.textContent).not.toContain('第2波');
    });
  });

  describe('setCameraMode', () => {
    it('reflects the camera mode on the HUD', () => {
      hud.setCameraMode('first-person');
      expect(byId('hud')?.getAttribute('data-camera-mode')).toBe('first-person');
      const chip = byId('hud-camera-mode');
      expect(isShown(chip)).toBe(true);
      const firstPersonLabel = chip?.textContent ?? '';
      expect(firstPersonLabel.trim()).not.toBe('');

      hud.setCameraMode('third-person');
      expect(byId('hud')?.getAttribute('data-camera-mode')).toBe('third-person');
      expect(chip?.textContent).not.toBe(firstPersonLabel);
    });
  });

  describe('setBossStatus', () => {
    it('shows the label and phase, and hides for null', () => {
      hud.setBossStatus('熔岩巨像 · 核心暴露', { current: 2, total: 3 });
      const strip = byId('hud-boss-status');
      expect(isShown(strip)).toBe(true);
      expect(strip?.textContent).toContain('熔岩巨像 · 核心暴露');
      expect(strip?.textContent).toContain('2/3');

      hud.setBossStatus('熔岩巨像 · 核心暴露', { current: 3, total: 3 });
      expect(strip?.textContent).toContain('3/3');

      hud.setBossStatus(null);
      expect(isShown(strip)).toBe(false);

      hud.setBossStatus('深渊利维坦');
      expect(isShown(strip)).toBe(true);
      expect(strip?.textContent).toContain('深渊利维坦');
      expect(strip?.textContent).not.toContain('熔岩巨像');
    });

    it('never renders NaN for a broken phase', () => {
      hud.setBossStatus('天穹神谕', { current: Number.NaN, total: 3 });
      hud.setBossStatus('天穹神谕', { current: 1, total: Number.POSITIVE_INFINITY });
      expect(hudText()).not.toMatch(/NaN|Infinity|undefined/);
    });
  });

  describe('setMissileWarning', () => {
    it('escalates locking → incoming and clears on none', () => {
      expect(isShown(byId('hud-missile-warning'))).toBe(false);

      hud.setMissileWarning('locking');
      const warning = byId('hud-missile-warning');
      expect(isShown(warning)).toBe(true);
      expect(byId('hud')?.getAttribute('data-missile-warning')).toBe('locking');
      const lockingText = warning?.textContent ?? '';
      expect(lockingText.trim()).not.toBe('');

      hud.setMissileWarning('incoming');
      expect(isShown(warning)).toBe(true);
      expect(byId('hud')?.getAttribute('data-missile-warning')).toBe('incoming');
      expect(warning?.textContent).not.toBe(lockingText);

      hud.setMissileWarning('none');
      expect(isShown(warning)).toBe(false);
      expect(byId('hud')?.getAttribute('data-missile-warning')).toBe('none');
    });
  });

  describe('flashWarning', () => {
    it.each([
      ['threat', undefined],
      ['threat', 'threat'],
      ['sys', 'sys'],
      ['ally', 'ally'],
    ] as const)('shows the text with the %s tone (argument %s)', (expectedTone, tone) => {
      hud.flashWarning('岩浆柱即将喷发！', tone);
      const flash = byId('hud-flash-warning');
      expect(isShown(flash)).toBe(true);
      expect(flash?.textContent).toContain('岩浆柱即将喷发！');
      expect(flash?.getAttribute('data-tone')).toBe(expectedTone);
    });

    it('expires through update(dt) and freezes without it', () => {
      vi.useFakeTimers();
      hud.flashWarning('冲击环！', 'threat');
      vi.advanceTimersByTime(60_000);
      expect(isShown(byId('hud-flash-warning'))).toBe(true);
      hud.update(0.5);
      expect(isShown(byId('hud-flash-warning'))).toBe(true);
      for (let elapsed = 0; elapsed < 6; elapsed += 0.1) {
        hud.update(0.1);
      }
      expect(isShown(byId('hud-flash-warning'))).toBe(false);
    });

    it('ignores an empty message', () => {
      hud.flashWarning('   ', 'sys');
      expect(isShown(byId('hud-flash-warning'))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 触控按键簇（index.html）
// ---------------------------------------------------------------------------

describe('HUD on the shipped touch deck (§9)', () => {
  let hud: HUD;

  beforeAll(() => {
    document.body.innerHTML = '';
    useViewport('touch');
    mountShippedMobileControls();
    hud = new HUD();
    hud.init();
  });

  afterAll(() => {
    hud.dispose();
    document.body.innerHTML = '';
    restoreEnvironment();
  });

  beforeEach(() => {
    resetCampaignPanels(hud);
  });

  it('writes the selected weapon onto #special-button', () => {
    hud.updateWeaponPanel(panelState());
    const special = byId('special-button');
    expect(special?.getAttribute('data-weapon')).toBe('RKT');
    expect(special?.getAttribute('data-ready')).toBe('true');
    expect(special?.textContent).toContain('RKT');

    hud.updateWeaponPanel(panelState({ visible: false }));
    expect(special?.getAttribute('data-weapon')).toBe('');
  });

  it('shows flare charges and missile alerts on #flare-button', () => {
    hud.updateFlares(2, 3, 0.5);
    const flare = byId('flare-button');
    expect(flare?.textContent).toContain('2');
    for (const level of ['locking', 'incoming', 'none'] as const) {
      hud.setMissileWarning(level);
      expect(flare?.getAttribute('data-alert')).toBe(level);
    }
  });

  it('marks the camera mode on #camera-button', () => {
    hud.setCameraMode('first-person');
    const camera = byId('camera-button');
    expect(camera?.getAttribute('data-camera-mode')).toBe('first-person');
    hud.setCameraMode('third-person');
    expect(camera?.getAttribute('data-camera-mode')).toBe('third-person');
  });

  it('uses the attribute values that the index.html styles key on', () => {
    const css = INDEX_HTML.replace(/"/g, "'");
    expect(css).toContain("#flare-button[data-alert='incoming']");
    expect(css).toContain("#flare-button[data-alert='locking']");
    expect(css).toContain("#camera-button[data-camera-mode='first-person']");
    expect(css).toContain("#special-button[data-weapon='']");
  });
});

describe('index.html mobile buttons (§9)', () => {
  it.each(MOBILE_BUTTON_IDS)('ships #%s as a button inside #mobile-controls', (id) => {
    const shipped = new DOMParser().parseFromString(INDEX_HTML, 'text/html');
    const button = shipped.getElementById(id);
    expect(button, `#${id}`).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.closest('#mobile-controls')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RadarMinimap
// ---------------------------------------------------------------------------

interface DrawOp {
  name: string;
  args: number[];
  fill: string;
  stroke: string;
}

interface RecordingContext {
  ctx: CanvasRenderingContext2D;
  ops: DrawOp[];
}

function createRecordingContext(canvas: HTMLCanvasElement): RecordingContext {
  const ops: DrawOp[] = [];
  const state: Record<string, unknown> = {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'start',
    globalAlpha: 1,
  };
  const ctx = new Proxy(state, {
    get(target, property) {
      if (typeof property !== 'string') {
        return undefined;
      }
      if (property in target) {
        return target[property];
      }
      return (...args: unknown[]) => {
        ops.push({
          name: property,
          args: args.filter((arg): arg is number => typeof arg === 'number'),
          fill: String(target.fillStyle),
          stroke: String(target.strokeStyle),
        });
      };
    },
    set(target, property, value) {
      if (typeof property === 'string') {
        target[property] = value;
      }
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const ORIGIN = new THREE.Vector3(0, 100, 0);
const FACING_NORTH = new THREE.Quaternion();
const AHEAD_200 = new THREE.Vector3(0, 100, -200);
const ALL_KINDS: readonly RadarBlipKind[] = [
  'enemy',
  'spawning',
  'ally',
  'boss',
  'pickup',
  'enemy-ground',
  'enemy-sea',
  'neutral',
  'ally-unit',
];

function paints(ops: readonly DrawOp[]): DrawOp[] {
  return ops.filter((op) => op.name === 'fill' || op.name === 'stroke');
}

function paintColors(ops: readonly DrawOp[]): Set<string> {
  return new Set(paints(ops).map((op) => (op.name === 'fill' ? op.fill : op.stroke)));
}

function signature(ops: readonly DrawOp[]): string {
  return ops
    .map((op) => {
      const style = op.name === 'fill' ? op.fill : op.name === 'stroke' ? op.stroke : '';
      return `${op.name}(${op.args.map((arg) => arg.toFixed(1)).join(',')})${style}`;
    })
    .join(';');
}

describe('RadarMinimap (§9)', () => {
  let radar: RadarMinimap;
  let recorder: RecordingContext | null = null;
  let backgroundOps = 0;

  /** 背景 + 玩家之后的绘制调用（量程倍率为 1 时末尾没有标签） */
  function drawBlip(kind: RadarBlipKind, position: THREE.Vector3 = AHEAD_200): DrawOp[] {
    const ops = recorder?.ops ?? [];
    ops.length = 0;
    radar.updateBlips(ORIGIN, [{ position, kind }], FACING_NORTH);
    return ops.slice(backgroundOps);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    useViewport('desktop');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      recorder = createRecordingContext(this);
      return recorder.ctx;
    } as unknown as HTMLCanvasElement['getContext']);
    radar = new RadarMinimap();
    const ops = recorder?.ops ?? [];
    ops.length = 0;
    radar.updateBlips(ORIGIN, [], FACING_NORTH);
    backgroundOps = ops.length;
  });

  afterEach(() => {
    radar.dispose();
    recorder = null;
    document.body.innerHTML = '';
    restoreEnvironment();
    vi.restoreAllMocks();
  });

  it('accepts the four new blip kinds', () => {
    expect(NEW_KINDS_ARE_RADAR_KINDS).toBe(true);
    expect(backgroundOps).toBeGreaterThan(0);
  });

  it.each(ALL_KINDS)('draws a visible %s blip', (kind) => {
    expect(paints(drawBlip(kind)).length, kind).toBeGreaterThan(0);
  });

  it('draws each new kind with its own symbol', () => {
    const kinds: RadarBlipKind[] = [
      'enemy',
      'ally',
      'enemy-ground',
      'enemy-sea',
      'neutral',
      'ally-unit',
    ];
    const signatures = kinds.map((kind) => signature(drawBlip(kind)));
    expect(new Set(signatures).size).toBe(kinds.length);
  });

  it('colours hostile units like enemies, allied units like allies, and civilians neutrally', () => {
    const enemyColors = paintColors(drawBlip('enemy'));
    const allyColors = paintColors(drawBlip('ally'));
    for (const kind of ['enemy-ground', 'enemy-sea'] as const) {
      for (const color of paintColors(drawBlip(kind))) {
        expect(enemyColors.has(color), `${kind} uses the hostile colour`).toBe(true);
      }
    }
    for (const color of paintColors(drawBlip('ally-unit'))) {
      expect(allyColors.has(color), 'ally-unit uses the friendly colour').toBe(true);
    }
    for (const color of paintColors(drawBlip('neutral'))) {
      expect(enemyColors.has(color), 'civilians must not look hostile').toBe(false);
      expect(allyColors.has(color), 'civilians must not look friendly').toBe(false);
    }
  });

  it('sets and reports the range multiplier, rejecting invalid values', () => {
    expect(radar.getRangeMultiplier()).toBe(1);
    radar.setRangeMultiplier(1.6);
    expect(radar.getRangeMultiplier()).toBeCloseTo(1.6, 5);
    for (const invalid of [Number.NaN, 0, -2, Number.POSITIVE_INFINITY]) {
      radar.setRangeMultiplier(1.6);
      radar.setRangeMultiplier(invalid);
      expect(radar.getRangeMultiplier(), `setRangeMultiplier(${invalid})`).toBe(1);
    }
    radar.setRangeMultiplier(100);
    expect(radar.getRangeMultiplier()).toBeGreaterThan(1);
    expect(radar.getRangeMultiplier()).toBeLessThanOrEqual(4);
    radar.setRangeMultiplier(0.01);
    expect(radar.getRangeMultiplier()).toBeGreaterThanOrEqual(0.25);
    expect(radar.getRangeMultiplier()).toBeLessThan(1);
  });

  it('draws a distant contact closer to the centre with a larger range multiplier', () => {
    const contact = new THREE.Vector3(0, 100, -500);
    const centreDistance = (ops: readonly DrawOp[]): number => {
      const arc = ops.find((op) => op.name === 'arc');
      expect(arc, 'blip arc').toBeDefined();
      const [x, y] = arc?.args ?? [0, 0];
      return Math.hypot(x - 60, y - 60);
    };
    const atBaseRange = centreDistance(drawBlip('enemy', contact));
    radar.setRangeMultiplier(2);
    const atDoubleRange = centreDistance(drawBlip('enemy', contact));
    expect(atDoubleRange).toBeLessThan(atBaseRange - 5);
  });
});
