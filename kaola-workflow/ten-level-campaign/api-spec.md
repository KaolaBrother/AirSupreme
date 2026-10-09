# Ten-Level Campaign — Shared API Spec (single source of truth)

Every batch implements exactly these names/signatures; the test author tests against them; the integrator
wires them. If an implementer must deviate, they say so explicitly in their final report.

Already landed (commit a6a76ec, read them first):
`src/core/CombatContracts.ts` (SpecialWeaponId, DamageSource, CombatTarget, DecoyPoint, IDecoyProvider,
IStunnable, getDeclaredHitRadius), `src/core/Faction.ts` (Faction.CIVILIAN; never hostile),
`src/core/Difficulty.ts` (getLevelScaling, LevelScaling, CAMPAIGN_LEVEL_CAP=10),
`src/features/campaign/CampaignData.ts` (TOTAL_LEVELS=10, chapters, radio, unlock schedule:
L2 rockets · L4 laser · L6 swarm · L7 railgun · L9 emp), `src/features/boss/BossTypes.ts` (5 new BossType
values + configs + getBossForLevel 1..10), `src/features/boss/BossContracts.ts` (IBossCore, IAdvancedBoss,
isAdvancedBoss, BossHazardHit, BossMinionKind, BossSubTarget).

Global rules for all new modules
- No `document`/`window` access at import time. Canvas/texture creation must tolerate a missing `document`
  (return null / use untextured fallback) so logic can be unit-tested in a non-DOM runner.
- Per-frame code reuses preallocated vectors/quaternions; guard NaN/Infinity positions.
- Transparent VFX/environment materials: `renderOrder 0`, `transparent: true`, `depthTest: true`,
  `depthWrite: false`.
- Everything added to a scene is removed and its geometry/material/texture disposed in `dispose()`/`clear()`
  (skip objects flagged `userData.sharedResource === true`).
- Large meshes declare `mesh.userData.hitRadius` (metres) — see `getDeclaredHitRadius`.

---------------------------------------------------------------------------------------------------
## 1. Terrain / levels — `src/features/terrain/*` (batch: terrain)

`enum TerrainType` gains: `VOLCANO = 'VOLCANO'`, `ARCTIC = 'ARCTIC'`, `CANYON = 'CANYON'`,
`STRATOSPHERE = 'STRATOSPHERE'`, `CITADEL = 'CITADEL'` (same upper-case style as existing members).

`LEVELS` gains ids 6..10 (append after id 5; never reorder 1..5):
| id | name (must equal CampaignData title) | terrain | totalWaves |
| 6 | 熔炉之心 | VOLCANO | 7 |
| 7 | 极光冰海 | ARCTIC | 7 |
| 8 | 雷霆峡谷 | CANYON | 7 |
| 9 | 天梯之巅 | STRATOSPHERE | 7 |
| 10 | 神谕核心 | CITADEL | 8 |
`enemiesPerWave.length === totalWaves`; `difficulty: 10` for 6..10 (legacy field; strength comes from
`getLevelScaling`). Every level 1..10 must carry meaningful `postFx` values (`exposure`, `contrast`,
`saturation`, `bloomStrength`, `vignetteStrength`) — consumed by the new post-processing.

`TerrainGenerator` new public method:
```ts
sampleSurface(worldX: number, worldZ: number): { y: number; water: boolean };
// y = world-space surface height (water surface y where water); water = true where a ship can sail.
```
`getCrashSurfaceY` keeps its contract for all 10 terrains. Water level stays `WORLDSCAPE_WATER_Y` (-48).
Water exists for: LAKE (inside lake), OCEAN, VOLCANO (sea around the island), ARCTIC (open sea between
ice). CANYON/STRATOSPHERE/CITADEL/DESERT/MOUNTAINS/CITY: water=false everywhere (canyon river optional).

New weather presets as needed (e.g. `'ash'`, `'aurora'`); `'storm'` (rain + lightning) must work for CANYON.

---------------------------------------------------------------------------------------------------
## 2. Bosses 6..10 — one file each in `src/features/boss/` (batches: bosses-a, bosses-b, boss-final)

| BossType | file | class | mesh factory |
| MAGMA_COLOSSUS | MagmaColossusAI.ts | MagmaColossusAI | createMagmaColossusMesh(config: BossConfig): THREE.Group |
| ABYSSAL_LEVIATHAN | AbyssalLeviathanAI.ts | AbyssalLeviathanAI | createAbyssalLeviathanMesh(config) |
| TEMPEST_ZEPPELIN | TempestZeppelinAI.ts | TempestZeppelinAI | createTempestZeppelinMesh(config) |
| PHANTOM_WING | PhantomWingAI.ts | PhantomWingAI | createPhantomWingMesh(config) |
| ORACLE_PRIME | OraclePrimeAI.ts | OraclePrimeAI | createOraclePrimeMesh(config) |

Each class `implements IAdvancedBoss` with constructor
`(mesh: THREE.Group, config: BossConfig, scene: THREE.Scene, particleSystem: ParticleSystem)`.
The controller creates the mesh, positions it, adds it to the scene, THEN constructs the AI.
- `mesh.name = \`BOSS_${config.type}\``; collidable parts returned by `getCollisionParts()`.
- Optional extra: `setGroundSampler(sampler: (x: number, z: number) => number): void` for ground bosses.
- Spawn convention (controller): Colossus at (px, groundY, pz+260); Leviathan at (px, -48, pz+260);
  Zeppelin at (px, 170, pz+300); Phantom Wing at (px+120, py+40, pz+320); Oracle at (px, 160, pz+280).
- Missiles via their own `BossMissileSystem` instance returned by `getMissileSystem()` (or null).
- Cannon shells via `onFire(position, direction, damage)`; minions via `onSpawnMinion(position, kind)`.
- `takeDamageAt(part, amount)` applies weak-point/armour multipliers and sub-target HP itself;
  ignores damage while `isInvulnerable()`.
- `checkHazard(pos, radius)` returns a hit or null; no internal cooldown (controller keeps ~0.6 s/target).
- `dispose()` removes the mesh and every helper object (mortars, mines, arcs, decoys, beams…).

---------------------------------------------------------------------------------------------------
## 3. Units — `src/features/units/*` (batch: units)

```ts
// UnitTypes.ts
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
  type: UnitType; name: string; domain: UnitDomain; faction: Faction;
  health: number; speed: number; hitRadius: number;
  scoreValue: number;      // hostile kill score (0 for others)
  penalty: number;         // score penalty when a civilian/ally is destroyed by the player (0 if n/a)
  radarKind: UnitRadarKind;
  isEscort: boolean;       // ALLY_CONVOY, ALLY_TRANSPORT
}
export const UNIT_CONFIGS: Record<UnitType, UnitConfig>;

// UnitMeshFactory.ts
export function createUnitMesh(type: UnitType): THREE.Group; // sets userData.hitRadius & userData.unitType

// UnitDeployments.ts
export type UnitPlacement = 'ahead' | 'flank' | 'around' | 'water' | 'route' | 'high-altitude';
export interface UnitSpawnSpec { type: UnitType; count: number; placement: UnitPlacement; }
export function getWaveDeployment(level: number, waveIndex: number): UnitSpawnSpec[]; // [] when none

// UnitSystem.ts
export interface UnitInstance {
  readonly id: string; readonly type: UnitType; readonly config: UnitConfig;
  readonly mesh: THREE.Group; readonly faction: Faction; readonly domain: UnitDomain;
  isAlive(): boolean; isTargetable(): boolean;          // submerged submarine → false
  getHealth(): { current: number; max: number };
  applyDamage(amount: number, source: DamageSource, hitPoint?: THREE.Vector3): void;
  applyStun(seconds: number): void; isStunned(): boolean;
  getPosition(out?: THREE.Vector3): THREE.Vector3;
}
export interface UnitUpdateContext {
  playerMesh: THREE.Object3D; playerPosition: THREE.Vector3;
  enemyAirMeshes: THREE.Object3D[];   // existing hostile jets (allies may shoot them)
  friendlyAirMeshes: THREE.Object3D[]; // existing friendly jets (enemies may target them)
}
export class UnitSystem implements IGameSystem {
  readonly name = 'UnitSystem';
  constructor(scene: THREE.Scene, particleSystem: ParticleSystem | null);
  init(): void; update(deltaTime: number): void; // update(dt) is a no-op wrapper; use updateWithContext
  updateWithContext(deltaTime: number, ctx: UnitUpdateContext): void;
  setSurfaceSampler(sampler: (x: number, z: number) => { y: number; water: boolean }): void;
  setDecoyProvider(provider: IDecoyProvider | null): void;
  setLevelScaling(scaling: LevelScaling): void;
  spawnForWave(level: number, waveIndex: number, playerPosition: THREE.Vector3): UnitInstance[];
  spawnUnit(type: UnitType, position: THREE.Vector3, options?: { route?: THREE.Vector3[] }): UnitInstance | null;
  getUnits(): readonly UnitInstance[];
  getCombatTargets(): CombatTarget[];       // alive && targetable units, all factions
  getHostileMeshes(): THREE.Object3D[];     // alive && targetable hostile units
  getFriendlyMeshes(): THREE.Object3D[];
  getCivilianMeshes(): THREE.Object3D[];
  findByMesh(object: THREE.Object3D): UnitInstance | null; // matches the root or any descendant
  getAliveHostileCount(): number;           // hostiles still alive (incl. submerged) — wave gating
  getHostileRadarBonus(): number;           // e.g. 0.15 while an enemy RADAR_STATION lives
  getRadarRangeMultiplier(): number;        // e.g. 1.6 while ALLY_AWACS lives, else 1
  getRadarBlips(): Array<{ position: THREE.Vector3; kind: UnitRadarKind }>;
  getIncomingMissiles(): ReadonlyArray<{ position: THREE.Vector3; targetIsPlayer: boolean }>;
  destroyMissilesInRadius(center: THREE.Vector3, radius: number): number; // EMP
  applyAreaDamage(center: THREE.Vector3, radius: number, damage: number, source: DamageSource): number;
  applyAreaStun(center: THREE.Vector3, radius: number, seconds: number): number;
  clear(): void; dispose(): void;
  // callbacks (all optional)
  onUnitFire?: (position: THREE.Vector3, direction: THREE.Vector3, damage: number, faction: Faction, owner: THREE.Object3D) => void;
  onUnitDestroyed?: (unit: UnitInstance, position: THREE.Vector3, byPlayer: boolean) => void;
  onCivilianHit?: (unit: UnitInstance) => void;      // first player hit on a civilian (throttled per unit)
  onEscortResult?: (success: boolean, unit: UnitInstance) => void;
  onLockWarning?: (unit: UnitInstance, phase: 'locking' | 'launched') => void; // SAM lock vs player
  onPlayerDamaged?: (damage: number, cause: 'sam' | 'kamikaze' | 'bomb', position: THREE.Vector3) => void;
  onFirstContact?: (type: UnitType) => void;          // first spawn of a type this session
  onExplosion?: (position: THREE.Vector3, scale: number, kind: 'ground' | 'sea' | 'air' | 'missile') => void;
}
```
Damage attribution: `applyDamage(..., source)` where source is one of the player weapon sources
(`cannon|missile|rocket|laser|swarm|railgun|emp`) counts as `byPlayer=true`.

---------------------------------------------------------------------------------------------------
## 4. Special weapons & flares — `src/features/weapons/*` (batch: weapons)

```ts
// WeaponTypes.ts
export type SpecialWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';
export interface SpecialWeaponConfig {
  id: SpecialWeaponId; name: string; shortCode: string; icon: string; description: string;
  mode: SpecialWeaponMode; maxUpgradeLevel: 5;
}
export const SPECIAL_WEAPON_CONFIGS: Record<SpecialWeaponId, SpecialWeaponConfig>;
// shortCodes: rockets 'RKT', laser 'LSR', swarm 'SWM', railgun 'RLG', emp 'EMP'
export interface SpecialWeaponStats {
  damage: number; range: number; cooldown: number;    // seconds between shots / pulses
  maxAmmo: number; reloadTime: number;                // Infinity ammo → maxAmmo = Infinity
  projectileCount: number;                            // rockets per salvo / swarm missiles per volley
  splashRadius: number; chargeTime: number; heatPerSecond: number; coolPerSecond: number;
  stunSeconds: number; radius: number;                // EMP radius
}
export function getSpecialWeaponStats(id: SpecialWeaponId, upgradeLevel: number): SpecialWeaponStats;

// WeaponSystem.ts
export interface WeaponHudSlot { id: SpecialWeaponId; icon: string; shortCode: string; selected: boolean; ready: boolean; }
export interface WeaponHudState {
  selected: SpecialWeaponId | null; name: string; icon: string; shortCode: string;
  mode: SpecialWeaponMode | null;
  ammo: number; maxAmmo: number; reloadProgress: number;  // 0..1 progress to next ammo
  heat: number; overheated: boolean; charge: number; cooldown: number; // 0..1
  ready: boolean; slots: WeaponHudSlot[];
}
export interface WeaponSaveState { unlocked: SpecialWeaponId[]; selected: SpecialWeaponId | null; ammo: Partial<Record<SpecialWeaponId, number>>; }
export interface WeaponMuzzle { position: THREE.Vector3; quaternion: THREE.Quaternion; }
export class WeaponSystem {
  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null); // scene null → logic only
  setUnlocked(ids: readonly SpecialWeaponId[]): void;   // keeps selection if still unlocked, else selects first
  getUnlocked(): SpecialWeaponId[];
  getSelected(): SpecialWeaponId | null;
  select(id: SpecialWeaponId): boolean;                 // false if locked
  selectNext(): SpecialWeaponId | null;                 // cycles unlocked list
  selectIndex(index: number): boolean;                  // 0-based into SPECIAL_WEAPON_IDS order (locked → false)
  setUpgradeLevel(id: SpecialWeaponId, level: number): void;
  setTargetProvider(provider: () => readonly CombatTarget[]): void;  // hostile + civilian + friendly targets; system filters
  setTriggerHeld(held: boolean): void;   // salvo/pulse fire on press edge; beam fires while held; charge charges while held, fires on release
  update(deltaTime: number, muzzle: WeaponMuzzle): void;
  getHudState(): WeaponHudState;
  exportState(): WeaponSaveState; importState(state: WeaponSaveState): void;
  clear(): void;    // remove in-flight projectiles/beams
  dispose(): void;
  onFired?: (id: SpecialWeaponId, position: THREE.Vector3, direction: THREE.Vector3) => void;
  onImpact?: (id: SpecialWeaponId, position: THREE.Vector3, scale: number) => void;
  onEmpPulse?: (center: THREE.Vector3, radius: number, stunSeconds: number) => void;
  onOverheat?: () => void;
  onChargeStart?: () => void;
  onDryFire?: (id: SpecialWeaponId) => void;
}
```
Targeting rules: hitscan/splash only damages targets whose faction is ENEMY or CIVILIAN (civilians can be
hit by accident — wrappers apply penalties); FRIENDLY and NEUTRAL (player) are never damaged. Swarm missiles
only auto-target ENEMY targets. EMP: `onEmpPulse` is emitted and every ENEMY target in radius gets
`applyStun?.(stunSeconds)` plus small damage to `kind === 'projectile'` / drones.

```ts
// CountermeasureSystem.ts
export class CountermeasureSystem implements IDecoyProvider {
  constructor(scene: THREE.Scene | null, particleSystem: ParticleSystem | null);
  setCapacity(maxCharges: number): void;      // default 2
  setRechargeTime(seconds: number): void;     // default 12
  deploy(origin: THREE.Vector3, quaternion: THREE.Quaternion): boolean; // false when no charges
  update(deltaTime: number): void;
  getActiveDecoys(): readonly DecoyPoint[];
  getCharges(): number; getMaxCharges(): number; getRechargeProgress(): number; // 0..1
  exportState(): { charges: number }; importState(state: { charges: number }): void;
  clear(): void; dispose(): void;
  onDeployed?: () => void;
}
```

---------------------------------------------------------------------------------------------------
## 5. Camera — `src/features/camera/*` (batch: camera)

```ts
export type CameraMode = 'third-person' | 'first-person';
export interface CameraRigFlightState { speedRatio: number; boosting: boolean; }
export class CameraRig {
  constructor(camera: THREE.PerspectiveCamera, target: THREE.Object3D, options?: { mode?: CameraMode });
  getMode(): CameraMode; isFirstPerson(): boolean;
  setMode(mode: CameraMode, immediate?: boolean): void;
  toggleMode(): CameraMode;
  update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, deltaTime: number, flight?: CameraRigFlightState): void;
  addShake(intensity: number): void;  // trauma 0..1 accumulates, decays
  dispose(): void;
  onModeChanged?: (mode: CameraMode) => void;
}
export const PLAYER_EXTERIOR_LAYER = 3; // player aircraft exterior hidden in first-person via layers
```
`ThirdPersonCamera` stays exported (back-compat).

---------------------------------------------------------------------------------------------------
## 6. Audio — `src/core/Audio/*` (batch: audio)

MusicSystem keeps its API and adds:
```ts
export enum LevelMusic { /* existing 10 */ VOLCANO, ARCTIC, CANYON, STRATOSPHERE, CITADEL,
  MAGMA_BOSS, LEVIATHAN_BOSS, TEMPEST_BOSS, PHANTOM_BOSS, ORACLE_BOSS, MENU, STORY, VICTORY }  // string values
export type MusicStinger = 'chapter-start' | 'boss-defeated' | 'level-complete' | 'game-over' | 'campaign-complete' | 'checkpoint' | 'phase-change';
export function getLevelMusicForLevel(level: number): LevelMusic;   // 1..10 distinct level tracks
export function getBossMusicForLevel(level: number): LevelMusic;    // 1..10 distinct boss tracks
playStinger(kind: MusicStinger): void;
playMenuMusic(): void; playStoryMusic(): void; playVictoryMusic(): void;
setIntensity(intensity: number): void; // 0..1, boss phases push it up
```
AudioManager adds (all no-throw, gated by `beginSound` policies):
`playRocketSalvo() playLaserStart() playLaserStop() playLaserOverheat() playRailgunCharge() playRailgunChargeCancel() playRailgunFire() playSwarmLaunch() playEmpPulse() playFlareDeploy() playSamLockWarning() playSamLaunch() playBombDrop() playTankCannon() playHelicopterPass(intensity?: number) playShipHorn() playSonarPing() playCameraSwitch() playAutosave() playRadioOpen() playTypewriterTick() playWeaponSwitch() playWeaponUnlock() playCivilianWarning() playChapterImpact() playLightningStrike() playLavaEruption() playShieldHit() playBossPhaseAlarm() playDebriefTally() playUnitDestroyed(domain: 'ground'|'sea'|'air')`
and `playGroundImpact` surface union adds `'lava' | 'ice' | 'rock' | 'cloud'`.

---------------------------------------------------------------------------------------------------
## 7. VFX — `src/features/effects/*`, `src/scenes/GameScene.ts` (batch: vfx)

ParticleSystem keeps every existing public method/signature and adds:
```ts
export type SurfaceImpactType = 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud';
createMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, scale?: number): void;
createDamageSmoke(position: THREE.Vector3, intensity: number): void;   // call ~6-10 Hz for damaged units
createPickupBurst(position: THREE.Vector3, color?: number): void;
createEmpBurst(center: THREE.Vector3, radius: number): void;
createSplash(position: THREE.Vector3, scale?: number): void;           // big water splash (ships, subs)
getBudget(): number;                                                     // live particle cap
```
GameScene adds:
```ts
setScreenEffects(effects: { damagePulse?: number; lowHealth?: number; flash?: number; speed?: number; empFlash?: number }): void; // 0..1 each
setPostFxEnabled(enabled: boolean): void; // quality-driven; performance preset = off
```
PlayerSystem adds `notifyShieldHit(worldPosition: THREE.Vector3): void` (shield ripple).

---------------------------------------------------------------------------------------------------
## 8. Progression, save, menus (batch: progression)

UpgradeSystem:
```ts
export enum UpgradeType { /* existing 7 */ ARMOR = 'ARMOR', FLARES = 'FLARES',
  WEAPON_ROCKETS = 'WEAPON_ROCKETS', WEAPON_LASER = 'WEAPON_LASER', WEAPON_SWARM = 'WEAPON_SWARM',
  WEAPON_RAILGUN = 'WEAPON_RAILGUN', WEAPON_EMP = 'WEAPON_EMP' }
export const WEAPON_UPGRADE_TYPES: Record<SpecialWeaponId, UpgradeType>;
export function getUpgradeCapForLevel(type: UpgradeType, campaignLevel: number): number; // tier cap
export function getStartingUpgradePoints(level: number): number;  // fair start when skipping ahead
// PlayerUpgrades additions
setCampaignLevel(level: number): void; getCampaignLevel(): number;
setUnlockedWeapons(ids: readonly SpecialWeaponId[]): void;
isLocked(type: UpgradeType): boolean;          // weapon track not unlocked yet
getCap(type: UpgradeType): number;             // min(config.maxLevel, tier cap)
awardBonusPoints(points: number): void;
// canUpgrade() also requires level < getCap(type) and !isLocked(type)
// PlayerStats additions
getArmorReduction(): number;   // 0..0.4
getFlareCapacity(): number;    // 2..6
getWeaponUpgradeLevel(id: SpecialWeaponId): number; // 0..5
```
Core tracks go to maxLevel 10 with the SAME end values as today's level 5 (smaller steps).
Tier cap: core tracks `min(10, campaignLevel + 1)`; ARMOR/FLARES `min(maxLevel, ceil(campaignLevel/2)+1)`;
weapon tracks `min(5, campaignLevel - unlockLevel + 2)` and locked before unlock.
`import()` must accept the old export format (7 tracks, no level/weapons fields).

SaveSystem — `src/core/save/SaveSystem.ts`:
```ts
export const CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save';
export const CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress';
export const CAMPAIGN_SAVE_VERSION = 1;
export type CheckpointKind = 'level-start' | 'wave' | 'boss';
export interface CampaignSaveData {
  version: 1; savedAt: number; checkpoint: CheckpointKind;
  level: number; wave: number;              // wave = 0-based index of the NEXT wave to play
  difficulty: number; score: number; lives: number; missiles: number;
  upgrades: Record<string, unknown>;        // PlayerUpgrades.export()
  weapons: WeaponSaveState-compatible { unlocked: SpecialWeaponId[]; selected: SpecialWeaponId | null; ammo: Partial<Record<SpecialWeaponId, number>> };
  flares: number; cameraMode: 'third-person' | 'first-person';
  stats: { kills: number; civiliansLost: number; deaths: number; playTimeSeconds: number };
}
export function saveCampaignCheckpoint(data: Omit<CampaignSaveData, 'version' | 'savedAt'>): boolean;
export function loadCampaignCheckpoint(): CampaignSaveData | null;  // validates + normalizes; corrupt → removes key, null
export function clearCampaignCheckpoint(): void;
export function hasCampaignCheckpoint(): boolean;
export function describeCheckpoint(data: CampaignSaveData): string; // e.g. '第6关 · 熔炉之心 · 第3波'
export function markCampaignCompleted(finalScore: number): void;
export function getCampaignProgress(): { completed: boolean; bestScore: number; highestLevel: number };
export function recordLevelReached(level: number): void;
```
SessionSettings: `startLevel` clamps to 1..TOTAL_LEVELS; new persisted field
`cameraMode: 'third-person' | 'first-person'` (default third-person) in StartFlowSettings + GameSettings.
StartMenu: `setOnContinue(cb: (save: CampaignSaveData) => void): void`; shows a 继续战役 button with
`describeCheckpoint` text when a save exists (`#continue-btn`); level row shows chapter title for 1..10;
camera row (`#camera-row`); controls legend lists V/F/G/Tab/1-5.
UpgradeMenu: `show(options?: { mode?: 'pause' | 'hangar'; title?: string; subtitle?: string; onContinue?: () => void })`
(no-arg call keeps today's behaviour); renders caps/locks/new tracks.

---------------------------------------------------------------------------------------------------
## 9. Story UI + HUD (batch: story-ui)

```ts
// src/ui/StoryOverlay.ts
export interface DebriefData {
  chapter: CampaignChapter; scoreGained: number; totalScore: number; kills: number;
  civiliansLost: number; alliesLost: number; bonusPoints: Array<{ label: string; points: number }>;
}
export class StoryOverlay {
  constructor();
  showChapterIntro(chapter: CampaignChapter, onComplete: () => void, options?: { includePrologue?: boolean; unlockLine?: string | null }): void;
  showDebrief(data: DebriefData, onContinue: () => void): void;
  showEnding(data: { finalScore: number }, onComplete: () => void): void; // epilogue + credits from CampaignData
  isActive(): boolean; skip(): void; hide(): void; dispose(): void;
  onTypeTick?: () => void; onCardShown?: (kind: 'chapter' | 'debrief' | 'ending') => void;
}
// src/ui/RadioComms.ts
export class RadioComms {
  constructor();
  enqueue(line: RadioLine, options?: { priority?: 'normal' | 'high' }): void; // speaker resolved via CAMPAIGN_SPEAKERS
  update(deltaTime: number): void;
  isBusy(): boolean; clear(): void; dispose(): void;
  onLineShown?: (line: RadioLine) => void;
}
```
HUD additions:
```ts
export interface HudWeaponPanelState {
  visible: boolean; icon: string; name: string; shortCode: string;
  mode: 'salvo' | 'beam' | 'charge' | 'pulse' | null;
  ammo: number; maxAmmo: number; reloadProgress: number; heat: number; overheated: boolean;
  charge: number; cooldown: number; ready: boolean;
  slots: Array<{ icon: string; shortCode: string; selected: boolean; ready: boolean }>;
}
updateWeaponPanel(state: HudWeaponPanelState): void;
updateFlares(charges: number, max: number, rechargeProgress: number): void;
showAutosave(label?: string): void;
setCameraMode(mode: 'third-person' | 'first-person'): void;
setBossStatus(label: string | null, phase?: { current: number; total: number }): void;
setMissileWarning(level: 'none' | 'locking' | 'incoming'): void;
flashWarning(text: string, tone?: 'threat' | 'sys' | 'ally'): void;
```
RadarMinimap `RadarBlipKind` gains `'enemy-ground' | 'enemy-sea' | 'neutral' | 'ally-unit'` and
`setRangeMultiplier(multiplier: number): void`.
index.html gains mobile buttons `#camera-button`, `#special-button`, `#cycle-button`, `#flare-button`.

---------------------------------------------------------------------------------------------------
## 10. Integration contract (integration batch, later)

- Input: V toggle camera · F special weapon (hold for beam/charge) · Tab / X cycle · 1-5 select ·
  G flares; mobile buttons above.
- Level flow (normal mode): chapter intro → level briefing + radio → waves (units spawn per wave via
  UnitSystem; wave completes when jets AND `getAliveHostileCount()` reach 0) → autosave 'wave' →
  … → autosave 'boss' → boss → debrief → hangar (UpgradeMenu mode 'hangar') → next chapter. After level
  10: ending → MISSION COMPLETE, `markCampaignCompleted`, `clearCampaignCheckpoint`.
- Game over: settlement offers 从检查点继续 when a checkpoint exists.
- Boss mode: no story cards; boss intro radio only; weapons unlocked through that level.
