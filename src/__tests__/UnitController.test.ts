import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DamageSource } from '@/core/CombatContracts';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { UnitController, type UnitControllerDeps } from '@/core/units/UnitController';
import {
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  type GenericRadioKey,
} from '@/features/campaign/CampaignData';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UnitType } from '@/features/units/UnitTypes';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD, type HudText, type HudWarningTone } from '@/ui/HUD';
import { LOCALES, expectBilingual, resetLocale, textIn } from './i18nTestUtils';

/**
 * UnitController 的友军 / 平民损失无线电（ALLY_LOSS_RADIO）：
 * 友军预警机 ALLY_AWACS → 'awacs-lost'，友军护卫舰 ALLY_FRIGATE → 'frigate-lost'（各由本机组播报），
 * 其余友军单位 → 'ally-unit-destroyed'，平民 → 'civilian-destroyed'；敌方单位被毁不播损失台词。
 */

const KILL = 1e6;
const LOSS_KEYS: readonly GenericRadioKey[] = [
  'awacs-lost',
  'frigate-lost',
  'ally-unit-destroyed',
  'civilian-destroyed',
];

type PresentationStub = {
  genericRadio: ReturnType<typeof vi.fn>;
  unitFirstContact: ReturnType<typeof vi.fn>;
  onUnitEvent: ReturnType<typeof vi.fn>;
  flashWarning: ReturnType<typeof vi.fn>;
  setMissileWarning: ReturnType<typeof vi.fn>;
};

/** 单位系统会调用的粒子特效：全部是空实现 */
function particleStub(): ParticleSystem {
  const stub = {
    createHit: vi.fn(),
    createExplosion: vi.fn(),
    createShockwave: vi.fn(),
    createWaterImpact: vi.fn(),
    createGroundImpact: vi.fn(),
    createMissileImpact: vi.fn(),
    createMissileTrail: vi.fn(),
    createTrail: vi.fn(),
    createDamageSmoke: vi.fn(),
    createSplash: vi.fn(),
    createMuzzleFlash: vi.fn(),
  };
  return stub as unknown as ParticleSystem;
}

describe('UnitController ally-loss radio (ALLY_LOSS_RADIO)', () => {
  let presentation: PresentationStub;
  let deps: UnitControllerDeps;
  let controller: UnitController;
  let system: UnitSystem;

  beforeEach(async () => {
    presentation = {
      genericRadio: vi.fn(),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      flashWarning: vi.fn(),
      setMissileWarning: vi.fn(),
    };
    deps = {
      scene: new THREE.Scene(),
      presentation: presentation as unknown as ICampaignPresentation,
      awardKill: vi.fn(),
      applyPenalty: vi.fn(),
      onAssetLost: vi.fn(),
      damagePlayer: vi.fn(),
      onExplosion: vi.fn(),
      onEscortResult: vi.fn(),
    };
    controller = new UnitController(deps);
    system = await controller.ensureLoaded(particleStub());
  });

  afterEach(() => {
    controller.dispose();
    resetLocale();
  });

  function spawn(type: UnitType): UnitInstance {
    const domain = UNIT_CONFIGS[type].domain;
    const unit = system.spawnUnit(type, new THREE.Vector3(0, domain === 'air' ? 300 : 0, 0));
    expect(unit, `spawnUnit(${type})`).not.toBeNull();
    return unit as UnitInstance;
  }

  function destroy(type: UnitType, source: DamageSource = 'enemy-fire'): UnitInstance {
    const unit = spawn(type);
    presentation.genericRadio.mockClear();
    unit.applyDamage(KILL, source);
    expect(unit.isAlive(), `${type} should be destroyed`).toBe(false);
    return unit;
  }

  function lossRadio(): GenericRadioKey[] {
    return presentation.genericRadio.mock.calls
      .map(([key]) => key as GenericRadioKey)
      .filter((key) => LOSS_KEYS.includes(key));
  }

  it.each([
    [UnitType.ALLY_AWACS, 'awacs-lost'],
    [UnitType.ALLY_FRIGATE, 'frigate-lost'],
  ] as const)('reports the loss of %s with the %s line', (type, key) => {
    destroy(type);
    expect(lossRadio()).toEqual([key]);
    expect(deps.onAssetLost).toHaveBeenCalledWith(false);
  });

  it.each([UnitType.ALLY_CONVOY, UnitType.ALLY_TRANSPORT])(
    'falls back to ally-unit-destroyed for %s',
    (type) => {
      destroy(type);
      expect(lossRadio()).toEqual(['ally-unit-destroyed']);
      expect(deps.onAssetLost).toHaveBeenCalledWith(false);
    }
  );

  it.each([UnitType.CIVILIAN_AIRLINER, UnitType.CIVILIAN_SHIP, UnitType.CIVILIAN_TRUCK])(
    'reports civilian-destroyed for %s',
    (type) => {
      destroy(type);
      expect(lossRadio()).toEqual(['civilian-destroyed']);
      expect(deps.onAssetLost).toHaveBeenCalledWith(true);
    }
  );

  it('plays no loss line when the player destroys a hostile unit', () => {
    destroy(UnitType.TANK, 'missile');
    expect(lossRadio()).toEqual([]);
    expect(deps.onAssetLost).not.toHaveBeenCalled();
    expect(deps.awardKill).toHaveBeenCalledTimes(1);
  });

  it('voices the AWACS and frigate losses with their own crews', () => {
    expect(GENERIC_RADIO['awacs-lost'].speaker).toBe('awacs');
    expect(GENERIC_RADIO['frigate-lost'].speaker).toBe('frigate');
    for (const key of ['awacs-lost', 'frigate-lost'] as const) {
      const line = GENERIC_RADIO[key];
      expect(CAMPAIGN_SPEAKERS[line.speaker], key).toBeDefined();
      expectBilingual(line.text, key);
      expect(line.text.en).not.toBe(GENERIC_RADIO['ally-unit-destroyed'].text.en);
    }
  });

  it.each(LOCALES)(
    'names a friendly the player destroyed in the interface language (%s)',
    (locale) => {
      setLocale(locale);
      destroy(UnitType.ALLY_AWACS, 'missile');
      const config = UNIT_CONFIGS[UnitType.ALLY_AWACS];
      expect(deps.applyPenalty).toHaveBeenCalledWith(
        config.penalty,
        textIn(config.name, locale),
        false
      );
      expect(lossRadio()).toEqual(['awacs-lost']);
    }
  );
});

/**
 * 紧急告警配音配额（终验修复 F2）：地空导弹发射的配音每波（每场 Boss 战）最多两次，
 * 第二次至少隔 20 秒；只有真的进了无线电（genericRadio 返回 true）才计数；HUD 闪烁告警每次发射
 * 都有；新的一波（spawnForWave）与 Boss 战开始（clear）重新计数。误伤平民同样每波最多两次配音。
 */
describe('UnitController urgent-warning radio budget', () => {
  type BudgetPresentationStub = PresentationStub & {
    setRadarRangeMultiplier: ReturnType<typeof vi.fn>;
  };
  let presentation: BudgetPresentationStub;
  let controller: UnitController;
  let system: UnitSystem;
  let radioAccepts: boolean;
  const playerMesh = new THREE.Object3D();
  const playerPosition = new THREE.Vector3(0, 300, 0);
  const sam = {} as UnitInstance;

  beforeEach(async () => {
    radioAccepts = true;
    presentation = {
      genericRadio: vi.fn(() => radioAccepts),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      flashWarning: vi.fn(),
      setMissileWarning: vi.fn(),
      setRadarRangeMultiplier: vi.fn(),
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
    resetLocale();
  });

  function advance(seconds: number, dt = 0.1): void {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
      controller.update(dt, playerMesh, playerPosition, [], [], false);
    }
  }

  function missileLaunch(): void {
    system.onLockWarning?.(sam, 'launched');
  }

  function voiced(key: GenericRadioKey): number {
    return presentation.genericRadio.mock.calls.filter(([called]) => called === key).length;
  }

  function accepted(key: GenericRadioKey): number {
    return presentation.genericRadio.mock.calls.filter(
      ([called], index) =>
        called === key && presentation.genericRadio.mock.results[index]?.value === true
    ).length;
  }

  it('flashes the HUD warning on every launch but voices at most two per wave, 20 s apart', () => {
    missileLaunch();
    expect(accepted('missile-warning')).toBe(1);

    advance(10);
    missileLaunch();
    expect(accepted('missile-warning'), 'second warning inside the 20 s cooldown').toBe(1);

    advance(10.5);
    missileLaunch();
    expect(accepted('missile-warning'), 'second warning after 20 s').toBe(2);

    for (let i = 0; i < 4; i++) {
      advance(60);
      missileLaunch();
    }
    expect(accepted('missile-warning'), 'never a third in the same wave').toBe(2);
    expect(presentation.flashWarning).toHaveBeenCalledTimes(7);
    for (const [, tone] of presentation.flashWarning.mock.calls) {
      expect(tone).toBe('threat');
    }
  });

  it('only counts a warning that actually went on the radio', () => {
    // 正在配音的台词期间告警被跳过（genericRadio 返回 false）：不占配额、不进冷却
    radioAccepts = false;
    missileLaunch();
    missileLaunch();
    expect(accepted('missile-warning')).toBe(0);

    radioAccepts = true;
    missileLaunch();
    expect(accepted('missile-warning')).toBe(1);
    advance(20.5);
    missileLaunch();
    expect(accepted('missile-warning')).toBe(2);
  });

  it('starts counting again at the next wave and at a boss fight', () => {
    missileLaunch();
    advance(21);
    missileLaunch();
    missileLaunch();
    expect(accepted('missile-warning')).toBe(2);

    controller.spawnForWave(1, 1, playerPosition);
    missileLaunch();
    expect(accepted('missile-warning'), 'new wave').toBe(3);

    advance(21);
    missileLaunch();
    expect(accepted('missile-warning')).toBe(4);
    missileLaunch();
    expect(accepted('missile-warning')).toBe(4);

    // Boss 战开始：协调器清场（clear）
    controller.clear();
    missileLaunch();
    expect(accepted('missile-warning'), 'boss fight').toBe(5);
  });

  it('voices civilian hits at most twice per wave, with the cease-fire warning every time', () => {
    for (let i = 0; i < 6; i++) {
      system.onCivilianHit?.(sam);
      advance(40);
    }
    expect(voiced('civilian-hit')).toBeLessThanOrEqual(2);
    expect(accepted('civilian-hit')).toBe(2);
    expect(presentation.flashWarning).toHaveBeenCalledTimes(6);

    controller.spawnForWave(1, 2, playerPosition);
    system.onCivilianHit?.(sam);
    expect(accepted('civilian-hit')).toBe(3);
  });
});

/**
 * 打磨批次 Q：单位告警（导弹来袭、误伤平民停火、残余目标脱离战区）把双语原文交给 flashWarning，
 * 告警显示期间切换语言随之重绘（不再是发出时按当时语言取好的字符串）。
 */
describe('UnitController warnings relabel on a language switch', () => {
  let hud: HUD;
  let flashWarning: ReturnType<typeof vi.fn>;
  let controller: UnitController;
  let system: UnitSystem;
  const playerMesh = new THREE.Object3D();
  const playerPosition = new THREE.Vector3(0, 300, 0);
  const sam = {} as UnitInstance;

  beforeEach(async () => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    // 与协调器的表现层一样：告警交给 HUD.flashWarning
    flashWarning = vi.fn((text: HudText, tone: HudWarningTone) => hud.flashWarning(text, tone));
    const presentation = {
      genericRadio: vi.fn(() => true),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      flashWarning,
      setMissileWarning: vi.fn(),
      setRadarRangeMultiplier: vi.fn(),
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
    resetLocale();
    document.body.innerHTML = '';
  });

  const flashText = (): string => document.getElementById('hud-flash-warning')?.textContent ?? '';

  /** 唯一一次告警：传的是双语原文，HUD 上按当前语言显示并随切换重绘 */
  function expectRelabelledWarning(tone: HudWarningTone): void {
    expect(flashWarning).toHaveBeenCalledTimes(1);
    const [text, calledTone] = flashWarning.mock.calls[0] as [HudText, HudWarningTone];
    expect(calledTone).toBe(tone);
    expect(typeof text, 'a bilingual value, not a string resolved at call time').not.toBe('string');
    const bilingual = text as LocalizedText;
    expectBilingual(bilingual, 'warning');
    expect(bilingual.zh).not.toBe(bilingual.en);

    expect(flashText()).toContain(bilingual.en);
    setLocale('zh-CN');
    expect(flashText()).toContain(bilingual.zh);
    expect(flashText()).not.toContain(bilingual.en);
    setLocale('en');
    expect(flashText()).toContain(bilingual.en);
  }

  it('missile inbound', () => {
    system.onLockWarning?.(sam, 'launched');
    expectRelabelledWarning('threat');
  });

  it('civilian hit (cease fire)', () => {
    system.onCivilianHit?.(sam);
    expectRelabelledWarning('threat');
  });

  it('remaining targets have left the area', () => {
    // 敌机已清空，远处一座敌方雷达站拖住波次：防卡关放行时告警
    expect(system.spawnUnit(UnitType.RADAR_STATION, new THREE.Vector3(30000, 0, 30000))).not.toBe(
      null
    );
    for (let elapsed = 0; elapsed < 200 && flashWarning.mock.calls.length === 0; elapsed += 1) {
      controller.update(1, playerMesh, playerPosition, [], [], true);
    }
    expect(controller.getWaveHoldCount(), 'the wave is released').toBe(0);
    expectRelabelledWarning('sys');
  });
});
