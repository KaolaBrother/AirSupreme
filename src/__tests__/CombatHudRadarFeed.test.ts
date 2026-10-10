import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDifficultyProfile } from '@/core/Difficulty';
import type { GameSessionState } from '@/core/GameSessionState';
import type { PresentationController, RadarBlip } from '@/core/PresentationController';
import type { ICampaignPresentation } from '@/core/campaign/CampaignPresentation';
import { CombatHudFeed } from '@/core/hud/CombatHudFeed';
import { UnitController, type UnitSurfaceSampler } from '@/core/units/UnitController';
import type { ParticleSystem } from '@/features/effects/ParticleSystem';
import type { UnitInstance, UnitSystem } from '@/features/units/UnitSystem';
import { UNIT_CONFIGS, UnitType } from '@/features/units/UnitTypes';
import { RadarMinimap, type RadarTerrainSampler } from '@/ui/RadarMinimap';
import { installCanvasRecording, type CanvasRecording } from './canvasRecorder';
import { resetLocale } from './i18nTestUtils';

/**
 * 战斗 HUD 馈送的雷达部分（规格 M7 的接线）：CombatHudFeed.updateRadar 每次刷新把单位系统的
 * 地表采样器与关卡号交给表现层（setRadarTerrainSource → RadarMinimap.setTerrainSource），
 * 展开的关卡地图用它画底图；换关后收起地图。单位也作为雷达目标喂进去，敌方地面 / 舰船、
 * 友军、平民各是不同的种类。
 */

/** 雷达刷新间隔（20 Hz）略放宽 */
const REFRESH_SECONDS = 0.06;
const PLAYER = new THREE.Vector3(0, 300, 0);

function particleStub(): ParticleSystem {
  const noop = (): void => undefined;
  return new Proxy(
    {},
    { get: (_target, property) => (property === 'then' ? undefined : noop) }
  ) as unknown as ParticleSystem;
}

interface FedRadar {
  position: THREE.Vector3;
  blips: Array<{ position: THREE.Vector3; kind: RadarBlip['kind'] }>;
}

describe('CombatHudFeed radar feed', () => {
  let controller: UnitController;
  let system: UnitSystem;
  let feed: CombatHudFeed;
  let terrainCalls: Array<[RadarTerrainSampler | null, number]>;
  let radarCalls: FedRadar[];
  /** 接在馈送后面的真实雷达（需要时才建） */
  let radar: RadarMinimap | null;
  let recording: CanvasRecording | null;
  let now: number;

  beforeEach(async () => {
    document.body.innerHTML = '';
    now = 50_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    terrainCalls = [];
    radarCalls = [];
    radar = null;
    recording = null;

    const unitPresentation = {
      genericRadio: vi.fn(() => true),
      unitFirstContact: vi.fn(),
      onUnitEvent: vi.fn(),
      flashWarning: vi.fn(),
      setMissileWarning: vi.fn(),
      setRadarRangeMultiplier: vi.fn(),
    };
    controller = new UnitController({
      scene: new THREE.Scene(),
      presentation: unitPresentation as unknown as ICampaignPresentation,
      awardKill: vi.fn(),
      applyPenalty: vi.fn(),
      onAssetLost: vi.fn(),
      damagePlayer: vi.fn(),
      onExplosion: vi.fn(),
      onEscortResult: vi.fn(),
    });
    system = await controller.ensureLoaded(particleStub());

    // 表现层替身：记下收到的东西；接了真实雷达时原样转交（与 PresentationController 一样）
    const presentation = {
      setRadarTerrainSource(sampler: RadarTerrainSampler | null, level: number): void {
        terrainCalls.push([sampler, level]);
        radar?.setTerrainSource(sampler, level);
      },
      updateRadar(position: THREE.Vector3, blips: RadarBlip[], rotation: THREE.Quaternion): void {
        radarCalls.push({
          position: position.clone(),
          blips: blips.map((blip) => ({ position: blip.position.clone(), kind: blip.kind })),
        });
        radar?.updateBlips(position, blips, rotation);
      },
    };
    const session = { isBossMode: () => false, isInBossBattle: () => false };
    feed = new CombatHudFeed({
      session: session as unknown as GameSessionState,
      units: controller,
      camera: new THREE.PerspectiveCamera(),
      getEnemySystem: () => null,
      getBossController: () => null,
      getPresentationController: () => presentation as unknown as PresentationController,
      getPlayerPosition: () => PLAYER,
      getPlayerQuaternion: () => new THREE.Quaternion(),
    });
  });

  afterEach(() => {
    radar?.dispose();
    recording?.restore();
    controller.dispose();
    vi.restoreAllMocks();
    resetLocale();
    document.body.innerHTML = '';
  });

  function refresh(times = 1): void {
    for (let i = 0; i < times; i++) {
      now += REFRESH_SECONDS * 1000;
      feed.updateRadar(REFRESH_SECONDS);
    }
  }

  function attachRadar(): RadarMinimap {
    recording = installCanvasRecording();
    radar = new RadarMinimap();
    return radar;
  }

  function spawn(type: UnitType, x: number, z: number): UnitInstance {
    const air = UNIT_CONFIGS[type].domain === 'air';
    const unit = system.spawnUnit(type, new THREE.Vector3(x, air ? 400 : 0, z));
    expect(unit, `spawnUnit(${type})`).not.toBeNull();
    return unit as UnitInstance;
  }

  describe('terrain source', () => {
    it('hands over the unit system’s surface sampler and level on every refresh', () => {
      const sampler: UnitSurfaceSampler = () => ({ y: 12, water: false });
      controller.setSurfaceSampler(sampler);
      controller.setLevel(4, getDifficultyProfile(4));

      refresh(3);
      expect(terrainCalls).toHaveLength(3);
      for (const [fedSampler, level] of terrainCalls) {
        expect(fedSampler).toBe(sampler);
        expect(level).toBe(4);
      }
      expect(radarCalls, 'together with the radar update').toHaveLength(3);
    });

    it('hands over null while there is no sampler', () => {
      controller.setLevel(2, getDifficultyProfile(2));
      refresh();
      expect(terrainCalls).toEqual([[null, 2]]);
    });

    it('follows a change of sampler and of level', () => {
      const first: UnitSurfaceSampler = () => ({ y: 0, water: true });
      const second: UnitSurfaceSampler = () => ({ y: 40, water: false });
      controller.setSurfaceSampler(first);
      controller.setLevel(1, getDifficultyProfile(1));
      refresh();
      controller.setSurfaceSampler(second);
      controller.setLevel(2, getDifficultyProfile(2));
      refresh();
      expect(terrainCalls).toEqual([
        [first, 1],
        [second, 2],
      ]);
    });

    it('does not refresh more often than the radar does (20 Hz)', () => {
      // 一秒 60 帧：雷达约刷新 20 次，地形来源随雷达一起交，不是每帧都交
      for (let frame = 0; frame < 60; frame++) {
        now += 1000 / 60;
        feed.updateRadar(1 / 60);
      }
      expect(terrainCalls.length).toBeGreaterThanOrEqual(15);
      expect(terrainCalls.length).toBeLessThanOrEqual(22);
      expect(terrainCalls).toHaveLength(radarCalls.length);
    });
  });

  describe('with the real radar behind it', () => {
    function openMap(): void {
      refresh();
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyN', key: 'n', bubbles: true, cancelable: true })
      );
      expect(radar?.isMapExpanded(), 'the level map opens').toBe(true);
    }

    it('the expanded level map samples the level through the unit system’s sampler', () => {
      const sampled: Array<{ x: number; z: number }> = [];
      controller.setSurfaceSampler((x, z) => {
        sampled.push({ x, z });
        return { y: z < 0 ? 0 : 30, water: z < 0 };
      });
      controller.setLevel(3, getDifficultyProfile(3));
      attachRadar();
      openMap();
      refresh(40);

      expect(sampled.length).toBeGreaterThan(100);
      const xs = sampled.map((point) => point.x);
      const zs = sampled.map((point) => point.z);
      expect(Math.min(...xs)).toBeLessThan(-1200);
      expect(Math.max(...xs)).toBeGreaterThan(1200);
      expect(Math.min(...zs)).toBeLessThan(-1200);
      expect(Math.max(...zs)).toBeGreaterThan(1200);
      const painted = (recording as CanvasRecording).recorders.flatMap(
        (recorder) => recorder.images
      );
      expect(painted.length, 'a terrain image was painted').toBeGreaterThan(0);
    });

    it('keeps the map open from refresh to refresh and collapses it when the level changes', () => {
      controller.setSurfaceSampler(() => ({ y: 0, water: false }));
      controller.setLevel(1, getDifficultyProfile(1));
      attachRadar();
      openMap();
      refresh(30);
      expect(radar?.isMapExpanded(), 'same level').toBe(true);

      controller.setLevel(2, getDifficultyProfile(2));
      refresh();
      expect(radar?.isMapExpanded(), 'next level').toBe(false);
    });

    it('draws the map without terrain when the unit system has no sampler', () => {
      controller.setLevel(1, getDifficultyProfile(1));
      attachRadar();
      openMap();
      refresh(20);
      expect(radar?.isMapExpanded()).toBe(true);
      const painted = (recording as CanvasRecording).recorders.flatMap(
        (recorder) => recorder.images
      );
      expect(painted).toHaveLength(0);
    });
  });

  describe('unit contacts', () => {
    function kindAt(unit: UnitInstance): RadarBlip['kind'] | undefined {
      const position = unit.mesh.position;
      const latest = radarCalls[radarCalls.length - 1];
      return latest.blips.find((blip) => blip.position.distanceTo(position) < 0.5)?.kind;
    }

    it('feeds every living unit as a contact at its position', () => {
      const units = [
        spawn(UnitType.TANK, 300, -200),
        spawn(UnitType.FRIGATE, -500, 100),
        spawn(UnitType.BOMBER, 0, -800),
        spawn(UnitType.ALLY_CONVOY, 200, 600),
        spawn(UnitType.CIVILIAN_SHIP, -900, -900),
      ];
      refresh();
      const latest = radarCalls[radarCalls.length - 1];
      expect(latest.position.equals(PLAYER)).toBe(true);
      expect(latest.blips).toHaveLength(units.length);
      for (const unit of units) {
        expect(kindAt(unit), unit.type).toBeDefined();
      }

      units[0].applyDamage(1e6, 'missile');
      refresh();
      expect(radarCalls[radarCalls.length - 1].blips).toHaveLength(units.length - 1);
      expect(kindAt(units[0]), 'a destroyed unit is no contact').toBeUndefined();
    });

    it('tells hostile ground units, hostile ships, allies and civilians apart', () => {
      const tank = spawn(UnitType.TANK, 300, -200);
      const station = spawn(UnitType.RADAR_STATION, 350, 250);
      const frigate = spawn(UnitType.FRIGATE, -500, 100);
      const gunboat = spawn(UnitType.GUNBOAT, -650, 300);
      const bomber = spawn(UnitType.BOMBER, 0, -800);
      const convoy = spawn(UnitType.ALLY_CONVOY, 200, 600);
      const awacs = spawn(UnitType.ALLY_AWACS, 700, 700);
      const liner = spawn(UnitType.CIVILIAN_AIRLINER, -900, -900);
      const truck = spawn(UnitType.CIVILIAN_TRUCK, 900, -300);
      refresh();

      expect(kindAt(tank)).toBe('enemy-ground');
      expect(kindAt(station)).toBe('enemy-ground');
      expect(kindAt(frigate)).toBe('enemy-sea');
      expect(kindAt(gunboat)).toBe('enemy-sea');
      // 敌方空中单位与敌机同一种符号
      expect(kindAt(bomber)).toBe('enemy');
      expect(kindAt(convoy)).toBe('ally-unit');
      expect(kindAt(awacs)).toBe('ally-unit');
      expect(kindAt(liner)).toBe('neutral');
      expect(kindAt(truck)).toBe('neutral');
    });
  });
});
