import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig, type QualityPreset } from '@/config';
import { EventBus } from '@/core/EventBus';
import { PlayerSystem } from '@/core/systems/PlayerSystem';
import {
  ParticleSystem,
  ParticleType,
  getVfxTextures,
  type HeavyWeaponImpactProfile,
  type HitEffectProfile,
  type SurfaceImpactType,
  type VfxTextures,
} from '@/features/effects/ParticleSystem';
import { ShieldRipple } from '@/features/effects/ShieldRipple';
import { PostFxPipeline } from '@/features/effects/postfx/PostFxPipeline';
import type { ScreenEffectsValues } from '@/features/effects/postfx/ScreenEffectsState';
import { ScreenOverlay } from '@/features/effects/postfx/ScreenOverlay';
import { PlayerStats } from '@/features/upgrade/UpgradeSystem';
import { GameScene } from '@/scenes/GameScene';

/**
 * api-spec §7（VFX）：ParticleSystem 保留旧 API 并新增 5 个效果 + getBudget；
 * GameScene.setScreenEffects / setPostFxEnabled；PlayerSystem.notifyShieldHit。
 *
 * jsdom 没有 WebGL：只把 three 的 WebGLRenderer 换成记录调用的替身（其余 three 原样），
 * PostFxPipeline / EffectComposer / ScreenOverlay 都在替身上真实构建。屏幕效果的实际取值
 * 从每帧交给 PostFxPipeline.render / ScreenOverlay.render 的参数里读取（不看像素）。
 */

const rendererControl = vi.hoisted(() => ({
  /** EXT_color_buffer_(half_)float：后处理是否可用 */
  floatTargets: true,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();

  class FakeWebGLRenderer {
    readonly domElement = document.createElement('canvas');
    readonly capabilities = { isWebGL2: true };
    readonly extensions = {
      has: (name: string): boolean =>
        rendererControl.floatTargets &&
        (name === 'EXT_color_buffer_float' || name === 'EXT_color_buffer_half_float'),
      get: (): null => null,
    };
    readonly shadowMap = { enabled: false, needsUpdate: false, type: actual.PCFShadowMap };
    readonly renders: unknown[] = [];
    autoClear = true;
    autoClearColor = true;
    autoClearDepth = true;
    autoClearStencil = true;
    toneMapping: number = actual.NoToneMapping;
    toneMappingExposure = 1;
    outputColorSpace: string = actual.SRGBColorSpace;
    private width = 1024;
    private height = 768;
    private pixelRatio = 1;
    private target: unknown = null;
    private readonly clearColor = new actual.Color(0, 0, 0);
    private clearAlpha = 1;

    setSize(width: number, height: number): void {
      this.width = width;
      this.height = height;
    }

    getSize(target: InstanceType<typeof actual.Vector2>): InstanceType<typeof actual.Vector2> {
      return target.set(this.width, this.height);
    }

    setPixelRatio(ratio: number): void {
      this.pixelRatio = ratio;
    }

    getPixelRatio(): number {
      return this.pixelRatio;
    }

    getRenderTarget(): unknown {
      return this.target;
    }

    setRenderTarget(target: unknown): void {
      this.target = target;
    }

    getClearColor(target: InstanceType<typeof actual.Color>): InstanceType<typeof actual.Color> {
      return target.copy(this.clearColor);
    }

    setClearColor(color: InstanceType<typeof actual.Color> | number, alpha?: number): void {
      this.clearColor.set(color);
      if (alpha !== undefined) {
        this.clearAlpha = alpha;
      }
    }

    getClearAlpha(): number {
      return this.clearAlpha;
    }

    setClearAlpha(alpha: number): void {
      this.clearAlpha = alpha;
    }

    clear(): void {}

    clearDepth(): void {}

    render(object: unknown): void {
      this.renders.push(object);
    }

    dispose(): void {}
  }

  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

vi.mock('@/features/player/PlayerController', () => ({
  PlayerController: vi.fn().mockImplementation((aircraft: THREE.Group) => ({
    getPosition: () => aircraft.position.clone(),
    getQuaternion: () => aircraft.quaternion.clone(),
    getSpeed: () => 0,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// 规范类型
// ---------------------------------------------------------------------------

type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type SpecSurface = 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud';
const SURFACE_UNION_MATCHES_SPEC: IsExact<SurfaceImpactType, SpecSurface> = true;

/** 合并前（c58678e）ParticleSystem 的公共方法与签名（属性写法 → 参数逆变检查） */
interface LegacyParticleSystemApi {
  createShockwave: (
    position: THREE.Vector3,
    radius: number,
    life: number,
    color: number,
    opacity?: number
  ) => void;
  createExplosion: (
    position: THREE.Vector3,
    scale?: number,
    profile?: 'enemy' | 'player' | 'friendly'
  ) => void;
  createBossDeathExplosion: (position: THREE.Vector3, scale?: number) => void;
  createHit: (position: THREE.Vector3, intensity?: number, profile?: HitEffectProfile) => void;
  createGroundImpact: (
    position: THREE.Vector3,
    intensity?: number,
    surface?: 'ground' | 'desert' | 'snow' | 'city'
  ) => void;
  createWaterImpact: (position: THREE.Vector3, intensity?: number) => void;
  createHeavyWeaponImpact: (
    position: THREE.Vector3,
    scale?: number,
    profile?: HeavyWeaponImpactProfile
  ) => void;
  createTrail: (position: THREE.Vector3, color: THREE.Color) => void;
  createMissileTrail: (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    color: THREE.Color,
    intensity?: number
  ) => void;
  createMissileImpact: (position: THREE.Vector3, scale?: number) => void;
  createBossMissileTrail: (position: THREE.Vector3, direction: THREE.Vector3) => void;
  createBossMissileExplosion: (position: THREE.Vector3, scale?: number) => void;
  createFlakExplosion: (position: THREE.Vector3, radius?: number) => void;
  createTeleportOut: (position: THREE.Vector3) => void;
  createTeleportIn: (position: THREE.Vector3) => void;
  createLaserBeam: (start: THREE.Vector3, end: THREE.Vector3, color?: number) => void;
  createTentacleExplosion: (position: THREE.Vector3) => void;
  update: (deltaTime: number) => void;
  clear: () => void;
  getActiveCount: () => number;
  dispose: () => void;
}

/** §7 新增 */
interface CampaignParticleApi {
  createMuzzleFlash: (position: THREE.Vector3, direction: THREE.Vector3, scale?: number) => void;
  createDamageSmoke: (position: THREE.Vector3, intensity: number) => void;
  createPickupBurst: (position: THREE.Vector3, color?: number) => void;
  createEmpBurst: (center: THREE.Vector3, radius: number) => void;
  createSplash: (position: THREE.Vector3, scale?: number) => void;
  getBudget: () => number;
  createGroundImpact: (position: THREE.Vector3, intensity?: number, surface?: SpecSurface) => void;
}

const LEGACY_METHODS: readonly (keyof LegacyParticleSystemApi)[] = [
  'createShockwave',
  'createExplosion',
  'createBossDeathExplosion',
  'createHit',
  'createGroundImpact',
  'createWaterImpact',
  'createHeavyWeaponImpact',
  'createTrail',
  'createMissileTrail',
  'createMissileImpact',
  'createBossMissileTrail',
  'createBossMissileExplosion',
  'createFlakExplosion',
  'createTeleportOut',
  'createTeleportIn',
  'createLaserBeam',
  'createTentacleExplosion',
  'update',
  'clear',
  'getActiveCount',
  'dispose',
];

const CAMPAIGN_METHODS: readonly (keyof CampaignParticleApi)[] = [
  'createMuzzleFlash',
  'createDamageSmoke',
  'createPickupBurst',
  'createEmpBurst',
  'createSplash',
  'getBudget',
];

/** 旧模块导出的贴图集合（SpawnPortal / 弹丸池等仍在使用） */
interface LegacyVfxTextureSet {
  glow: THREE.Texture | null;
  fire: THREE.Texture | null;
  smoke: THREE.Texture | null;
  spark: THREE.Texture | null;
  ring: THREE.Texture | null;
  swirl: THREE.Texture | null;
  tail: THREE.Texture | null;
}

type ParticleCall = [name: string, invoke: (particles: ParticleSystem) => void];

const at = (x = 0, y = 50, z = 0): THREE.Vector3 => new THREE.Vector3(x, y, z);
const FORWARD = new THREE.Vector3(0, 0, -1);
const ORANGE = new THREE.Color(1, 0.5, 0.1);

const LEGACY_CALLS: readonly ParticleCall[] = [
  ['createShockwave', (p) => p.createShockwave(at(), 20, 0.6, 0x66ccff)],
  ['createExplosion', (p) => p.createExplosion(at(), 1.4, 'player')],
  ['createBossDeathExplosion', (p) => p.createBossDeathExplosion(at(), 1.2)],
  ['createHit', (p) => p.createHit(at(), 1, 'enemy')],
  ['createGroundImpact', (p) => p.createGroundImpact(at(0, -40, 0), 1, 'desert')],
  ['createWaterImpact', (p) => p.createWaterImpact(at(0, -48, 0), 1)],
  ['createHeavyWeaponImpact', (p) => p.createHeavyWeaponImpact(at(), 1.5, 'boss-cannon')],
  ['createTrail', (p) => p.createTrail(at(), ORANGE)],
  ['createMissileTrail', (p) => p.createMissileTrail(at(), FORWARD, ORANGE, 1.2)],
  ['createMissileImpact', (p) => p.createMissileImpact(at(), 1)],
  ['createBossMissileTrail', (p) => p.createBossMissileTrail(at(), FORWARD)],
  ['createBossMissileExplosion', (p) => p.createBossMissileExplosion(at())],
  ['createFlakExplosion', (p) => p.createFlakExplosion(at(), 40)],
  ['createTeleportOut', (p) => p.createTeleportOut(at())],
  ['createTeleportIn', (p) => p.createTeleportIn(at())],
  ['createLaserBeam', (p) => p.createLaserBeam(at(), at(0, 50, -200), 0xff3344)],
  ['createTentacleExplosion', (p) => p.createTentacleExplosion(at())],
];

const CAMPAIGN_CALLS: readonly ParticleCall[] = [
  ['createMuzzleFlash', (p) => p.createMuzzleFlash(at(), FORWARD, 1)],
  ['createDamageSmoke', (p) => p.createDamageSmoke(at(), 0.85)],
  ['createPickupBurst', (p) => p.createPickupBurst(at())],
  ['createPickupBurst(color)', (p) => p.createPickupBurst(at(), 0x44ff88)],
  ['createEmpBurst', (p) => p.createEmpBurst(at(), 60)],
  ['createSplash', (p) => p.createSplash(at(0, -48, 0))],
  ['createSplash(scale)', (p) => p.createSplash(at(0, -48, 0), 2.5)],
];

const NAN_POSITION = new THREE.Vector3(Number.NaN, 10, 0);
const NON_FINITE_CALLS: readonly ParticleCall[] = [
  ['createMuzzleFlash', (p) => p.createMuzzleFlash(NAN_POSITION, FORWARD)],
  ['createDamageSmoke', (p) => p.createDamageSmoke(NAN_POSITION, 1)],
  ['createPickupBurst', (p) => p.createPickupBurst(NAN_POSITION, 0xffffff)],
  ['createEmpBurst', (p) => p.createEmpBurst(NAN_POSITION, 80)],
  ['createSplash', (p) => p.createSplash(NAN_POSITION, 2)],
];

const SURFACES: readonly SpecSurface[] = [
  'ground',
  'desert',
  'snow',
  'city',
  'lava',
  'ice',
  'rock',
  'cloud',
];

const ORIGINAL_IS_MOBILE = GameConfig.isMobile;

function setQuality(preset: QualityPreset, mobile = false): void {
  GameConfig.isMobile = mobile;
  GameConfig.setQualityPreset(preset);
  GameConfig.clearRuntimeQualityOverride();
}

function restoreQuality(): void {
  GameConfig.isMobile = ORIGINAL_IS_MOBILE;
  GameConfig.setQualityPreset('auto');
  GameConfig.clearRuntimeQualityOverride();
}

function stepParticles(particles: ParticleSystem, seconds: number, dt = 0.05): number {
  let peak = particles.getActiveCount();
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
    particles.update(dt);
    peak = Math.max(peak, particles.getActiveCount());
  }
  return peak;
}

// ---------------------------------------------------------------------------
// ParticleSystem
// ---------------------------------------------------------------------------

describe('ParticleSystem (§7)', () => {
  let scene: THREE.Scene;
  let particles: ParticleSystem | null = null;

  function createParticles(preset: QualityPreset = 'balanced'): ParticleSystem {
    setQuality(preset);
    particles = new ParticleSystem(scene);
    return particles;
  }

  beforeEach(() => {
    scene = new THREE.Scene();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    particles?.dispose();
    particles = null;
    restoreQuality();
    vi.restoreAllMocks();
  });

  it('keeps the legacy public API and adds the campaign effects (type-level + runtime)', () => {
    const system = createParticles();
    const legacy: LegacyParticleSystemApi = system;
    const campaign: CampaignParticleApi = system;
    expect(SURFACE_UNION_MATCHES_SPEC).toBe(true);
    for (const name of LEGACY_METHODS) {
      expect(typeof legacy[name], name).toBe('function');
    }
    for (const name of CAMPAIGN_METHODS) {
      expect(typeof campaign[name], name).toBe('function');
    }
  });

  it('keeps the legacy module exports (ParticleType members, getVfxTextures)', () => {
    expect(ParticleType.EXPLOSION).toBe('EXPLOSION');
    expect(ParticleType.SMOKE).toBe('SMOKE');
    expect(ParticleType.SPARK).toBe('SPARK');
    expect(ParticleType.FIRE).toBe('FIRE');
    expect(ParticleType.DEBRIS).toBe('DEBRIS');
    const textures: VfxTextures = getVfxTextures();
    const legacyView: LegacyVfxTextureSet = textures;
    expect(Object.keys(legacyView).sort()).toEqual(
      ['fire', 'glow', 'ring', 'smoke', 'spark', 'swirl', 'tail'].sort()
    );
  });

  it.each(LEGACY_CALLS)('%s still spawns particles', (_name, invoke) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const system = createParticles();
    expect(() => invoke(system)).not.toThrow();
    expect(stepParticles(system, 0.3)).toBeGreaterThan(0);
  });

  it.each(CAMPAIGN_CALLS)('%s spawns transient particles', (_name, invoke) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const system = createParticles();
    expect(() => invoke(system)).not.toThrow();
    expect(stepParticles(system, 0.3), 'particles while the effect plays').toBeGreaterThan(0);
    stepParticles(system, 30, 0.1);
    expect(system.getActiveCount(), 'all particles expire').toBe(0);
  });

  it.each(SURFACES)('createGroundImpact accepts the %s surface', (surface) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const system = createParticles();
    expect(() => system.createGroundImpact(at(0, -30, 0), 1.2, surface)).not.toThrow();
    expect(stepParticles(system, 0.3)).toBeGreaterThan(0);
  });

  it.each(NON_FINITE_CALLS)('%s ignores a non-finite position', (_name, invoke) => {
    const system = createParticles();
    expect(() => invoke(system)).not.toThrow();
    expect(stepParticles(system, 1)).toBe(0);
  });

  it('tolerates non-finite effect parameters at a valid position', () => {
    const system = createParticles();
    expect(() => {
      system.createMuzzleFlash(at(), new THREE.Vector3(0, 0, 0), Number.NaN);
      system.createMuzzleFlash(at(), new THREE.Vector3(Number.NaN, 0, 1));
      system.createDamageSmoke(at(), Number.NaN);
      system.createPickupBurst(at(), Number.NaN);
      system.createEmpBurst(at(), Number.NaN);
      system.createEmpBurst(at(), -50);
      system.createSplash(at(), Number.POSITIVE_INFINITY);
      stepParticles(system, 2);
    }).not.toThrow();
    expect(Number.isFinite(system.getActiveCount())).toBe(true);
  });

  it('reports a positive, finite live-particle budget', () => {
    const system = createParticles();
    const budget = system.getBudget();
    expect(Number.isFinite(budget)).toBe(true);
    expect(budget).toBeGreaterThan(0);
  });

  it('sizes the budget by quality preset (performance < balanced < quality)', () => {
    const budgets = (['performance', 'balanced', 'quality'] as const).map((preset) => {
      const system = createParticles(preset);
      const budget = system.getBudget();
      system.dispose();
      particles = null;
      return budget;
    });
    expect(budgets[0]).toBeLessThan(budgets[1]);
    expect(budgets[1]).toBeLessThan(budgets[2]);
  });

  it('follows a quality change at runtime', () => {
    const reference = createParticles('performance');
    const performanceBudget = reference.getBudget();
    reference.dispose();

    const system = createParticles('quality');
    expect(system.getBudget()).toBeGreaterThan(performanceBudget);
    setQuality('performance');
    stepParticles(system, 2);
    expect(system.getBudget()).toBe(performanceBudget);
  });

  it('never keeps more live particles than its budget', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const system = createParticles('performance');
    const budget = system.getBudget();
    for (let i = 0; i < budget; i += 1) {
      system.createMuzzleFlash(at(i % 40, 50, 0), FORWARD, 1);
      if (i % 50 === 0) {
        system.update(0.001);
      }
      expect(system.getActiveCount()).toBeLessThanOrEqual(budget);
    }
    expect(system.getActiveCount(), 'the cap is actually reached').toBeGreaterThan(budget / 2);
  });

  it('clear() empties it and dispose() removes it from the scene', () => {
    const system = createParticles();
    const childCount = scene.children.length;
    expect(childCount).toBeGreaterThan(0);
    for (const [, invoke] of CAMPAIGN_CALLS) {
      invoke(system);
    }
    system.clear();
    expect(system.getActiveCount()).toBe(0);
    expect(stepParticles(system, 1)).toBe(0);

    system.dispose();
    particles = null;
    expect(scene.children).toHaveLength(0);
    expect(() => {
      for (const [, invoke] of CAMPAIGN_CALLS) {
        invoke(system);
      }
      system.update(0.1);
    }).not.toThrow();
    expect(system.getActiveCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------

type ScreenField = 'damagePulse' | 'lowHealth' | 'flash' | 'speed' | 'empFlash';
const SCREEN_FIELDS: readonly ScreenField[] = [
  'damagePulse',
  'lowHealth',
  'flash',
  'speed',
  'empFlash',
];

interface FakeRendererHandle {
  renders: unknown[];
}

describe('GameScene screen effects and post-processing (§7)', () => {
  let gameScene: GameScene | null = null;
  let nowMs = 1000;
  let postFxFrames: ScreenEffectsValues[] = [];
  let overlayFrames: ScreenEffectsValues[] = [];

  function createScene(preset: QualityPreset): GameScene {
    setQuality(preset);
    gameScene = new GameScene();
    return gameScene;
  }

  function renderFor(target: GameScene, seconds: number, frameMs = 16): void {
    const frames = Math.round((seconds * 1000) / frameMs);
    for (let i = 0; i < frames; i += 1) {
      nowMs += frameMs;
      target.render();
    }
  }

  function lastFrame(frames: readonly ScreenEffectsValues[]): ScreenEffectsValues {
    const frame = frames[frames.length - 1];
    expect(frame, 'at least one rendered frame').toBeDefined();
    return frame;
  }

  function peak(frames: readonly ScreenEffectsValues[], field: ScreenField): number {
    return frames.reduce((max, frame) => Math.max(max, frame[field]), 0);
  }

  beforeEach(() => {
    rendererControl.floatTargets = true;
    nowMs = 1000;
    postFxFrames = [];
    overlayFrames = [];
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    vi.spyOn(PostFxPipeline.prototype, 'render').mockImplementation(
      (_deltaTime: number, effects: ScreenEffectsValues) => {
        postFxFrames.push({ ...effects });
      }
    );
    vi.spyOn(ScreenOverlay.prototype, 'render').mockImplementation(
      (_renderer: THREE.WebGLRenderer, effects: ScreenEffectsValues) => {
        overlayFrames.push({ ...effects });
      }
    );
  });

  afterEach(() => {
    gameScene?.dispose();
    gameScene = null;
    restoreQuality();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('turns post-processing off for the performance preset and on for balanced / quality', () => {
    expect(createScene('performance').isPostFxEnabled()).toBe(false);
    gameScene?.dispose();
    expect(createScene('balanced').isPostFxEnabled()).toBe(true);
    gameScene?.dispose();
    expect(createScene('quality').isPostFxEnabled()).toBe(true);
  });

  it('setPostFxEnabled toggles isPostFxEnabled in both directions', () => {
    const quality = createScene('quality');
    quality.setPostFxEnabled(false);
    expect(quality.isPostFxEnabled()).toBe(false);
    quality.setPostFxEnabled(true);
    expect(quality.isPostFxEnabled()).toBe(true);
    quality.dispose();

    const performancePreset = createScene('performance');
    performancePreset.setPostFxEnabled(true);
    expect(performancePreset.isPostFxEnabled()).toBe(true);
    renderFor(performancePreset, 0.1);
    expect(postFxFrames.length, 'enabled pipeline renders the frames').toBeGreaterThan(0);
    performancePreset.setPostFxEnabled(false);
    expect(performancePreset.isPostFxEnabled()).toBe(false);
  });

  it('never claims post-processing without float render targets and still draws the scene', () => {
    rendererControl.floatTargets = false;
    const target = createScene('quality');
    expect(target.isPostFxEnabled()).toBe(false);
    target.setPostFxEnabled(true);
    expect(target.isPostFxEnabled()).toBe(false);
    renderFor(target, 0.1);
    const renderer = target.renderer as unknown as FakeRendererHandle;
    expect(renderer.renders).toContain(target.scene);
  });

  it('falls back to direct rendering when the pipeline fails mid-game', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = createScene('quality');
    vi.mocked(PostFxPipeline.prototype.render).mockImplementationOnce(() => {
      throw new Error('context lost');
    });
    expect(() => renderFor(target, 0.1)).not.toThrow();
    expect(target.isPostFxEnabled()).toBe(false);
    const renderer = target.renderer as unknown as FakeRendererHandle;
    expect(renderer.renders).toContain(target.scene);
  });

  it.each(SCREEN_FIELDS)('accepts the %s field', (field) => {
    const target = createScene('balanced');
    target.setScreenEffects({ [field]: 0.8 });
    renderFor(target, 0.5);
    expect(peak(postFxFrames, field), field).toBeGreaterThan(0.05);
    for (const other of SCREEN_FIELDS) {
      if (other !== field) {
        expect(peak(postFxFrames, other), `${other} while setting ${field}`).toBe(0);
      }
    }
  });

  it('clamps every field to 0..1 and never passes NaN to the renderer', () => {
    const target = createScene('balanced');
    target.setScreenEffects({
      damagePulse: 5,
      lowHealth: 9,
      flash: -3,
      speed: Number.POSITIVE_INFINITY,
      empFlash: Number.NaN,
    });
    renderFor(target, 1);
    for (const frame of postFxFrames) {
      for (const field of SCREEN_FIELDS) {
        expect(Number.isFinite(frame[field]), field).toBe(true);
        expect(frame[field], field).toBeGreaterThanOrEqual(0);
        expect(frame[field], field).toBeLessThanOrEqual(1);
      }
    }
    expect(peak(postFxFrames, 'damagePulse')).toBe(1);
    expect(peak(postFxFrames, 'lowHealth')).toBeGreaterThan(0.9);
    expect(peak(postFxFrames, 'flash')).toBe(0);
  });

  it('lets pulses fade on their own while continuous effects hold their level', () => {
    const target = createScene('balanced');
    target.setScreenEffects({ damagePulse: 1, flash: 1, empFlash: 1, lowHealth: 0.6, speed: 0.4 });
    renderFor(target, 2.5);
    const settled = lastFrame(postFxFrames);
    expect(settled.damagePulse).toBeLessThan(0.01);
    expect(settled.flash).toBeLessThan(0.01);
    expect(settled.empFlash).toBeLessThan(0.01);
    expect(settled.lowHealth).toBeCloseTo(0.6, 1);
    expect(settled.speed).toBeCloseTo(0.4, 1);

    target.setScreenEffects({ lowHealth: 0, speed: 0 });
    renderFor(target, 2.5);
    const cleared = lastFrame(postFxFrames);
    expect(cleared.lowHealth).toBeLessThan(0.01);
    expect(cleared.speed).toBeLessThan(0.01);
  });

  it('applies partial updates without resetting the other effects', () => {
    const target = createScene('balanced');
    target.setScreenEffects({ lowHealth: 0.7 });
    renderFor(target, 1.5);
    target.setScreenEffects({ flash: 0.5 });
    renderFor(target, 1.5);
    expect(lastFrame(postFxFrames).lowHealth).toBeCloseTo(0.7, 1);
  });

  it('still shows screen effects when post-processing is off', () => {
    const target = createScene('performance');
    expect(target.isPostFxEnabled()).toBe(false);
    target.setScreenEffects({ damagePulse: 1, empFlash: 0.6 });
    renderFor(target, 0.3);
    expect(overlayFrames.length).toBeGreaterThan(0);
    expect(peak(overlayFrames, 'damagePulse')).toBe(1);
    expect(peak(overlayFrames, 'empFlash')).toBeGreaterThan(0.5);
    const renderer = target.renderer as unknown as FakeRendererHandle;
    expect(renderer.renders).toContain(target.scene);
  });
});

// ---------------------------------------------------------------------------
// PlayerSystem.notifyShieldHit
// ---------------------------------------------------------------------------

describe('PlayerSystem.notifyShieldHit (§7)', () => {
  let scene: THREE.Scene;
  let mesh: THREE.Group;
  let system: PlayerSystem;

  beforeEach(() => {
    EventBus.clear();
    scene = new THREE.Scene();
    mesh = new THREE.Group();
    mesh.position.set(40, 120, -60);
    system = new PlayerSystem(scene, mesh, new PlayerStats());
    system.init();
  });

  afterEach(() => {
    system.dispose();
    EventBus.clear();
    vi.restoreAllMocks();
  });

  it('ripples the active shield toward the hit point', () => {
    const notifyHit = vi.spyOn(ShieldRipple.prototype, 'notifyHit');
    system.activateShield(scene);
    system.update(0.016);

    system.notifyShieldHit(new THREE.Vector3(40, 120, -60).add(new THREE.Vector3(0, 0, 3)));

    expect(notifyHit).toHaveBeenCalledTimes(1);
    const direction = notifyHit.mock.calls[0][0].clone().normalize();
    expect(direction.dot(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(0.99);
  });

  it('still ripples (with a finite direction) for a hit at the shield centre', () => {
    const notifyHit = vi.spyOn(ShieldRipple.prototype, 'notifyHit');
    system.activateShield(scene);
    system.update(0.016);
    system.notifyShieldHit(mesh.position.clone());
    expect(notifyHit).toHaveBeenCalledTimes(1);
    const direction = notifyHit.mock.calls[0][0];
    expect(Number.isFinite(direction.lengthSq())).toBe(true);
    expect(direction.lengthSq()).toBeGreaterThan(0);
  });

  it('ignores hits without an active shield and non-finite positions', () => {
    const notifyHit = vi.spyOn(ShieldRipple.prototype, 'notifyHit');
    expect(() => system.notifyShieldHit(new THREE.Vector3(1, 2, 3))).not.toThrow();
    expect(notifyHit).not.toHaveBeenCalled();

    system.activateShield(scene);
    system.update(0.016);
    expect(() => system.notifyShieldHit(new THREE.Vector3(Number.NaN, 0, 0))).not.toThrow();
    expect(notifyHit).not.toHaveBeenCalled();
  });
});
