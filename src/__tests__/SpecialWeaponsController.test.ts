import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { SpecialWeaponsController } from '@/core/combat/SpecialWeaponsController';
import type { InputState } from '@/core/Input/InputHandler';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { SPECIAL_WEAPON_CONFIGS } from '@/features/weapons/WeaponTypes';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD, type HudText } from '@/ui/HUD';
import { expectBilingual, resetLocale } from './i18nTestUtils';

/**
 * 打磨批次 Q：SpecialWeaponsDeps.notify(icon, text: HudText) 收到双语原文（尚无特殊武器、
 * 武器尚未解锁、切换武器时配置里的双语武器名），交给 HUD 中央大字提示后显示期间切换语言随之重绘。
 */

const IDLE: InputState = {
  pitchUp: false,
  pitchDown: false,
  yawLeft: false,
  yawRight: false,
  rollLeft: false,
  rollRight: false,
  fire: false,
  missile: false,
  throttle: false,
  special: false,
};

/** 任意方法都是 vi.fn() 的替身 */
function autoStub<T>(): T {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') return undefined;
        let method = methods.get(key);
        if (!method) {
          method = vi.fn();
          methods.set(key, method);
        }
        return method;
      },
    }
  ) as T;
}

describe('SpecialWeaponsController.notify hands HudText to the centre callout', () => {
  let hud: HUD;
  let notify: ReturnType<typeof vi.fn>;
  let controller: SpecialWeaponsController;
  const aircraft = new THREE.Object3D();

  beforeEach(async () => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    // 与协调器一样：notify → HUD.showPowerUpBig(icon, text, 0.9, true)
    notify = vi.fn((icon: string, text: HudText) => hud.showPowerUpBig(icon, text, 0.9, true));
    controller = new SpecialWeaponsController({
      scene: new THREE.Scene(),
      presentation: autoStub<ICampaignPresentation>(),
      collectTargets: vi.fn(),
      onEmpPulse: vi.fn(),
      onFired: vi.fn(),
      onImpact: vi.fn(),
      notify,
    });
    await controller.ensureLoaded(autoStub<ParticleSystem>());
  });

  afterEach(() => {
    controller.dispose();
    hud.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  function unlock(ids: SpecialWeaponId[]): void {
    const stats = {
      getWeaponUpgradeLevel: () => 0,
      getFlareCapacity: () => 2,
    } as unknown as PlayerStats;
    controller.syncProgression(stats, ids);
  }

  const callout = (): string => document.getElementById('hud-callout')?.textContent ?? '';

  /** 最近一次提示：双语原文（不是按当时语言取好的字符串），HUD 上随语言切换重绘 */
  function expectRelabelledNotice(expected: LocalizedText): void {
    expect(notify).toHaveBeenCalled();
    const [, text] = notify.mock.calls[notify.mock.calls.length - 1] as [string, HudText];
    expect(typeof text, 'a bilingual value, not a string resolved at call time').not.toBe('string');
    expect(text).toEqual(expected);
    expectBilingual(expected, 'notice');

    expect(callout()).toContain(expected.en);
    setLocale('zh-CN');
    expect(callout()).toContain(expected.zh);
    expect(callout()).not.toContain(expected.en);
    setLocale('en');
    expect(callout()).toContain(expected.en);
  }

  it('"no special weapons yet" when cycling with nothing unlocked', () => {
    unlock([]);
    controller.handleInput(IDLE, true, -1, false, aircraft, true);
    expectRelabelledNotice({ en: 'No special weapons yet', zh: '尚无特殊武器' });
  });

  it('"weapon not unlocked yet" for a locked slot', () => {
    unlock(['rockets']);
    controller.handleInput(IDLE, false, SPECIAL_WEAPON_IDS.indexOf('emp'), false, aircraft, true);
    expectRelabelledNotice({ en: 'Weapon not unlocked yet', zh: '武器尚未解锁' });
  });

  it.each<SpecialWeaponId>(['laser', 'swarm', 'railgun', 'emp'])(
    'switching to %s announces the bilingual name from the weapon config',
    (id) => {
      unlock([...SPECIAL_WEAPON_IDS]);
      expect(controller.getSelected()).toBe(SPECIAL_WEAPON_IDS[0]);
      controller.handleInput(IDLE, false, SPECIAL_WEAPON_IDS.indexOf(id), false, aircraft, true);
      expect(controller.getSelected()).toBe(id);
      expect(notify.mock.calls[notify.mock.calls.length - 1][0]).toBe(
        SPECIAL_WEAPON_CONFIGS[id].icon
      );
      expectRelabelledNotice(SPECIAL_WEAPON_CONFIGS[id].name);
    }
  );

  it('cycling announces the next weapon by its bilingual name', () => {
    unlock(['rockets', 'swarm']);
    controller.handleInput(IDLE, true, -1, false, aircraft, true);
    expect(controller.getSelected()).toBe('swarm');
    expectRelabelledNotice(SPECIAL_WEAPON_CONFIGS.swarm.name);
  });
});
