# API

This game has no HTTP API. Contracts below are in-process. Signatures are copied from the source files named in each section; the source wins if they ever differ.

## EventBus

Source of truth: `src/core/EventBus.ts`.

```typescript
import { EventBus, GameEventType } from '@/core/EventBus';

EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
  // payload.config.scoreValue, payload.enemyId, payload.position
});

EventBus.emit(GameEventType.SCORE_CHANGED, { score: 100, delta: 10 });
```

Event names include player fire/hit/death/respawn; enemy and friendly spawn/fire/hit/death; missile fire/hit; wave and level complete; powerup collect/expire; balloon destroyed; shield activate/deactivate; score changed. Payload shapes are `GameEventPayloads` in the same file — read that file, do not copy the enum into agent instructions.

The ten-level campaign added **no** event types. Units reuse the existing fire events through `src/features/units/UnitEventBridge.ts`:

```typescript
/** 把 UnitSystem 的开火回调接入现有 EventBus；返回解除函数（恢复接入前的 onUnitFire） */
export function bridgeUnitFireToEventBus(system: UnitSystem): () => void;
// Faction.FRIENDLY → GameEventType.FRIENDLY_FIRED, otherwise → GameEventType.ENEMY_FIRED
// payload: { position, direction, damage, faction, owner }
```

`GameCoordinator`'s handlers for `WAVE_START`, `WAVE_COMPLETE`, `LEVEL_COMPLETE`, `ENEMY_DEATH` and `PLAYER_DEATH` forward to `CampaignFlowController` (and `WAVE_START` to `UnitController.spawnForWave`); `PLAYER_HIT` also drives camera shake and the damage pulse. Everything else in the campaign is wired with direct callbacks (`on…` properties) and `…Deps` interfaces.

The controls and weapons round (touch flight, unit markers, always-on seeker, Save & Exit, new menu) also added and changed **no** event types or payloads. One wiring note: nothing emits `MISSILE_FIRED` and nothing listens for it — the player's missile is launched by a direct call (`GameCoordinator.launchMissile` → `MissileSystem.fire`), as it already was before this round, and the listeners the coordinator and `CombatSystem` had for it are gone (`launchMissile` reports the tutorial's missile step itself). Only the type and its payload are still declared in `EventBus.ts`. `MISSILE_HIT` is unchanged.

## Config

- Runtime constants: `src/config.ts` (`GAME_CONSTANTS` — `PLAYER`, `PROJECTILE`, `GUN_ASSIST`, `CAMERA`, `WORLD`, `POWERUP`, `LEVEL`, `MISSILE`; `GameConfig` device / quality profiles)
- There is no external config file and no config is fetched at start-up: every tuning value lives in the TypeScript source

Enemy type tables live in `src/features/enemy/EnemyTypes.ts`. Level terrain params live in `src/features/terrain/LevelConfig.ts`. Quality presets (`QualityPreset = 'auto' | 'performance' | 'balanced' | 'quality'`) and their per-device parameters live in `GameConfig` (`src/config.ts`).

## Logger

```typescript
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MyModule');
log.debug('debug', { data: 123 });
log.info('info');
log.warn('warn');
log.error('error');
```

The minimum level is `DEBUG` in development builds (`import.meta.env.MODE === 'development'`) and `WARN` in every other mode (production, preview, tests); `loggerManager.setMinLevel(level)` overrides it. Log history is stored only in development builds.

## Localisation (i18n)

Source: `src/i18n/index.ts` (no `document` / `window` access at import time). English is the default; Simplified Chinese is the one other locale.

```typescript
export type Locale = 'en' | 'zh-CN';
export const DEFAULT_LOCALE: Locale = 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN'];

/** 双语文案：en 为英文，zh 为简体中文 */
export interface LocalizedText {
  readonly en: string;
  readonly zh: string;
}
export type TextParams = Readonly<Record<string, string | number>>;
export type LocaleListener = (locale: Locale) => void;

/** 把任意输入规整为受支持的语言；无法识别时回落到默认英文 */
export function normalizeLocale(value: unknown): Locale;
export function getLocale(): Locale;
export function isChinese(): boolean;
/** 切换语言：同步 <html lang> 并通知订阅者（语言未变化时不通知） */
export function setLocale(locale: Locale): void;
/** 订阅语言变化，返回取消订阅函数 */
export function onLocaleChange(listener: LocaleListener): () => void;
/** 按当前语言取文案；传入纯字符串时原样返回（便于渐进迁移） */
export function localize(text: LocalizedText | string): string;
/** 用 {name} 占位符填充参数；未提供的占位符保持原样 */
export function format(template: string, params?: TextParams): string;
/** localize + format 的组合 */
export function tr(text: LocalizedText | string, params?: TextParams): string;
```

```typescript
import { tr } from '@/i18n';

tr({ en: 'Wave {n}', zh: '第{n}波' }, { n: 3 }); // 'Wave 3' | '第3波'
```

- `normalizeLocale` maps `zh`, `zh-cn` and `zh-hans…` (trimmed, any case) to `'zh-CN'`, `en` and `en-…` to `'en'`, and everything else to `'en'`.
- `setLocale` normalises its argument, returns early when nothing changes, writes `document.documentElement.lang` when a document exists, then calls every listener once; a listener that throws is logged and does not stop the others.

**Data contract.** Player-facing text is written in place, next to the data it belongs to, as a `LocalizedText` with both languages, and resolved where it is read with `tr()` / `localize()`; there are no string keys or per-language tables ([ADR 0002](decisions/0002-bilingual-text-and-voice-packs.md)). Fields typed `LocalizedText`:

| Type | Fields | Source |
| ---- | ------ | ------ |
| `UnitConfig` | `name` | `src/features/units/UnitTypes.ts` |
| `BossConfig` | `name` | `src/features/boss/BossTypes.ts` |
| `EnemyConfig` | `name` | `src/features/enemy/EnemyTypes.ts` |
| `SpecialWeaponConfig` | `name`, `description` | `src/features/weapons/WeaponTypes.ts` |
| `UpgradeConfig` | `name`, `description`, `unit` | `src/features/upgrade/UpgradeSystem.ts` |
| `PowerUpConfig` | `name`, `description` | `src/features/powerups/PowerUpSystem.ts` |
| `LevelConfig` | `name` (the same object as the chapter title in `CHAPTER_TITLES`), `description` | `src/features/terrain/LevelConfig.ts` |
| `DifficultyProfile` | `label` (Very Easy · Easy · Normal · Hard · Expert = 非常简单 · 简单 · 普通 · 困难 · 专家, tier for tier) | `src/core/Difficulty.ts` |
| Campaign data | every player-facing field — see [Campaign data](#campaign-data) | `src/features/campaign/` |

Snapshots handed to the HUD stay `string` and are localised when they are produced (for example `WeaponSystem.getHudState().name` is `tr(config.name)`). Per-frame code keeps its `{ en, zh }` objects as module-level constants, so nothing bilingual is allocated per frame.

**Live switching.** `src/main.ts` calls `setLocale(loadStartFlowSettings().language)` before any UI renders, writes the page shell (title, loading screen, touch-button labels and `aria-label`s) in that language and rewrites it on `onLocaleChange`. Other subscribers: `StartMenu`, `PauseMenu` and `UpgradeMenu` (re-render in place), `HUD` (its own text, the settlement panel, and any briefing banner, autosave toast, flashed warning, boss status label, power-up timer or centre callout still on screen that was given bilingual text — see `HudText` under [HUD, story overlay, radio, radar, menus](#hud-story-overlay-radio-radar-menus)), `AdvancedBossController` (while a boss 6–10 is active, it re-pushes the boss's status label at once), `EnemyHealthBars` (every bar name, also while paused), `ModelPreview` (labels and model names; it re-frames the model for the new name label), `RadioComms` (the line on screen) and `VoiceSystem` (stops the current line, re-prefetches in the new language). `StoryOverlay` writes each card in the locale current when the card is shown: a card already on screen keeps its language and the rest of its narration is skipped. These keep their bilingual source and follow a switch while visible: the level and boss briefings, the checkpoint autosave toasts (including "Resumed: …"), the short wave / tutorial completion objectives, the power-up timer names, the score-penalty flash ("Civilian hit · -{points} pts"), the return-to-arena prompt, the boss bearing call-out, the unit warnings from `UnitController` (cease fire, missile inbound, remaining targets left the area), the centre callouts from `showPowerUpBig` (allied support, laser warnings, wingman losses, pickups with their POWER-UP! subtitle, upgrade feedback and points, escort results, tutorial hints, wave / event announcements, boss destroyed, and the special-weapon notices sent through `SpecialWeaponsDeps.notify`), and the phase labels and hazard warnings of bosses 6–10 (`IAdvancedBoss.onPhaseChange` / `onHazardWarning` carry `HudText`). Bosses 6–10 build `getStatusLabel()` in the current language and the controller re-sends it every 0.25 s and on a switch.

## Crash surface

Source: `src/features/terrain/TerrainGenerator.ts`, `src/features/levels/LevelManager.ts`, `src/core/systems/PlayerSystem.ts`.

```typescript
/** worldscape 高度场局部 0（水位）对应的世界 Y */
export const WORLDSCAPE_WATER_Y = -48;

// TerrainGenerator / LevelManager
public getCrashSurfaceY(worldX: number, worldZ: number): number;

// PlayerSystem — 注入活地形/水面高度采样；未设置时坠毁判定回落到 WORLDSCAPE_WATER_Y
setCrashSurfaceSampler(sampler: (x: number, z: number) => number): void;
```

Kill condition: world `Y <=` sampled surface. `GameCoordinator` wires:

```typescript
this.playerSystem.setCrashSurfaceSampler(
  (x, z) => this.enemySystem?.getLevelManager().getCrashSurfaceY(x, z) ?? WORLDSCAPE_WATER_Y,
);
```

`TerrainGenerator.getCrashSurfaceY` uses the heightfield (`WORLDSCAPE_WATER_Y + heightAt`) for levels 1–5 and the environment module's sampled surface for levels 6–10; no field → `WORLDSCAPE_WATER_Y`. `LevelManager.getCrashSurfaceY` forwards to the generator, or `WORLDSCAPE_WATER_Y` if terrain is not loaded. The crash check bypasses the SHIELD power-up: the shield never protects against terrain.

**Respawn** (`PlayerSystem`, private constants at the top of the class; the jet reappears after the 2 s respawn delay):

- **Safe track.** While flying, every 0.25 s the position is pushed into a fixed ring buffer (64 samples, about 16 s, no per-frame allocation) if it is more than 10 m above the sampled surface. The track restarts from the spawn point at construction, on `placeAt` (level start, checkpoint) and at every respawn, so samples that led into an obstacle are never reused.
- **Respawn point.** The newest sample taken at least 3 s and at least 150 m (horizontally) before the crash; if the track is too short (just after a level start, a checkpoint or a respawn) the farthest sample is pushed out along the crash → sample direction to 150 m from the crash point (straight back along the crash heading when they coincide). The point is clamped inside `GAME_CONSTANTS.WORLD.SOFT_BOUNDARY_RADIUS` and raised to at least 40 m above the surface; the jet comes back wings level.
- **Heading.** Eight candidates, starting with the heading flown at that sample, then ±45°, ±90°, ±135° and 180°. If the death was a surface crash within 8 s (flight clock) of the previous respawn, the starting heading is turned round, away from the crash, so a quick re-crash does not repeat the same flight (shot-down deaths keep the normal order). Each candidate is probed 0–400 m ahead (2 m steps to 40 m, then 3 m) across a corridor 24 m either side of the path, with a lane every 3 m (closer than the 8 m-wide Sky Ladder rails), and a surface higher than 20 m below the flight level blocks it. The first clear heading wins; if all are blocked, the jet climbs above the heading with the lowest obstacle line (when that stays under `SOFT_CEILING`), otherwise it takes the heading whose first obstacle is farthest.
- **Crash grace.** For 3 s after a respawn, contact with the surface does not kill. On a floor or slope the jet is lifted 3 m above it and, if the nose is below about 12°, levelled and pitched up to 12°. If staying above the surface would take more than 12 m of lift, the contact counts as a wall: the jet is pushed out horizontally to the nearest open spot (rings every 2 m out to 48 m, 16 bearings each, open = surface more than 3 m below the jet), its heading loses the into-wall component and turns outward, and wings and pitch are levelled; if no open spot is found it falls back to the lift. `placeAt` clears the crash record, the quick re-crash state and the grace.

## Surface sampling and levels

Source: `src/features/terrain/environments/TerrainEnvironment.ts`, `TerrainGenerator.ts`, `src/features/levels/LevelManager.ts`, `src/features/terrain/LevelConfig.ts`.

```typescript
export interface TerrainSurfaceSample {
  y: number;
  water: boolean;
}
export type TerrainSurfaceKind =
  | 'water' | 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud';

// TerrainGenerator
public sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample;
public getSurfaceKind(worldX: number, worldZ: number): TerrainSurfaceKind;
public getEnvironment(): TerrainEnvironment | null; // levels 6-10

// LevelManager — fall back to { y: WORLDSCAPE_WATER_Y, water: false } / 'ground' until terrain loads
public getSurfaceSample(worldX: number, worldZ: number): TerrainSurfaceSample;
public getSurfaceKind(worldX: number, worldZ: number): TerrainSurfaceKind;
public getTerrainEnvironment(): TerrainEnvironment | null;
public isTerrainReady(): boolean;
public async whenTerrainReady(): Promise<void>;
public loadLevel(levelId: number, startWave: number = 0): void;
public setWaveHoldProvider(provider: (() => number) | null): void; // extra uncleared count (alive hostile units)
public setAccuracyBonusProvider(provider: (() => number) | null): void; // enemy-jet accuracy bonus
public areWaveJetsCleared(): boolean;
/** 同时在场敌机上限：GameConfig.getMaxEnemies()（桌面 6 / 移动端 5）+ 关卡曲线的 concurrentEnemyBonus */
public getMaxConcurrentEnemies(): number;
```

`y` is the world-space surface (the water surface where `water` is true). Water exists on `LAKE`, `OCEAN`, `VOLCANO` (sea around the island), `ARCTIC` (open sea between ice) and the `CANYON` river. Environment modules implement `TerrainEnvironment` (`terrain`, `root`, `hasWater`, `build(ctx)`, `sampleHeight(worldX, worldZ)`, `isWater(worldX, worldZ)`, optional `surfaceKindAt(worldX, worldZ)` and `update(deltaTime, elapsed, focus)`, `dispose()`) on top of `EnvironmentBase`; `sampleEnvironmentSurface(environment, worldX, worldZ, waterY)` turns height + water into the `sampleSurface` result.

`LevelManager` also estimates the player's velocity each step (a jump faster than 250 m/s — respawn, checkpoint, dev teleport — resets it to zero) and hands it to every jet through `EnemyAI.setTargetVelocity`, so jets aim at a lead point (see [Enemy AI](#enemy-ai)). A wave group's spawn centre (600–800 m from the player) is picked among directions that keep the whole group, including its 60 m spread, inside the battlefield; if none of 12 tries fits, it goes toward the battlefield centre instead of being clamped onto the boundary next to the player.

`LevelConfig` (`TerrainType` gains five values, the weather presets gain `ash` / `aurora`, `LEVELS` covers ids 1..10 with names equal to `CampaignChapter.title`):

```typescript
export enum TerrainType {
  LAKE = 'LAKE', DESERT = 'DESERT', MOUNTAINS = 'MOUNTAINS', OCEAN = 'OCEAN', CITY = 'CITY',
  VOLCANO = 'VOLCANO', ARCTIC = 'ARCTIC', CANYON = 'CANYON', STRATOSPHERE = 'STRATOSPHERE',
  CITADEL = 'CITADEL',
}
export type LevelWeatherPreset =
  | 'clear' | 'cloudy' | 'mist' | 'windy' | 'sandstorm' | 'snow' | 'storm' | 'smog' | 'ash' | 'aurora';
// existing; every level now carries tuned values, consumed by the post-processing grade
export interface LevelPostFxConfig {
  exposure: number;
  contrast: number;
  saturation: number;
  bloomStrength: number;
  vignetteStrength: number;
}
export function getLevelConfig(levelId: number): LevelConfig | undefined;
```

Environment extensions: `CanyonEnvironment.getConvoyRoute(): readonly THREE.Vector3[]` and `CitadelEnvironment.getAssaultRoute(): readonly THREE.Vector3[]` feed `UnitSystem.setRouteProvider`; `CitadelEnvironment.getCoreArena(target?)` anchors Oracle Prime and `setCoreState(state: CitadelCoreState)` (`'online' | 'exposed' | 'overload' | 'offline'`) mirrors its phases.

## Terrain detail and static batching

Source: `src/features/terrain/worldscape/staticBatch.ts`, `src/features/terrain/worldscape/vegetation.ts`, `src/features/terrain/worldscape/clouds.ts`, `TerrainGenerator.ts`.

```typescript
// staticBatch.ts — 静态装饰几何按「材质 + renderOrder」分桶合并
export interface StaticBatchPartOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  /** 顶点色材质的零件颜色；材质未开启 vertexColors 时忽略，缺省为白色 */
  color?: THREE.Color;
}
export class StaticBatcher {
  /** 拷贝 geometry 并按 matrix 烘焙（原几何不被修改） */
  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4,
      options?: StaticBatchPartOptions): void;
  /** 并入一个拼装好的 Group；无法合批的可渲染对象（InstancedMesh、多材质网格、点 / 线 / 精灵、灯光）连同子树原样返回 */
  addObject(root: THREE.Object3D, colorOf?: (mesh: THREE.Mesh) => THREE.Color | undefined): THREE.Object3D[];
  /** 每桶合并为一个 Mesh 挂到 parent 下（matrixAutoUpdate = false），返回生成的网格 */
  flush(parent: THREE.Object3D, name?: string): THREE.Mesh[];
}
/** 多材质几何：同材质的分组在索引里排到一起，每种材质只剩一个分组；返回去重后的材质数组 */
export function consolidateMaterialGroups(
  geometry: THREE.BufferGeometry,
  materials: THREE.Material[]
): THREE.Material[];

// vegetation.ts — VegetationProfile.lod（缺省 = 整图一块全细节）
export interface VegetationLodProfile {
  tiles: number; // 每边分块数
  farDistance: number; // 远景替身切换距离（米，相机到分块中心）
  keep?: { trees?: number; rocks?: number; grass?: number }; // 均匀抽稀的保留比例 0..1
}
```

- **Static props.** `TerrainGenerator` builds static props (the city's buildings, roads, landmarks, bridge, expressways and light ribbons; the lakeside hamlet and dock; desert dunes, wadis, cacti, dead trees, arches and oasis palms; ocean islands) in an unattached staging group and merges them per material with `StaticBatcher` (`flushStaticBatch`); building walls keep a per-building tint through vertex colours on one shared material. Whatever `addObject` hands back is re-attached to the terrain group with its world transform. Animated parts (traffic, trains, searchlights, blinking beacons and cranes, flickering neon, the stadium rim) keep their own materials and still animate. Flat transparent sheets use `forceSinglePass`, the instanced glass-tower and elevated-train boxes use two material groups instead of six (`consolidateMaterialGroups`), and each bird flock is two `InstancedMesh`es (bodies, wings).
- **Vegetation LOD.** `buildVegetation` keeps its seeded placement and, with `lod`, splits each layer into a grid of tiles: each tile has its own `InstancedMesh`es with an instance-derived bounding sphere (so the main and shadow cameras cull tiles) under a `THREE.LOD` — full detail near, stand-ins beyond `farDistance` (one cone per pine, one icosahedron per broadleaf crown, a 20-face rock, no trunks or grass tufts). Rocks use a coarser grid (half the tiles, at least 3 × 3). `keep` thins instances evenly without changing the layout.
- **Detail by preset.** `TerrainGenerator` reads `GameConfig.getEffectiveQualityPreset()` when a level is generated (a runtime auto-downgrade applies from the next level load; mobile always uses the performance tier): `performance` 6 × 6 tiles, stand-ins beyond 700 m, keeps 80 % of trees, 75 % of rocks, 55 % of grass; `balanced` 5 × 5, 1,000 m, 85 % of grass; `quality` 5 × 5, 1,800 m, full density. Level 3 uses at most 4 × 4 tiles; level 2's sparse rocks and grass stay two untiled meshes.
- **Clouds.** `CloudField.update` writes only the clouds the current coverage shows (scale above 0.2 %) into the front of each variant's instance buffer and sets `count` / `visible`, so hidden clouds cost no vertex work.

## Shared combat contracts

Source: `src/core/CombatContracts.ts`, `src/core/Faction.ts`, `src/core/Difficulty.ts`.

```typescript
/** 特殊武器标识（主炮与锁定导弹不在此列） */
export type SpecialWeaponId = 'rockets' | 'laser' | 'swarm' | 'railgun' | 'emp';
/** 解锁顺序即 HUD / 切换顺序 */
export const SPECIAL_WEAPON_IDS: readonly SpecialWeaponId[]; // rockets, laser, swarm, railgun, emp

export type DamageSource =
  | 'cannon' | 'missile' | 'rocket' | 'laser' | 'swarm' | 'railgun' | 'emp'
  | 'enemy-fire' | 'unit-fire' | 'boss' | 'collision';

export type CombatTargetKind = 'air' | 'ground' | 'sea' | 'boss-part' | 'projectile';

export interface CombatTarget {
  readonly id: string;
  readonly mesh: Object3D;
  readonly faction: Faction;
  readonly kind: CombatTargetKind;
  /** 命中判定半径（米，世界坐标系） */
  readonly hitRadius: number;
  isAlive(): boolean;
  applyDamage(amount: number, source: DamageSource, hitPoint?: Vector3): void;
  applyStun?(seconds: number): void;
}

export interface DecoyPoint {
  readonly position: Vector3;
  /** 0-1，诱骗强度随时间衰减 */
  readonly strength: number;
}
export interface IDecoyProvider {
  getActiveDecoys(): readonly DecoyPoint[];
}
export interface IStunnable {
  applyStun(seconds: number): void;
  isStunned(): boolean;
}

export const HIT_RADIUS_USERDATA_KEY = 'hitRadius';
export function getDeclaredHitRadius(mesh: Object3D, fallback: number): number;
```

```typescript
export enum Faction {
  ENEMY = 'ENEMY',
  FRIENDLY = 'FRIENDLY',
  NEUTRAL = 'NEUTRAL', // the player
  CIVILIAN = 'CIVILIAN', // airliners, cargo ships, trucks — hostile to nobody
}
export function areHostile(faction1: Faction, faction2: Faction): boolean;
```

```typescript
export interface LevelScaling {
  level: number;
  progress: number; // 0 (level 1) → 1 (level 10)
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyCooldownMultiplier: number;
  enemyAccuracyBonus: number;
  /** 敌机射击提前量 0..1：0 = 瞄准玩家当前位置，1 = 按一阶拦截点完整提前 */
  enemyAimLead: number;
  /** 同时在场敌机上限的加成（叠加到 GameConfig.getMaxEnemies() 的桌面 / 移动端基础值上） */
  concurrentEnemyBonus: number;
  unitHealthMultiplier: number;
  /** 单位（地面 / 海上 / 空中）伤害相对 enemyDamageMultiplier 的份额 */
  unitDamageShare: number;
  bossCooldownMultiplier: number;
  scoreMultiplier: number;
}
export const CAMPAIGN_LEVEL_CAP = 10;
export function getLevelScaling(level: number): LevelScaling;

export interface DifficultyProfile {
  level: 1 | 2 | 3 | 4 | 5;
  /** 难度名（中英双语，逐档一一对应）：Very Easy 非常简单 → Easy 简单 → Normal 普通 → Hard 困难 → Expert 专家 */
  label: LocalizedText;
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyAttackCooldownMultiplier: number;
  powerUpDropMultiplier: number;
  bossCooldownMultiplier: number;
}
export function getDifficultyProfile(level: number): DifficultyProfile; // player difficulty 1..5
```

The per-level values live in one module-private table, `LEVEL_CURVE` (one column per level, level 1 = 1.0 / 0), which `getLevelScaling` reads; `LevelManager` (enemy jets) and `UnitController.setLevel` (units) multiply them by the player's `DifficultyProfile`, and `GameCoordinator` applies `scoreMultiplier` to every score award. Jets take `aimLead` from `enemyAimLead` (0 at level 1, 0.28 at level 2, rising to 0.94 at level 10) and the concurrent-jet cap from `concurrentEnemyBonus` (+1 in levels 4–6, +2 in levels 7–10); units deal `enemyDamageMultiplier × unitDamageShare`. Jet firepower (damage ÷ cooldown) relative to level 1 is about 2× in levels 2–3, 2.5–2.9× in levels 4–5 and steps up from level 6 (about 5.1×) to about 9.8× in level 10; `scoreMultiplier` runs 1.0 → 2.08. Difficulty 3 (Normal) is the default; `Difficulty.ts` records that it was tuned with the dev-only scripted-pilot harness (`src/core/dev/BalanceHarness.ts`, greedy hangar buys): damage taken per minute of about 20–25 % of max health in levels 1–2, about 30 % in levels 3–6 and 35–40 % in levels 8–10, with 0–2 non-crash deaths per level.

## Campaign data

Source: `src/features/campaign/` (data and pure functions only). `CampaignData.ts` is the single import point: it re-exports the types (`CampaignTypes.ts`), the cast (`CampaignCast.ts`), the chapters (`CampaignChapters.ts`), first-contact and generic radio (`CampaignRadio.ts`), title / prologue / epilogue / credits (`CampaignStory.ts`) and the chapter titles (`ChapterTitles.ts`), and adds the functions below. Every player-facing field is a [`LocalizedText`](#localisation-i18n); read it with `tr()`.

```typescript
export const TOTAL_LEVELS = 10;

export type CampaignSpeakerId =
  | 'hq' | 'wingman' | 'wingman2' | 'scientist' | 'awacs' | 'frigate'
  | 'oracle' | 'player' | 'airliner' | 'freighter';
export type CampaignSpeakerTone = 'sys' | 'ally' | 'threat' | 'weapon' | 'muted';
/** 配音选角用的性别（neutral：合成音 / 无配音） */
export type CampaignSpeakerGender = 'female' | 'male' | 'neutral';
export interface CampaignSpeaker {
  id: CampaignSpeakerId;
  /** 呼号（HUD 无线电标签） */
  callsign: LocalizedText;
  /** 角色名（军衔 + 姓名） */
  name: LocalizedText;
  tone: CampaignSpeakerTone;
  gender: CampaignSpeakerGender;
  /** 配音选角说明：年龄、口音、语气（en 用于英文配音，zh 用于中文配音） */
  voiceDirection: LocalizedText;
}
export const CAMPAIGN_SPEAKERS: Readonly<Record<CampaignSpeakerId, CampaignSpeaker>>;
/** 剧情卡片旁白（章节简报、序章、尾声）的配音者：天穹指挥官瓦尔加上校 */
export const NARRATION_SPEAKER: CampaignSpeakerId; // 'hq'

export type RadioTriggerKind =
  | 'level-start' | 'wave-start' | 'wave-complete'
  | 'boss-spawn' | 'boss-phase' | 'boss-low-health' | 'boss-defeated';
export interface RadioLine {
  /**
   * 稳定唯一 id，同时是语音文件名（小写字母、数字、连字符）。
   * 章节台词：c{两位章号}-{触发}[-{序号}]-{说话人}[-{同组第 n 句}]，如 c03-wave-start-2-wingman2；
   * 首次遭遇：contact-{单位类型}；通用台词：generic-{键}。
   */
  id: string;
  trigger: RadioTriggerKind;
  /** 波次序号或 Boss 阶段号；缺省表示不区分序号 */
  index?: number;
  speaker: CampaignSpeakerId;
  text: LocalizedText;
}
/** 带稳定 id 的配音旁白段落（章节简报 / 序章 / 尾声）；本身就是 LocalizedText，可直接 tr() */
export interface VoicedText extends LocalizedText {
  readonly id: string;
}

export interface CampaignBossBrief {
  name: LocalizedText;
  /** 英文代号（两种语言下相同） */
  codename: string;
  briefingLine: LocalizedText;
  weakPointHint: LocalizedText;
}
export interface CampaignChapter {
  level: number;
  chapterLabel: LocalizedText;
  /** 行动代号（英文，两种语言下相同），如 OPERATION FIRST LIGHT */
  codename: string;
  /** 本地化行动名：中文如「破晓行动」；英文界面与 codename 重复，故 en 为空串（卡片只显示代号） */
  operationName: LocalizedText;
  /** 关卡标题（与 LevelConfig.name 是同一个对象，见 ChapterTitles） */
  title: LocalizedText;
  location: LocalizedText;
  /** 章节简报（卡片打字机逐段展示；由天穹指挥官配音） */
  intro: readonly VoicedText[];
  objectives: readonly LocalizedText[];
  levelBriefingLine: LocalizedText;
  boss: CampaignBossBrief;
  radio: readonly RadioLine[];
  unlockedWeapons: readonly SpecialWeaponId[];
  /** 解锁说明（含按键提示，不配音；无解锁时为 null） */
  unlockLine: LocalizedText | null;
  debriefSummary: LocalizedText;
}

export const CAMPAIGN_TITLE: LocalizedText; // 'AIR SUPREME · The Skydome War' / 'AIR SUPREME · 天穹之战'
export const CAMPAIGN_PROLOGUE: readonly VoicedText[];
export const CAMPAIGN_EPILOGUE: readonly VoicedText[];
export const CAMPAIGN_CREDITS: readonly LocalizedText[];
export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[];
/** 十个章节的标题（关卡 1..10）；章节 title 与 LevelConfig 的 name 引用同一个对象 */
export const CHAPTER_TITLES: readonly LocalizedText[];

/** 首次遭遇某类单位时的提示台词；键为 UnitType 枚举的字符串值 */
export const UNIT_FIRST_CONTACT_RADIO: Readonly<Record<string, RadioLine>>;
export type GenericRadioKey =
  | 'civilian-hit' | 'civilian-destroyed' | 'ally-unit-destroyed' | 'awacs-lost' | 'frigate-lost'
  | 'escort-success' | 'escort-failed' | 'missile-warning' | 'low-health' | 'weapon-overheat'
  | 'checkpoint' | 'swift-joined' | 'raven-down-swift' | 'raven-down-hq' | 'swift-down-raven'
  | 'swift-down-hq';
export const GENERIC_RADIO: Readonly<Record<GenericRadioKey, RadioLine>>;

/** 配音脚本条目（getVoiceScript 的返回值，供配音批次逐句生成语音） */
export interface VoiceScriptLine {
  /** 稳定唯一 id = 语音文件名 */
  id: string;
  speaker: CampaignSpeakerId;
  text: LocalizedText;
  /** narration：剧情卡片旁白；radio：无线电台词 */
  kind: 'narration' | 'radio';
}

export function getCampaignChapter(level: number): CampaignChapter; // clamps to 1..TOTAL_LEVELS
export function getChapterRadio(level: number, trigger: RadioTriggerKind, index?: number): RadioLine[];
export function getUnlockedWeaponsThrough(level: number): SpecialWeaponId[];
export function getWeaponUnlockLevel(weapon: SpecialWeaponId): number | null;
/**
 * 全部需要配音的台词（每次返回新数组），按播放顺序：
 * 序章 → 每章（简报旁白 + 无线电）→ 首次遭遇 → 通用告警 → 尾声。
 */
export function getVoiceScript(): VoiceScriptLine[];
```

Unlock schedule (`CampaignChapter.unlockedWeapons`): rockets 2 · laser 4 · swarm 6 · railgun 7 · emp 9.

The generic keys `awacs-lost` / `frigate-lost` replace `ally-unit-destroyed` when an `ALLY_AWACS` / `ALLY_FRIGATE` is lost (`ALLY_LOSS_RADIO` in `src/core/units/UnitController.ts`); the five wingman keys (`swift-joined`, and `raven-down-swift`, `raven-down-hq`, `swift-down-raven`, `swift-down-hq`, whose last word names who reports the loss) are played through `ICampaignPresentation.onWingmanEvent`. `getVoiceScript()` is the voiced script the voice packs are recorded from — see [voice-lines.md](voice-lines.md).

## Campaign presentation (`ICampaignPresentation`)

Source: `src/core/campaign/CampaignPresentation.ts`. Gameplay code tells the story, reports state and makes campaign sounds only through this interface; `DefaultCampaignPresentation` implements it on top of `StoryOverlay`, `RadioComms`, `HUD`, `PresentationController` (radar), `MusicSystem`, `CampaignSfxRouter` and, when one is supplied, a voice (`VoiceSystem`). See [ADR 0001](decisions/0001-campaign-presentation-adapter.md).

```typescript
export interface ICampaignPresentation {
  // ── 剧情卡片（StoryOverlay） ──
  /** 开局预加载剧情 / 无线电界面（失败时卡片直接放行） */
  preloadStoryUi(): Promise<void>;
  showChapterIntro(
    level: number,
    options: { includePrologue: boolean; unlockLine: string | null },
    onComplete: () => void
  ): void;
  showDebrief(data: CampaignDebriefInput, onContinue: () => void): void;
  showEnding(finalScore: number, onComplete: () => void): void;
  /** 剧情卡片显示中 */
  isStoryActive(): boolean;

  // ── 无线电（RadioComms） ──
  radio(
    trigger: RadioTriggerKind,
    level: number,
    index?: number,
    speakers?: RadioSpeakerFilter
  ): void;
  /**
   * 通用台词。返回这句是否进了无线电：Boss 模式过滤掉的普通台词、正在配音时跳过的紧急告警
   * （missile-warning / low-health / civilian-hit 从不打断正在配音的台词）返回 false。
   */
  genericRadio(key: GenericRadioKey): boolean;
  unitFirstContact(unitType: string): void;
  /** 僚机入列 / 被击落：播放 WINGMAN_EVENT_RADIO 登记的通用台词（未登记的事件不出声） */
  onWingmanEvent(id: WingmanId, event: WingmanEvent): void;
  /** 某名僚机此刻是否在空中（无线电 / 语音挑选说话人用） */
  isWingmanFlying(id: WingmanId): boolean;
  /** 无线电正在播放或有排队台词 */
  isRadioBusy(): boolean;
  /**
   * 估计无线电把当前与排队的台词全部说完还要多少秒（游戏时间；有配音的台词按语音包清单里的
   * 当前语言时长计）。Boss 收尾据此设定等待上限。
   */
  getRadioBacklogSeconds(): number;
  /** 关卡结束 / 换关 / 失败：清空无线电 */
  clearRadio(): void;

  // ── HUD 新面板 ──
  updateWeaponPanel(state: CampaignWeaponPanelState | null): void;
  updateFlares(charges: number, max: number, rechargeProgress: number): void;
  /** 自动存档提示 + 存档音效；双语对象或 { text, params }（HudText）在提示显示期间随语言切换重绘 */
  showAutosave(label: HudText): void;
  /** announce = false：开局 / 读档同步视角，不播放切换音效 */
  setCameraMode(mode: CameraModeSetting, announce?: boolean): void;
  /** Boss 状态条（null 且没有阶段时收起）；HudText 在显示期间随语言切换重绘，纯字符串原样显示 */
  setBossStatus(label: HudText | null, phase?: { current: number; total: number }): void;
  /** 导弹告警：单位（SAM）与 Boss 导弹两个来源取最高级 */
  setMissileWarning(level: MissileWarningLevel, source?: 'units' | 'boss'): void;
  /** 闪烁告警（约 2.2 秒）；text 可本地化（同上） */
  flashWarning(text: HudText, tone: 'threat' | 'sys' | 'ally'): void;
  setRadarRangeMultiplier(multiplier: number): void;
  /** 每个模拟步长：低血量蜂鸣 + 低血量无线电（高优先级） */
  updatePlayerHealth(deltaTime: number, healthPercent: number, active: boolean): void;

  // ── 音乐 ──
  playLevelMusic(level: number): void;
  playBossMusic(level: number): void;
  playStinger(kind: CampaignStinger): void;
  setMusicIntensity(intensity: number): void;
  /** Boss 进入新阶段：阶段台词、警报 + phase-change 刺激音、音乐强度、HUD 闪烁告警（label 可本地化） */
  onBossPhaseChange(level: number, phase: number, label: HudText | null): void;
  /** Boss 血量首次低于 25%：台词；adjustIntensity 时音乐强度拉满 */
  onBossLowHealth(level: number, adjustIntensity: boolean): void;
  onPause(): void;
  onResume(): void;
  onGameOver(): void;
  /** 第 10 关之后：campaign-complete 刺激音，随后胜利曲 */
  onMissionComplete(): void;

  // ── 音效 ──
  onWeaponEvent(event: WeaponPresentationEvent, weapon: SpecialWeaponId | null): void;
  onUnitEvent(event: UnitPresentationEvent, position: THREE.Vector3 | null, scale?: number): void;
  onBossCue(cue: string, position: THREE.Vector3, intensity: number): void;

  /** 每个模拟步长：无线电计时（剧情卡片显示时冻结） */
  update(deltaTime: number): void;
  dispose(): void;
}
```

Supporting types (same file):

```typescript
export interface CampaignDebriefInput {
  level: number;
  scoreGained: number;
  totalScore: number;
  kills: number;
  civiliansLost: number;
  alliesLost: number;
  bonusPoints: Array<{ label: string; points: number }>;
}
/** 与 MusicSystem 的 MusicStinger 取值一致 */
export type CampaignStinger =
  | 'chapter-start' | 'boss-defeated' | 'level-complete' | 'game-over'
  | 'campaign-complete' | 'checkpoint' | 'phase-change';
export type WeaponPresentationEvent =
  | 'fired' | 'beam-end' | 'overheat' | 'charge-start' | 'charge-cancel' | 'dry-fire'
  | 'switch' | 'unlock' | 'flare' | 'flare-empty' | 'emp';
export type UnitPresentationEvent =
  | 'cannon' | 'missile-launch' | 'flak-burst' | 'rocket-salvo' | 'ciws' | 'bomb-drop'
  | 'sub-surface' | 'sub-dive' | 'sam-locking' | 'sam-launched' | 'explosion'
  | 'civilian-hit' | 'destroyed-ground' | 'destroyed-sea' | 'destroyed-air';
export type MissileWarningLevel = 'none' | 'locking' | 'incoming';
export interface RadioSpeakerFilter {
  only?: CampaignSpeakerId;
  exclude?: CampaignSpeakerId;
}
/** HUD 武器面板快照（与 WeaponSystem.getHudState() 结构一致） */
export interface CampaignWeaponPanelState {
  selected: SpecialWeaponId | null;
  name: string;
  icon: string;
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
  slots: Array<{ id: SpecialWeaponId; icon: string; shortCode: string; selected: boolean; ready: boolean }>;
}
export interface RadarRangeTarget {
  setRadarRangeMultiplier(multiplier: number): void;
}
/** 表现层用到的配音接口（VoiceSystem 的子集，便于测试替身） */
export interface CampaignVoice {
  play(lineId: string, options: VoicePlayOptions): number;
  stop(kind?: VoiceKind): void;
  stopAll(): void;
  pause(): void;
  resume(): void;
  prefetch(lineIds: readonly string[]): void;
  loadManifest(): Promise<unknown>;
  /** 清单记录的这句配音时长（秒，当前语言）；没有这句 / 清单未加载时为 null */
  getLineDuration?(lineId: string): number | null;
}
export interface DefaultCampaignPresentationDeps {
  getHud(): HUD | null;
  getRadar(): RadarRangeTarget | null;
  audio: AudioManager;
  music: MusicSystem;
  /** Boss 模式：没有剧情卡片，无线电只播 Boss 登场与高优先级告警 */
  isBossMode(): boolean;
  /** 听者（玩家）位置：远处单位事件静音 */
  getListenerPosition(): THREE.Vector3 | null;
  /** 剧情界面模块加载（缺省为动态导入；测试可注入） */
  loadStoryUi?(): Promise<StoryUiModules>;
  /** 具名僚机的在空状态（缺省视为都不在空中） */
  wingmen?: WingmanStatus;
  /** 角色配音（缺省没有配音：无线电与剧情卡片纯文字） */
  voice?: CampaignVoice;
}
export class DefaultCampaignPresentation implements ICampaignPresentation {
  constructor(deps: DefaultCampaignPresentationDeps);
}
```

Behaviour worth knowing: radio lines enqueued before the story UI loads are buffered (up to 6, duplicates dropped); `civilian-hit`, `missile-warning` and `low-health` are high priority — they interrupt a normal line that is only being read, but never a line whose voice is playing (`RadioComms.isVoicing()`): then `genericRadio` skips them and returns `false`, and the low-health call waits until the voiced line has ended (the low-health beep does not wait). Boss mode keeps only `boss-spawn` chapter lines and the high-priority generic lines (`genericRadio` returns `false` for the rest). `getRadioBacklogSeconds()` asks `RadioComms.estimateRemainingSeconds` with the current pack's durations from `voice.getLineDuration` (before the story UI loads, each buffered line counts its voice length or 6.5 s, plus 1.5 s). Per-frame HUD pushes are diffed (no call when nothing visible changed). `GameCoordinator` passes its `WingmanRoster` as `wingmen` and its `VoiceSystem` as `voice`.

Voice wiring (all optional — without `voice` the radio and the story cards are text only):

- **Radio.** `RadioComms.onLineShown` plays the line's voice: `voice.play(line.id, { kind: 'radio', speaker: line.speaker, … })`. On start the line is held for the voice (`RadioComms.holdForVoice(line, duration)`); on end or silence it is released (`releaseVoice(line)`). A line replayed after a high-priority interrupt (at most one replay per line) calls `play` again, so its voice starts over.
- **Narration.** `StoryOverlay.narration` is set to a `StoryNarration` that plays each paragraph id as `kind: 'narration'` with `NARRATION_SPEAKER` and stops with `voice.stop('narration')`.
- **Prefetch.** `showChapterIntro` prefetches the chapter's lines — prologue (when shown), briefing, level-start lines, the rest of the chapter's radio, then the urgent generic lines (`missile-warning`, `low-health`, `civilian-hit`); `playBossMusic` prefetches the chapter's `boss-*` lines (Boss mode has no chapter card). `preloadStoryUi` also starts loading the voice manifest.
- **Lifecycle.** `onPause` / `onResume` pause and resume the voice; `clearRadio` stops the radio voice; the debrief card clears the radio queue but lets the line being spoken finish; `onGameOver`, `onMissionComplete` and `dispose` stop all voices. The voice belongs to the coordinator, which disposes it.
- **Wingman events.** `WINGMAN_EVENT_RADIO` maps `swift:joined` → `swift-joined`, `raven:down` → `raven-down-swift` (Swift reports, if she is flying) or else `raven-down-hq`, and `swift:down` → `swift-down-raven` or else `swift-down-hq`. Raven has no join line; unmapped events are silent. Outside the dev hooks, `'joined'` is only sent by `CampaignFlowController.handleWingmanLaunched` — once per campaign run, see [Wingmen](#wingmen).

## Radio budget

Source: `src/core/campaign/RadioBudget.ts`. Decides only whether an urgent warning is voiced this time; the caller still shows the HUD flash and plays the warning tone every time.

```typescript
export interface RadioBudgetConfig {
  /** 每波最多开口几次 */
  readonly maxPerWave: number;
  /** 第 n 次开口之后的冷却（秒，逐次加长；超出数组长度沿用最后一项） */
  readonly cooldownSeconds: readonly number[];
}
export class RadioBudget {
  constructor(config: RadioBudgetConfig);
  /** 本波还有配额且不在冷却中 */
  isReady(): boolean;
  /** 记一次开口，进入下一档冷却 */
  consume(): void;
  /** 推进冷却（游戏时间，秒） */
  update(deltaTime: number): void;
  /** 新的一波 / Boss 战：配额与冷却清零 */
  reset(): void;
  getUsed(): number;
}
```

Usage: when `isReady()`, try the line and `consume()` only if `presentation.genericRadio(key)` returned `true`. `UnitController` keeps two budgets, reset on every `spawnForWave` (wave start) and `clear()` (level change, checkpoint load, boss fight start): the SAM `missile-warning` voice (`{ maxPerWave: 2, cooldownSeconds: [20, 45] }`; the "Missile inbound · Press G for flares" flash — "Missile inbound · Tap FLARE" / "导弹来袭 · 点「热焰」键" when `GameConfig.isMobile` — and the `sam-launched` sound event go out on every launch) and the `civilian-hit` voice (`{ maxPerWave: 2, cooldownSeconds: [15, 30] }`; the cease-fire flash and the `civilian-hit` sound event go out on every hit).

## Campaign flow

Source: `src/core/campaign/CampaignFlowController.ts`.

```typescript
export interface CampaignFlowDeps {
  session: GameSessionState;
  stats: PlayerStats;
  presentation: ICampaignPresentation;
  prepareLevel(level: number, startWave: number): Promise<void>;
  startLevelCombat(level: number, startWave: number, firstLevelOfSession: boolean): void;
  startBossEncounter(level: number, isBossMode: boolean): void;
  showHangar(level: number, onContinue: () => void): void;
  syncProgression(level: number): void;
  setStoryHold(hold: boolean): void;
  showMissionComplete(finalScore: number): void;
  /** 'hangar' 检查点的 level 是即将开始的那一关（升级上限与武器解锁按那一关） */
  captureCheckpoint(kind: CheckpointKind, level: number, wave: number): CampaignCheckpointInput;
  getScore(): number;
}

/** 暂停菜单“保存并退出”的去向（describeExitSave 的预告与 saveForExit 的实际结果同一形状） */
export type CampaignExitSave =
  | { kind: 'saved'; stage: CheckpointKind; position: LocalizedText }
  | { kind: 'no-save-mode' | 'not-started' | 'complete' | 'failed' };

export class CampaignFlowController {
  constructor(deps: CampaignFlowDeps);
  setupNewRun(level: number): void;
  beginNewRun(level: number): void;
  resumeFromCheckpoint(save: CampaignSaveData): void;
  /** “保存并退出”的预告（只读，不写存档）：会存到哪里，或者为什么不存 */
  describeExitSave(): CampaignExitSave;
  /** 暂停菜单“保存并退出”：把此刻的快照重写在当前进度的检查点位置上；写入后读回确认 */
  saveForExit(): CampaignExitSave;
  handleWaveStart(wave: number): void;
  handleWaveComplete(wave: number): void;
  handleLevelComplete(level: number): void;
  handleBossDefeated(level: number, isBossMode: boolean): void;
  recordKill(): void;
  recordAssetLost(civilian: boolean): void;
  recordDeath(): void;
  /** 累计游戏时间并推进 Boss 收尾（只在战斗进行时调用：暂停 / 剧情冻结时不调用） */
  tick(deltaTime: number): void;
  /** 具名僚机随编队升空：雨燕每局第一次升空时播入列台词并记进当前检查点（Boss 模式不播） */
  handleWingmanLaunched(id: WingmanId): void;
  getRunStats(): CampaignRunStats;
  isVictory(): boolean;
  dispose(): void;
}
```

The sequence it drives is in [architecture.md → Campaign flow](architecture.md#campaign-flow). Details:

- **Hangar checkpoint.** In normal mode, a boss kill in levels 1–9 writes a `'hangar'` checkpoint at once, with the next level and wave 0: post-boss score, run stats and upgrade points, and the next level's upgrade caps and weapon unlocks (`captureCheckpoint` rewrites `upgrades.campaignLevel` / `unlockedWeapons` and `weapons.unlocked` for that level). Its autosave toast reads "Level N cleared" / "第N关完成" for the level just finished. Pressing **Launch** in the hangar (`launchChapter`) rewrites it silently before the chapter card, so purchases survive a quit during the card. Level 10 marks the campaign complete and clears the checkpoint instead; Boss mode never saves.
- **Resume.** `resumeFromCheckpoint` on a `'hangar'` save sets the level, syncs progression and opens the hangar; Launch continues as after a boss kill (chapter card without prologue or tutorial, then combat). `'level-start'` / `'wave'` saves resume at the saved wave, `'boss'` saves (or `wave >= totalWaves`) at the boss briefing. The "Resumed: …" toast is a bilingual object built from `describeCheckpointText(save)`.
- **Boss outro.** `handleBossDefeated` plays the `boss-defeated` stinger, then waits on game time advanced by `tick` (pauses and story holds freeze it): at least `BOSS_OUTRO_MIN_SECONDS` (1.6 s), then until `presentation.isRadioBusy()` is false, with a watchdog ceiling of `min(BOSS_OUTRO_MAX_SECONDS (75 s), max(1.6 s, getRadioBacklogSeconds()) + BOSS_OUTRO_SLACK_SECONDS (6 s))` taken when the outro starts. At the ceiling the debrief opens and the line being spoken finishes. If the player dies or leaves meanwhile, the outro is dropped.
- **Autosave labels** are `HudText`: `{ text: 'Level {level} · Wave {wave}' | 'Level {level} · Before the boss' | 'Level {level} cleared', params }` (with their Chinese forms), so a toast on screen follows a language switch. Only `'wave'` checkpoints add the `checkpoint` stinger.
- **Save & Exit.** The controller keeps an _exit point_ `{ kind, level, wave }`: the position of the most recent checkpoint (taken from the save on resume, set by every checkpoint write). When the last wave is cleared it becomes `{ kind: 'boss', level, wave: totalWaves }` before the `'boss'` checkpoint is written; it is `null` before the first checkpoint and after the campaign is complete. `describeExitSave()` is a read-only preview: `'no-save-mode'` in Boss mode; with no exit point `'complete'` after a victory, otherwise `'not-started'`; else `'saved'` with the checkpoint kind and the position text (the same wording as `describeCheckpointText`). `saveForExit()` writes a checkpoint at the exit point with the snapshot of that moment (score, lives, missiles, upgrades, special weapons and ammo, flares, camera view, stats), shows no autosave toast, then loads the stored checkpoint and returns `'failed'` unless it is the one just written (the write succeeded, the record reads back, `savedAt` is not older than the call, and kind, level, wave and score match). Continuing from it restarts that wave, the boss fight or the hangar stop. `'failed'` only ever comes from `saveForExit()`.
- **Swift's join line.** `handleWingmanLaunched('swift')` plays `onWingmanEvent('swift', 'joined')` the first time Swift launches in a campaign run, then patches `swiftJoined: true` into the stored checkpoint (the `'level-start'` checkpoint is written just before the flight launches); every later checkpoint carries the flag, and `resumeFromCheckpoint` reads it with `isSwiftJoinAnnounced(save)`.
- **After game over.** A death can land in the same simulation step as a wave clear, a level clear or a boss kill, and the coordinator finishes that step. Once the session status is `GAME_OVER` the controller leaves storage alone: `writeCheckpoint` returns `null` without writing, the level-10 branch of `handleBossDefeated` neither marks the campaign complete nor clears the checkpoint, and the Swift flag is not patched in — so the position the settlement panel names is still the one that is stored. `GameCoordinator`'s `LEVEL_COMPLETE` handler also returns while the session is not playing, so a late level clear does not start the boss encounter under the panel.

## Wingmen

Source: `src/core/campaign/Wingmen.ts`. Decides which friendly AI jet is which named wingman; flying and fighting stay with `FriendlyAI`.

```typescript
export type WingmanId = 'raven' | 'swift';
/** 入列 / 被击落（无线电与语音挂钩） */
export type WingmanEvent = 'joined' | 'down';

export interface WingmanProfile {
  readonly id: WingmanId;
  /** 呼号：友机血条标签（mesh.userData.displayName）与提示文案 */
  readonly callsign: LocalizedText;
  /** 从第几关起随队出击（与战役剧情的入队章节一致） */
  readonly joinsAtLevel: number;
}
/** 编队顺序即入列顺序：先渡鸦，后雨燕（雨燕在第 3 章雪山救援中入队） */
export const WINGMEN: readonly WingmanProfile[]; // raven (level 1), swift (level 3)

/** 只读视图：无线电 / 语音据此判断某名僚机此刻是否在空中 */
export interface WingmanStatus {
  isFlying(id: WingmanId): boolean;
}

export class WingmanRoster implements WingmanStatus {
  constructor(profiles: readonly WingmanProfile[] = WINGMEN);
  /** 新友机入场：返回它的僚机身份；null 表示普通友机 */
  assign(friendlyId: string, level: number): WingmanProfile | null;
  /** 此刻还能领取的僚机身份数（该关已随队、不在空中、本关未被击落） */
  countAvailable(level: number): number;
  /** 友机坠毁：是僚机则记为本关被击落并返回其身份；普通友机返回 null */
  release(friendlyId: string): WingmanProfile | null;
  /** 友机全部撤场（换关 / 读档 / Boss 击破）：僚机全部归队 */
  reset(): void;
  isFlying(id: WingmanId): boolean;
}
```

`GameCoordinator` owns one roster, passed to the presentation as its `WingmanStatus`. Every friendly AI jet is spawned by `spawnFriendlyJet()`, which calls `assign(mesh.uuid, level)` — the first profile that has joined by that level, is not flying and was not shot down this level wins — and puts the callsign on `mesh.userData.displayName` (the health bar label). Launch rules:

- **Named flight.** Shortly after every level start (`startLevelCombat`: 1 s, or after the tutorial intro on level 1) and when a resume starts at a `'boss'` checkpoint (`startBossEncounter` in normal mode), `launchWingmen()` spawns `countAvailable(level)` jets — Raven in levels 1–2, Raven and Swift from level 3 — and calls `CampaignFlowController.handleWingmanLaunched(id)` for each. Coming from the waves to the boss, the flight is already up, so nothing launches twice.
- **Other friendlies** — wave reinforcements, boss-fight support (`BossBattleController`'s `onSpawnFriendly`), the Call Wingman pickup and escort jets — go through `spawnFriendlyAI()`. They can take a callsign that is free (for example in Boss mode, where no flight launches) but never fire `'joined'`.
- **Losses and resets.** On `FRIENDLY_DEATH` the coordinator calls `release(friendlyId)`, names the wingman in the HUD toast and fires `onWingmanEvent(id, 'down')`; a downed wingman sits out the rest of the level. `reset()` runs when a level is prepared (new level or checkpoint resume) and when a boss is destroyed.

Formation flight (`src/features/enemy/FriendlyAI.ts`, `src/core/systems/EnemySystem.ts`, `src/features/enemy/EnemyAI.ts`):

```typescript
// FriendlyAI.ts — 编队位布局的唯一来源（EnemySystem 的友机入场点也按它取值）
/** 编队位在玩家水平航向坐标系中的偏移（米）：along 向前、lateral 向右、up 向上 */
export interface FormationSlotOffset {
  side: number; // -1 = 左侧，1 = 右侧
  along: number;
  lateral: number;
  up: number;
}
/** 第 slot 号编队位的偏移（写入 out 并返回，不分配）：偶数号在左、奇数号在右，每排再向外、向后、向上错开 */
export function getFormationSlotOffset(slot: number, out: FormationSlotOffset): FormationSlotOffset;

// FriendlyAI
/** 有敌机（或 Boss 本体 / 部件等额外目标）时追击最近的目标；没有目标时飞向编队位 */
public update(
  deltaTime: number,
  enemyMeshes: readonly THREE.Object3D[],
  playerPosition: THREE.Vector3,
  playerVelocity?: THREE.Vector3 // EnemySystem 的平滑估计：航向与速度前馈
): void;
/** EnemySystem 入场时分配的编队位（0 = 左翼、1 = 右翼、2 = 左二……） */
public setFormationSlot(slot: number): void;
public getFormationSlot(): number;

// EnemySystem
/**
 * 下一架友机的入场位姿（随后 spawnFriendly 分配同一个编队位）：玩家身侧、编队位所在一侧，
 * 机头朝玩家的水平航向；outPosition 写入世界坐标，outHeading 写入水平单位向量
 */
getFriendlySpawnPose(
  playerPosition: THREE.Vector3,
  playerForward: THREE.Vector3,
  outPosition: THREE.Vector3,
  outHeading: THREE.Vector3
): void;
```

- **Slots.** `EnemySystem.spawnFriendly` gives each new friendly the lowest slot no living friendly holds, so the two named wingmen never share a side. `getFormationSlotOffset` lays slots out in the player's horizontal heading frame (from the smoothed player velocity): slot 0 left, slot 1 right, 38 m ahead of the wing line, 40 m out, 6 m up; each further rank adds 35 m out, 25 m back and 4 m up.
- **Camera corridor.** An idle friendly steers clear of the chase camera's sight corridor (60 m behind to 35 m ahead of the jet, ±28 m to the side): inside it, it steps out sideways first (with a higher gain); a path to its slot that would cross it goes round behind the camera or well ahead of the jet (the right-hand slot detours further, so two wingmen changing sides do not meet).
- **Steering.** Desired velocity = player velocity + a clamped correction toward the target point, followed with a 2 rad/s turn rate and 25 m/s² acceleration, then `EnemyAI.updateKinematic(dt)` (see [Enemy AI](#enemy-ai)). As soon as an enemy jet or boss target exists, `update` returns to the usual chase from the frozen manoeuvre state.
- **Spawn pose.** `getFriendlySpawnPose` places the next friendly at its slot's `getFormationSlotOffset` moved 12 m back (40 m out plus 35 m per rank, 26 m ahead minus 25 m per rank, 6 m plus 4 m per rank up) in the player's nose frame, falling back to the smoothed velocity when the nose is near vertical, then −Z. The coordinator writes the pose to the mesh before constructing `FriendlyAI` (the AI snapshots its interpolation state in the constructor), keeps it at least 30 m above the terrain, points the nose along the player's heading and starts it at `max(config.speed, player speed)`.

## Enemy AI

Source: `src/features/enemy/EnemyAI.ts`, `EnemyTypes.ts`. Enemy jets and the friendly jets (`FriendlyAI` wraps an `EnemyAI`) share it; `LevelManager` builds each enemy jet's `EnemyConfig` from the base config × level curve × difficulty.

```typescript
// EnemyConfig (EnemyTypes.ts) addition
/** 射击提前量 0..1（可选，缺省 0 = 瞄准目标当前位置）：LevelManager 生成敌机时按 enemyAimLead 写入；友军僚机不设置 */
aimLead?: number;

// EnemyAI
public update(
  deltaTime: number,
  playerPosition: THREE.Vector3 | null,
  friendlyMeshes?: THREE.Object3D[],
  fireTarget: THREE.Vector3 | null = null
): void;
/** 开火目标的速度（世界坐标，米/秒）：设置后按 config.aimLead 计算提前量；null 或非有限 / 过大（瞬移）的速度只瞄准目标当前位置 */
public setTargetVelocity(velocity: THREE.Vector3 | null): void;
/**
 * 外部操纵的运动学步进（僚机编队飞行等）：调用方先写好 velocity；与 update 一样做地形避让、位置积分、
 * 贴地兜底、按速度方向的四元数朝向、尾迹与渲染插值，但不运行机动状态机、不开火
 * （状态与计时冻结，攻击冷却与 EMP 瘫痪照常计时；velocity 非有限时沿机头按配置速度飞行）
 */
public updateKinematic(deltaTime: number): void;
```

Aiming: a jet fires only when its nose is within `fireSpreadAngle` of the target and the target is inside `FIRE_RANGE` (420 m). With a target velocity below 250 m/s and `aimLead > 0`, the shot is aimed at `target + velocity × t × min(1, aimLead)`, where `t` is a two-step first-order intercept time at the bullet speed (`GAME_CONSTANTS.PROJECTILE.SPEED`), capped at 4 s; the accuracy-based yaw / pitch scatter is applied on top. `update` and `updateKinematic` share the same motion integration and NaN guard (a non-finite position is reset to the origin and the step skipped).

## Save system

Source: `src/core/save/SaveSystem.ts`. Only touches `localStorage` when called (via `getLocalStorage()`); never throws.

```typescript
export const CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save';
export const CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress';
export const CAMPAIGN_SAVE_VERSION = 1;

/**
 * 检查点类型：入关、波次之间、Boss 战之前、机库（击破上一关 Boss 后、下一章开始之前；
 * level 是即将开始的那一关，wave 为 0）
 */
export type CheckpointKind = 'level-start' | 'wave' | 'boss' | 'hangar';

export interface CampaignRunStats {
  kills: number;
  civiliansLost: number;
  deaths: number;
  playTimeSeconds: number;
}

export interface CampaignSaveData {
  version: typeof CAMPAIGN_SAVE_VERSION;
  /** 存档时间（Date.now() 毫秒） */
  savedAt: number;
  checkpoint: CheckpointKind;
  /** 关卡号 1..TOTAL_LEVELS */
  level: number;
  /** 下一个要进行的波次（从 0 开始）；Boss 检查点通常等于该关总波数 */
  wave: number;
  difficulty: number;
  score: number;
  lives: number;
  missiles: number;
  /** PlayerUpgrades.export() 的原样数据 */
  upgrades: Record<string, unknown>;
  /** WeaponSystem.exportState()（无限弹药的热量武器不写 ammo） */
  weapons: WeaponSaveState;
  /** 热焰弹剩余发数（CountermeasureSystem.exportState().charges） */
  flares: number;
  cameraMode: CameraModeSetting;
  stats: CampaignRunStats;
  /**
   * 本局战役雨燕的入列台词是否已播过（每局只播一次，读档不重播）。
   * 可选：加入这个字段之前写的存档没有它，按关卡推断（见 isSwiftJoinAnnounced）。
   */
  swiftJoined?: boolean;
}

export type CampaignCheckpointInput = Omit<CampaignSaveData, 'version' | 'savedAt'>;

export interface CampaignProgress {
  completed: boolean;
  bestScore: number;
  highestLevel: number;
}

export function saveCampaignCheckpoint(data: CampaignCheckpointInput): boolean;
export function loadCampaignCheckpoint(): CampaignSaveData | null;
export function clearCampaignCheckpoint(): void;
export function hasCampaignCheckpoint(): boolean;
/**
 * 默认当前语言，传入 locale 时按该语言：如 “Ch. 6 · Heart of the Forge · Wave 3” / “第6关 · 熔炉之心 · 第3波”；
 * Boss 检查点显示 “Boss” / “Boss 战”，机库检查点显示 “Hangar” / “机库整备”
 */
export function describeCheckpoint(data: CampaignSaveData, locale?: Locale): string;
/** describeCheckpoint 的双语版本 { en, zh }（HUD 提示切换语言时重绘） */
export function describeCheckpointText(data: CampaignSaveData): LocalizedText;
/** 存档里有 swiftJoined 时以它为准；旧存档按关卡推断：level > 3 视为已播 */
export function isSwiftJoinAnnounced(data: CampaignSaveData): boolean;
export function getCampaignProgress(): CampaignProgress;
export function markCampaignCompleted(finalScore: number): void;
export function recordLevelReached(level: number): void;
```

`loadCampaignCheckpoint` validates and normalises: corrupt JSON, a non-object, a different version or a missing level removes the key and returns `null`; out-of-range fields are clamped and missing ones defaulted (an unknown `checkpoint` becomes `'wave'` when `wave > 0`, else `'level-start'`); `swiftJoined` is kept only when it is a boolean. Saves written before `'hangar'` and `swiftJoined` existed load unchanged (`CAMPAIGN_SAVE_VERSION` is still 1). `saveCampaignCheckpoint` returns `false` when storage is unavailable, the write fails or the level is missing. Checkpoints are written by `CampaignFlowController` in normal mode only: `'level-start'` (wave 0) after the chapter card, `'wave'` (wave k + 1) after wave k except the last, `'boss'` (wave = `totalWaves`) before the boss, and `'hangar'` (the next level, wave 0) at a boss kill in levels 1–9 and again, silently, when the hangar's Launch is pressed; each carries the run's `swiftJoined` flag. Restore order in `GameCoordinator.restoreCheckpoint`: `upgrades.reset()` → `import(save.upgrades)` → `setCampaignLevel` → `setUnlockedWeapons(getUnlockedWeaponsThrough(level))` → `SpecialWeaponsController.syncProgression` → `importState(save.weapons, save.flares)` → score / lives / missiles / camera mode. The first `prepareLevel` after a restore keeps the saved ammo and flare charges, except after a `'hangar'` save, where the new chapter refills them as usual.

## Session settings

Source: `src/core/SessionSettings.ts`; `GameSettings` (`src/ui/StartMenu.ts`) mirrors `StartFlowSettings` field by field.

```typescript
export type GameMode = 'normal' | 'boss';
/** 视角偏好（与 CameraRig 的 CameraMode 取值一致） */
export type CameraModeSetting = 'third-person' | 'first-person';

/** 角色配音音量的缺省值（0..1；0 = 纯文字，不加载语音） */
export const DEFAULT_VOICE_VOLUME = 0.9;

export interface StartFlowSettings {
  difficulty: number;
  sfxVolume: number;
  musicVolume: number;
  /** 角色配音音量 0..1（旧存档没有该字段时取缺省值） */
  voiceVolume: number;
  qualityPreset: QualityPreset;
  tutorialEnabled: boolean;
  playerLives: number;
  startLevel: number; // clamped to 1..TOTAL_LEVELS
  gameMode: GameMode;
  testScore: number;
  cameraMode: CameraModeSetting; // default 'third-person'
  /** 界面语言：默认英文（不跟随浏览器语言），可在开始菜单 / 暂停菜单切换为简体中文 */
  language: Locale;
}

export const DEFAULT_START_FLOW_SETTINGS: StartFlowSettings = {
  difficulty: 3,
  sfxVolume: 0.7,
  musicVolume: 0.7,
  voiceVolume: DEFAULT_VOICE_VOLUME,
  qualityPreset: 'auto',
  tutorialEnabled: true,
  playerLives: 3,
  startLevel: 1,
  gameMode: 'normal',
  testScore: 0,
  cameraMode: 'third-person',
  language: DEFAULT_LOCALE,
};
export const START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings';

/** 语言设置的选项名：每种语言用它自己的写法（English / 中文），不随界面语言变化 */
export const LANGUAGE_ENDONYMS: Readonly<Record<Locale, string>>; // { en: 'English', 'zh-CN': '中文' }
/** 按 SUPPORTED_LOCALES 的顺序循环切换语言（菜单里的 - / +） */
export function stepLanguage(current: Locale, direction: 1 | -1): Locale;

export function normalizeCameraModeSetting(
  value: unknown,
  fallback: CameraModeSetting = 'third-person'
): CameraModeSetting;
export function normalizeStartFlowSettings(raw?: Partial<StartFlowSettings>): StartFlowSettings;
/** 调用时才访问 window.localStorage；不可用时返回 null（SaveSystem 复用） */
export function getLocalStorage(): Storage | null;
export function loadStartFlowSettings(): StartFlowSettings;
export function saveStartFlowSettings(settings?: Partial<StartFlowSettings>): void;
```

Normalisation: `voiceVolume` is clamped to 0..1 and falls back to `DEFAULT_VOICE_VOLUME` when missing or not a finite number; `language` goes through `normalizeLocale`, so saves from before the field existed, and unknown values, load as English. `saveStartFlowSettings` merges with what is stored before normalising, so a partial save (for example `{ voiceVolume }` from the pause menu) keeps every other field. `GameCoordinator` writes `cameraMode` back with `saveStartFlowSettings({ cameraMode })` whenever the view is toggled, applies `voiceVolume` to its `VoiceSystem` when it is constructed and when it boots with the start settings (the pause menu's Voice row applies it live through `IPauseMenuOptions.applyVoice`), and `src/main.ts` applies `language` with `setLocale` before any UI renders.

## Upgrades

Source: `src/features/upgrade/UpgradeSystem.ts`. Costs and per-tier values live in `UPGRADE_CONFIGS`.

```typescript
export enum UpgradeType {
  MAX_HEALTH = 'MAX_HEALTH',
  DAMAGE = 'DAMAGE',
  FIRE_RATE = 'FIRE_RATE',
  SPEED = 'SPEED',
  MISSILE_LOCK_TIME = 'MISSILE_LOCK_TIME',
  MISSILE_LOCK_RADIUS = 'MISSILE_LOCK_RADIUS',
  MISSILE_RELOAD_TIME = 'MISSILE_RELOAD_TIME',
  ARMOR = 'ARMOR',
  FLARES = 'FLARES',
  WEAPON_ROCKETS = 'WEAPON_ROCKETS',
  WEAPON_LASER = 'WEAPON_LASER',
  WEAPON_SWARM = 'WEAPON_SWARM',
  WEAPON_RAILGUN = 'WEAPON_RAILGUN',
  WEAPON_EMP = 'WEAPON_EMP',
}
export type UpgradeCategory = 'core' | 'defense' | 'weapon';
export interface UpgradeConfig {
  type: UpgradeType;
  name: LocalizedText;
  description: LocalizedText;
  maxLevel: number;
  costs: number[];
  valuePerLevel: number;
  baseValue: number;
  unit: LocalizedText;
  category: UpgradeCategory;
  /** 仅特殊武器强化线：对应的武器 */
  weaponId?: SpecialWeaponId;
}
export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig>;
export const WEAPON_UPGRADE_TYPES: Record<SpecialWeaponId, UpgradeType>;
export function getWeaponIdForUpgrade(type: UpgradeType): SpecialWeaponId | null;
/** core: min(10, level + 1) · defense: min(maxLevel, ceil(level / 2) + 1) · weapon: 0 before unlock, then min(5, level - unlockLevel + 2) */
export function getUpgradeCapForLevel(type: UpgradeType, campaignLevel: number): number;
/** 第 1 关为 0；第 N 关 = 第 N-1 关全部上限总花费 × 75%（向下取整） */
export function getStartingUpgradePoints(level: number): number;

// PlayerUpgrades additions
public setCampaignLevel(level: number): void;
public getCampaignLevel(): number;
public setUnlockedWeapons(ids: readonly SpecialWeaponId[]): void;
public getUnlockedWeapons(): SpecialWeaponId[];
public isLocked(type: UpgradeType): boolean;
public getCap(type: UpgradeType): number; // min(maxLevel, tier cap)
public getNextCapRaiseLevel(type: UpgradeType): number | null;
public awardBonusPoints(points: number): void;
// canUpgrade(): not locked, below maxLevel, below getCap(), enough points
// export() adds campaignLevel / unlockedWeapons / scorePointsAwarded; import() still accepts the old 7-track format

// PlayerStats additions
public getArmorReduction(): number; // 0..0.4
public getFlareCapacity(): number; // 2..6
public getWeaponUpgradeLevel(id: SpecialWeaponId): number; // 0..5
```

`PlayerSystem.takeCombatDamage(amount, feedback?)` applies `getArmorReduction()` before damaging the player.

The missile tracks feed the seeker: `MISSILE_LOCK_TIME` is 1.0 s at tier 0 and drops 0.05 s per tier (0.5 s at tier 10), read with `PlayerStats.getMissileLockTime()`; `MISSILE_LOCK_RADIUS` is the acquire-ring multiplier (1.0 → 2.0); `MISSILE_RELOAD_TIME` is 7.5 s minus 0.5 s per tier. See [Missiles and gun aim](#missiles-and-gun-aim).

## Units

Source: `src/features/units/UnitTypes.ts`, `UnitDeployments.ts`, `UnitSystem.ts`, `UnitEntity.ts`, `UnitMeshFactory.ts`. Unit stats (health, speed, hit radius, score, penalty) live in `UNIT_CONFIGS`; per-wave spawns in the deployment tables.

```typescript
export enum UnitType {
  TANK = 'TANK', SAM_LAUNCHER = 'SAM_LAUNCHER', AA_GUN = 'AA_GUN', RADAR_STATION = 'RADAR_STATION',
  GUNBOAT = 'GUNBOAT', FRIGATE = 'FRIGATE', SUBMARINE = 'SUBMARINE',
  ATTACK_HELICOPTER = 'ATTACK_HELICOPTER', BOMBER = 'BOMBER', DRONE = 'DRONE',
  ALLY_CONVOY = 'ALLY_CONVOY', ALLY_FRIGATE = 'ALLY_FRIGATE', ALLY_AWACS = 'ALLY_AWACS',
  ALLY_TRANSPORT = 'ALLY_TRANSPORT',
  CIVILIAN_AIRLINER = 'CIVILIAN_AIRLINER', CIVILIAN_SHIP = 'CIVILIAN_SHIP', CIVILIAN_TRUCK = 'CIVILIAN_TRUCK',
}
export type UnitDomain = 'ground' | 'sea' | 'air';
export type UnitRadarKind = 'enemy-ground' | 'enemy-sea' | 'enemy-air' | 'ally' | 'neutral';
export interface UnitConfig {
  type: UnitType;
  /** 显示名（HUD / 血条 / 结算），中英双语 */
  name: LocalizedText;
  domain: UnitDomain;
  faction: Faction;
  health: number;
  speed: number;
  hitRadius: number;
  scoreValue: number; // hostile kill score (0 for others)
  penalty: number; // score penalty when the player destroys a civilian / ally (0 if n/a)
  radarKind: UnitRadarKind;
  isEscort: boolean; // ALLY_CONVOY, ALLY_TRANSPORT
}
export const UNIT_TYPES: readonly UnitType[];
export const UNIT_CONFIGS: Record<UnitType, UnitConfig>;
export function isUnitType(value: unknown): value is UnitType;
export function isHostileUnitType(type: UnitType): boolean;

// UnitMeshFactory.ts
export function createUnitMesh(type: UnitType): THREE.Group; // sets userData.hitRadius / unitType / aimPoint
export function prewarmUnitMeshes(types: readonly UnitType[] = Object.values(UnitType)): void;

// UnitDeployments.ts
export type UnitPlacement = 'ahead' | 'flank' | 'around' | 'water' | 'route' | 'high-altitude';
export interface UnitSpawnSpec {
  type: UnitType;
  count: number;
  placement: UnitPlacement;
}
export const UNIT_DEPLOYMENT_LEVELS: number;
export function getDeploymentWaveCount(level: number): number;
export function getWaveDeployment(level: number, waveIndex: number): UnitSpawnSpec[]; // [] when none
```

```typescript
// UnitEntity.ts (re-exported from UnitSystem.ts)
export interface UnitInstance {
  readonly id: string;
  readonly type: UnitType;
  readonly config: UnitConfig;
  readonly mesh: THREE.Group;
  readonly faction: Faction;
  readonly domain: UnitDomain;
  isAlive(): boolean;
  /** 潜航中的潜艇返回 false */
  isTargetable(): boolean;
  getHealth(): { current: number; max: number };
  applyDamage(amount: number, source: DamageSource, hitPoint?: THREE.Vector3): void;
  applyStun(seconds: number): void;
  isStunned(): boolean;
  getPosition(out?: THREE.Vector3): THREE.Vector3;
}

// UnitSystem.ts
export interface UnitUpdateContext {
  playerMesh: THREE.Object3D;
  playerPosition: THREE.Vector3;
  enemyAirMeshes: THREE.Object3D[];
  friendlyAirMeshes: THREE.Object3D[];
}
export type UnitSurfaceSampler = (x: number, z: number) => { y: number; water: boolean };
export type UnitRouteProvider = (type: UnitType, domain: UnitDomain) => readonly THREE.Vector3[] | null;
export type PlayerLockState = 'none' | 'locking' | 'incoming';
export interface UnitEffectOverrides {
  damageSmoke?: (position: THREE.Vector3, intensity: number) => void;
  splash?: (position: THREE.Vector3, scale: number) => void;
  muzzleFlash?: (position: THREE.Vector3, intensity: number) => void;
}
export type UnitEventKind =
  | 'cannon' | 'missile-launch' | 'flak-burst' | 'rocket-salvo' | 'ciws' | 'bomb-drop'
  | 'sub-surface' | 'sub-dive';
export const MAX_UNITS = 80;
/** forEachAliveHostile 的访问函数：网格、当前 / 最大血量、作战域、此刻是否可被命中 */
export type HostileUnitVisitor = (
  mesh: THREE.Object3D,
  health: number,
  maxHealth: number,
  domain: UnitDomain,
  targetable: boolean
) => void;

export class UnitSystem implements IGameSystem {
  readonly name = 'UnitSystem';
  constructor(scene: THREE.Scene, particleSystem: ParticleSystem | null);
  init(): void;
  update(_deltaTime: number): void; // no-op; use updateWithContext
  updateWithContext(deltaTime: number, ctx: UnitUpdateContext): void;

  setSurfaceSampler(sampler: UnitSurfaceSampler | null): void;
  setEffectOverrides(overrides: UnitEffectOverrides | null): void;
  setDecoyProvider(provider: IDecoyProvider | null): void;
  setRouteProvider(provider: UnitRouteProvider | null): void;
  setLevelScaling(scaling: LevelScaling): void;
  getLevelScaling(): LevelScaling;

  spawnForWave(level: number, waveIndex: number, playerPosition: THREE.Vector3): UnitInstance[];
  spawnUnit(
    type: UnitType,
    position: THREE.Vector3,
    options?: { route?: THREE.Vector3[] }
  ): UnitInstance | null; // null at MAX_UNITS or on invalid input

  getUnits(): readonly UnitInstance[]; // live units only
  getCombatTargets(): CombatTarget[]; // alive && targetable, all factions
  getHostileMeshes(): THREE.Object3D[];
  getFriendlyMeshes(): THREE.Object3D[];
  getCivilianMeshes(): THREE.Object3D[];
  findByMesh(object: THREE.Object3D): UnitInstance | null; // root or any descendant
  hitTest(point: THREE.Vector3, padding = 0): UnitInstance | null; // radius-aware point test
  getAliveHostileCount(): number; // incl. submerged — wave gating
  /** 逐个访问存活的敌方单位（HUD 目标标记 / 波次提示用），不分配；targetable 为 false = 潜航中的潜艇 */
  forEachAliveHostile(visit: HostileUnitVisitor): void;
  getHostileRadarBonus(): number; // enemy-jet accuracy bonus while enemy radar stations live
  getRadarRangeMultiplier(): number; // > 1 while an ALLY_AWACS lives
  getRadarBlips(): Array<{ position: THREE.Vector3; kind: UnitRadarKind }>;
  getIncomingMissiles(): ReadonlyArray<{ position: THREE.Vector3; targetIsPlayer: boolean }>;
  getPlayerLockState(): PlayerLockState;
  destroyMissilesInRadius(center: THREE.Vector3, radius: number): number; // EMP
  applyAreaDamage(center: THREE.Vector3, radius: number, damage: number, source: DamageSource): number;
  applyAreaStun(center: THREE.Vector3, radius: number, seconds: number): number; // ENEMY units only
  clear(): void; // removes everything, no callbacks; first-contact memory survives
  resetFirstContacts(): void;
  dispose(): void;

  onUnitFire?: (
    position: THREE.Vector3,
    direction: THREE.Vector3,
    damage: number,
    faction: Faction,
    owner: THREE.Object3D
  ) => void;
  onUnitDestroyed?: (unit: UnitInstance, position: THREE.Vector3, byPlayer: boolean) => void;
  onCivilianHit?: (unit: UnitInstance) => void;
  onEscortResult?: (success: boolean, unit: UnitInstance) => void;
  onLockWarning?: (unit: UnitInstance, phase: 'locking' | 'launched') => void;
  onPlayerDamaged?: (damage: number, cause: 'sam' | 'kamikaze' | 'bomb', position: THREE.Vector3) => void;
  onFirstContact?: (type: UnitType) => void;
  onExplosion?: (position: THREE.Vector3, scale: number, kind: 'ground' | 'sea' | 'air' | 'missile') => void;
  onMissileDecoyed?: (position: THREE.Vector3) => void;
  onUnitDamaged?: (unit: UnitInstance, amount: number, byPlayer: boolean) => void;
  onUnitDeparted?: (unit: UnitInstance, reason: 'arrived' | 'exited') => void;
  onUnitEvent?: (unit: UnitInstance, kind: UnitEventKind, position: THREE.Vector3) => void;
}
```

Faction rules: damage from a player source (`cannon | missile | rocket | laser | swarm | railgun | emp`) counts as `byPlayer`; `applyAreaDamage` with a player source spares friendly units, and `'enemy-fire'` / `'boss'` spare enemy units. The system draws its own explosions — use `onExplosion` for camera shake and sound only. `UnitController` (`src/core/units/UnitController.ts`) is the runtime wrapper the coordinator talks to. `UnitMeshFactory.createUnitMesh` puts the unit's bilingual name on `mesh.userData.displayName` (`UNIT_CONFIGS[type].name`), which the HUD reads for the unit's health-bar label.

Wave hold, objective and markers (`UnitController`):

```typescript
/** HUD 目标标记的访问函数：网格、当前 / 最大血量（只给可被命中的敌方单位） */
export type HostileMarkerVisitor = (mesh: THREE.Object3D, health: number, maxHealth: number) => void;

public getWaveHoldCount(): number; // alive hostile units incl. submerged; 0 once the wave is released
public isObjectiveActive(): boolean; // jets cleared, hostile units still hold the wave, not released
public forEachHostileMarker(visit: HostileMarkerVisitor): void; // targetable hostile units only
public getSurfaceSampler(): UnitSurfaceSampler | null; // the level map's terrain source
public collectLockTargets(out: THREE.Object3D[]): void; // hostile-unit aim points for the seeker and gun aim
```

- **Stall release.** Once the jets are cleared and hostile units still hold the wave, a timer runs on game time; at `WAVE_STALL_LIMIT_SECONDS` (60 s) the wave is released with a "Remaining targets have left the area" flash. `UnitSystem.onUnitDamaged` with `byPlayer` on an `ENEMY` unit restarts the timer, so a player who is attacking is never cut off.
- **Objective.** While that hold lasts, `isObjectiveActive()` is true and `CombatHudFeed` flags the unit health-bar snapshots `objective`; `EnemyHealthBars` switches their bracket and off-screen arrow to the objective style. One hint per wave goes out through `presentation.flashWarning(text, 'sys')`, worded for what is left (ground / ship / air / mixed, or a submerged submarine).
- **Markers.** `forEachHostileMarker` visits the unit root meshes that can be hit right now; a submerged submarine still holds the wave but is not visited.

## Special weapons

Source: `src/features/weapons/WeaponTypes.ts`, `WeaponSystem.ts`. Per-tier stat tables live in `WeaponTypes.ts`.

```typescript
export type SpecialWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';
export interface SpecialWeaponConfig {
  id: SpecialWeaponId;
  /** 武器名（HUD 武器面板 / 升级菜单），中英双语 */
  name: LocalizedText;
  shortCode: string; // 'RKT' | 'LSR' | 'SWM' | 'RLG' | 'EMP' (same in both languages)
  icon: string;
  description: LocalizedText;
  mode: SpecialWeaponMode;
  maxUpgradeLevel: 5;
}
export interface SpecialWeaponStats {
  damage: number;
  range: number;
  cooldown: number;
  maxAmmo: number; // Infinity for heat weapons; salvo weapons count salvos
  reloadTime: number;
  projectileCount: number;
  splashRadius: number;
  chargeTime: number;
  heatPerSecond: number;
  coolPerSecond: number;
  stunSeconds: number;
  radius: number; // EMP radius
}
export const SPECIAL_WEAPON_MAX_UPGRADE_LEVEL = 5;
export const SPECIAL_WEAPON_CONFIGS: Record<SpecialWeaponId, SpecialWeaponConfig>;
export function getSpecialWeaponStats(id: SpecialWeaponId, upgradeLevel: number): SpecialWeaponStats;
export function clampWeaponUpgradeLevel(level: number): number;
export function isSpecialWeaponId(value: unknown): value is SpecialWeaponId;
export function isHeatBasedMode(mode: SpecialWeaponMode): boolean;
```

```typescript
export interface WeaponHudSlot {
  id: SpecialWeaponId;
  icon: string;
  shortCode: string;
  selected: boolean;
  ready: boolean;
}
export interface WeaponHudState {
  selected: SpecialWeaponId | null;
  name: string; // tr(config.name), in the language current when getHudState() runs
  icon: string;
  shortCode: string;
  mode: SpecialWeaponMode | null;
  ammo: number;
  maxAmmo: number;
  /** 0..1：距离下一发弹药的进度（弹药已满为 1） */
  reloadProgress: number;
  heat: number;
  overheated: boolean;
  charge: number;
  /** 0..1：剩余冷却比例（0 = 可以开火） */
  cooldown: number;
  ready: boolean;
  slots: WeaponHudSlot[];
}
export interface WeaponSaveState {
  unlocked: SpecialWeaponId[];
  selected: SpecialWeaponId | null;
  ammo: Partial<Record<SpecialWeaponId, number>>;
}
/** 发射基准：position 为机头挂点附近，quaternion 为机体朝向（本地 -Z 为前方） */
export interface WeaponMuzzle {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export class WeaponSystem {
  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null); // scene null → logic only
  setUnlocked(ids: readonly SpecialWeaponId[]): void; // newly unlocked weapons start full
  getUnlocked(): SpecialWeaponId[];
  isUnlocked(id: SpecialWeaponId): boolean;
  getSelected(): SpecialWeaponId | null;
  select(id: SpecialWeaponId): boolean; // false if locked
  selectNext(): SpecialWeaponId | null;
  selectIndex(index: number): boolean; // 0-based into SPECIAL_WEAPON_IDS
  setUpgradeLevel(id: SpecialWeaponId, level: number): void;
  getUpgradeLevel(id: SpecialWeaponId): number;
  getStats(id: SpecialWeaponId): SpecialWeaponStats;
  setTargetProvider(provider: () => readonly CombatTarget[]): void;
  setSurfaceSampler(sampler: SurfaceSampler | null): void;
  setViewMode(mode: 'third-person' | 'first-person'): void;
  setEffectDensity(density: number): void;
  /** salvo / pulse：按下沿开火；beam：按住持续照射；charge：按住蓄力、松开发射 */
  setTriggerHeld(held: boolean): void;
  refill(): void;
  isBeamActive(): boolean;
  getActiveProjectileCount(): number;
  update(deltaTime: number, muzzle: WeaponMuzzle): void;
  getHudState(): WeaponHudState;
  exportState(): WeaponSaveState;
  importState(state: WeaponSaveState): void; // call setUpgradeLevel first
  clear(): void; // in-flight projectiles / beams / charge; ammo kept
  dispose(): void;

  onFired?: (id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3) => void;
  onImpact?: (id: SpecialWeaponId, position: THREE.Vector3, scale: number) => void;
  onEmpPulse?: (center: THREE.Vector3, radius: number, stunSeconds: number) => void;
  onOverheat?: () => void;
  onChargeStart?: () => void;
  onDryFire?: (id: SpecialWeaponId) => void;
  onBeamEnd?: (id: SpecialWeaponId) => void;
}
```

Targeting: hits only damage `Faction.ENEMY` and `Faction.CIVILIAN` targets (civilian penalties are applied by the target wrappers); `FRIENDLY` and the player are never damaged. Swarm missiles auto-target `ENEMY` targets only. The EMP calls `applyStun?.(stunSeconds)` on every enemy target in radius and damages `kind === 'projectile'` targets and drones; `onEmpPulse` lets the coordinator stun units, destroy unit / boss missiles and decloak the Phantom Wing. Railgun releases below `RAILGUN_MIN_CHARGE` (`EnergyWeaponControllers.ts`) cancel through `onDryFire('railgun')`.

## Flares

Source: `src/features/weapons/CountermeasureSystem.ts`.

```typescript
export class CountermeasureSystem implements IDecoyProvider {
  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null);
  setCapacity(maxCharges: number): void; // default 2; upgrades 2..6
  setRechargeTime(seconds: number): void; // default 12
  getCharges(): number;
  getMaxCharges(): number;
  getRechargeProgress(): number; // 0..1, 1 when full
  /** 没有充能时返回 false；velocity 缺省按机头方向估算 */
  deploy(origin: THREE.Vector3, quaternion: THREE.Quaternion, velocity?: THREE.Vector3): boolean;
  update(deltaTime: number): void;
  getActiveDecoys(): readonly DecoyPoint[];
  exportState(): { charges: number };
  importState(state: { charges: number }): void;
  clear(): void; // extinguish flares, charges kept
  dispose(): void;
  onDeployed?: () => void;
}
```

`SpecialWeaponsController` (`src/core/combat/SpecialWeaponsController.ts`) owns one `WeaponSystem` and one `CountermeasureSystem`, implements `IDecoyProvider` for units and for every boss (both boss controllers run a `BossFlareDecoyRedirector` on it, see [Bosses](#bosses)), and exposes `handleInput(input, cycleRequested, slotRequested, flareRequested, aircraft, canFire)`, `syncProgression(stats, unlocked): SpecialWeaponId[]`, `refill()`, `clearInFlight()`, `exportState()` and `importState(state, flareCharges)` to the coordinator. Its short notices go through `SpecialWeaponsDeps.notify(icon: string, text: HudText)`, which the coordinator wires to `HUD.showPowerUpBig(icon, text, 0.9, true)`: "No special weapons yet", "Weapon not unlocked yet" and, on a weapon switch, the selected weapon's bilingual `SpecialWeaponConfig.name` (not the already-localised `getHudState().name`), so a notice on screen follows a language switch.

## Missiles and gun aim

Source: `src/features/combat/MissileSeeker.ts`, `MissileSystem.ts`, `GunLeadSolver.ts`, `src/ui/LockOnIndicator.ts`, `src/core/systems/PlayerSystem.ts`. Tuning lives in `GAME_CONSTANTS.MISSILE` and `GAME_CONSTANTS.GUN_ASSIST` (`src/config.ts`). `GameCoordinator` drives them from `updateGunAim` and `handleMissileInput` in the simulation step and from `renderAimHud` in the render frame.

```typescript
// MissileSeeker.ts — pure logic, no DOM
/** 屏幕像素坐标（左上原点）；visible=false 表示点在相机后方或坐标非法 */
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}
export function projectToScreen(
  world: Vector3,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  out: ScreenPoint
): boolean;

export class MissileSeeker {
  /** 本次 update 内发生的事件（下一次 update 开始时清零） */
  public readonly events = {
    /** 开始跟踪一个新目标（含换目标） */
    acquired: false,
    /** 锁定完成 */
    locked: false,
    /** 目标离开保持环超过宽限时间而丢失（被击毁 / 回收不算） */
    lost: false,
    /** lost 时目标是否已经完成锁定 */
    lostWhileLocked: false,
  };
  /** 锁定所需时间（秒），下限 0.2 防止除零 */
  public setLockTime(seconds: number): void;
  /** 捕获环半径（像素） */
  public setAcquireRadius(pixels: number): void;
  public getKeepRadius(): number; // acquire radius × LOCK_KEEP_RATIO
  public setViewport(width: number, height: number): void;
  /** 静默清空（复活 / 剧情冻结 / 没有导弹时）：不产生任何事件 */
  public reset(): void;
  /** 当前跟踪目标（锁定中或已锁定） */
  public getTarget(): Object3D | null;
  /** 已完成锁定的目标；未锁定时为 null */
  public getLockedTarget(): Object3D | null;
  public isLocked(): boolean;
  /** 锁定进度 0..1 */
  public getProgress(): number;
  /** 跟踪目标到载机的距离（米）；无目标时为 0 */
  public getTargetRange(): number;
  /**
   * @param origin 载机世界坐标（距离判定）
   * @param aim 准星的屏幕位置；visible=false 时不捕获新目标
   * @param candidates 本步的全部可锁定对象（必须是完整列表：不在表里的目标立即丢弃）
   */
  public update(
    deltaTime: number,
    origin: Vector3,
    aim: Readonly<ScreenPoint>,
    candidates: readonly Object3D[],
    camera: Camera
  ): void;
}

// MissileSystem.ts
/**
 * 发射导弹：从 position 沿 direction 离架，直飞一小段后追踪 target。
 * launcherSpeed 为发射瞬间载机沿 direction 的速度（米/秒），导弹继承它并继续加速（见 Missile）。
 */
public fire(
  position: THREE.Vector3,
  direction: THREE.Vector3,
  target?: THREE.Object3D,
  launcherSpeed: number = 0
): void;
public prewarm(): void; // level load: renders a hidden missile so the first launch does not compile shaders

// LockOnIndicator.ts — owns the MissileSeeker and draws the reticle, rings, gun cross and lead marker
export type LockOnCue = 'no-lock' | 'no-missile';
public getSeeker(): MissileSeeker;
public setLockTime(time: number): void;
public setLockCircleScale(scale: number): void; // 1..2, the lock-radius upgrade
public setMissileCount(count: number): void; // 0 switches the seeker off
/** 放弃当前跟踪 / 锁定（阵亡、复活、剧情冻结）：不触发丢锁提示 */
public cancelLockOn(): void;
/** 在准星下方短暂显示“未锁定 / 无导弹” */
public showCue(kind: LockOnCue): void;
/**
 * 模拟步：推进导引头（没有导弹时导引头关闭，见 setMissileCount）。
 * @param candidates 本步全部可锁定对象（完整列表：不在表里的目标立即丢弃）
 * @param playerQuaternion 载机姿态，准星取机头轴线；传 null 时以相机视线（视口中心）为准星
 * @returns 是否已完成锁定
 */
public update(
  playerPosition: Vector3,
  candidates: readonly Object3D[],
  camera: Camera,
  deltaTime: number,
  playerQuaternion: Quaternion | null
): boolean;
public renderUpdate(
  visible: boolean,
  playerPosition: Vector3,
  playerQuaternion: Quaternion,
  camera: Camera,
  leadPoint: Vector3 | null,
  leadOnTarget: boolean,
  gunAimDirection: Vector3 | null = null,
  gunAimDistance: number = AIM_DISTANCE
): void;

// GunLeadSolver.ts — pure logic
/**
 * @param muzzle 炮口世界坐标
 * @param forward 机头方向（单位向量）
 * @param targets 候选：前 airCount 个是空中目标（可显示提前量标记），其余只参与触屏辅助
 * @param assistEnabled 是否计算触屏辅助瞄准点
 */
public update(
  deltaTime: number,
  muzzle: Vector3,
  forward: Vector3,
  targets: readonly Object3D[],
  airCount: number,
  assistEnabled: boolean
): void;

// PlayerSystem.ts
/** @param weight 辅助强度 0..1：1 时基础散布收到最窄，0 时与未辅助相同 */
setGunAimAssist(direction: THREE.Vector3 | null, weight: number = 1): void;
```

`GAME_CONSTANTS.MISSILE`:

| Key                                     | Value          | Meaning                                                                         |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `SPEED`                                 | 200            | Cruise speed, m/s                                                               |
| `LAUNCH_SPEED_BOOST`                    | 20             | Launch speed = the launcher's speed + this                                      |
| `ACCELERATION`                          | 200            | m/s² up to cruise speed                                                         |
| `MIN_OVERTAKE_SPEED`                    | 80             | Cruise speed is at least the launcher's speed + this                            |
| `DAMAGE`                                | 80             | Multiplied by the combat damage multiplier (Damage Boost)                       |
| `TURN_SPEED`                            | 5.0            | rad/s                                                                           |
| `MAX_LIFETIME` / `MAX_FLIGHT_DISTANCE`  | 12 s / 2,400 m | The missile is removed at either limit                                          |
| `MAX_LOCK_DISTANCE`                     | 1,200          | Seeker range, m                                                                 |
| `LOCK_RING_RATIO`                       | 0.13           | Acquire-ring radius ÷ viewport short side, before the lock-radius upgrade scale |
| `LOCK_KEEP_RATIO`                       | 1.6            | Keep-ring radius ÷ acquire-ring radius                                          |
| `LOCK_GRACE_TIME`                       | 0.5            | Seconds outside the keep ring before the target is lost                         |
| `LOCK_DECAY_RATE`                       | 1.0            | Lock progress lost per second between the two rings                             |
| `LOCK_REARM_TIME`                       | 0.35           | Minimum seconds between two launches                                            |
| `STARTING_MISSILES`                     | 3              | Missile count at the start of a run and after a respawn                         |
| `MAX_MISSILES` / `MAX_RESPAWN_MISSILES` | 5 / 5          | Carried maximum / the count the timed reload fills up to                        |

`LOCK_TIME`, `LOCK_BOX_SIZE` and `MISSILE_RESPAWN_TIME` are gone: lock time, ring size and reload time come from the upgrade tracks (see [Upgrades](#upgrades)).

`GAME_CONSTANTS.GUN_ASSIST`: `MAX_RANGE` 480 m, `FULL_ANGLE` 2.5°, `OUTER_ANGLE` 5°, `EASE_TIME` 0.1 s, `SWITCH_MARGIN` 0.75°, `REFERENCE_RANGE` 600 m, `CROSS_MIN_RANGE` 100 m.

- **Seeker.** It runs whenever the player has a missile; there is no "start lock" step. The reticle is the screen position of the point `GUN_ASSIST.REFERENCE_RANGE` ahead on the nose axis. The acquire ring is centred on it with radius `clamp(short side × LOCK_RING_RATIO × lock-radius scale, 44 px, 0.3 × short side)`, which `LockOnIndicator` also publishes as `--hud-aim-r` on `<html>`. The candidate inside the ring that is closest to the reticle on screen is tracked. Progress rises by `1 / lockTime` per second inside the acquire ring, decays at `LOCK_DECAY_RATE` between the acquire ring and the keep ring, and a completed lock holds anywhere inside the keep ring. Outside the keep ring, behind the camera or beyond `MAX_LOCK_DISTANCE`, the target is lost after `LOCK_GRACE_TIME` (`events.lost`). A target that is missing from the candidate list is dropped at once with no `lost` event. A candidate that is closer to the reticle replaces the current target only after it has stayed so for 0.25 s (0.6 s once locked); while the current target is still inside the acquire ring the newcomer must also be closer by at least `max(12 px, 25% of the acquire radius)`. Progress then starts from zero.
- **Candidates.** `GameCoordinator.collectLockCandidates()` rebuilds the full list every step: the boss controller's `appendLockTargets` during a boss fight, the meshes of live enemy jets, then `UnitController.collectLockTargets`.
- **Launch.** One press fires one missile. With a completed lock the press fires at once and the lock stays; the next launch needs a new press and `LOCK_REARM_TIME`. A press while the seeker is still locking fires the moment the lock completes if the input is still held. A press with nothing tracked, or a release before the lock completes, shows `showCue('no-lock')`; a press with no missiles shows `showCue('no-missile')`. With the Rapid Fire power-up (`PowerUpType.MULTISHOT`) one press fires up to three missiles 0.1 s apart. Each missile leaves from alternate wing pylons along the nose, and `PlayerSystem.getSpeed()` is passed as `launcherSpeed`.
- **Flight.** A missile starts at `min(cruise, launcherSpeed + LAUNCH_SPEED_BOOST)` and accelerates at `ACCELERATION` to `cruise = max(SPEED, launcherSpeed + MIN_OVERTAKE_SPEED)`. It flies straight for 0.2 s, then steers with lead on the target's estimated velocity at `TURN_SPEED`. The hit test covers the segment travelled in the step; targets without a declared hit radius use a 6 m proximity radius. A missile whose target is gone re-acquires the nearest enemy.
- **Gun lead and assist.** `GunLeadSolver` estimates each target's velocity from successive positions and solves the intercept for `PROJECTILE.SPEED`. The nearest airborne target within 500 m and 40° of the nose gets the lead marker; `isPipOnTarget()` tells the indicator when the nose is on it. With `assistEnabled` — `GameCoordinator` passes `GameConfig.isMobile` — the solver also returns an assist direction: it points at the lead point while that is within `FULL_ANGLE` of the nose, the offset fades to zero by `OUTER_ANGLE`, there is none beyond `MAX_RANGE`, and it eases over `EASE_TIME` when the target changes. `PlayerSystem.setGunAimAssist(direction, weight)` makes the next shots leave along that direction and narrows the base spread from 3° towards 1.2° with `weight`; with `null` shots leave along the nose. `renderUpdate` draws the gun cross on the same direction, so the cross and the bullets agree. An `update` whose `deltaTime` is not a positive finite number is skipped and changes nothing.

## Camera

Source: `src/features/camera/CameraRig.ts`. `ThirdPersonCamera` stays exported for back-compat.

```typescript
export type CameraMode = 'third-person' | 'first-person';
export interface CameraRigFlightState {
  /** 0..1：0 = 最低巡航速度，1 = 最大速度 */
  speedRatio: number;
  /** 是否正在加力（按住加速键） */
  boosting: boolean;
}
export interface CameraRigOptions {
  mode?: CameraMode;
  thirdPersonOffset?: Readonly<{ x: number; y: number; z: number }>;
  smoothFactor?: number;
  eyeOffset?: Readonly<{ x: number; y: number; z: number }>;
  blendDuration?: number;
  cockpit?: boolean;
  manageTargetLayers?: boolean;
}

/** 玩家飞机外观所在渲染层：第一人称时相机关闭此层以隐藏机体外壳 */
export const PLAYER_EXTERIOR_LAYER = 3;
export const FIRST_PERSON_EYE_OFFSET: Readonly<{ x: number; y: number; z: number }>;
export const CAMERA_BLEND_SECONDS = 0.55;
export function assignPlayerExteriorLayer(root: THREE.Object3D): void;
export function setPlayerExteriorVisible(camera: THREE.Camera, visible: boolean): void;
/** 爆炸/冲击 → 震动强度（0..1）：随距离二次衰减 */
export function computeExplosionShake(distance: number, scale: number = 1, radius: number = 120): number;

export class CameraRig {
  constructor(
    camera: THREE.PerspectiveCamera,
    target: THREE.Object3D,
    options: CameraRigOptions = {}
  );
  getMode(): CameraMode;
  isFirstPerson(): boolean;
  /** 切换视角；immediate = true 时下一帧直接就位（无混合） */
  setMode(mode: CameraMode, immediate: boolean = false): void;
  toggleMode(): CameraMode;
  /** 累加震动创伤（0..1，封顶 1，随时间衰减） */
  addShake(intensity: number): void;
  getShake(): number;
  /** 缓动后的混合值：0 = 第三人称，1 = 第一人称 */
  getBlend(): number;
  isBlending(): boolean;
  /** 下一次 update 直接把追尾相机放到理想位置（传送/复活/读档后调用） */
  snapToTarget(): void;
  update(
    targetPosition: THREE.Vector3,
    targetQuaternion: THREE.Quaternion,
    deltaTime: number,
    flight?: CameraRigFlightState
  ): void;
  dispose(): void;
  onModeChanged?: (mode: CameraMode) => void;
}
```

`PlayerViewController` (`src/core/camera/PlayerViewController.ts`) wraps the rig for the coordinator (`toggleMode`, `setMode`, `snapToTarget`, `setFlightState`, `addShake`, `addExplosionShake(position, scale)`, `getBlend`) and drives `updatePlayerAfterburner` (`AircraftMeshFactory`). Friendly wingmen use `createFriendlyMesh(config)` (same airframe and hit radii as `createEnemyMesh`).

Field of view: the rig is the only writer of `camera.fov`. It adds a speed / boost kick to the base FOV, and when `camera.aspect < 1` (portrait) it raises the vertical FOV so that the horizontal field stays at about 70°, capped at 95° vertical; landscape is unaffected.

Cockpit (`CockpitModel.ts`): the structure is modelled in a cockpit frame pitched 4° nose-down about the eye point, so the glare shield is a thin eave low in the view; the HUD combiner glass (0.30 × 0.30 m, 0.6 m ahead on the view axis) is not pitched and frames the DOM-layer gun cross and seeker ring. In first person the special-weapon effects are toned down: `FIRST_PERSON_FLASH_SCALE` (0.55, `GameCoordinator`) scales the muzzle flash and the railgun screen flash, swarm missiles leave from further out under the wings, and weapon particles fade by view depth near the camera (`WeaponParticleField`).

## Bosses

Source: `src/features/boss/BossTypes.ts`, `BossContracts.ts`, the boss AI files. HP, damage and fire intervals live in `BOSS_CONFIGS`.

```typescript
export enum BossType {
  HEAVY_BOMBER = 'HEAVY_BOMBER',
  DESERT_FORTRESS = 'DESERT_FORTRESS',
  OCTOPUS_WARSHIP = 'OCTOPUS_WARSHIP',
  MISSILE_DESTROYER = 'MISSILE_DESTROYER',
  SKY_CARRIER = 'SKY_CARRIER',
  MAGMA_COLOSSUS = 'MAGMA_COLOSSUS', // level 6
  ABYSSAL_LEVIATHAN = 'ABYSSAL_LEVIATHAN', // level 7
  TEMPEST_ZEPPELIN = 'TEMPEST_ZEPPELIN', // level 8
  PHANTOM_WING = 'PHANTOM_WING', // level 9
  ORACLE_PRIME = 'ORACLE_PRIME', // level 10
}
export function getBossForLevel(level: number): BossType | null; // 1..10, else null
```

```typescript
/** 所有 Boss（含前五关）共同遵守的鸭子类型契约 */
export interface IBossCore {
  update(deltaTime: number, playerMesh: Object3D | null, friendlyMeshes: Object3D[]): void;
  takeDamage(amount: number): void;
  getHealth(): { current: number; max: number };
  isAlive(): boolean;
  getMesh(): Group;
  getConfig(): BossConfig;
  getPosition(): Vector3;
  getCollisionParts(): Object3D[];
  getMissileSystem(): BossMissileSystem | null;
  dispose(): void;
  onDestroy?: (position: Vector3, config: BossConfig) => void;
}

export interface BossHazardHit {
  damage: number;
  profile: HeavyWeaponImpactProfile;
  position: Vector3;
}
export type BossMinionKind = 'scout' | 'fighter' | 'heavy' | 'ace' | 'drone';
export interface BossSubTarget {
  mesh: Object3D;
  current: number;
  max: number;
}

/** 第 6-10 关 Boss 的扩展契约 */
export interface IAdvancedBoss extends IBossCore {
  getPhase(): number; // from 1
  getPhaseCount(): number;
  isInvulnerable(): boolean;
  getDamageMultiplier(part: Object3D): number;
  /** 部件命中的唯一入口：part 为 getCollisionParts() 中的对象（原始伤害，倍率由 Boss 自己计算） */
  takeDamageAt(part: Object3D, amount: number): void;
  /** 无内部冷却；控制器按目标维护约 0.6 s 的命中冷却 */
  checkHazard(targetPosition: Vector3, targetRadius: number): BossHazardHit | null;
  getStatusLabel(): string | null;
  getSubTargets?(): BossSubTarget[];
  applyStun?(seconds: number): void;

  onFire?: (position: Vector3, direction: Vector3, damage: number) => void;
  onMissileFired?: () => void;
  /** label 传双语原文（或 { text, params }，见 HudText）：HUD 按当前语言显示，显示期间切换语言随之重绘 */
  onPhaseChange?: (phase: number, label: HudText) => void;
  onSpawnMinion?: (position: Vector3, kind: BossMinionKind) => void;
  /** 特殊武器预警（HUD 闪烁提示 + 预警音）；label 同 onPhaseChange */
  onHazardWarning?: (label: HudText) => void;
}
export function isAdvancedBoss(boss: unknown): boss is IAdvancedBoss;
```

Bosses 6–10 — every class has the constructor `(mesh: THREE.Group, config: BossConfig, scene: THREE.Scene, particleSystem: ParticleSystem)`; the controller creates the mesh, positions it and adds it to the scene before constructing the AI:

| `BossType` | Class / file | Mesh factory | Extras beyond `IAdvancedBoss` |
| ---------- | ------------ | ------------ | ----------------------------- |
| `MAGMA_COLOSSUS` | `MagmaColossusAI` | `createMagmaColossusMesh(config: BossConfig): THREE.Group` | `setGroundSampler`, `setDeathSequenceEnabled`, `isDying`, `onEffectCue` (`MagmaColossusCue`) |
| `ABYSSAL_LEVIATHAN` | `AbyssalLeviathanAI` | `createAbyssalLeviathanMesh(config)` | `setDeathSequenceEnabled`, `isDying`, `getSubmergeLevel(): number`, `onEffectCue` (`AbyssalLeviathanCue`) |
| `TEMPEST_ZEPPELIN` | `TempestZeppelinAI` | `createTempestZeppelinMesh(config)` | `setGroundSampler`, `setDeathSequenceEnabled`, `isDying`, `getSinkAmount(): number`, `getCloudCover(): number`, `onEffectCue` (`TempestZeppelinCue`) |
| `PHANTOM_WING` | `PhantomWingAI` | `createPhantomWingMesh(config)` | `setGroundSampler`, `setDeathSequenceEnabled`, `isDying`, `applyEmpPulse(center, radius, seconds): boolean`, `isCloaked(): boolean`, `getCloakLevel(): number`, `getDecoyMeshes(): readonly THREE.Object3D[]`, `onEffectCue` (`PhantomWingCue`) |
| `ORACLE_PRIME` | `OraclePrimeAI` | `createOraclePrimeMesh(config)` | `setGroundSampler`, `setDeathSequenceEnabled`, `isDying`, `getDeathProgress(): number`, `getStage(): OraclePrimeStage`, `getMusicIntensity(): number`, `onEffectCue` (`OraclePrimeCue`) |

Shared extras: `setGroundSampler(sampler: (x: number, z: number) => number): void`, `setDeathSequenceEnabled(enabled: boolean): void` (the controller enables it; `onDestroy` then fires after the death sequence) and `isDying(): boolean`. Parts the lock-on skips carry `userData.bossDeflector` (Oracle's shield proxy) or `userData.bossHazardTarget` (Leviathan mines); Phantom decoys carry `userData.bossDecoy`. `AdvancedBossController` / `AdvancedBossInstance` (`src/core/boss/AdvancedBossController.ts`) and the spawn / cooldown / decoy helpers in `src/core/boss/AdvancedBossSupport.ts` (`resolveAdvancedBossSpawn`, `resolveLegacyBossSpawn`, `HazardCooldownTracker`, `BossFlareDecoyRedirector`, `mapOracleStageToCoreState`) implement the controller side.

Boss missiles, flak and aim (`BossMissileSystem.ts`, `FlakCannonSystem.ts`, `BossAim.ts`, `AdvancedBossSupport.ts`):

```typescript
// BossMissileSystem — damage：单发命中伤害（Boss 配置的 missileDamage，已按难度调整），缺省 BOSS_MISSILE_CONFIG.DAMAGE（90）
constructor(scene: THREE.Scene, particleSystem: ParticleSystem, damage: number = BOSS_MISSILE_CONFIG.DAMAGE);
public fire(
  position: THREE.Vector3,
  target: THREE.Object3D | null,
  potentialTargets: THREE.Object3D[] = [],
  playerMesh: THREE.Object3D | null = null,
  targetingPlayer: boolean = false,
  profile?: BossMissileFlightProfile
): void;
public checkCollisions(
  targetMeshes: THREE.Object3D[],
  onHit: (target: THREE.Object3D, damage: number) => void // damage = 构造时的单发伤害
): void;

/** 单发导弹的飞行参数；全部缺省 = 旧版慢速导弹（50 米/秒、插值追踪、只受射程限制） */
export interface BossMissileFlightProfile {
  speed?: number; // 巡航速度；限速追踪的导弹发射后约 0.8 秒内从 55% 加速到满速
  turnRate?: number; // 最大转向角速度（弧度/秒）：设置后改为限速转向追踪，大过载急转可以甩掉
  lead?: number; // 提前量 0..1
  lifetime?: number; // 秒，到时空中自爆（不造成伤害）
  launchDirection?: THREE.Vector3; // 发射初速方向，缺省竖直向上
}

// FlakCannonSystem
export interface FlakShotOptions {
  speed?: number; // 弹速（米/秒，缺省 FLAK_CANNON_CONFIG.SPEED）
}
public fire(position: THREE.Vector3, targetPosition: THREE.Vector3, options: FlakShotOptions = {}): void;

// BossAim.ts — 第 1-5 关 Boss 共用：目标速度估计（逐帧差分，> 250 米/秒视为瞬移清零）与提前量瞄准
export class TargetLeadTracker {
  readonly velocity: THREE.Vector3;
  update(deltaTime: number, position: THREE.Vector3 | null | undefined): void;
  reset(): void;
  /** target + 速度 × 拦截时间（两次迭代，上限 4 秒）× lead，写入 out */
  leadPoint(origin: THREE.Vector3, target: THREE.Vector3, projectileSpeed: number, lead: number,
            out: THREE.Vector3): THREE.Vector3;
}

// AdvancedBossSupport.ts — 诱饵锚点节点名：Boss 导弹的 target 是它即表示已被热焰弹诱骗
export const BOSS_DECOY_ANCHOR_NAME = 'boss-missile-decoy-anchor';
```

- **Damage by difficulty.** `GameCoordinator.getAdjustedBossConfig` scales `missileDamage` by the difficulty's `enemyDamageMultiplier` (rounded, at least 1) along with `health` and `damage`, and every missile-carrying boss passes it to its `BossMissileSystem`; `BossHitFeedback.checkBossMissileHits` applies the reported value to the player (through armour, not while shielded) and to wingmen. With the base 90 that is 31 / 38 / 45 / 56 / 70 per hit from Very Easy to Expert; the Phantom Wing's base is doubled (63 … 140, 90 on Normal). Flak and the Octopus Warship's eye bolts follow the same rule: `FlakCannonSystem(scene, explosionRadius, onExplode, damage = FLAK_CANNON_CONFIG.DAMAGE)` takes the boss's scaled `damage` (Desert Fortress and Missile Destroyer; base 30) and passes it to every shell's explosion, and `EyeSystem(scene, damage = EYE_CONFIG.DAMAGE)` takes the scaled `BossConfig.eyeDamage` (optional, base 40; `OctopusWarshipAI.getEyeDamage()` returns the system's value). Per hit from Very Easy to Expert: flak 11 / 13 / 15 / 19 / 23, eye bolts 14 / 17 / 20 / 25 / 31 (Normal keeps the tuned 15 / 20).
- **Flares.** `BossBattleController` now runs the same `BossFlareDecoyRedirector` as `AdvancedBossController`, so flares pull the player-tracking missiles of bosses 1–5 too: a missile within 420 m can be redirected to an anchor that follows a burning flare (chance from the strongest flare) and detonates there.
- **Profiles in use.** Trident (level 4) launches salvos of 2 missiles — 3 at 35 % health or less — at 72 m/s (turn rate 0.85 rad/s, lead 0.3, 7 s fuel, 0.4 s apart) every `missileFireInterval` (20 s base) and fires 95 m/s flak with 50 % lead and ±32 m scatter; the Sky Carrier's missiles fly at 72 m/s (0.95 rad/s, lead 0.3, 10 s); the Phantom Wing's bay missiles at 88 m/s (1.3 rad/s, lead 0.5, 8 s), ejected forward and down. Sandwall's flak (80 m/s) and the Sky Carrier's cannons (100 m/s) lead the player through `TargetLeadTracker` (50 % and 60 %).

## Music

Source: `src/core/Audio/MusicSystem.ts`.

```typescript
export enum LevelMusic {
  LAKE = 'LAKE', DESERT = 'DESERT', SNOW = 'SNOW', OCEAN = 'OCEAN', CITY = 'CITY',
  BOSS = 'BOSS', DESERT_BOSS = 'DESERT_BOSS', OCTOPUS_BOSS = 'OCTOPUS_BOSS',
  OCEAN_BOSS = 'OCEAN_BOSS', SKY_CARRIER_BOSS = 'SKY_CARRIER_BOSS',
  // added for the campaign
  VOLCANO = 'VOLCANO', ARCTIC = 'ARCTIC', CANYON = 'CANYON', STRATOSPHERE = 'STRATOSPHERE',
  CITADEL = 'CITADEL',
  MAGMA_BOSS = 'MAGMA_BOSS', LEVIATHAN_BOSS = 'LEVIATHAN_BOSS', TEMPEST_BOSS = 'TEMPEST_BOSS',
  PHANTOM_BOSS = 'PHANTOM_BOSS', ORACLE_BOSS = 'ORACLE_BOSS',
  MENU = 'MENU', STORY = 'STORY', VICTORY = 'VICTORY',
}
export type MusicStinger =
  | 'chapter-start' | 'boss-defeated' | 'level-complete' | 'game-over'
  | 'campaign-complete' | 'checkpoint' | 'phase-change';
export const MUSIC_STINGERS: readonly MusicStinger[];
export function getLevelMusicForLevel(level: number): LevelMusic; // 1..10, distinct
export function getBossMusicForLevel(level: number): LevelMusic; // 1..10, distinct

// MusicSystem — new or extended methods
public playBossMusic(level?: number): void; // levels 1..10
public playMenuMusic(): void;
public playStoryMusic(): void;
public playVictoryMusic(): void;
/** 0..1：图层、速度与滤波随之变化；切换曲目时恢复为新曲目的缺省强度 */
public setIntensity(intensity: number): void;
public getIntensity(): number;
/** 对齐到当前曲目的下一拍，移调到当前调性，并闪避或结束主音乐 */
public playStinger(kind: MusicStinger): void;
public pauseMusic(): void; // fades and remembers the track
public resumeMusic(): void;
/** 配音闪避的当前增益倍数（1 = 未闪避；没有音频图时为 null） */
public getVoiceDuckLevel(): number | null;
/** 诊断：在音乐总线出口（音量与配音闪避之后）挂一个 AnalyserNode；不支持时返回 null。调用方负责 disconnect */
public createOutputAnalyser(): AnalyserNode | null;
```

`boss-defeated`, `level-complete`, `game-over` and `campaign-complete` end the current music themselves. Tracks and stingers are compositions under `src/core/Audio/music/tracks/` played by the lookahead `Sequencer`. Bus order: sessions → stinger duck → SFX duck → volume → **voice duck** → sub-bass high-pass → shared output. The voice-duck gain follows `voiceDuckBridge` (see [Voice](#voice)), so a speaking character lowers the whole music bus — stingers and reverb included — and a newly built bus starts at the bridge's current level.

## Voice

Source: `src/core/Audio/VoiceSystem.ts`, `src/core/Audio/VoiceDucking.ts`. Plays the recorded voice packs (`public/voice/`, format and upkeep in [voice-lines.md](voice-lines.md)) through the shared `AudioContext`. Never throws: with no `AudioContext`, no `fetch`, no manifest, a missing line, a failed decode or a slow load, the line is simply silent and the UI shows the text. Callbacks are delivered asynchronously (microtask), so a caller may call back into the system from them.

```typescript
export type VoiceKind = 'radio' | 'narration';
export type VoicePackLanguage = 'en' | 'zh';

/** play() 没有出声 / 没有说完的原因 */
export type VoiceSilentReason =
  | 'unavailable' // 语音包里没有这句，或没有可用的 AudioContext / 解码能力
  | 'muted' // 语音音量为 0（纯文字）
  | 'timeout' // 加载超过 maxStartDelayMs，这一句改为纯文字（缓冲区仍会缓存，下次直接播）
  | 'error' // 获取或解码失败
  | 'stopped' // 被 stop / stopAll 打断（跳过、关卡结束、失败、切换语言）
  | 'superseded' // 被下一句配音顶掉
  | 'disposed';

export interface VoiceManifestEntry {
  readonly duration: number;
  readonly bytes?: number;
}
export interface VoiceManifest {
  readonly version: number;
  readonly format: string;
  readonly languages: Partial<
    Record<VoicePackLanguage, Readonly<Record<string, VoiceManifestEntry>>>
  >;
}

/** 一句配音开始 / 说完时回调的信息 */
export interface VoiceLineInfo {
  readonly lineId: string;
  readonly kind: VoiceKind;
  readonly speaker: string | null;
  readonly locale: Locale;
  readonly language: VoicePackLanguage;
  /** 配音时长（秒，解码后的缓冲区） */
  readonly duration: number;
  /** 响度归一化增益（dB） */
  readonly gainDb: number;
}

export interface VoicePlayOptions {
  kind: VoiceKind;
  /** CampaignSpeakerId：决定电台音色（带宽 / 底噪）；旁白忽略 */
  speaker?: string | null;
  /** 配音真正开始播放（缓冲区已就绪） */
  onStart?: (info: VoiceLineInfo) => void;
  /** 自然说完（不含被打断 / 暂停） */
  onEnd?: (info: VoiceLineInfo) => void;
  /** 没有出声，或开始后被打断（每个请求至多一次；与 onEnd 互斥） */
  onSilent?: (reason: VoiceSilentReason) => void;
  /** 等待加载的最长时间（毫秒）；缺省无线电 1500、旁白 2500 */
  maxStartDelayMs?: number;
}

/** fetch 的最小子集（便于注入测试替身） */
export interface VoiceFetchResponse {
  readonly ok: boolean;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type VoiceFetch = (url: string) => Promise<VoiceFetchResponse>;
export interface VoiceSystemOptions {
  /** 语音包根路径（缺省 `${import.meta.env.BASE_URL}voice/`） */
  baseUrl?: string;
  /** 注入 fetch（缺省使用全局 fetch） */
  fetch?: VoiceFetch;
}

/** 界面语言 → 语音包语言 */
export function getVoicePackLanguage(locale: Locale = getLocale()): VoicePackLanguage; // zh-CN → 'zh', else 'en'
/** 门限 RMS → 归一化增益（dB） */
export function measureVoiceGainDb(buffer: AudioBuffer): number;

export class VoiceSystem {
  constructor(options: VoiceSystemOptions = {});
  /** 加载语音包清单（只请求一次；失败后 20 秒内不重试）；不可用时为 null */
  public loadManifest(): Promise<VoiceManifest | null>;
  /** 当前（或指定）语言的语音包里有这句（清单未加载时为 false） */
  public hasLine(lineId: string, locale: Locale = getLocale()): boolean;
  /** 清单记录的配音时长（秒）；没有这句 / 清单未加载时为 null */
  public getLineDuration(lineId: string, locale: Locale = getLocale()): number | null;
  /** 播放一句配音（顶掉正在说 / 正在加载的那句）。立即返回请求编号，从不抛错 */
  public play(lineId: string, options: VoicePlayOptions): number;
  /** 停下当前配音（可只停某一类）；正在加载的那句也作废 */
  public stop(kind?: VoiceKind): void;
  /** 停下一切配音（关卡结束、失败、退出、切换语言） */
  public stopAll(): void;
  /** 有配音正在说（或暂停中 / 加载中）；可只看某一类 */
  public isSpeaking(kind?: VoiceKind): boolean;
  /** 跟随游戏暂停：当前配音淡出并记住断点 */
  public pause(): void;
  /** 游戏继续：从断点续播（断点已到结尾则视为说完） */
  public resume(): void;
  public isPaused(): boolean;
  /** 语音音量 0..1（非有限值忽略）；调到 0 时立即停下当前配音，之后的台词纯文字显示 */
  public setVolume(volume: number): void;
  public getVolume(): number;
  /** 预取一批台词（当前语言）：前几句立即获取并解码，其余只取编码数据；清单里没有的 id 跳过 */
  public prefetch(lineIds: readonly string[]): void;
  /** 诊断：在人声总线出口（语音音量之后）挂一个 AnalyserNode；不支持时返回 null。调用方负责 disconnect */
  public createOutputAnalyser(): AnalyserNode | null;
  /** 诊断快照：当前台词、缓存、闪避目标与最近的事件 */
  public getDebugState(): VoiceDebugState;
  public dispose(): void;
}
```

`VoiceDebugState` and `VoiceDebugEvent` (same file) describe the diagnostic snapshot: pack language, manifest state, line counts, volume, pause state, the current request, the duck target, cache sizes and the last few events.

Behaviour (constants are at the top of `VoiceSystem.ts`):

- **Packs.** The manifest (`<baseUrl>manifest.json`) is fetched lazily. The pack follows the interface language (`getVoicePackLanguage`); only ids the manifest lists for that language are requested, from `<baseUrl><en|zh>/<id>.<format>`. A failed manifest makes every line silent and is retried after a pause.
- **One voice at a time.** A new `play` supersedes the current line or load (`onSilent('superseded')`). A request either reaches `onStart` and then `onEnd` or `onSilent('stopped' | …)`, or goes straight to `onSilent(reason)`. Volume 0 declines with `'muted'`; a load that takes longer than `maxStartDelayMs` gives `'timeout'` (the decoded line stays cached).
- **Radio chain** (`kind: 'radio'`). A per-speaker band-pass and a matching static bed, keyed by `CampaignSpeakerId` (`RADIO_PROFILES`; unknown speakers get a default band), feed a shared radio stage — a fixed telephone-style band, a presence peak, soft saturation and a compressor — and a gated squelch tail closes each naturally finished line. Radio lines start after a short lead so the radio-open blip (`AudioManager.playRadioOpen`) comes first.
- **Narration chain** (`kind: 'narration'`). A low-cut high-pass and a gentle compressor.
- **Loudness.** Every decoded line gets a gain from `measureVoiceGainDb` (gated RMS in short blocks, toward a fixed target, clamped), so speakers and languages play at a matched level.
- **Output.** User voice volume × bus level → the shared output node from `AudioContextHost` (the same limiter as SFX and music).
- **Ducking.** While a line plays, `voiceDuckBridge.set(level, attack)` lowers the music (radio deeper than narration). After a line it releases with a delay and a slow ramp, so consecutive radio lines do not make the music pump; `stop` / `stopAll` / `pause` release at once.
- **Pause.** `pause()` fades the line out and remembers its offset; `resume()` continues from there. A real-time watchdog finishes a line if its `onended` never arrives, so the radio queue and the story typewriter cannot wedge.
- **Language switch.** `onLocaleChange` → `stopAll()` and a re-prefetch of the last batch in the new pack.
- **Caches and prefetch.** Two LRUs — decoded buffers (count and seconds limits) and encoded bytes (size limit). `prefetch(ids)` dedupes, decodes the first few and only fetches the rest, with a few concurrent workers; a newer prefetch cancels the older one.

```typescript
// VoiceDucking.ts — hold-type duck between VoiceSystem and MusicSystem (they never import each other)
export type VoiceDuckListener = (level: number, rampSeconds: number, delaySeconds: number) => void;
export const voiceDuckBridge = {
  subscribe(listener: VoiceDuckListener): () => void;
  /**
   * 请求音乐增益倍数：level 1 = 不闪避；rampSeconds 为过渡时长；delaySeconds 后才开始过渡。
   * 非有限值按安全缺省处理（level → 1，时长 → 0）。
   */
  set(level: number, rampSeconds: number, delaySeconds: number = 0): void;
  /** 最近一次请求的目标倍数（新建的音乐总线以此为初值） */
  getLevel(): number;
  /** 测试隔离：清空监听者并回到不闪避 */
  resetForTests(): void;
};
```

Unlike the SFX `musicDuckingBridge` (short fixed-length dips), the voice duck holds until released, and every request replaces the one not yet applied.

Ownership: `GameCoordinator` creates one `VoiceSystem`, sets its volume from the saved settings, passes it to `DefaultCampaignPresentation` as `voice` (see [Campaign presentation](#campaign-presentation-icampaignpresentation)) and to the dev hooks, wires the pause menu's `applyVoice` to `setVolume`, and disposes it.

## SFX

Source: `src/core/Audio/AudioManager.ts` (all no-throw, gated by `beginSound` policies; voices in `src/core/Audio/sfx/SfxLibrary.ts`).

```typescript
public playRocketSalvo(): void;
public playLaserStart(): void;
public playLaserStop(): void;
public playLaserOverheat(): void;
public playRailgunCharge(chargeSeconds: number = 1.2): void;
public playRailgunChargeCancel(): void;
public playRailgunFire(): void;
public playSwarmLaunch(): void;
public playEmpPulse(): void;
public playFlareDeploy(): void;
public playSamLockWarning(): void;
public playSamLaunch(): void;
public playBombDrop(): void;
public playTankCannon(): void;
public playHelicopterPass(intensity: number = 1): void;
public playShipHorn(): void;
public playSonarPing(): void;
public playCameraSwitch(): void;
public playAutosave(): void;
public playRadioOpen(): void;
public playTypewriterTick(): void;
public playWeaponSwitch(): void;
public playWeaponUnlock(): void;
public playCivilianWarning(): void;
public playChapterImpact(): void;
public playLightningStrike(): void;
public playLavaEruption(): void;
public playShieldHit(): void;
public playBossPhaseAlarm(): void;
public playDebriefTally(): void;
public playUnitDestroyed(domain: 'ground' | 'sea' | 'air'): void;
public stopSustainedSounds(): void; // laser beam + railgun charge loops (pause / death / leaving combat)

public playGroundImpact(
  surface: 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud',
  intensity: number = 1
): void;
```

Each method has a matching `SoundType` entry (`ROCKET_SALVO`, `LASER_BEAM`, `LASER_STOP`, `LASER_OVERHEAT`, `RAILGUN_CHARGE`, `RAILGUN_CANCEL`, `RAILGUN_FIRE`, `SWARM_LAUNCH`, `EMP_PULSE`, `FLARE_DEPLOY`, `SAM_LOCK`, `SAM_LAUNCH`, `BOMB_DROP`, `TANK_CANNON`, `HELICOPTER`, `SHIP_HORN`, `SONAR`, `CAMERA_SWITCH`, `AUTOSAVE`, `RADIO`, `TYPEWRITER`, `WEAPON_SWITCH`, `WEAPON_UNLOCK`, `CIVILIAN_WARNING`, `CHAPTER_IMPACT`, `LIGHTNING`, `LAVA_ERUPTION`, `SHIELD_HIT`, `PHASE_ALARM`, `DEBRIEF_TALLY`, `UNIT_DESTROYED`). Gameplay reaches them through `ICampaignPresentation.onWeaponEvent` / `onUnitEvent` / `onBossCue` (`CampaignSfxRouter`, `src/core/campaign/CampaignSfx.ts`).

## VFX

Source: `src/features/effects/ParticleSystem.ts`, `particles/ParticleTypes.ts`, `src/scenes/GameScene.ts`, `src/features/effects/postfx/ScreenEffectsState.ts`, `src/core/systems/PlayerSystem.ts`.

```typescript
export type SurfaceImpactType =
  | 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud';

// ParticleSystem — every earlier method keeps its signature; additions:
public createMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, scale: number = 1): void;
public createDamageSmoke(position: THREE.Vector3, intensity: number): void; // call ~6-10 Hz
public createPickupBurst(position: THREE.Vector3, color?: number): void;
public createEmpBurst(center: THREE.Vector3, radius: number): void;
public createSplash(position: THREE.Vector3, scale: number = 1): void;
public getBudget(): number; // live particle cap (quality preset)
// existing, with the widened SurfaceImpactType (lava / ice / rock / cloud added)
public createGroundImpact(position: THREE.Vector3, intensity: number = 1, surface: SurfaceImpactType = 'ground'): void;

// GameScene
export interface ScreenEffectsInput {
  damagePulse?: number;
  lowHealth?: number;
  flash?: number;
  speed?: number;
  empFlash?: number;
}
/** damagePulse / flash / empFlash 为脉冲（取最大值后自动衰减），lowHealth / speed 为持续量 */
public setScreenEffects(effects: ScreenEffectsInput): void;
/** 显式开启/关闭后处理（默认按画质：performance 关闭，balanced/quality 开启） */
public setPostFxEnabled(enabled: boolean): void;
public isPostFxEnabled(): boolean;

// PlayerSystem
notifyShieldHit(worldPosition: THREE.Vector3): void; // hex ripple; ignored when the shield is hidden
setShieldViewFade(fade: number): void; // 0..1, driven by the camera blend
placeAt(position: THREE.Vector3, quaternion: THREE.Quaternion): void; // level start / checkpoint; restarts the respawn track

// WeaponFx (src/features/weapons/WeaponFx.ts) — 扩散冲击环；nearFade > 0 时离镜头 nearFade 米内的环段淡出
public spawnRing(
  position: THREE.Vector3,
  normal: THREE.Vector3,
  fromRadius: number,
  toRadius: number,
  life: number,
  color: THREE.Color,
  opacity: number,
  thickness: number,
  additive = true,
  nearFade = 0
): void;
```

EMP visuals: `empFlash` decays over 0.5 s (`ScreenEffectsState`); the post-FX grade and the `performance` overlay (`ScreenOverlay`) both draw it as a capped electric-blue screen edge plus a thin ring sweeping outward from just outside the reticle, with sparse glitch bands, and never brighten the centre or mix it toward white. In the world, the two EMP shock rings fade within 48 m of the camera (`nearFade`; the railgun rings pass 0), the ring shader keeps its `smoothstep` edges ordered (a thin ring used to render as a solid disc), the EMP shell dims while the camera is close to it and fades within about 4–32 m of the camera, and the centre flash is smaller and skipped in first person.

## HUD, story overlay, radio, radar, menus

Source: `src/ui/HUD.ts`, `StoryOverlay.ts`, `RadioComms.ts`, `RadarMinimap.ts`, `StartMenu.ts`, `UpgradeMenu.ts`, `src/core/PresentationController.ts`.

```typescript
// HUD — 可本地化文案
/** 带占位参数的双语文案：{ text: { en: 'Wave {wave}', zh: '第{wave}波' }, params: { wave: 3 } } */
export interface HudTextWithParams {
  readonly text: LocalizedText | string;
  readonly params?: TextParams;
}
/** 纯字符串原样显示；双语对象或 { text, params } 按当前语言取值，显示期间切换语言会重绘 */
export type HudText = string | LocalizedText | HudTextWithParams;
export type BriefingTone = 'sys' | 'threat';
export interface BriefingRequest {
  kicker: HudText;
  title: HudText;
  line: HudText;
  tone: BriefingTone;
  durationMs: number;
}
/** 入关 / Boss 简报：顶部消息栈里的玻璃卡片，新简报替换旧简报 */
public showBriefing(briefing: BriefingRequest): void;

// HUD
export type HudCameraMode = 'third-person' | 'first-person';
/** 敌人计数：'wave' 为“敌人 N · 剩余 M”（本关波次）；'boss' 为 Boss 战，只显示在场的敌方数 */
export type HudEnemyCounterMode = 'wave' | 'boss';
export type HudMissileWarningLevel = 'none' | 'locking' | 'incoming';
export type HudWarningTone = 'threat' | 'sys' | 'ally';
export type HudWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';
export interface HudWeaponSlotState {
  icon: string;
  shortCode: string;
  selected: boolean;
  ready: boolean;
}
/** 特殊武器面板状态（与 WeaponSystem.getHudState() 对齐；visible=false 时隐藏面板） */
export interface HudWeaponPanelState {
  visible: boolean;
  icon: string;
  name: string;
  shortCode: string;
  mode: HudWeaponMode | null;
  ammo: number;
  maxAmmo: number;
  reloadProgress: number; // 0..1, 1 when full
  heat: number; // 0..1
  overheated: boolean;
  charge: number; // 0..1
  cooldown: number; // 0..1, 1 = just fired
  ready: boolean;
  slots: HudWeaponSlotState[];
}
public updateWeaponPanel(state: HudWeaponPanelState): void;
public updateFlares(charges: number, max: number, rechargeProgress: number): void;
public showAutosave(label?: HudText): void; // ~2.6 s toast, timed by update(dt)
public setCameraMode(mode: HudCameraMode): void;
public setBossStatus(label: HudText | null, phase?: { current: number; total: number }): void; // null hides the strip
public setMissileWarning(level: HudMissileWarningLevel): void;
/** 屏幕中下方的闪烁告警，约 2.2 秒；同一句话重复调用只续时 */
public flashWarning(text: HudText, tone: HudWarningTone = 'threat'): void;
/** 持续型道具的倒计时（duration <= 0 的即时道具不显示）；name 可本地化 */
public showPowerUp(name: HudText, icon: string, duration: number = 0): void;
/** 中央大字提示（锁定圈上方的横幅）；简报显示期间只保留最新一条，简报收起后显示 */
public showPowerUpBig(
  icon: string,
  name: HudText,
  minDisplayTime: number = HUD.TOAST_DEFAULT_MS / 1000, // 0.8 s
  hideSubtext: boolean = false,
  variant: BigMessageVariant = 'announcement' // module-private: 'announcement' | 'powerup'
): void;
public setEnemyCounterMode(mode: HudEnemyCounterMode): void;
```

`HudText` given to `showBriefing`, `showAutosave`, `flashWarning`, `setBossStatus`, `showPowerUp` and `showPowerUpBig` is kept as the source; while the banner, toast, warning, boss label, power-up timer or centre callout (with the `'powerup'` variant's POWER-UP! subtitle) is on screen, a language switch re-renders it in place (no animation replay, no timer reset). A callout queued behind a briefing is resolved when it shows. Plain strings show as given. The per-frame power-up countdown reads a cached string.

The enemy counter reads `ENEMIES n · LEFT m` (`敌人 n · 剩余 m`) in `'wave'` mode. `GameCoordinator.updateUI` sets `'boss'` during a boss fight (`sessionState.isBossMode()` or `sessionState.isInBossBattle()`) and `'wave'` otherwise: the counter then reads `ENEMIES n` (`敌人 n`), where n is the hostiles actually present — live enemy jets (boss-launched ones included) plus live hostile units (boss drones included) — and the wave roster's LEFT count is not shown.

```typescript
// StoryOverlay
export interface DebriefData {
  chapter: CampaignChapter;
  scoreGained: number;
  totalScore: number;
  kills: number;
  civiliansLost: number;
  alliesLost: number;
  bonusPoints: Array<{ label: string; points: number }>;
}
export type StoryCardKind = 'chapter' | 'debrief' | 'ending';
export interface ChapterIntroOptions {
  includePrologue?: boolean;
  unlockLine?: string | null;
}
/** 旁白配音的回调（每次 play 至多一次 onStart，之后 onEnd 与 onSilent 互斥、至多一次） */
export interface StoryNarrationEvents {
  /** 配音开口；durationSeconds 为配音时长 */
  onStart(durationSeconds: number): void;
  /** 自然说完 */
  onEnd(): void;
  /** 没有配音 / 加载失败 / 超时 / 被打断 */
  onSilent(): void;
}
/**
 * 旁白配音挂钩（表现层实现，StoryOverlay 不直接接触音频）：
 * 序章 / 章节简报 / 尾声的每一段开始打字时 play(段落 id)；跳过、翻页、收起时 stop()。
 */
export interface StoryNarration {
  play(voiceId: string, events: StoryNarrationEvents): void;
  stop(): void;
}
export class StoryOverlay {
  showChapterIntro(chapter: CampaignChapter, onComplete: () => void, options?: ChapterIntroOptions): void;
  showDebrief(data: DebriefData, onContinue: () => void): void;
  showEnding(data: { finalScore: number }, onComplete: () => void): void; // epilogue + credits
  isActive(): boolean;
  skip(): void;
  hide(): void; // cancels silently
  dispose(): void;
  onTypeTick?: () => void;
  onCardShown?: (kind: StoryCardKind) => void;
  narration: StoryNarration | null; // null = silent cards
}

// RadioComms — speaker resolved via CAMPAIGN_SPEAKERS; timing only from update(dt)
export type RadioPriority = 'normal' | 'high';
export interface RadioEnqueueOptions {
  priority?: RadioPriority;
}
export class RadioComms {
  enqueue(line: RadioLine, options?: RadioEnqueueOptions): void;
  update(deltaTime: number): void;
  /** 正在播放、有排队台词，或处于两句之间的间隔中（与 enqueue 的立即显示条件一致） */
  isBusy(): boolean;
  /** 当前台词的配音正在说（holdForVoice 之后、releaseVoice 之前） */
  isVoicing(): boolean;
  /**
   * 估计全部说完（当前 + 排队 + 间隔）还要多少秒（update 驱动的时间）；voiceSeconds 给出某句的配音时长
   * （没有配音时返回 null）。只用于等待上限（Boss 收尾），不影响播放时序
   */
  estimateRemainingSeconds(voiceSeconds?: (line: RadioLine) => number | null): number;
  /** 当前台词的配音开口了：台词至少停留到“此刻 + 配音时长 + 尾巴”，并在 releaseVoice 之前不进入淡出（有兜底上限） */
  holdForVoice(line: RadioLine, durationSeconds: number): void;
  /** 当前台词的配音说完 / 被停下 / 不可用：解除等待 */
  releaseVoice(line: RadioLine): void;
  clear(): void;
  dispose(): void;
  onLineShown?: (line: RadioLine) => void;
}
```

`StoryOverlay` sets `data-story-overlay` on `<html>` while a card is up (the HUD, radar, radio, mobile controls and indicator layers hide); callbacks run once per `show*`, after the overlay closes. With `narration` set, each prologue / briefing / epilogue paragraph asks for its voice by `VoicedText.id` before it types: it waits a short time for the voice to start (otherwise it types as plain text and stops the late voice), paces the typewriter so the text lands just before the voice ends, and waits for the voice to end (with a grace cap) before the next paragraph. A fully narrated card turns the page after a short hold for the objectives instead of the reading-time hold. Space / click (reveal all), the next card, Esc / Skip and `hide()` stop the narration; reduced motion shows the text at once and still narrates; a card written before a language switch is not narrated further.

`RadioComms` shows a line immediately when idle (the short gap between lines counts as busy), lets `'high'` interrupt, ignores duplicate text and caps its queue. Voiced timing: `holdForVoice` keeps the line up until its voice has finished plus a short tail, and the next line waits for `releaseVoice` (or a safety cap); without a voice the reading-time timing is unchanged. An interrupted normal line that was not delivered (its voice had not finished, or a text-only line had not been held long enough) goes back to the front of the normal queue — once: a replay that is interrupted again is dropped; a line whose voice finished counts as delivered. Whether an urgent line may interrupt a voiced one is the caller's decision (`isVoicing()`; the presentation never does). On a language switch the line on screen (callsign, text, screen-reader text) is rewritten in the new language. Each speaker's portrait glyph comes from `getSpeakerGlyph(speakerId)` (`src/ui/theme/hudGlyphs.ts`), which has an entry for every `CampaignSpeakerId`.

```typescript
// RadarMinimap (#radar-minimap) — RadarBlipKind / RadarBlip live in src/ui/radarGlyphs.ts and are re-exported
export type RadarBlipKind =
  | 'enemy' | 'spawning' | 'ally' | 'boss' | 'pickup'
  | 'enemy-ground' | 'enemy-sea' | 'neutral' | 'ally-unit';
/** 地表采样器：世界 (x, z) → 表面高度与是否为可航行水域（与 UnitSurfaceSampler 同形） */
export type RadarTerrainSampler = (x: number, z: number) => { y: number; water: boolean };
public setRangeMultiplier(multiplier: number): void;
public getRangeMultiplier(): number;
/** 关卡地图的地形底图来源：地表采样器 + 关卡号。可以每帧调用；关卡号变化时收起地图并作废底图缓存 */
public setTerrainSource(sampler: RadarTerrainSampler | null, level: number): void;
public isMapExpanded(): boolean;
public toggleMap(): void;
public setMapExpanded(expanded: boolean): void;
// PresentationController passthrough
public setRadarRangeMultiplier(multiplier: number): void;
public setRadarTerrainSource(sampler: RadarTerrainSampler | null, level: number): void;
// HealthBarSnapshot (PresentationController) adds `objective?: boolean` — see Units

// StartMenu (#start-menu) — a shell over src/ui/menu/: TitleScreen, SettingsSheet, HowToPlaySheet
public setOnStart(callback: (settings: GameSettings) => void): void;
public setOnContinue(callback: (save: CampaignSaveData) => void): void;
/**
 * “进入战场”过场（约 0.3 秒）播完且菜单已隐藏后兑现。onStart / onContinue 仍在点击的调用栈上同步触发
 * （音频解锁依赖这一点）。没有过场在播（减少动态效果、或菜单已被 hide()）时立即兑现。
 */
public whenLaunched(): Promise<void>;
public reloadFromStorage(): void;
public show(): void;
public hide(): void;
public dispose(): void;
// GameSettings (same file) mirrors StartFlowSettings field by field, including voiceVolume and language
// Title screen buttons: #continue-btn (only with a save; shows describeCheckpoint(save)), #start-btn,
// #preview-btn (Hangar), #settings-btn, #howto-btn.
// Settings sheet (#settings-sheet): rows keep the stable ids #<key>-row / #<key>-value, independent of the
// interface language: difficulty, lives, camera, tutorial, sfx, music, voice, quality, language, and under
// Advanced: level (1..TOTAL_LEVELS, caption #level-chapter), mode, testscore; #advanced-badge marks overrides.
// How to Play sheet: #howto-sheet. New-campaign confirm: #new-campaign-confirm.

// PauseMenu
export interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  /** 回到主菜单（菜单在存档成功、无需存档或玩家选择“仍然退出”之后调用） */
  onExitToMenu: () => void;
  /**
   * “保存并退出”的预告（只读，不写存档）：会存到哪里，或者本局为什么不存。
   * 与 onSaveAndExit 成对提供才启用；缺一个时菜单自己不存档，按钮仍叫“返回菜单”，
   * 确认页只读已有检查点、如实说明“继续战役”会从哪里开始。
   */
  getSaveStatus?: () => CampaignExitSave;
  /**
   * 执行存档并返回真实结果。只在预告是 'saved'（确认页写着“保存并退出”）时调用；不存档的对局
   * 直接 onExitToMenu，不会调用它。'saved' 随即调用 onExitToMenu；'failed' 时菜单停在失败页，
   * 由玩家选择仍然退出或返回；其余结果（预告说会存、结果却没存）回到确认页重新说明，不退出。
   */
  onSaveAndExit?: () => CampaignExitSave;
  applyAudio: (sfx: number, music: number) => void;
  /** 角色配音音量 0..1（立即生效）；缺省不显示语音一行 */
  applyVoice?: (voice: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}
// Default view: Resume, Upgrades, Settings, then Save & Exit when getSaveStatus().kind === 'saved',
// otherwise Main Menu. Either opens the Leave Mission confirm: it names the save position and what
// Continue Campaign will do, or says why nothing is saved ('no-save-mode' / 'not-started' / 'complete').
// A 'failed' result shows the Save Failed view (Back / Exit Anyway). handleEscape() returns to the
// default view from any sub-view.
// Looks: the main menu's own style fragments re-scoped to #pause-menu —
// rescopeMenuCss(menuKitCss() + sheetKitCss(), '#pause-menu') (src/ui/menu/menuStyles.ts, sheetStyles.ts).
// The confirm shows the save position as a card. Save & Exit is the primary (ice-blue) button; amber
// marks only an exit that discards progress ('no-save-mode', or no save wiring) and the Save Failed view.
// Settings view rows: Sound effects, Music, Voice (only with applyVoice), Graphics, Language.
// The Language row saves { language }, then setLocale(); every open menu re-renders through onLocaleChange.
// GameCoordinator wires getSaveStatus / onSaveAndExit to campaign.describeExitSave() / saveForExit()
// while a game is being played, and answers { kind: 'no-save-mode' } otherwise.

// UpgradeMenu
export type UpgradeMenuMode = 'pause' | 'hangar';
export interface UpgradeMenuShowOptions {
  mode?: UpgradeMenuMode;
  title?: string;
  subtitle?: string;
  /** 点击底部按钮时调用；缺省回退到构造参数 onResume。hangar 模式会先自行隐藏 */
  onContinue?: () => void;
}
public show(options?: UpgradeMenuShowOptions): void; // no argument = the old pause behaviour
public getMode(): UpgradeMenuMode;

// HUD settlement panel (MISSION FAILED / MISSION COMPLETE)
/** 绑定结算按钮回调（再来一局 / 返回菜单） */
public setSettlementActions(actions: { onRetry: () => void; onExitToMenu: () => void }): void;
/**
 * 任务失败且有可用检查点时结算面板的主动作：“从检查点重试”。
 * detail 说明回到哪里（章节 / 波次；可本地化，面板开着时切换语言随之重绘）。
 */
export interface SettlementCheckpointRetry {
  detail: HudText;
  onRetry: () => void;
}
/**
 * 显示游戏结束。
 * checkpointRetry：有可用检查点时传入，面板的主动作变成“从检查点重试”并写明回到哪里，
 * 不再提供“再来一局”（它会从头开始、清掉这份存档）；不传 / null 时面板与原来一样。
 */
public showGameOver(finalScore: number, checkpointRetry?: SettlementCheckpointRetry | null): void;
public showMissionComplete(finalScore: number): void;
```

Game over and the checkpoint. `GameCoordinator.resolveCheckpointRetry()` builds the `SettlementCheckpointRetry` when the run is in normal mode, `onContinueFromCheckpoint` was supplied and a valid checkpoint is stored (`hasCampaignCheckpoint()` / `loadCampaignCheckpoint()`): `detail` is `describeCheckpointText(save)` and `onRetry` calls `onContinueFromCheckpoint(save)`. The panel then shows **Retry from checkpoint** / 从检查点重试 as its primary action, with the position on a card labelled **Checkpoint** / 检查点 above it (card and action are one button), then **Main Menu**; the **Play Again** action bound through `setSettlementActions` is not offered, and nothing on the panel deletes the save. In Boss mode, or with no checkpoint, `checkpointRetry` is `null` and the panel is **Play Again** / **Main Menu**. `CheckpointResumeButton` (the floating button under the old panel) no longer exists.

The settlement panel (`#hud-settlement-overlay` / `#hud-settlement-panel`, shared by `showGameOver` and `showMissionComplete`) is drawn in the main menu's visual language, from the same style fragments as the pause menu: `rescopeMenuCss(menuKitCss() + sheetKitCss(), '#hud-settlement-overlay')`. Above the title it carries the eyebrow **Debrief** / 战后简报; the panel's `data-tone` is `failed` (a red accent) or `complete` (ice blue). In every state — failed with or without a checkpoint, mission complete — the first action is focused when the panel appears, Tab / Shift+Tab cycle between the panel's two actions and do not leave it, and each action delivers its callback once per showing, however often it is pressed. On the focused first action, a repeating key or an Enter / Space press within 500 ms of the panel appearing is ignored, because Space is also the fire key.

Mobile controls in `index.html`: the stick (`#touch-stick-zone`, `#joystick`, `#joystick-knob`; see [Input](#input)) and the buttons `#camera-button`, `#special-button`, `#cycle-button`, `#flare-button` (plus the existing `#fire-button`, `#missile-button`, `#throttle-button`, `#upgrade-button`). `#throttle-button` (BOOST) is a latch and carries `aria-pressed`; `#missile-button` shows the missile count (`data-count`) and a reload ring (`--tc-meter`) written by the HUD, and the lock state as classes written by `LockOnIndicator` (`is-search`, plus `is-track` while tracking; `is-lock` + `is-ready` when locked; `is-dry` with no missiles). The HTML ships English labels (FIRE, MSL, SPEC, FLARE, BOOST, SWAP, VIEW, PAUSE); `src/main.ts` rewrites labels and `aria-label`s for the current language, except the special button's main label while the HUD shows a weapon code there.

HUD layout (`HUD.ts`, `theme/hudExtrasStyles.ts`, `theme/radioStyles.ts`): `#hud` is inset by `env(safe-area-inset-*)`, and positions and sizes are CSS keyed by `HudLayoutDensity`, so a rotation re-lays out. The right status column `#hud-status` stacks the wave line, the lives readout (label + pips, `data-hud="lives-readout"`), the missile readout (label, `#hud-missile-count` as `n/max`, pips and the reload meter, `data-hud="missile-readout"`) and the power-up timer (the two readouts side by side in portrait). The centre message stack `#hud-top-stack` holds the boss strip, briefing, event objective and, in portrait, the autosave toast; on phones in portrait it is a full-width row under the status band, and the radio panel follows its bottom through the `--hud-stack-bottom` variable on `<html>`. In portrait the autosave toast waits (hidden, timer paused) while a briefing is up or while the boss strip and an objective share the stack. Centre callouts (`showPowerUpBig`, `#hud-callout`) are a banner, not a full-screen block, placed per camera mode so that it clears the reticle and the seeker ring (whose radius `LockOnIndicator` publishes as `--hud-aim-r` on `<html>`; the HUD marks the mode with `data-hud-camera`): in the chase view, where the reticle sits about 29% down the screen, the banner goes below the jet on desktop and touch-landscape and between the ring and the jet in portrait; in first person, where the reticle is at the centre, it grows upward from above the ring on desktop and portrait and sits under the message stack in touch-landscape. The warning lane (`#hud-warning-lane`) sits below the jet in the chase view (under the callout on desktop and touch-landscape) and below the ring in first person. The ENEMIES / LEFT counter has the same dark backing as the cockpit panel.

Health bars (`src/ui/EnemyHealthBars.ts`) show a friendly AI jet's pilot callsign when its mesh carries `userData.displayName` (`LocalizedText` or string — set from `WingmanProfile.callsign`), ahead of the per-name label cache, and rename every bar at once on a language switch. Bars come in three sizes: boss body (120 × 10 px, with its name), boss part (44 × 5 px on a dark track) and everything else (60 × 6 px, with its name). Of the boss parts in view, only the one nearest the reticle shows its name, with hysteresis (another part must be under 80 % of its distance to take over); parts no longer draw their own off-screen chevrons.

Hostile ground / sea / air units are fed to the same bars by `CombatHudFeed` (through `UnitController.forEachHostileMarker`) and are labelled with the unit's own name from `mesh.userData.displayName`. On top of the bar, a unit gets:

- a **target bracket** — four corners in the threat colour with the range in metres (rounded to 10 m) — while it projects smaller than about 22 px on screen, hidden again above 28 px;
- the **objective style** when its snapshot carries `objective: true`: the bracket is always shown, thicker and pulsing, and its off-screen arrow blinks in the threat colour (class `is-objective`; no animation under reduced motion);
- an **off-screen arrow** (`OffscreenChevron`) whose distance label stays horizontal on the arrow's tail side. Arrows are kept out from under the chrome drawn above them by `ChevronAvoidance` (`src/ui/ChevronAvoidance.ts`); `EnemyHealthBars` and `BossMissileIndicator` (the arrows that point at a boss's missiles) each hold one instance and follow the same rules. The areas avoided are the radar dial (`#radar-minimap`), the HUD panels (`#hud-score`, `#hud-speed`, `#hud-upgrades`, `#hud-status`, `#hud-health` and every block showing in `#hud-top-stack`) and, in touch layouts, the stick (`#joystick`) and every visible `.touch-btn`. The rectangles are re-measured about once a second (and on touch start / end, because the floating stick moves), and an arrow whose footprint — distance label included — touches one of them (with an 8 px margin) slides along the screen edge or inward past it, whichever is the shorter move, keeping its bearing and staying whole on screen.

Radar (`RadarMinimap`, `RadarLevelMap`, `radarGlyphs.ts`):

- The dial (`#radar-minimap`) is heading-up: forward is up and a contact on the player's right is drawn on the right. `BASE_RANGE` is 800 m across the dial (about 400 m from the centre to the rim), scaled by `setRangeMultiplier` (0.25–4). Desktop: 120 px, bottom-left. Touch layouts: top-left under the status cabin, 84 px on phones and 132 px when the viewport's shorter side is at least 700 px, with a separate tap surface `#radar-tap-target` so touches on the dial do not start the stick.
- In-range contacts are filled glyphs (`drawRadarBlip`); a contact beyond range is clamped to the rim and drawn by `drawRadarRimMarker` as a smaller, dimmer, hollow glyph of the same class with a short tick pointing outward.
- A click or tap on the dial, or the N key (not with Ctrl / Meta / Alt, not while typing), toggles the level map (`#radar-map`); Esc closes it and is captured so it does not also pause. The map collapses on a level change and when radar updates stop for 1.5 s. It does not pause the game.
- The level map is north-up (world −Z at the top) and fixed-scale: the battlefield boundary circle, 500 m and 1000 m rings around the player, the player's arrow rotated by heading, every radar contact with the same glyphs drawn larger, a legend, and a 64 × 64 land / water underlay sampled once per level from the `RadarTerrainSampler` (a plain grid without one). The panel is 72% of the viewport's shorter side (200–560 px), nearly opaque, redrawn at 20 Hz.

`ModelPreview` builds every boss from its own mesh factory through a lazy `Record<BossType, loader>` (bosses 6–10 from `MagmaColossusMesh`, `AbyssalLeviathanMesh`, `TempestZeppelinMesh`, `PhantomWingMesh`, `OraclePrimeMesh`), scales the visible geometry (hidden parts and sprites excluded) to a fixed bounding sphere — centred on the visible bounding box, its radius the farthest visible vertex from that centre, so the model stays inside it at every rotation — and disposes each previewed model's geometries, materials and instance buffers once, skipping shared resources. `hideSignalLights()` (`src/ui/menu/modelDisposal.ts`) first hides the jet factory's signal-light balls (`navLightPort`, `navLightStarboard`, `strobeLight`, `beaconLight`) on that instance, so they are neither drawn nor framed; `MenuHeroScene` does the same for the title screen's jet. The sphere is framed in the part of the canvas above the name label: after the name is written (and again on resize and on a language switch) `frameCamera()` reads the label's top from the DOM, keeps 8 px clear of it and of the canvas top (the region reaches at least halfway down the canvas), backs the camera off until the sphere's outline is 70% of the canvas's shorter side — the same size for every model — or, where the region is too small for that, until it fits the region's height or width with a margin, and moves the projection centre into the region with `setViewOffset`; before the canvas has a layout it frames the whole canvas. A model whose factory or chunk fails to load writes `Could not load: {name}` / `无法加载：{name}` into the name label and leaves the other models and the way back working; a failed import of the aircraft factory is not kept, so the next visit to that page imports it again (a browser whose module map remembers the failed download still needs a reload). If `show()` cannot create its renderer (no WebGL context) it calls `hide()`, which runs the `setOnBack` callback and so brings the menu back with focus on the Hangar button, and rethrows. The name label stays on one line when it fits (18 px type up to 600 px width); in a landscape viewport up to 520 px tall the header is compressed and the hint line hidden so the stand gets the height. The menu calls this screen the **Hangar** (`#model-preview`, opened from `#preview-btn`): arrow buttons, the Left / Right keys or a horizontal swipe change model, a mouse drag rotates it, `#rotate-toggle` switches auto-rotate, and Esc or the back button returns to the menu. Its `WebGLRenderer` exists only while it is shown — created in `show()`, released with its context in `hide()` — so it never coexists with the title screen's hero renderer or a game's.

## Input

Source: `src/core/Input/InputHandler.ts`.

```typescript
export interface InputState {
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  fire: boolean;
  missile: boolean;
  throttle: boolean;
  /** 特殊武器扳机（F 键 / 移动端特殊武器按钮）：按住持续照射 / 蓄力 */
  special: boolean;
  /**
   * 俯仰模拟量 -1..1（正 = 抬头）。键盘为 ±1，触控摇杆为“径向死区 + 指数曲线”后的连续值。
   * InputHandler.getState() 总会写入；类型上可选，是为了只写布尔方向的调用方（脚本飞行员、
   * 测试里的字面量）仍然可用——PlayerController 在缺省或为 0 时退回布尔方向（±1）。
   */
  pitchAxis?: number;
  /** 偏航模拟量 -1..1（正 = 右转），规则同 pitchAxis */
  yawAxis?: number;
  /**
   * 辅助飞行：转向来自触控摇杆（手指按在摇杆上，且键盘没有在转向）时为 true，
   * PlayerController 走“推右就相对地平线右转”的辅助模型；键盘转向（含平板外接键盘）为 false。
   */
  flightAssist?: boolean;
}

/** 触控摇杆手感参数 */
export const TOUCH_STICK_TUNING = {
  DEAD_ZONE: 0.12, // radial dead zone, as a fraction of the travel
  EXPO: 1.7, // response-curve exponent
  DIGITAL_THRESHOLD: 0.08, // |axis| above this also sets the boolean direction
  FALLBACK_RADIUS_PX: 54, // travel radius when the stick cannot be measured
  EDGE_MARGIN_PX: 6, // floating base keeps this far from the screen / safe-area edge
} as const;
/** 摇杆响应曲线：输入是偏转幅度（0..1，占行程比例），输出 0..1 */
export function shapeStickMagnitude(magnitude: number): number;

public getState(): Required<InputState>; // reused object — read it in the same step
public consumeCameraToggle(): boolean; // V / #camera-button
public consumeWeaponCycle(): boolean; // Tab / X / #cycle-button
public consumeWeaponSlot(): number; // Digit1-5 / Numpad1-5 → 0..4, -1 when none
public consumeFlareDeploy(): boolean; // G / #flare-button
public resetActionQueue(): void; // pause / story cards / level change
/** 本步是否切换暂停：Esc / P 的按下沿，或一次排队中的移动端暂停键单击（读取即清除） */
public isPauseToggled(): boolean;
public resetPauseState(): void; // clears the held key edge and a queued pause tap
```

The mobile pause button (`#upgrade-button`, labelled PAUSE) latches its tap on `touchstart` like the other tap buttons, so a tap shorter than one simulation step still pauses; the desktop keys keep their held-key edge detection.

Axes and assist. `getState()` always writes `pitchAxis`, `yawAxis` and `flightAssist`. The keyboard gives ±1. On a touch device the stick's shaped value is merged with the keyboard — the larger magnitude wins per axis, buttons are OR-ed — and the boolean directions are derived from the merged axes (`DIGITAL_THRESHOLD`). `flightAssist` is true only while a finger is on the stick and no pitch / yaw / roll key is down; `PlayerController` then flies the assisted model (`applyAssistedAttitude`), whose three channels are independent: yaw about the world vertical in proportion to `yawAxis`; pitch about the level right axis in proportion to `pitchAxis`, not increasing past `ASSIST_PITCH_LIMIT` (75°) from the horizon; bank easing toward `−yawAxis × ASSIST_MAX_BANK` (45°), so the wings level when the stick centres (`ASSIST_ROLL_RESPONSE`, `ASSIST_ROLL_MAX_RATE`; all in `GAME_CONSTANTS.PLAYER`). Without the flag it keeps the body-axis model (`applyManualAttitude`), unchanged for the keyboard. Callers that only set the boolean directions (the scripted pilot, test literals) still work: a missing or zero axis falls back to ±1 from the booleans.

Floating stick. A touch anywhere in `#touch-stick-zone` (or on `#joystick`) becomes the stick's origin: the base moves under the finger, kept `EDGE_MARGIN_PX` inside the screen and the safe area. The touch is then followed at document level by its identifier, so sliding out of the zone does not drop the stick and a second finger cannot take it over. Deflection is `shapeStickMagnitude` of the distance over the stick's travel radius.

Tap latches. A press of fire (Space, `#fire-button`) or missile (`KeyM` / `ShiftRight`, `#missile-button`) is queued until the next `getState()`, which reports it and clears it, so a press shorter than one simulation step is still seen once: a key-down is queued at once, and a touch press that `getState()` has not read yet is queued when the finger lifts. A touch that ends in `touchcancel` is not counted as a press and leaves a tap that was already queued in place. `#throttle-button` toggles a boost latch (`aria-pressed`, class `is-active`) instead of being held. `resetActionQueue()` clears the queued fire / missile taps along with the other one-shot actions and switches the boost latch off. A window `blur` or the page becoming hidden releases every held key, button and the stick, and clears the queued fire / missile taps.

Desktop bindings: `KeyW`/`ArrowUp`, `KeyS`/`ArrowDown` pitch · `KeyA`/`KeyD` yaw · `KeyQ`/`KeyE` roll · `Space` fire · `KeyM`/`ShiftRight` missile · `ShiftLeft`/`ControlLeft` throttle · `KeyF` special · `KeyV` camera · `Tab`/`KeyX` cycle (Tab's default is prevented unless a form control has focus) · `Digit1`–`Digit5`/`Numpad1`–`Numpad5` slot · `KeyG` flares · `Escape`/`KeyP` pause · `KeyU` upgrade.

## Coordinator options

Source: `src/core/GameCoordinator.ts` (`GameCoordinatorOptions`, not exported).

```typescript
interface GameCoordinatorOptions {
  showStartMenu?: boolean;
  onRetry?: () => void;
  onExitToMenu?: () => void;
  /** 从战役检查点继续（正常模式）：开局时还原进度并回到存档的波次 / Boss 战前 */
  resume?: CampaignSaveData | null;
  /** 结算界面“从检查点继续”：由 main.ts 用存档重新开一局 */
  onContinueFromCheckpoint?: (save: CampaignSaveData) => void;
}
```

`onRetry` is the settlement panel's **Play Again** and `onExitToMenu` its **Main Menu**. `onContinueFromCheckpoint` is what the panel's **Retry from checkpoint** calls after a failed mission with a checkpoint (see [HUD, story overlay, radio, radar, menus](#hud-story-overlay-radio-radar-menus)); `src/main.ts` passes its `continueFromCheckpoint`. Both restarts end in `bootGame`, which returns at once while an earlier boot is still in progress, so a double press cannot start two games.

## HUD tokens and layout

Source: `src/ui/theme/hudTokens.ts`. `injectHudTokens()` appends a `<style id="hud-tokens">` once.

```typescript
export type HudLayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';
export type LockOnState = 'search' | 'track' | 'lock' | 'break' | 'dry';

export const HUD_COLORS = {
  sys: '#8FE4FF',
  weapon: '#FFB347',
  lock: '#5CFFB0',
  lockRgb: 'rgb(92, 255, 176)',
  threat: '#FF4D4D',
  ally: '#F4D35E',
  glass: 'rgba(8,14,24,0.72)',
  edge: 'rgba(143,228,255,0.28)',
  text: '#EEF8FF',
  muted: 'rgba(183,231,255,0.86)',
  shadow: '0 12px 24px rgba(0, 0, 0, 0.28)',
} as const;

export function injectHudTokens(): void;
export function detectHudLayoutDensity(): HudLayoutDensity;

// HUD / LockOnIndicator
public setLayoutDensity(density: HudLayoutDensity): void;
```

`:root` variables include `--hud-sys #8FE4FF`, `--hud-weapon #FFB347`, `--hud-lock #5CFFB0`, `--hud-threat #FF4D4D`, `--hud-ally #F4D35E`. DRY lock chrome text is `NO MSL`. Callers of `injectHudTokens()`: `HUD`, `LockOnIndicator`, `PauseMenu`, `PresentationController`. The campaign UI adds `hudPalette.ts`, `hudGlyphs.ts`, `hudExtrasStyles.ts`, `storyStyles.ts` and `radioStyles.ts` in the same folder.

`PauseMenu` has no `setLayoutDensity`.

## AudioContextHost

Source: `src/core/Audio/AudioContextHost.ts`.

`AudioManager`, `MusicSystem` and `VoiceSystem` acquire/release the same `AudioContext` as holders. SFX, music and voice gain graphs stay separate and meet at the shared output node.

```typescript
export function getSharedAudioContext(): AudioContext | null;
export function acquireSharedAudioContext(holder: object): AudioContext | null;
export function releaseSharedAudioContext(holder: object): void;
export function resumeSharedAudioContext(): void;
export function unlockAudioFromUserGesture(): void;
/** 共享输出总线入口（限幅器 + 软削波 → destination）；每个上下文只建一次 */
export function getSharedOutputNode(context: BaseAudioContext): AudioNode;
export function resetSharedAudioContextForTests(): void;
```

- `getSharedAudioContext()` — current shared context, or `null` if none exists / it is closed.
- `acquireSharedAudioContext(holder)` — ref-counted get-or-create; last `releaseSharedAudioContext(holder)` closes the context.
- `resumeSharedAudioContext()` — if the shared context is `suspended` or `interrupted`, calls `resume()`.
- `unlockAudioFromUserGesture()` — create (if needed) and resume on the user-gesture stack. Unlock itself does not occupy a holder, so `AudioManager` / `MusicSystem` can take over later.
- `resetSharedAudioContextForTests()` — test isolation only: clear holders, close a live context, drop the singleton. Not a runtime API.

Call sites: `StartMenu.launch()` and `src/main.ts` `bootGame` call `unlockAudioFromUserGesture()`; `MenuMusic` calls it after the first menu gesture; `AudioManager.resume()` / `MusicSystem.resume()` call `resumeSharedAudioContext()` after `initContext()`; both dispose paths call `releaseSharedAudioContext(this)`.

## Missile lock audio

Source: `src/core/Audio/AudioManager.ts`.

```typescript
export enum SoundType {
  // ...
  MISSILE_LOCK_BREAK = 'MISSILE_LOCK_BREAK',
  MISSILE_DRY = 'MISSILE_DRY',
  // ...
}

public playMissileLockBreak(): void;
public playMissileDry(): void;
```

`GameCoordinator.handleMissileInput` calls `playMissileDry()` on a missile press with no missiles, on a press with nothing tracked and on a release before the lock completes; `playMissileLockBreak()` when the seeker reports `events.lost`; `playMissileLockConfirm()` on `events.locked`; and the self-throttled `playMissileLock()` while a target is tracked but not yet locked. See [Missiles and gun aim](#missiles-and-gun-aim).

## Browser debug handles

When running the game, `window.game` exposes the coordinator for console inspection.

Dev builds only (`import.meta.env.DEV`): `GameCoordinator` dynamically imports `src/core/dev/DevHooks.ts` when a game starts, whose `installDevHooks(access: DevHookAccess): void` publishes `window.__AIR_SUPREME_DEV__` (state readout, simulation time scale, wave clearing, boss damage, teleports). The production build strips the import. Added with the voice, balance and polish work:

- `voice` — `state()` (`VoiceSystem.getDebugState()`), `sample()` (voice and music bus RMS in dBFS, the music's voice-duck level, current line and phase, pack language), `say(lineId, kind = 'radio')`, `radio(key: GenericRadioKey)` and `wingman(id: WingmanId, event: WingmanEvent)`.
- `balance` — the scripted-pilot balance harness (`installBalanceHarness`, `src/core/dev/BalanceHarness.ts`, with the pilot in `ScriptedPilot.ts`), used to measure the difficulty curve and progression. The pilot's terrain look-ahead also checks lines 14 m either side of its path for walls, so it steers around obstacles such as the Sky Ladder pylons.
- `grantPowerUp(type = 'DAMAGE')` — emits `POWERUP_COLLECTED` with that power-up's config (unknown types fall back to `DAMAGE`), so the real pickup handler runs (HUD timer, effect, sound); returns the type granted.

`getState()` also carries an `aim` block from `DevHookAccess.getAimState?()` (`null` when the access object does not provide it): `reticle` and `gunCross` as screen pixels (`null` while off screen), `gunCrossAssisted`, `acquireRadius` and `keepRadius` in pixels, `lockState`, `lockProgress`, `hasTarget`, `missiles`, `leadPip` and `gunAssist`. The scripted pilot presses the missile key in a hold-and-release cadence (1.4 s held, 0.25 s released), because one press fires one missile.
