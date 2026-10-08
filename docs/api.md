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

## Config

- Runtime constants: `src/config.ts` (`GAME_CONSTANTS` — `PLAYER`, `PROJECTILE`, `CAMERA`, `WORLD`, `POWERUP`, `LEVEL`, `MISSILE`; `GameConfig` device / quality profiles)
- External JSON: `public/config/game-config.json` via `src/core/utils/ConfigLoader.ts`

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

await configLoader.load();
const playerConfig = configLoader.getPlayer();
const enemyConfig = configLoader.getEnemy('FIGHTER');
```

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

`TerrainGenerator.getCrashSurfaceY` uses the heightfield (`WORLDSCAPE_WATER_Y + heightAt`) for levels 1–5 and the environment module's sampled surface for levels 6–10; no field → `WORLDSCAPE_WATER_Y`. `LevelManager.getCrashSurfaceY` forwards to the generator, or `WORLDSCAPE_WATER_Y` if terrain is not loaded.

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
```

`y` is the world-space surface (the water surface where `water` is true). Water exists on `LAKE`, `OCEAN`, `VOLCANO` (sea around the island), `ARCTIC` (open sea between ice) and the `CANYON` river. Environment modules implement `TerrainEnvironment` (`terrain`, `root`, `hasWater`, `build(ctx)`, `sampleHeight(worldX, worldZ)`, `isWater(worldX, worldZ)`, optional `surfaceKindAt(worldX, worldZ)` and `update(deltaTime, elapsed, focus)`, `dispose()`) on top of `EnvironmentBase`; `sampleEnvironmentSurface(environment, worldX, worldZ, waterY)` turns height + water into the `sampleSurface` result.

`LevelConfig` additions:

```typescript
export enum TerrainType {
  LAKE = 'LAKE', DESERT = 'DESERT', MOUNTAINS = 'MOUNTAINS', OCEAN = 'OCEAN', CITY = 'CITY',
  VOLCANO = 'VOLCANO', ARCTIC = 'ARCTIC', CANYON = 'CANYON', STRATOSPHERE = 'STRATOSPHERE',
  CITADEL = 'CITADEL',
}
export type LevelWeatherPreset =
  | 'clear' | 'cloudy' | 'mist' | 'windy' | 'sandstorm' | 'snow' | 'storm' | 'smog' | 'ash' | 'aurora';
export interface LevelPostFxConfig {
  exposure: number;
  contrast: number;
  saturation: number;
  bloomStrength: number;
  vignetteStrength: number;
}
// LevelConfig gains `postFx: LevelPostFxConfig`; LEVELS covers ids 1..10 (names = CampaignChapter.title)
export function getLevelConfig(levelId: number): LevelConfig | undefined;
```

`CanyonEnvironment.getConvoyRoute()` and `CitadelEnvironment.getAssaultRoute()` feed `UnitSystem.setRouteProvider`; `CitadelEnvironment.getCoreArena()` anchors Oracle Prime and `setCoreState('online' | 'exposed' | 'overload' | 'offline')` mirrors its phases.

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
  unitHealthMultiplier: number;
  bossCooldownMultiplier: number;
  scoreMultiplier: number;
}
export const CAMPAIGN_LEVEL_CAP = 10;
export function getLevelScaling(level: number): LevelScaling;
export function getDifficultyProfile(level: number): DifficultyProfile; // player difficulty 1..5
```

The curve values live in `getLevelScaling` itself; `UnitController.setLevel` multiplies them by the player's `DifficultyProfile`.

## Campaign data

Source: `src/features/campaign/CampaignData.ts` (data and pure functions only).

```typescript
export const TOTAL_LEVELS = 10;

export type CampaignSpeakerId = 'hq' | 'wingman' | 'scientist' | 'oracle' | 'player' | 'civilian';
export type CampaignSpeakerTone = 'sys' | 'ally' | 'threat' | 'weapon' | 'muted';
export interface CampaignSpeaker {
  id: CampaignSpeakerId;
  callsign: string;
  name: string;
  tone: CampaignSpeakerTone;
}
export const CAMPAIGN_SPEAKERS: Readonly<Record<CampaignSpeakerId, CampaignSpeaker>>;

export type RadioTriggerKind =
  | 'level-start' | 'wave-start' | 'wave-complete'
  | 'boss-spawn' | 'boss-phase' | 'boss-low-health' | 'boss-defeated';
export interface RadioLine {
  trigger: RadioTriggerKind;
  /** 波次序号或 Boss 阶段号；缺省表示不区分序号 */
  index?: number;
  speaker: CampaignSpeakerId;
  text: string;
}

export interface CampaignBossBrief {
  name: string;
  codename: string;
  briefingLine: string;
  weakPointHint: string;
}
export interface CampaignChapter {
  level: number;
  chapterLabel: string;
  codename: string;
  operationName: string;
  title: string;
  location: string;
  intro: readonly string[];
  objectives: readonly string[];
  levelBriefingLine: string;
  boss: CampaignBossBrief;
  radio: readonly RadioLine[];
  unlockedWeapons: readonly SpecialWeaponId[];
  unlockLine: string | null;
  debriefSummary: string;
}

export const CAMPAIGN_TITLE = 'AIR SUPREME · 天穹之战';
export const CAMPAIGN_PROLOGUE: readonly string[];
export const CAMPAIGN_EPILOGUE: readonly string[];
export const CAMPAIGN_CREDITS: readonly string[];
export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[];

/** 首次遭遇某类单位时的提示台词；键为 UnitType 枚举的字符串值 */
export const UNIT_FIRST_CONTACT_RADIO: Readonly<Record<string, RadioLine>>;
export type GenericRadioKey =
  | 'civilian-hit' | 'civilian-destroyed' | 'ally-unit-destroyed' | 'escort-success'
  | 'escort-failed' | 'missile-warning' | 'low-health' | 'weapon-overheat' | 'checkpoint';
export const GENERIC_RADIO: Readonly<Record<GenericRadioKey, RadioLine>>;

export function getCampaignChapter(level: number): CampaignChapter; // clamps to 1..TOTAL_LEVELS
export function getChapterRadio(level: number, trigger: RadioTriggerKind, index?: number): RadioLine[];
export function getUnlockedWeaponsThrough(level: number): SpecialWeaponId[];
export function getWeaponUnlockLevel(weapon: SpecialWeaponId): number | null;
```

Unlock schedule (`CampaignChapter.unlockedWeapons`): rockets 2 · laser 4 · swarm 6 · railgun 7 · emp 9.

## Campaign presentation (`ICampaignPresentation`)

Source: `src/core/campaign/CampaignPresentation.ts`. Gameplay code tells the story, reports state and makes campaign sounds only through this interface; `DefaultCampaignPresentation` implements it on top of `StoryOverlay`, `RadioComms`, `HUD`, `PresentationController` (radar), `MusicSystem` and `CampaignSfxRouter`. See [ADR 0001](decisions/0001-campaign-presentation-adapter.md).

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
  genericRadio(key: GenericRadioKey): void;
  unitFirstContact(unitType: string): void;
  /** 无线电正在播放或有排队台词 */
  isRadioBusy(): boolean;
  /** 关卡结束 / 换关 / 失败：清空无线电 */
  clearRadio(): void;

  // ── HUD 新面板 ──
  updateWeaponPanel(state: CampaignWeaponPanelState | null): void;
  updateFlares(charges: number, max: number, rechargeProgress: number): void;
  showAutosave(label: string): void;
  /** announce = false：开局 / 读档同步视角，不播放切换音效 */
  setCameraMode(mode: CameraModeSetting, announce?: boolean): void;
  setBossStatus(label: string | null, phase?: { current: number; total: number }): void;
  /** 导弹告警：单位（SAM）与 Boss 导弹两个来源取最高级 */
  setMissileWarning(level: MissileWarningLevel, source?: 'units' | 'boss'): void;
  flashWarning(text: string, tone: 'threat' | 'sys' | 'ally'): void;
  setRadarRangeMultiplier(multiplier: number): void;
  /** 每个模拟步长：低血量蜂鸣 + 低血量无线电（高优先级） */
  updatePlayerHealth(deltaTime: number, healthPercent: number, active: boolean): void;

  // ── 音乐 ──
  playLevelMusic(level: number): void;
  playBossMusic(level: number): void;
  playStinger(kind: CampaignStinger): void;
  setMusicIntensity(intensity: number): void;
  /** Boss 进入新阶段：阶段台词、警报 + phase-change 刺激音、音乐强度、HUD 闪烁告警 */
  onBossPhaseChange(level: number, phase: number, label: string | null): void;
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
}
export class DefaultCampaignPresentation implements ICampaignPresentation {
  constructor(deps: DefaultCampaignPresentationDeps);
}
```

Behaviour worth knowing: radio lines enqueued before the story UI loads are buffered (up to 6, duplicates dropped); `civilian-hit`, `missile-warning` and `low-health` are high priority; Boss mode keeps only `boss-spawn` chapter lines and the high-priority generic lines; per-frame HUD pushes are diffed (no call when nothing visible changed).

## Campaign flow

Source: `src/core/campaign/CampaignFlowController.ts`.

```typescript
export interface CampaignFlowDeps {
  session: GameSessionState;
  stats: PlayerStats;
  presentation: ICampaignPresentation;
  scheduleTimeout(callback: () => void, delayMs: number): void;
  prepareLevel(level: number, startWave: number): Promise<void>;
  startLevelCombat(level: number, startWave: number, firstLevelOfSession: boolean): void;
  startBossEncounter(level: number, isBossMode: boolean): void;
  showHangar(level: number, onContinue: () => void): void;
  syncProgression(level: number): void;
  setStoryHold(hold: boolean): void;
  showMissionComplete(finalScore: number): void;
  captureCheckpoint(kind: CheckpointKind, level: number, wave: number): CampaignCheckpointInput;
  getScore(): number;
}

export class CampaignFlowController {
  constructor(deps: CampaignFlowDeps);
  setupNewRun(level: number): void;
  beginNewRun(level: number): void;
  resumeFromCheckpoint(save: CampaignSaveData): void;
  handleWaveStart(wave: number): void;
  handleWaveComplete(wave: number): void;
  handleLevelComplete(level: number): void;
  handleBossDefeated(level: number, isBossMode: boolean): void;
  recordKill(): void;
  recordAssetLost(civilian: boolean): void;
  recordDeath(): void;
  tick(deltaTime: number): void;
  getRunStats(): CampaignRunStats;
  isVictory(): boolean;
  dispose(): void;
}
```

The sequence it drives is in [architecture.md → Campaign flow](architecture.md#campaign-flow).

## Save system

Source: `src/core/save/SaveSystem.ts`. Only touches `localStorage` when called (via `getLocalStorage()`); never throws.

```typescript
export const CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save';
export const CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress';
export const CAMPAIGN_SAVE_VERSION = 1;

/** 检查点类型：入关、波次之间、Boss 战之前 */
export type CheckpointKind = 'level-start' | 'wave' | 'boss';

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
/** 如“第6关 · 熔炉之心 · 第3波”；Boss 检查点显示“Boss 战” */
export function describeCheckpoint(data: CampaignSaveData): string;
export function getCampaignProgress(): CampaignProgress;
export function markCampaignCompleted(finalScore: number): void;
export function recordLevelReached(level: number): void;
```

`loadCampaignCheckpoint` validates and normalises: corrupt JSON, a non-object, a different version or a missing level removes the key and returns `null`; out-of-range fields are clamped and missing ones defaulted. `saveCampaignCheckpoint` returns `false` when storage is unavailable, the write fails or the level is missing. Checkpoints are written by `CampaignFlowController` in normal mode only: `'level-start'` (wave 0) after the chapter card, `'wave'` (wave k + 1) after wave k except the last, `'boss'` (wave = `totalWaves`) before the boss. Restore order in `GameCoordinator.restoreCheckpoint`: `upgrades.reset()` → `import(save.upgrades)` → `setCampaignLevel` → `setUnlockedWeapons(getUnlockedWeaponsThrough(level))` → `SpecialWeaponsController.syncProgression` → `importState(save.weapons, save.flares)` → score / lives / missiles / camera mode.

## Session settings

Source: `src/core/SessionSettings.ts`; `GameSettings` (`src/ui/StartMenu.ts`) mirrors `StartFlowSettings` field by field.

```typescript
export type GameMode = 'normal' | 'boss';
/** 视角偏好（与 CameraRig 的 CameraMode 取值一致） */
export type CameraModeSetting = 'third-person' | 'first-person';

export interface StartFlowSettings {
  difficulty: number;
  sfxVolume: number;
  musicVolume: number;
  qualityPreset: QualityPreset;
  tutorialEnabled: boolean;
  playerLives: number;
  startLevel: number; // clamped to 1..TOTAL_LEVELS
  gameMode: GameMode;
  testScore: number;
  cameraMode: CameraModeSetting; // new; default 'third-person'
}

export const DEFAULT_START_FLOW_SETTINGS: StartFlowSettings = {
  difficulty: 3,
  sfxVolume: 0.7,
  musicVolume: 0.7,
  qualityPreset: 'auto',
  tutorialEnabled: true,
  playerLives: 3,
  startLevel: 1,
  gameMode: 'normal',
  testScore: 0,
  cameraMode: 'third-person',
};
export const START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings';

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

`GameCoordinator` writes `cameraMode` back with `saveStartFlowSettings({ cameraMode })` whenever the view is toggled.

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
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  valuePerLevel: number;
  baseValue: number;
  unit: string;
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
  name: string;
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

Faction rules: damage from a player source (`cannon | missile | rocket | laser | swarm | railgun | emp`) counts as `byPlayer`; `applyAreaDamage` with a player source spares friendly units, and `'enemy-fire'` / `'boss'` spare enemy units. The system draws its own explosions — use `onExplosion` for camera shake and sound only. `UnitController` (`src/core/units/UnitController.ts`) is the runtime wrapper the coordinator talks to.

## Special weapons

Source: `src/features/weapons/WeaponTypes.ts`, `WeaponSystem.ts`. Per-tier stat tables live in `WeaponTypes.ts`.

```typescript
export type SpecialWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';
export interface SpecialWeaponConfig {
  id: SpecialWeaponId;
  name: string;
  shortCode: string; // 'RKT' | 'LSR' | 'SWM' | 'RLG' | 'EMP'
  icon: string;
  description: string;
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
  name: string;
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

`SpecialWeaponsController` (`src/core/combat/SpecialWeaponsController.ts`) owns one `WeaponSystem` and one `CountermeasureSystem`, implements `IDecoyProvider` for units and bosses 6–10, and exposes `handleInput(input, cycleRequested, slotRequested, flareRequested, aircraft, canFire)`, `syncProgression(stats, unlocked): SpecialWeaponId[]`, `refill()`, `clearInFlight()`, `exportState()` and `importState(state, flareCharges)` to the coordinator.

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
  onPhaseChange?: (phase: number, label: string) => void;
  onSpawnMinion?: (position: Vector3, kind: BossMinionKind) => void;
  onHazardWarning?: (label: string) => void;
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
```

`boss-defeated`, `level-complete`, `game-over` and `campaign-complete` end the current music themselves. Tracks and stingers are compositions under `src/core/Audio/music/tracks/` played by the lookahead `Sequencer`.

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
placeAt(position: THREE.Vector3, quaternion: THREE.Quaternion): void; // level start / checkpoint
```

## HUD, story overlay, radio, radar, menus

Source: `src/ui/HUD.ts`, `StoryOverlay.ts`, `RadioComms.ts`, `RadarMinimap.ts`, `StartMenu.ts`, `UpgradeMenu.ts`, `CheckpointResumeButton.ts`, `src/core/PresentationController.ts`.

```typescript
// HUD
export type HudCameraMode = 'third-person' | 'first-person';
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
public showAutosave(label?: string): void;
public setCameraMode(mode: HudCameraMode): void;
public setBossStatus(label: string | null, phase?: { current: number; total: number }): void; // null hides the strip
public setMissileWarning(level: HudMissileWarningLevel): void;
public flashWarning(text: string, tone: HudWarningTone = 'threat'): void;
```

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
}

// RadioComms — speaker resolved via CAMPAIGN_SPEAKERS; timing only from update(dt)
export type RadioPriority = 'normal' | 'high';
export interface RadioEnqueueOptions {
  priority?: RadioPriority;
}
export class RadioComms {
  enqueue(line: RadioLine, options?: RadioEnqueueOptions): void;
  update(deltaTime: number): void;
  isBusy(): boolean;
  clear(): void;
  dispose(): void;
  onLineShown?: (line: RadioLine) => void;
}
```

`StoryOverlay` sets `data-story-overlay` on `<html>` while a card is up (the HUD, radar, radio, mobile controls and indicator layers hide); callbacks run once per `show*`, after the overlay closes. `RadioComms` shows a line immediately when idle, lets `'high'` interrupt (the interrupted line replays), ignores duplicate text and caps its queue.

```typescript
// RadarMinimap
export type RadarBlipKind =
  | 'enemy' | 'spawning' | 'ally' | 'boss' | 'pickup'
  | 'enemy-ground' | 'enemy-sea' | 'neutral' | 'ally-unit';
public setRangeMultiplier(multiplier: number): void;
public getRangeMultiplier(): number;
// PresentationController passthrough
public setRadarRangeMultiplier(multiplier: number): void;

// StartMenu — #continue-btn (继续战役) shows describeCheckpoint(save); #camera-row; #level-row 1..TOTAL_LEVELS
public setOnContinue(callback: (save: CampaignSaveData) => void): void;

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

// CheckpointResumeButton — "从检查点继续" under the MISSION FAILED settlement
public show(save: CampaignSaveData, onResume: (save: CampaignSaveData) => void): void;
public hide(): void;
public dispose(): void;
```

Mobile buttons in `index.html`: `#camera-button`, `#special-button`, `#cycle-button`, `#flare-button` (plus the existing `#fire-button`, `#missile-button`, `#throttle-button`, `#upgrade-button`).

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
}
public getState(): InputState; // reused object — read it in the same step
public consumeCameraToggle(): boolean; // V / #camera-button
public consumeWeaponCycle(): boolean; // Tab / X / #cycle-button
public consumeWeaponSlot(): number; // Digit1-5 / Numpad1-5 → 0..4, -1 when none
public consumeFlareDeploy(): boolean; // G / #flare-button
public resetActionQueue(): void; // pause / story cards / level change
```

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

`AudioManager` and `MusicSystem` acquire/release the same `AudioContext` as holders. SFX and music gain graphs stay separate.

```typescript
export function getSharedAudioContext(): AudioContext | null;
export function acquireSharedAudioContext(holder: object): AudioContext | null;
export function releaseSharedAudioContext(holder: object): void;
export function resumeSharedAudioContext(): void;
export function unlockAudioFromUserGesture(): void;
export function resetSharedAudioContextForTests(): void;
```

- `getSharedAudioContext()` — current shared context, or `null` if none exists / it is closed.
- `acquireSharedAudioContext(holder)` — ref-counted get-or-create; last `releaseSharedAudioContext(holder)` closes the context.
- `resumeSharedAudioContext()` — if the shared context is `suspended` or `interrupted`, calls `resume()`.
- `unlockAudioFromUserGesture()` — create (if needed) and resume on the user-gesture stack. Unlock itself does not occupy a holder, so `AudioManager` / `MusicSystem` can take over later.
- `resetSharedAudioContextForTests()` — test isolation only: clear holders, close a live context, drop the singleton. Not a runtime API.

Call sites: `StartMenu.startGame()` and `src/main.ts` `bootGame` call `unlockAudioFromUserGesture()`; `MenuMusic` calls it after the first menu gesture; `AudioManager.resume()` / `MusicSystem.resume()` call `resumeSharedAudioContext()` after `initContext()`; both dispose paths call `releaseSharedAudioContext(this)`.

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

`GameCoordinator` calls `playMissileDry()` when missile count is 0 and the missile input is held, and `playMissileLockBreak()` on transition into lock state `'break'`.

## Browser debug handles

When running the game, `window.game` exposes the coordinator for console inspection.

Dev builds only (`import.meta.env.DEV`): `GameCoordinator` dynamically imports `src/core/dev/DevHooks.ts`, whose `installDevHooks(access: DevHookAccess): void` publishes `window.__AIR_SUPREME_DEV__` (state readout, simulation time scale, wave clearing, boss damage, teleports). The production build strips the import.
