import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { UnitController } from '@/core/units/UnitController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import { setLocale, type Locale } from '@/i18n';
import { HUD, type HudText, type HudWarningTone } from '@/ui/HUD';
import { resetLocale } from './i18nTestUtils';

/**
 * 导弹来袭的 HUD 闪烁告警怎么写（UnitController，地空导弹发射时）：
 * - 触屏设备（GameConfig.isMobile）没有键盘：指向屏幕上的热焰键——
 *   “Missile inbound · Tap FLARE” / “导弹来袭 · 点「热焰」键”，不提任何键盘按键；
 * - 桌面保持原样：“Missile inbound · Press G for flares” / “导弹来袭 · 按 G 投放热焰弹”。
 *
 * 文案取自规格，不从被测代码里读。告警经表现层交给真实的 HUD（与 CampaignPresentation.flashWarning
 * 的转发一致），断言玩家在屏幕上读到的那一行。
 */

type Device = 'touch' | 'desktop';

const EXPECTED: Record<Device, Record<Locale, string>> = {
  touch: {
    en: 'Missile inbound · Tap FLARE',
    'zh-CN': '导弹来袭 · 点「热焰」键',
  },
  desktop: {
    en: 'Missile inbound · Press G for flares',
    'zh-CN': '导弹来袭 · 按 G 投放热焰弹',
  },
};

const DEVICES: readonly Device[] = ['touch', 'desktop'];
const LANGUAGES: readonly Locale[] = ['en', 'zh-CN'];
const CASES = DEVICES.flatMap((device) =>
  LANGUAGES.map((locale): [Device, Locale] => [device, locale])
);

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 单位系统只在爆炸 / 尾迹时用到粒子系统：任何方法都给一个空函数 */
function particleStub(): ParticleSystem {
  const calls = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === 'then') return undefined;
        if (!calls.has(property)) calls.set(property, vi.fn());
        return calls.get(property);
      },
    }
  ) as unknown as ParticleSystem;
}

describe('missile inbound warning wording', () => {
  let originalIsMobile: boolean;
  let hud: HUD;
  let controller: UnitController;
  let system: UnitSystem;
  let flashed: Array<{ text: HudText; tone: HudWarningTone }>;
  const sam = {} as UnitInstance;

  beforeEach(async () => {
    originalIsMobile = GameConfig.isMobile;
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    flashed = [];
    const presentation = {
      genericRadio: vi.fn(() => true),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      setMissileWarning: vi.fn(),
      setRadarRangeMultiplier: vi.fn(),
      // 与 CampaignPresentation.flashWarning 一样：原样交给 HUD
      flashWarning: (text: HudText, tone: HudWarningTone): void => {
        flashed.push({ text, tone });
        hud.flashWarning(text, tone);
      },
    };
    controller = new UnitController({
      scene: new THREE.Scene(),
      presentation: presentation as unknown as ICampaignPresentation,
      awardKill: vi.fn(),
      applyPenalty: vi.fn(),
      onAssetLost: vi.fn(),
      damagePlayer: vi.fn(),
      onExplosion: vi.fn(),
      onEscortResult: vi.fn(),
    });
    system = await controller.ensureLoaded(particleStub());
  });

  afterEach(() => {
    controller.dispose();
    hud.dispose();
    GameConfig.isMobile = originalIsMobile;
    resetLocale();
    document.body.innerHTML = '';
  });

  function useDevice(device: Device): void {
    GameConfig.isMobile = device === 'touch';
  }

  /** 一枚地空导弹发射 */
  function launchMissile(): void {
    expect(system.onLockWarning, 'the controller should listen for lock warnings').toBeTypeOf(
      'function'
    );
    system.onLockWarning?.(sam, 'launched');
  }

  /** 屏幕上的闪烁告警现在写着什么（没有显示时为 null） */
  function warningOnScreen(): string | null {
    const row = document.getElementById('hud-flash-warning');
    if (!row || row.style.display === 'none') return null;
    return (row.textContent ?? '').trim();
  }

  it('shows nothing until a missile is launched', () => {
    useDevice('touch');

    expect(warningOnScreen()).toBeNull();
    system.onLockWarning?.(sam, 'locking');
    expect(warningOnScreen()).toBeNull();
  });

  it.each(CASES)('reads as specified on a %s device in %s', (device, locale) => {
    useDevice(device);
    setLocale(locale);

    launchMissile();

    expect(warningOnScreen()).toBe(EXPECTED[device][locale]);
    // 威胁色的一条告警
    expect(flashed).toHaveLength(1);
    expect(flashed[0].tone).toBe('threat');
    expect(document.getElementById('hud-flash-warning')?.getAttribute('data-tone')).toBe('threat');
  });

  it.each(LANGUAGES)('names no keyboard key on a touch device (%s)', (locale) => {
    useDevice('touch');
    setLocale(locale);

    launchMissile();

    const text = warningOnScreen() ?? '';
    expect(text.length).toBeGreaterThan(0);
    // 没有单独成词的按键字母（G），也没有“按下某键”的说法
    expect(text).not.toMatch(/(^|[^A-Za-z])[A-Za-z]([^A-Za-z]|$)/);
    expect(text).not.toMatch(/press|keyboard|\bkey\b/i);
    expect(text).not.toMatch(/按\s*[A-Za-z]/);
    expect(text).not.toMatch(/键盘/);
    // 让玩家去点屏幕
    expect(text).toMatch(locale === 'en' ? /\btap\b/i : /点/);
  });

  it.each(LANGUAGES)('still names the G key on a desktop (%s)', (locale) => {
    useDevice('desktop');
    setLocale(locale);

    launchMissile();

    const text = warningOnScreen() ?? '';
    expect(text).toMatch(/(^|[^A-Za-z])G([^A-Za-z]|$)/);
    expect(text).not.toMatch(/\btap\b/i);
    expect(text).not.toMatch(/点/);
  });

  it.each(DEVICES)('says the same thing on every launch on a %s device', (device) => {
    useDevice(device);

    launchMissile();
    const first = warningOnScreen();
    hud.update(3);
    expect(warningOnScreen()).toBeNull();
    launchMissile();

    expect(first).toBe(EXPECTED[device].en);
    expect(warningOnScreen()).toBe(EXPECTED[device].en);
  });

  it.each(DEVICES)(
    'follows the language while it is on screen, keeping the %s wording',
    (device) => {
      useDevice(device);
      setLocale('en');
      launchMissile();
      expect(warningOnScreen()).toBe(EXPECTED[device].en);

      setLocale('zh-CN');
      expect(warningOnScreen()).toBe(EXPECTED[device]['zh-CN']);

      setLocale('en');
      expect(warningOnScreen()).toBe(EXPECTED[device].en);
    }
  );

  it('goes by the device at the moment of the launch', () => {
    useDevice('desktop');
    launchMissile();
    expect(warningOnScreen()).toBe(EXPECTED.desktop.en);

    useDevice('touch');
    launchMissile();
    expect(warningOnScreen()).toBe(EXPECTED.touch.en);

    useDevice('desktop');
    launchMissile();
    expect(warningOnScreen()).toBe(EXPECTED.desktop.en);
  });

  it('uses different wording for the two devices in both languages', () => {
    for (const locale of LANGUAGES) {
      expect(EXPECTED.touch[locale]).not.toBe(EXPECTED.desktop[locale]);
    }
    const seen = new Set<string>();
    for (const [device, locale] of CASES) {
      useDevice(device);
      setLocale(locale);
      launchMissile();
      seen.add(warningOnScreen() ?? '');
    }

    expect(seen.size).toBe(CASES.length);
  });

  it('calls the on-screen button what its face says', () => {
    // 触控热焰键键面上的字由 main.ts 的 localizeShell 写入
    const mainSource = readFileSync(path.join(PROJECT_ROOT, 'src/main.ts'), 'utf8');
    const face = mainSource.match(
      /'#flare-button \.tc-main',\s*tr\(\{\s*en:\s*'([^']+)',\s*zh:\s*'([^']+)'\s*\}\)/
    );
    expect(face, 'expected the flare button face text in src/main.ts').not.toBeNull();
    const [, faceEn, faceZh] = face as RegExpMatchArray;

    useDevice('touch');
    setLocale('en');
    launchMissile();
    expect(warningOnScreen()).toContain(faceEn);

    setLocale('zh-CN');
    expect(warningOnScreen()).toContain(faceZh);
  });
});
