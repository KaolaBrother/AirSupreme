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
import { setLocale } from '@/i18n';
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
