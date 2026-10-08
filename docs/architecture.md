# Architecture

AirSupreme is a Three.js + TypeScript aerial combat game. Runtime assembly lives in `GameCoordinator`; systems talk through `EventBus`. The ten-level campaign hangs off the coordinator as per-feature controllers under `src/core/<feature>/`, and every story / HUD / music / SFX call made by gameplay code goes through one presentation adapter, `ICampaignPresentation` (see [ADR 0001](decisions/0001-campaign-presentation-adapter.md)).

## Boundaries

- Entry: `src/main.ts` keeps one `StartMenu` for the page lifetime (`hide()`, not `dispose()`), installs `MenuMusic`, then dynamically imports `GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu, resume, onContinueFromCheckpoint })` and calls `boot(settings)`
- Continue: `StartMenu.setOnContinue` (start menu) and `CheckpointResumeButton` (game-over settlement, via the coordinator's `onContinueFromCheckpoint`) both reach `continueFromCheckpoint(save)` in `main.ts`, which boots a fresh coordinator with `resume: save` and settings taken from the save (difficulty, level, lives, camera mode; audio / quality from local settings)
- Combat, boss controllers, `PauseMenu`, upgrade menu, and presentation HUD load on demand
- `PresentationRuntimeLoader` creates `HUD`, health bars, lock-on, and related presentation objects; `warmPresentationRuntimeChunks()` also warms `StoryOverlay` and `RadioComms`
- Campaign chunks load on demand, and each controller is a no-op (or returns empty results) until its chunk is ready:

| Chunk | Loaded by |
| ----- | --------- |
| `CameraRig` + cockpit | `PlayerViewController.ensureLoaded()` |
| `UnitSystem`, `UnitMeshFactory`, `UnitEventBridge`, `UnitDeployments`, `UnitTypes` | `UnitController.ensureLoaded(particleSystem)` |
| `WeaponSystem`, `CountermeasureSystem` | `SpecialWeaponsController.ensureLoaded(particleSystem)` |
| `ContrailSystem` | `CombatVfxController.ensureLoaded(maxTrails)` |
| `StoryOverlay`, `RadioComms` | `DefaultCampaignPresentation.preloadStoryUi()` (called at game start) |
| Bosses 6–10 (`MagmaColossusAI`, `AbyssalLeviathanAI`, `TempestZeppelinAI`, `PhantomWingAI`, `OraclePrimeAI`) | `AdvancedBossController`, when that boss spawns |
| `DevHooks` | `GameCoordinator`, only when `import.meta.env.DEV` |

- `GameCoordinator.warmRuntimeChunks()` prefetches the combat runtime, `CameraRig`, `UnitSystem`, `WeaponSystem`, `CountermeasureSystem`, `ContrailSystem` and the presentation runtime while the menu idles
- The campaign's new modules are written to the api-spec rule of no `document` / `window` access at import time (canvas / texture creation tolerates a missing `document`), so their logic can run in a non-DOM test runner
- Audio: one shared `AudioContext` via `AudioContextHost`; start/retry unlock on the user-gesture stack; SFX and music gain graphs stay separate
- `src/Game.ts` re-exports `GameCoordinator`. `src/Game.legacy.ts` is deprecated

## Runtime systems

Systems implement `IGameSystem` (`init` / `update` / `dispose`):

| System | Role |
|--------|------|
| `PlayerSystem` | Player control, health, shield (hex ripple via `notifyShieldHit`), armour reduction (`takeCombatDamage`), respawn; crash kill when world `Y <=` live surface from `setCrashSurfaceSampler` |
| `CombatSystem` | Projectiles, missiles, collisions |
| `EnemySystem` | Enemy spawn, friendlies, waves; `LevelManager.getCrashSurfaceY` / `getSurfaceSample` / `getSurfaceKind` |
| `PowerUpSystem` | Drops and effects |
| `UnitSystem` | Ground / sea / air units (`src/features/units/`); `update(dt)` is a no-op wrapper — `UnitController` drives it with `updateWithContext` |

Feature modules under `src/features/` own AI, terrain, effects, powerups, bosses, units, special weapons, the camera rig and campaign data. UI lives in `src/ui/`. Audio lives in `src/core/Audio/`.

## Campaign controllers

`GameCoordinator` builds these in its constructor (each takes an explicit `…Deps` interface of callbacks into the coordinator), except the boss path, which is created on the first boss fight:

| Controller | File | Owns |
| ---------- | ---- | ---- |
| `CampaignFlowController` | `src/core/campaign/CampaignFlowController.ts` | What happens next: new run / resume, chapter → waves → checkpoints → boss → debrief → hangar → next chapter, ending; per-run stats. Concrete work (`prepareLevel`, `startLevelCombat`, `startBossEncounter`, `showHangar`, `syncProgression`, `setStoryHold`, `captureCheckpoint`, …) comes in through `CampaignFlowDeps` |
| `DefaultCampaignPresentation` (`ICampaignPresentation`) | `src/core/campaign/CampaignPresentation.ts` | Story cards (`StoryOverlay`), radio (`RadioComms`), new HUD panels, radar range, music (`MusicSystem`), SFX routing (`CampaignSfxRouter` in `CampaignSfx.ts`) |
| `UnitController` | `src/core/units/UnitController.ts` | `UnitSystem` wiring: surface sampler, flare decoys, route provider, level scaling, mesh prewarm, fire bridge, per-wave spawns, wave hold (with a stall release), scoring / penalties, radius-aware bullet and missile hits, EMP, radar blips, boss drones |
| `SpecialWeaponsController` | `src/core/combat/SpecialWeaponsController.ts` | `WeaponSystem` + `CountermeasureSystem` wiring: F / Tab / X / 1–5 / G input, muzzle, target provider, EMP callback, progression sync, refill, save export / import, HUD polling; implements `IDecoyProvider` |
| `PlayerViewController` | `src/core/camera/PlayerViewController.ts` | `CameraRig` (first / third person, shake, FOV) and the player afterburner; `onModeChanged` |
| `CombatVfxController` + `ContrailController` | `src/core/vfx/` | Low-health and speed screen effects, damage smoke, contrails, remote muzzle flashes, pickup bursts, special-weapon effect density from the particle budget |
| `CombatHudFeed` | `src/core/hud/CombatHudFeed.ts` | Pooled radar blips (20 Hz; unit kinds mapped to radar kinds) and health-bar snapshots (enemies, bosses, octopus eyes, boss sub-targets, wingmen) |
| `BossBattleController` | `src/core/BossBattleController.ts` | Boss lifecycle for all ten bosses; bosses 1–5 directly (spawn ahead via `resolveLegacyBossSpawn`, part hit spheres via `LegacyBossHitVolumes`); special-weapon / lock targets; EMP |
| `AdvancedBossController` | `src/core/boss/AdvancedBossController.ts` | Bosses 6–10 (`ADVANCED_BOSS_TYPES`): spawn placement (`resolveAdvancedBossSpawn`), ground samplers, death sequences, part hits through `takeDamageAt`, hazards with a per-target cooldown (`HazardCooldownTracker`), flare decoys for boss missiles (`BossFlareDecoyRedirector`), status label / music intensity, citadel core state, cloak hiding from radar and lock |
| `BossHitFeedback` | `src/core/boss/BossHitFeedback.ts` | Hit / armour / boss-missile feedback shared by both boss paths |

Helpers outside the coordinator: `MenuMusic` (`src/core/campaign/MenuMusic.ts`, owned by `main.ts`), `resolveLevelStartPose` (`src/core/campaign/LevelStartPose.ts`, terrain-checked start heading per level), the `SaveSystem` functions (`src/core/save/SaveSystem.ts`) and `installDevHooks` (`src/core/dev/DevHooks.ts`, dev builds only, exposes `window.__AIR_SUPREME_DEV__`).

```
main.ts ── StartMenu ── MenuMusic
   │
   └─ GameCoordinator ─┬─ PlayerSystem / CombatSystem / EnemySystem (LevelManager) / PowerUpSystem
                       ├─ PlayerViewController ── CameraRig ........................... (lazy)
                       ├─ DefaultCampaignPresentation ─┬─ StoryOverlay, RadioComms ........ (lazy)
                       │   (ICampaignPresentation)     ├─ HUD, PresentationController ── RadarMinimap
                       │                               ├─ MusicSystem
                       │                               └─ CampaignSfxRouter ── AudioManager
                       ├─ UnitController ── UnitSystem .................................. (lazy)
                       ├─ SpecialWeaponsController ── WeaponSystem, CountermeasureSystem . (lazy)
                       ├─ CombatVfxController ── ContrailController ── ContrailSystem .... (lazy)
                       ├─ CombatHudFeed
                       ├─ CampaignFlowController ── SaveSystem
                       └─ BossBattleController ─┬─ bosses 1-5 ........................ (lazy)
                                                └─ AdvancedBossController ── bosses 6-10 (lazy)
```

## Data flow

1. Input (`InputHandler`) and session settings feed the player controller. One-shot actions are latched on key-down and consumed once per simulation step: `consumeCameraToggle()` (V) → `PlayerViewController.toggleMode()`; `consumeWeaponCycle()` (Tab / X), `consumeWeaponSlot()` (1–5), `consumeFlareDeploy()` (G) and `InputState.special` (F) → `SpecialWeaponsController.handleInput(...)`.
2. Systems emit typed `GameEventType` events on `EventBus`. The campaign adds no event types: unit fire is bridged into the existing `ENEMY_FIRED` / `FRIENDLY_FIRED` by `bridgeUnitFireToEventBus`, so `CombatSystem` resolves it in the existing projectile pools.
3. Combat and presentation subscribe; they must not assume HUD exists before presentation runtime is loaded (`DefaultCampaignPresentation` reads `getHud()` / `getRadar()` lazily and skips pushes until they exist).
4. Hot objects (projectiles, enemies, particles, unit shots and missiles, contrail points, radar blips, health-bar snapshots) come from pools; per-frame paths reuse preallocated vectors.
5. Crash: each `PlayerSystem.update` samples crash Y at the player XZ. `GameCoordinator` injects `LevelManager.getCrashSurfaceY` (forwards `TerrainGenerator.getCrashSurfaceY`); missing sampler or terrain falls back to `WORLDSCAPE_WATER_Y` (`-48`). Kill when `Y <=` that surface.
6. Surface sampling: `LevelManager.getSurfaceSample(x, z)` (→ `TerrainGenerator.sampleSurface`, `{ y, water }`) feeds `UnitSystem.setSurfaceSampler`, `WeaponSystem.setSurfaceSampler` and the bosses' ground samplers; `getSurfaceKind` picks impact effects and sounds. Levels 6–10 delegate to their environment module (`TerrainGenerator.getEnvironment()`); the canyon convoy and citadel assault routes reach `UnitSystem.setRouteProvider` the same way.
7. Presentation chrome: `injectHudTokens()` writes `:root` HUD CSS variables once (`style#hud-tokens`). `HUD` / `LockOnIndicator` keep a `HudLayoutDensity` (`desktop | touch-landscape | touch-portrait`). Lock chrome states: `search | track | lock | break | dry`.

### Simulation step (`GameCoordinator.update`)

While a story card, debrief or hangar is up (`setStoryHold(true)`), the step only ticks the presentation and swallows pause / upgrade / one-shot input. Otherwise, in order: camera toggle → player controller, cannon, missiles → `SpecialWeaponsController.handleInput` → `PlayerSystem`, `CombatSystem` → boss (`BossBattleController.update`) or enemy waves → power-ups → `UnitController.update` (after the jets, so allied units can target them) → projectile collisions (enemy fire also hits friendly units) → radius-aware player bullet / missile hits on units → `SpecialWeaponsController.update` → particles → HUD → `presentation.updatePlayerHealth` → `CombatVfxController.update` → `CampaignFlowController.tick` → `presentation.update` (radio timing). The render step interpolates the player, runs `PlayerViewController.update` (camera rig + afterburner) and `CombatVfxController.renderUpdate` (contrails), fades the shield by the first-person blend and renders `GameScene`.

### Campaign flow

```
boot → setupNewRun(L): reset upgrades, setCampaignLevel(L), unlock weapons through L,
       starting upgrade points if L > 1, clear the checkpoint (normal mode)
     → beginNewRun(L): L > 1 → hangar first → beginChapter(L) | beginBossStage(L) (Boss mode)
     (booted with resume: restoreCheckpoint(save) → resumeFromCheckpoint(save))

beginChapter(L):  prepareLevel(L, 0) → showChapterIntro (prologue before chapter 1 of a new game)
                  → checkpoint 'level-start' (wave 0) → radio 'level-start'
                  → startLevelCombat → stinger 'chapter-start'
WAVE_START(k):    UnitController.spawnForWave(L, k) → radio 'wave-start'
                  (LevelManager holds the wave while UnitController.getWaveHoldCount() > 0)
WAVE_COMPLETE(k): radio 'wave-complete' → checkpoint 'wave' (wave k + 1) when k + 1 < totalWaves
LEVEL_COMPLETE:   checkpoint 'boss' (wave = totalWaves) → stinger 'level-complete' → boss briefing → boss
boss destroyed:   stinger 'boss-defeated' → outro (waits for the defeat radio lines)
                  → debrief → unlockLevel(L + 1) → hangar → beginChapter(L + 1)
L = 10:           markCampaignCompleted + clearCampaignCheckpoint → debrief → ending → MISSION COMPLETE
```

Boss mode skips story cards, debriefs and checkpoints, unlocks weapons through the chosen level and stops at the hangar between bosses. Game over in normal mode with a checkpoint shows `CheckpointResumeButton`.

### Bosses

All bosses satisfy `IBossCore`; bosses 6–10 also implement `IAdvancedBoss` (`src/features/boss/BossContracts.ts`). The controller creates and positions the mesh, adds it to the scene, then constructs the AI; it routes every hit through `takeDamageAt(part, rawDamage)` (the boss applies weak-point / armour multipliers and sub-target HP itself), calls `checkHazard(position, radius)` every frame for the player and each wingman with a ~0.6 s per-target cooldown, and maps `onSpawnMinion` kinds to enemy jets or unit drones. `onPhaseChange` → `presentation.onBossPhaseChange`, `onHazardWarning` → `presentation.flashWarning`, `onEffectCue` → `presentation.onBossCue` (sounds) plus camera shake for heavy cues. Oracle Prime spawns at the citadel core arena and drives the citadel's core state and the music intensity.

## Rendering and VFX

- `GameScene` owns the renderer, lights, background and an optional `PostFxPipeline` (`src/features/effects/postfx/`: display-referred `RenderPass` → `UnrealBloomPass` → grade / screen-effects `ShaderPass`). It is on for the `balanced` / `quality` presets and off for `performance` (where `ScreenOverlay` draws the screen effects); `setPostFxEnabled` overrides. Each level's `postFx` grade (exposure, contrast, saturation, bloom, vignette) is applied with the level environment. The final pass keeps `needsSwap = false` so the depth-buffered scene target stays bound every frame (`0db18f2`, pinned by `PostFxPipeline.test.ts`).
- `ParticleSystem` (`src/features/effects/ParticleSystem.ts`) is a facade over an instanced batch (`particles/ParticleBatch`), solid debris (`particles/DebrisField`) and layered recipes (`particles/recipes/`); its budget follows the quality preset (`getBudget()`).
- `ContrailSystem` draws all wingtip trails in one draw call; `ShieldRipple` draws the hex shield hit; `updatePlayerAfterburner` (`AircraftMeshFactory`) animates the afterburner.
- Transparent VFX / environment materials use `transparent: true`, `depthTest: true`, `depthWrite: false`, `renderOrder 0`; everything added to a scene is removed and disposed in `dispose()` / `clear()` (objects flagged `userData.sharedResource === true` are skipped). Large meshes declare `userData.hitRadius` (read with `getDeclaredHitRadius`).

## Site chrome

- Entry HTML: `index.html` — `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />` (file `public/favicon.svg`); viewport includes `viewport-fit=cover`.
- Mobile deck in `index.html`: `#joystick`, `#fire-button`, `#missile-button`, `#special-button`, `#flare-button`, `#throttle-button`, `#cycle-button`, `#camera-button`, `#upgrade-button` (pause). `InputHandler` binds the four new buttons only if they exist; `HUD` writes their labels, meter rings and alert state.
- `PauseMenu` and HUD settlement overlay pad with `env(safe-area-inset-*)`.

## Audio

- Shared context: `src/core/Audio/AudioContextHost.ts`. `AudioManager` and `MusicSystem` `acquireSharedAudioContext(this)` / `releaseSharedAudioContext(this)`; last holder close shuts the context.
- Unlock on the click stack (no `await` between gesture and unlock): `StartMenu.startGame()` calls `unlockAudioFromUserGesture()` before hiding the menu / `onStart`. `src/main.ts` `bootGame` calls `disposeGame()` then `unlockAudioFromUserGesture()` before `await import('./core/GameCoordinator')`. Retry uses `bootGame`.
- `unlockAudioFromUserGesture()` creates the shared context if needed and resumes it; unlock itself does not occupy a holder.
- `AudioManager.beginSound()` calls `this.resume()` before `canPlay()`. `GameCoordinator.startInternal` always `audioManager.resume()` / `musicSystem.resume()`.
- Gain graphs remain separate: `AudioManager` builds `masterGain` / `sfxGain` / `musicGain`; `MusicSystem` builds its own `masterGain`. Both connect to the shared context destination.
- Music: `MusicSystem` plays 23 compositions (`LevelMusic`) and 7 stingers (`MusicStinger`) through a lookahead sequencer (`src/core/Audio/music/`: `Sequencer`, `Instruments`, `Compose`, `Theory`, `tracks/`). `setIntensity(0..1)` adds layers, tempo and filter opening; stingers align to the next beat and transpose to the current key; `boss-defeated`, `level-complete`, `game-over` and `campaign-complete` end the current track.
- SFX: the campaign sounds live in `src/core/Audio/sfx/` (`SfxKit`, `SfxLibrary`) behind `AudioManager.play…` methods; `CampaignSfxRouter` maps weapon / unit / boss events to them with distance gating and throttles.
- `MenuMusic` (created by `main.ts`) owns a page-lifetime `MusicSystem` for the start menu: it starts after the first pointer / key / touch gesture, fades out when a game boots and resumes on return to the menu.

## Persistence

- `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'` — start-flow settings (`SessionSettings`), now including `startLevel` 1–10 and `cameraMode`; camera toggles in game are written back.
- `CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save'` — the single campaign checkpoint (`CampaignSaveData`, version `CAMPAIGN_SAVE_VERSION`).
- `CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress'` — completion flag, best score, highest level reached.
- All access goes through `getLocalStorage()`; reads and writes never throw, and corrupt records are removed.

## Key files

- Orchestration: `src/core/GameCoordinator.ts`
- Events: `src/core/EventBus.ts`
- Campaign: `src/features/campaign/CampaignData.ts` (chapters, radio, unlock schedule), `src/core/campaign/CampaignFlowController.ts`, `src/core/campaign/CampaignPresentation.ts` (`ICampaignPresentation`, `DefaultCampaignPresentation`), `src/core/campaign/CampaignSfx.ts`, `src/core/campaign/LevelStartPose.ts`, `src/core/campaign/MenuMusic.ts`
- Save: `src/core/save/SaveSystem.ts`
- Shared combat contracts: `src/core/CombatContracts.ts`, `src/core/Faction.ts` (`Faction.CIVILIAN`), `src/core/Difficulty.ts` (`getLevelScaling`)
- Units: `src/features/units/` (`UnitTypes.ts`, `UnitDeployments.ts`, `UnitSystem.ts`, `UnitBehaviors.ts`, `UnitBehaviorsAir.ts`, `UnitMeshFactory.ts`, `UnitEventBridge.ts`), `src/core/units/UnitController.ts`
- Special weapons: `src/features/weapons/` (`WeaponTypes.ts`, `WeaponSystem.ts`, `CountermeasureSystem.ts`), `src/core/combat/SpecialWeaponsController.ts`
- Camera: `src/features/camera/CameraRig.ts`, `CockpitModel.ts`, `CameraShake.ts`; `src/core/camera/PlayerViewController.ts`
- Bosses: `src/features/boss/BossTypes.ts`, `BossContracts.ts`, the boss AI / mesh files, `src/core/BossBattleController.ts`, `src/core/boss/`
- Terrain: `src/features/terrain/LevelConfig.ts`, `TerrainGenerator.ts`, `environments/` (`TerrainEnvironment.ts`, `EnvironmentBase.ts`, one module per level 6–10)
- VFX: `src/features/effects/ParticleSystem.ts`, `particles/`, `postfx/`, `ContrailSystem.ts`, `ShieldRipple.ts`; `src/scenes/GameScene.ts`; `src/core/vfx/`
- Session persist: `src/core/SessionSettings.ts` (`START_MENU_STORAGE_KEY`, `loadStartFlowSettings` / `saveStartFlowSettings`)
- Pause cabin: `src/ui/PauseMenu.ts`
- Presentation boundary: `src/core/PresentationRuntimeLoader.ts`, `src/core/PresentationController.ts`, `src/core/hud/CombatHudFeed.ts`
- Story UI: `src/ui/StoryOverlay.ts`, `src/ui/RadioComms.ts`, `src/ui/CheckpointResumeButton.ts`
- HUD tokens: `src/ui/theme/hudTokens.ts` (`injectHudTokens`, `HUD_COLORS`, `HudLayoutDensity`, `LockOnState`)
- HUD / lock / radar: `src/ui/HUD.ts`, `src/ui/LockOnIndicator.ts` (`setLayoutDensity`), `src/ui/RadarMinimap.ts`
- Menus: `src/ui/StartMenu.ts`, `src/ui/UpgradeMenu.ts`
- Audio: `src/core/Audio/AudioContextHost.ts` (`unlockAudioFromUserGesture`, shared `AudioContext`), `src/core/Audio/AudioManager.ts`, `src/core/Audio/MusicSystem.ts`, `src/core/Audio/music/`, `src/core/Audio/sfx/`
- Config: `src/config.ts`, `public/config/game-config.json`
- Player: `src/core/systems/PlayerSystem.ts` (`setCrashSurfaceSampler`), `src/features/player/PlayerController.ts`
- Enemy AI: `src/features/enemy/EnemyAI.ts`
- Levels / crash surface: `src/features/levels/LevelManager.ts`, `src/features/terrain/TerrainGenerator.ts` (`WORLDSCAPE_WATER_Y`, `getCrashSurfaceY`, `sampleSurface`)

Long-form system notes remain in `TECHNICAL_DOCUMENTATION.md`. Live work ordering is `IMPLEMENTATION_PLAN.md`. Contracts and signatures: [`api.md`](api.md).
