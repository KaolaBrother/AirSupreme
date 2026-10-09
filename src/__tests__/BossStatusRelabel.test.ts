import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type { MusicSystem } from '@/core/Audio/MusicSystem';
import {
  AdvancedBossController,
  type AdvancedBossControllerDeps,
  type AdvancedBossInstance,
} from '@/core/boss/AdvancedBossController';
import { DefaultCampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { BOSS_CONFIGS, BossType, getBossForLevel } from '@/features/boss/BossTypes';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD, type HudText } from '@/ui/HUD';
import { resetLocale } from './i18nTestUtils';

/**
 * 打磨批次 P：第 6-10 关 Boss 的状态条在切换语言时立即重推（暂停中逐帧推送停着也一样）；
 * Boss 的阶段 / 特殊武器预警标签以 HudText（双语原文）一路交到 HUD，显示期间切换语言随之重绘。
 */

type Stub = Record<string, unknown>;

/** 任意方法都是 vi.fn() 的替身；overrides 里的字段优先 */
function autoStub(overrides: Stub = {}): Stub {
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(overrides, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      if (key === 'then') return undefined;
      let method = methods.get(key);
      if (!method) {
        method = vi.fn();
        methods.set(key, method);
      }
      return method;
    },
  });
}

const ADVANCED_LEVELS = [6, 7, 8, 9, 10] as const;

interface Rig {
  controller: AdvancedBossController;
  presentation: {
    setBossStatus: ReturnType<typeof vi.fn>;
    flashWarning: ReturnType<typeof vi.fn>;
    onBossPhaseChange: ReturnType<typeof vi.fn>;
  };
  boss: AdvancedBossInstance;
}

describe('bosses 6-10: localizable status and warnings', () => {
  let canvasSpy: { mockRestore(): void } | null = null;
  const rigs: Rig[] = [];

  beforeEach(() => {
    canvasSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    for (const rig of rigs.splice(0)) {
      rig.controller.reset();
      rig.boss.dispose();
    }
    canvasSpy?.mockRestore();
    canvasSpy = null;
    resetLocale();
    document.body.innerHTML = '';
  });

  async function createRig(level: number): Promise<Rig> {
    const type = getBossForLevel(level) as BossType;
    const water = type === BossType.ABYSSAL_LEVIATHAN;
    const scene = new THREE.Scene();
    const playerAircraft = new THREE.Group();
    playerAircraft.position.set(0, 150, 0);
    scene.add(playerAircraft);
    const presentation = {
      setBossStatus: vi.fn(),
      flashWarning: vi.fn(),
      onBossPhaseChange: vi.fn(),
    };
    const deps = {
      scene,
      particleSystem: autoStub(),
      combatSystem: autoStub(),
      enemySystem: autoStub({ getFriendlyAIs: () => [] }),
      playerSystem: autoStub(),
      playerAircraft,
      audioManager: autoStub(),
      presentation: autoStub(presentation),
      feedback: autoStub(),
      getSurfaceSample: () => (water ? { y: -48, water: true } : { y: 0, water: false }),
      getTerrainEnvironment: () => null,
      getDecoys: () => [],
      onSpawnMinion: vi.fn(),
      onCameraShake: vi.fn(),
      onExplosionShake: vi.fn(),
      onScreenFlash: vi.fn(),
      getLevel: () => level,
      announceLastWords: vi.fn(),
      onBossDestroyed: vi.fn(),
    } as unknown as AdvancedBossControllerDeps;
    const controller = new AdvancedBossController(deps);
    const boss = await controller.create(type, BOSS_CONFIGS[type], false);
    controller.activate(boss);
    const rig = { controller, presentation, boss };
    rigs.push(rig);
    return rig;
  }

  describe('the status label is re-pushed on a language switch', () => {
    it.each(ADVANCED_LEVELS)('level %i boss', async (level) => {
      const { presentation, boss } = await createRig(level);
      presentation.setBossStatus.mockClear();

      setLocale('zh-CN');
      expect(presentation.setBossStatus).toHaveBeenCalledTimes(1);
      const [zhLabel, zhPhase] = presentation.setBossStatus.mock.calls[0];
      expect(zhLabel).toBe(boss.getStatusLabel());
      expect(zhPhase).toEqual({ current: boss.getPhase(), total: boss.getPhaseCount() });

      setLocale('en');
      expect(presentation.setBossStatus).toHaveBeenCalledTimes(2);
      const [enLabel] = presentation.setBossStatus.mock.calls[1];
      expect(enLabel).toBe(boss.getStatusLabel());
      if (typeof zhLabel === 'string' && typeof enLabel === 'string') {
        expect(enLabel, 'the label is in the new language').not.toBe(zhLabel);
      }
    });

    it('stops re-pushing once the boss is cleared', async () => {
      const { controller, presentation } = await createRig(6);
      controller.reset();
      presentation.setBossStatus.mockClear();
      setLocale('zh-CN');
      setLocale('en');
      expect(presentation.setBossStatus).not.toHaveBeenCalled();
    });

    it('at least one boss shows a status label at spawn (so the language check bites)', async () => {
      const labels: Array<string | null> = [];
      for (const level of ADVANCED_LEVELS) {
        labels.push((await createRig(level)).boss.getStatusLabel());
      }
      expect(labels.some((label) => typeof label === 'string' && label.length > 0)).toBe(true);
    });
  });

  describe('phase and hazard labels reach the presentation as HudText', () => {
    it.each(ADVANCED_LEVELS)(
      'level %i boss: the controller forwards them unchanged',
      async (level) => {
        const { presentation, boss } = await createRig(level);
        const hazard: LocalizedText = { en: 'Arc charging', zh: '电弧充能' };
        const phase: HudText = { text: { en: 'Phase {n}', zh: '第{n}阶段' }, params: { n: 2 } };

        boss.onHazardWarning?.(hazard);
        expect(presentation.flashWarning).toHaveBeenCalledWith(hazard, 'threat');
        boss.onPhaseChange?.(2, phase);
        expect(presentation.onBossPhaseChange).toHaveBeenCalledWith(level, 2, phase);
      }
    );
  });
});

describe('DefaultCampaignPresentation hands HudText to the HUD', () => {
  let hud: HUD;
  let presentation: DefaultCampaignPresentation;

  beforeEach(() => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
    presentation = new DefaultCampaignPresentation({
      getHud: () => hud,
      getRadar: () => null,
      audio: autoStub() as unknown as AudioManager,
      music: autoStub() as unknown as MusicSystem,
      isBossMode: () => true,
      getListenerPosition: () => null,
      loadStoryUi: () => new Promise(() => undefined),
    });
  });

  afterEach(() => {
    presentation.dispose();
    hud.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  const flash = (): string => document.getElementById('hud-flash-warning')?.textContent ?? '';
  const status = (): string => document.getElementById('hud-boss-status')?.textContent ?? '';

  it('a hazard warning switches language while it is up', () => {
    presentation.flashWarning({ en: 'Lava beam charging', zh: '熔岩光束充能' }, 'threat');
    expect(flash()).toContain('Lava beam charging');
    setLocale('zh-CN');
    expect(flash()).toContain('熔岩光束充能');
  });

  it('a phase-change label switches language while it is up', () => {
    presentation.onBossPhaseChange(10, 2, {
      en: 'Shield down · Core exposed',
      zh: '护盾崩溃 · 核心暴露',
    });
    expect(flash()).toContain('Shield down · Core exposed');
    setLocale('zh-CN');
    expect(flash()).toContain('护盾崩溃 · 核心暴露');
  });

  it('a bilingual boss status switches language while it is up', () => {
    presentation.setBossStatus({ en: 'Vents exposed', zh: '散热口暴露' }, { current: 2, total: 3 });
    expect(status()).toContain('Vents exposed');
    setLocale('zh-CN');
    expect(status()).toContain('散热口暴露');
  });
});
