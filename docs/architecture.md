# Architecture

AirSupreme is a Three.js + TypeScript aerial combat game. Runtime assembly lives in `GameCoordinator`; systems talk through `EventBus`. The ten-level campaign hangs off the coordinator as per-feature controllers under `src/core/<feature>/`, and every story / HUD / music / SFX / voice call made by gameplay code goes through one presentation adapter, `ICampaignPresentation` (see [ADR 0001](decisions/0001-campaign-presentation-adapter.md)). The interface is English by default with Simplified Chinese as a live setting: player-facing text is bilingual in place (`LocalizedText`, `src/i18n/`), and the radio and story narration play recorded English or Mandarin voice packs through `VoiceSystem` ([ADR 0002](decisions/0002-bilingual-text-and-voice-packs.md)).

## Boundaries

- Entry: `src/main.ts` first applies the saved language (`setLocale(loadStartFlowSettings().language)`) and writes the page shell in it, then keeps one `StartMenu` for the page lifetime (`hide()`, not `dispose()`), installs `MenuMusic`, then dynamically imports `GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu, resume, onContinueFromCheckpoint })` and calls `boot(settings)`
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
| `CampaignFlowController` | `src/core/campaign/CampaignFlowController.ts` | What happens next: new run / resume, chapter → waves → checkpoints → boss → debrief → hangar → next chapter, ending; per-run stats; the hangar checkpoint, the boss outro wait (on game time, from `tick`) and Swift's once-per-run join line (`handleWingmanLaunched`). Concrete work (`prepareLevel`, `startLevelCombat`, `startBossEncounter`, `showHangar`, `syncProgression`, `setStoryHold`, `captureCheckpoint`, …) comes in through `CampaignFlowDeps` |
| `DefaultCampaignPresentation` (`ICampaignPresentation`) | `src/core/campaign/CampaignPresentation.ts` | Story cards (`StoryOverlay`), radio (`RadioComms`), new HUD panels, radar range, music (`MusicSystem`), SFX routing (`CampaignSfxRouter` in `CampaignSfx.ts`), voice playback and prefetch through the coordinator's `VoiceSystem`, wingman radio (`WINGMAN_EVENT_RADIO`) |
| `UnitController` | `src/core/units/UnitController.ts` | `UnitSystem` wiring: surface sampler, flare decoys, route provider, level scaling, mesh prewarm, fire bridge, per-wave spawns, wave hold (with a stall release), scoring / penalties, radius-aware bullet and missile hits, EMP, radar blips, boss drones; SAM missile-warning and civilian-hit voice budgets (`RadioBudget`) |
| `SpecialWeaponsController` | `src/core/combat/SpecialWeaponsController.ts` | `WeaponSystem` + `CountermeasureSystem` wiring: F / Tab / X / 1–5 / G input, muzzle, target provider, EMP callback, progression sync, refill, save export / import, HUD polling; implements `IDecoyProvider` |
| `PlayerViewController` | `src/core/camera/PlayerViewController.ts` | `CameraRig` (first / third person, shake, FOV) and the player afterburner; `onModeChanged` |
| `CombatVfxController` + `ContrailController` | `src/core/vfx/` | Low-health and speed screen effects, damage smoke, contrails, remote muzzle flashes, pickup bursts, special-weapon effect density from the particle budget |
| `CombatHudFeed` | `src/core/hud/CombatHudFeed.ts` | Pooled radar blips (20 Hz; unit kinds mapped to radar kinds) and health-bar snapshots (enemies, bosses, octopus eyes, boss sub-targets, wingmen) |
| `BossBattleController` | `src/core/BossBattleController.ts` | Boss lifecycle for all ten bosses; bosses 1–5 directly (spawn ahead via `resolveLegacyBossSpawn`, part hit spheres via `LegacyBossHitVolumes`, flare decoys for their missiles via `BossFlareDecoyRedirector`); special-weapon / lock targets; EMP; friendly support jets at the start of a boss fight and every 30 s |
| `AdvancedBossController` | `src/core/boss/AdvancedBossController.ts` | Bosses 6–10 (`ADVANCED_BOSS_TYPES`): spawn placement (`resolveAdvancedBossSpawn`), ground samplers, death sequences, part hits through `takeDamageAt`, hazards with a per-target cooldown (`HazardCooldownTracker`), flare decoys for boss missiles (`BossFlareDecoyRedirector`), status label / music intensity, citadel core state, cloak hiding from radar and lock |
| `BossHitFeedback` | `src/core/boss/BossHitFeedback.ts` | Hit / armour / boss-missile feedback shared by both boss paths |

The coordinator also owns a `VoiceSystem` (`src/core/Audio/VoiceSystem.ts`, handed to the presentation as its `voice`) and a `WingmanRoster` (`src/core/campaign/Wingmen.ts`): each friendly AI jet that spawns takes the first identity in formation order — Raven, then Swift (from level 3) — that is neither flying nor shot down this level, or none; the callsign goes on `mesh.userData.displayName` for the health bar, and `FRIENDLY_DEATH` releases the identity and fires `presentation.onWingmanEvent(id, 'down')`; the roster resets whenever a level is prepared and when a boss is destroyed. Wingman launch rules:

- Shortly after every level start, and when a resume starts at a `'boss'` checkpoint, `launchWingmen()` launches the whole named flight (`WingmanRoster.countAvailable`): Raven in levels 1–2, Raven and Swift from level 3. Each launch goes to `CampaignFlowController.handleWingmanLaunched(id)`, which plays Swift's join line the first time she launches in a campaign run (never in Boss mode) and records `swiftJoined` in the checkpoint.
- Reinforcements, boss-fight support, the Call Wingman pickup and escort jets (`spawnFriendlyAI()`) never play a join line; they take a callsign only if one is free (in practice in Boss mode, where no flight launches).
- `EnemySystem.spawnFriendly` gives each friendly the lowest free formation slot (0 left, 1 right, then further out and back), and `getFriendlySpawnPose` puts a new friendly on its slot's side, nose along the player's heading. With no target, `FriendlyAI` flies to its slot in the player's heading frame, steering clear of the chase camera's sight corridor, and moves through `EnemyAI.updateKinematic` (no manoeuvre state machine, no firing); with an enemy jet or boss target it fights as before. Numbers: [api.md → Wingmen](api.md#wingmen).

Helpers outside the coordinator: `MenuMusic` (`src/core/campaign/MenuMusic.ts`, owned by `main.ts`), `resolveLevelStartPose` (`src/core/campaign/LevelStartPose.ts`, terrain-checked start heading per level), the `SaveSystem` functions (`src/core/save/SaveSystem.ts`) and `installDevHooks` (`src/core/dev/DevHooks.ts`, dev builds only, exposes `window.__AIR_SUPREME_DEV__`, including the `voice` probes and the `balance` harness).

```
main.ts ── setLocale(saved language) ── StartMenu ── MenuMusic
   │
   └─ GameCoordinator ─┬─ PlayerSystem / CombatSystem / EnemySystem (LevelManager) / PowerUpSystem
                       ├─ PlayerViewController ── CameraRig ........................... (lazy)
                       ├─ DefaultCampaignPresentation ─┬─ StoryOverlay, RadioComms ........ (lazy)
                       │   (ICampaignPresentation)     ├─ HUD, PresentationController ── RadarMinimap
                       │                               ├─ MusicSystem ◄── voiceDuckBridge ──┐
                       │                               ├─ VoiceSystem ── public/voice/ ─────┘ (fetched)
                       │                               ├─ WingmanRoster (WingmanStatus)
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

1. Input (`InputHandler`) and session settings feed the player controller. One-shot actions are latched on key-down and consumed once per simulation step: `consumeCameraToggle()` (V) → `PlayerViewController.toggleMode()`; `consumeWeaponCycle()` (Tab / X), `consumeWeaponSlot()` (1–5), `consumeFlareDeploy()` (G) and `InputState.special` (F) → `SpecialWeaponsController.handleInput(...)`. `isPauseToggled()` returns the Esc / P key edge or a mobile PAUSE tap, which is latched on `touchstart` until read (`resetPauseState()` clears both).
2. Systems emit typed `GameEventType` events on `EventBus`. The campaign adds no event types: unit fire is bridged into the existing `ENEMY_FIRED` / `FRIENDLY_FIRED` by `bridgeUnitFireToEventBus`, so `CombatSystem` resolves it in the existing projectile pools.
3. Combat and presentation subscribe; they must not assume HUD exists before presentation runtime is loaded (`DefaultCampaignPresentation` reads `getHud()` / `getRadar()` lazily and skips pushes until they exist).
4. Hot objects (projectiles, enemies, particles, unit shots and missiles, contrail points, radar blips, health-bar snapshots) come from pools; per-frame paths reuse preallocated vectors.
5. Crash: each `PlayerSystem.update` samples crash Y at the player XZ. `GameCoordinator` injects `LevelManager.getCrashSurfaceY` (forwards `TerrainGenerator.getCrashSurfaceY`); missing sampler or terrain falls back to `WORLDSCAPE_WATER_Y` (`-48`). Kill when `Y <=` that surface (the SHIELD power-up does not prevent it). The same sample feeds a ring buffer of safe track points; a respawn comes back at least 3 s and 150 m along that track before the crash, at least 40 m up, on a heading checked clear for 400 m, and for 3 s afterwards surface contact lifts the jet instead of killing it ([api.md → Crash surface](api.md#crash-surface)).
6. Surface sampling: `LevelManager.getSurfaceSample(x, z)` (→ `TerrainGenerator.sampleSurface`, `{ y, water }`) feeds `UnitSystem.setSurfaceSampler`, `WeaponSystem.setSurfaceSampler` and the bosses' ground samplers; `getSurfaceKind` picks impact effects and sounds. Levels 6–10 delegate to their environment module (`TerrainGenerator.getEnvironment()`); the canyon convoy and citadel assault routes reach `UnitSystem.setRouteProvider` the same way.
7. Presentation chrome: `injectHudTokens()` writes `:root` HUD CSS variables once (`style#hud-tokens`). `HUD` / `LockOnIndicator` keep a `HudLayoutDensity` (`desktop | touch-landscape | touch-portrait`); `#hud` sits inside the safe-area insets, and the status column (`#hud-status`), the centre message stack (`#hud-top-stack`: boss strip, briefing, objective, portrait autosave toast) and the radio panel (following `--hud-stack-bottom`) are laid out per density so they do not overlap on phones. Centre callouts sit above the lock ring. Lock chrome states: `search | track | lock | break | dry`.
8. Text: data carries `LocalizedText` (`{ en, zh }`) and the code that displays it calls `tr()` / `localize()` at that moment, in the locale from `getLocale()`. The Language rows in the start and pause menus save `language` and call `setLocale()`; `onLocaleChange` subscribers (menus, HUD, health bars, model preview, radio panel, page shell, `VoiceSystem`) redraw or react at once. The HUD's briefing banner and autosave toast take `HudText` (a string, a `LocalizedText` or `{ text, params }`), and the coordinator hands them the bilingual source, so a banner or toast on screen is redrawn in the new language; story cards and other runtime toasts pick the new language up the next time they are produced. Details: [api.md → Localisation](api.md#localisation-i18n).

### Simulation step (`GameCoordinator.update`)

While a story card, debrief or hangar is up (`setStoryHold(true)`), the step only ticks the presentation and swallows pause / upgrade / one-shot input. Otherwise, in order: camera toggle → player controller, cannon, missiles → `SpecialWeaponsController.handleInput` → `PlayerSystem`, `CombatSystem` → boss (`BossBattleController.update`) or enemy waves → power-ups → `UnitController.update` (after the jets, so allied units can target them) → projectile collisions (enemy fire also hits friendly units) → radius-aware player bullet / missile hits on units → `SpecialWeaponsController.update` → particles → HUD → `presentation.updatePlayerHealth` → `CombatVfxController.update` → `CampaignFlowController.tick` (play time and the boss outro wait) → `presentation.update` (radio timing). The render step interpolates the player, runs `PlayerViewController.update` (camera rig + afterburner) and `CombatVfxController.renderUpdate` (contrails), fades the shield by the first-person blend and renders `GameScene`.

### Campaign flow

```
boot → setupNewRun(L): reset upgrades, setCampaignLevel(L), unlock weapons through L,
       starting upgrade points if L > 1, clear the checkpoint (normal mode)
     → beginNewRun(L): L > 1 → hangar first → beginChapter(L) | beginBossStage(L) (Boss mode)
     (booted with resume: restoreCheckpoint(save) → resumeFromCheckpoint(save):
      'hangar' → hangar → Launch → launchChapter(L) · 'level-start' / 'wave' → that wave
      · 'boss' → boss briefing, with the named flight launching)

beginChapter(L):  prepareLevel(L, 0) → showChapterIntro (prologue before chapter 1 of a new game)
                  → checkpoint 'level-start' (wave 0) → radio 'level-start'
                  → startLevelCombat (named flight launches shortly after:
                    Raven in L1-2, Raven + Swift from L3; Swift's join line once per run)
                  → stinger 'chapter-start'
WAVE_START(k):    UnitController.spawnForWave(L, k) (resets the warning voice budgets) → radio 'wave-start'
                  (LevelManager holds the wave while UnitController.getWaveHoldCount() > 0)
WAVE_COMPLETE(k): radio 'wave-complete' → checkpoint 'wave' (wave k + 1) when k + 1 < totalWaves
LEVEL_COMPLETE:   checkpoint 'boss' (wave = totalWaves) → stinger 'level-complete' → boss briefing → boss
boss destroyed:   stinger 'boss-defeated' → checkpoint 'hangar' (level L + 1, wave 0; toast "Level L cleared")
                  → outro (game time: ≥ 1.6 s, then until the radio is idle;
                    ceiling = radio backlog estimate + 6 s, ≤ 75 s)
                  → debrief → unlockLevel(L + 1) → hangar
                  → Launch: launchChapter(L + 1) = rewrite 'hangar' silently → beginChapter(L + 1)
L = 10:           markCampaignCompleted + clearCampaignCheckpoint → outro → debrief → ending → MISSION COMPLETE
```

Boss mode skips story cards, debriefs and checkpoints, unlocks weapons through the chosen level and stops at the hangar between bosses; no named flight launches (boss-fight support jets can still take a free callsign). Game over in normal mode with a checkpoint shows `CheckpointResumeButton`.

### Bosses

All bosses satisfy `IBossCore`; bosses 6–10 also implement `IAdvancedBoss` (`src/features/boss/BossContracts.ts`). The controller creates and positions the mesh, adds it to the scene, then constructs the AI; it routes every hit through `takeDamageAt(part, rawDamage)` (the boss applies weak-point / armour multipliers and sub-target HP itself), calls `checkHazard(position, radius)` every frame for the player and each wingman with a ~0.6 s per-target cooldown, and maps `onSpawnMinion` kinds to enemy jets or unit drones. `onPhaseChange` → `presentation.onBossPhaseChange`, `onHazardWarning` → `presentation.flashWarning`, `onEffectCue` → `presentation.onBossCue` (sounds) plus camera shake for heavy cues. Oracle Prime spawns at the citadel core arena and drives the citadel's core state and the music intensity.

## Rendering and VFX

- `GameScene` owns the renderer, lights, background and an optional `PostFxPipeline` (`src/features/effects/postfx/`: display-referred `RenderPass` → `UnrealBloomPass` → grade / screen-effects `ShaderPass`). It is on for the `balanced` / `quality` presets and off for `performance` (where `ScreenOverlay` draws the screen effects); `setPostFxEnabled` overrides. Each level's `postFx` grade (exposure, contrast, saturation, bloom, vignette) is applied with the level environment. The final pass keeps `needsSwap = false` so the depth-buffered scene target stays bound every frame (`0db18f2`, pinned by `PostFxPipeline.test.ts`).
- `ParticleSystem` (`src/features/effects/ParticleSystem.ts`) is a facade over an instanced batch (`particles/ParticleBatch`), solid debris (`particles/DebrisField`) and layered recipes (`particles/recipes/`); its budget follows the quality preset (`getBudget()`).
- `ContrailSystem` draws all wingtip trails in one draw call; `ShieldRipple` draws the hex shield hit; `updatePlayerAfterburner` (`AircraftMeshFactory`) animates the afterburner.
- Terrain draw cost: `TerrainGenerator` merges static props per material with `StaticBatcher` (`worldscape/staticBatch.ts`), instances bird flocks, tiles the vegetation into near / far `THREE.LOD` cells whose distance and density follow the quality preset read when the level is generated, and packs only visible clouds into `CloudField`'s instance buffers ([api.md → Terrain detail and static batching](api.md#terrain-detail-and-static-batching)). Measured when the change landed (`IMPLEMENTATION_PLAN.md`): level 5 at `balanced` about 1,126 → 225 draw calls, level 1 at `performance` about 920k → 264k triangles.
- EMP: the screen pulse (`ScreenEffectsState.empFlash`, 0.5 s) is a capped electric-blue edge plus an outward ring that keeps the reticle area clear; the world-space shock rings and shell fade near the camera so the chase view does not white out.
- Transparent VFX / environment materials use `transparent: true`, `depthTest: true`, `depthWrite: false`, `renderOrder 0`; everything added to a scene is removed and disposed in `dispose()` / `clear()` (objects flagged `userData.sharedResource === true` are skipped). Large meshes declare `userData.hitRadius` (read with `getDeclaredHitRadius`).

## Site chrome

- Entry HTML: `index.html` — `<html lang="en">` with English loading-screen and touch-button text; `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />` (file `public/favicon.svg`); viewport includes `viewport-fit=cover`. `src/main.ts` rewrites the title, loading screen and touch labels for the saved language and again on every switch.
- Mobile deck in `index.html`: `#joystick`, `#fire-button`, `#missile-button`, `#special-button`, `#flare-button`, `#throttle-button`, `#cycle-button`, `#camera-button`, `#upgrade-button` (pause). `InputHandler` binds the four new buttons only if they exist; `HUD` writes the special button's weapon code and sub-labels, the meter rings and alert state.
- `PauseMenu` and HUD settlement overlay pad with `env(safe-area-inset-*)`.

## Audio

- Shared context: `src/core/Audio/AudioContextHost.ts`. `AudioManager`, `MusicSystem` and `VoiceSystem` `acquireSharedAudioContext(this)` / `releaseSharedAudioContext(this)`; last holder close shuts the context. All three feed the shared output node (`getSharedOutputNode`: limiter + soft clip → destination).
- Unlock on the click stack (no `await` between gesture and unlock): `StartMenu.startGame()` calls `unlockAudioFromUserGesture()` before hiding the menu / `onStart`. `src/main.ts` `bootGame` calls `disposeGame()` then `unlockAudioFromUserGesture()` before `await import('./core/GameCoordinator')`. Retry uses `bootGame`.
- `unlockAudioFromUserGesture()` creates the shared context if needed and resumes it; unlock itself does not occupy a holder.
- `AudioManager.beginSound()` calls `this.resume()` before `canPlay()`. `GameCoordinator.startInternal` always `audioManager.resume()` / `musicSystem.resume()`.
- Gain graphs remain separate: `AudioManager` builds `masterGain` / `sfxGain` / `musicGain`; `MusicSystem` builds its own `masterGain`; `VoiceSystem` builds a radio and a narration bus behind a voice-volume gain. All of them end at the shared output node.
- Music: `MusicSystem` plays 23 compositions (`LevelMusic`) and 7 stingers (`MusicStinger`) through a lookahead sequencer (`src/core/Audio/music/`: `Sequencer`, `Instruments`, `Compose`, `Theory`, `tracks/`). `setIntensity(0..1)` adds layers, tempo and filter opening; stingers align to the next beat and transpose to the current key; `boss-defeated`, `level-complete`, `game-over` and `campaign-complete` end the current track.
- SFX: the campaign sounds live in `src/core/Audio/sfx/` (`SfxKit`, `SfxLibrary`) behind `AudioManager.play…` methods; `CampaignSfxRouter` maps weapon / unit / boss events to them with distance gating and throttles.
- `MenuMusic` (created by `main.ts`) owns a page-lifetime `MusicSystem` for the start menu: it starts after the first pointer / key / touch gesture, fades out when a game boots and resumes on return to the menu.
- Voice: `VoiceSystem` plays one line at a time from the voice pack of the current language (`public/voice/<en|zh>/<lineId>.mp3`, gated by `public/voice/manifest.json`; see [voice-lines.md](voice-lines.md)). Radio lines go through a per-speaker band-pass and static bed, then a shared radio stage (band limit, presence, saturation, compression) and a squelch tail; narration goes through a clean high-pass and light compression; every line is loudness-normalised when decoded. While a line plays, `voiceDuckBridge` (`VoiceDucking.ts`) lowers a voice-duck stage at the end of the music bus and releases it shortly after the line ends.
- Voice timing is owned by the UI, not the audio: `DefaultCampaignPresentation` plays a radio line's voice from `RadioComms.onLineShown` and reports start / end back through `holdForVoice` / `releaseVoice`, and gives `StoryOverlay` a `StoryNarration` hook that the typewriter waits on. Without a manifest, at volume 0 or on any failure, both fall back to their text-only timing. Pause / resume, clear-radio, game over, mission complete and dispose stop or pause the voice through the presentation; a language switch stops it inside `VoiceSystem`.
- Urgent radio: `missile-warning`, `low-health` and `civilian-hit` interrupt a line that is only being read, but never one being voiced (`RadioComms.isVoicing()`) — they are skipped (`genericRadio` returns `false`), and the low-health call waits for the voiced line to end. `UnitController` voices the SAM missile warning and the civilian-hit call at most twice per wave or boss fight (`RadioBudget`: 20 s then 45 s, and 15 s then 30 s), while the HUD flash and the warning sound event are sent every time. An interrupted line is replayed at most once.
- Boss outro: `CampaignFlowController` waits on game time until the radio is idle, with a ceiling from `presentation.getRadioBacklogSeconds()` (current and queued lines, voiced lines at their manifest duration in the current language) plus 6 s, at most 75 s.

## Persistence

- `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'` — start-flow settings (`SessionSettings`), including `startLevel` 1–10, `cameraMode`, `voiceVolume` and `language` (English unless the player picked Chinese; older saves load as English); camera toggles in game and the pause menu's volume / graphics / language rows are written back.
- `CAMPAIGN_SAVE_KEY = 'air-supreme:campaign-save'` — the single campaign checkpoint (`CampaignSaveData`, version `CAMPAIGN_SAVE_VERSION` = 1): kind `'level-start'` / `'wave'` / `'boss'` / `'hangar'` and the optional `swiftJoined` flag; saves written before `'hangar'` and `swiftJoined` existed still load.
- `CAMPAIGN_PROGRESS_KEY = 'air-supreme:campaign-progress'` — completion flag, best score, highest level reached.
- All access goes through `getLocalStorage()`; reads and writes never throw, and corrupt records are removed.

## Key files

- Orchestration: `src/core/GameCoordinator.ts`
- Events: `src/core/EventBus.ts`
- Campaign: `src/features/campaign/CampaignData.ts` (import point: chapters, radio, unlock schedule, `getVoiceScript`; data split across `CampaignTypes.ts`, `CampaignCast.ts`, `CampaignChapters.ts`, `CampaignRadio.ts`, `CampaignStory.ts`, `ChapterTitles.ts`), `src/core/campaign/CampaignFlowController.ts`, `src/core/campaign/CampaignPresentation.ts` (`ICampaignPresentation`, `DefaultCampaignPresentation`, `CampaignVoice`), `src/core/campaign/CampaignSfx.ts`, `src/core/campaign/LevelStartPose.ts`, `src/core/campaign/MenuMusic.ts`, `src/core/campaign/Wingmen.ts` (`WINGMEN`, `WingmanRoster`), `src/core/campaign/RadioBudget.ts`
- Localisation: `src/i18n/index.ts` (`LocalizedText`, `tr`, `localize`, `format`, `getLocale` / `setLocale` / `onLocaleChange`, `normalizeLocale`, `DEFAULT_LOCALE`)
- Voice: `src/core/Audio/VoiceSystem.ts`, `src/core/Audio/VoiceDucking.ts`, `public/voice/` (`en/`, `zh/`, `manifest.json`, `provenance.json`; see [voice-lines.md](voice-lines.md))
- Save: `src/core/save/SaveSystem.ts`
- Shared combat contracts: `src/core/CombatContracts.ts`, `src/core/Faction.ts` (`Faction.CIVILIAN`), `src/core/Difficulty.ts` (`getLevelScaling` over the `LEVEL_CURVE` table, `getDifficultyProfile`)
- Units: `src/features/units/` (`UnitTypes.ts`, `UnitDeployments.ts`, `UnitSystem.ts`, `UnitBehaviors.ts`, `UnitBehaviorsAir.ts`, `UnitMeshFactory.ts`, `UnitEventBridge.ts`), `src/core/units/UnitController.ts`
- Special weapons: `src/features/weapons/` (`WeaponTypes.ts`, `WeaponSystem.ts`, `CountermeasureSystem.ts`), `src/core/combat/SpecialWeaponsController.ts`
- Camera: `src/features/camera/CameraRig.ts`, `CockpitModel.ts`, `CameraShake.ts`; `src/core/camera/PlayerViewController.ts`
- Bosses: `src/features/boss/BossTypes.ts`, `BossContracts.ts`, the boss AI / mesh files, `BossMissileSystem.ts` (`BossMissileFlightProfile`), `BossAim.ts` (`TargetLeadTracker`), `src/core/BossBattleController.ts`, `src/core/boss/`
- Terrain: `src/features/terrain/LevelConfig.ts`, `TerrainGenerator.ts`, `environments/` (`TerrainEnvironment.ts`, `EnvironmentBase.ts`, one module per level 6–10), `worldscape/` (`staticBatch.ts`, `vegetation.ts`, `clouds.ts`)
- VFX: `src/features/effects/ParticleSystem.ts`, `particles/`, `postfx/`, `ContrailSystem.ts`, `ShieldRipple.ts`; `src/scenes/GameScene.ts`; `src/core/vfx/`
- Session persist: `src/core/SessionSettings.ts` (`START_MENU_STORAGE_KEY`, `loadStartFlowSettings` / `saveStartFlowSettings`, `DEFAULT_VOICE_VOLUME`, `LANGUAGE_ENDONYMS`, `stepLanguage`)
- Pause cabin: `src/ui/PauseMenu.ts`
- Presentation boundary: `src/core/PresentationRuntimeLoader.ts`, `src/core/PresentationController.ts`, `src/core/hud/CombatHudFeed.ts`
- Story UI: `src/ui/StoryOverlay.ts` (`StoryNarration` hook), `src/ui/RadioComms.ts` (`holdForVoice` / `releaseVoice`), `src/ui/CheckpointResumeButton.ts`, speaker glyphs in `src/ui/theme/hudGlyphs.ts`
- HUD tokens: `src/ui/theme/hudTokens.ts` (`injectHudTokens`, `HUD_COLORS`, `HudLayoutDensity`, `LockOnState`)
- HUD / lock / radar: `src/ui/HUD.ts`, `src/ui/LockOnIndicator.ts` (`setLayoutDensity`), `src/ui/RadarMinimap.ts`
- Menus: `src/ui/StartMenu.ts`, `src/ui/UpgradeMenu.ts` (the Language and Voice rows live in `StartMenu` and `PauseMenu`)
- Audio: `src/core/Audio/AudioContextHost.ts` (`unlockAudioFromUserGesture`, shared `AudioContext`, `getSharedOutputNode`), `src/core/Audio/AudioManager.ts`, `src/core/Audio/MusicSystem.ts`, `src/core/Audio/music/`, `src/core/Audio/sfx/`, `src/core/Audio/VoiceSystem.ts`, `src/core/Audio/VoiceDucking.ts`
- Config: `src/config.ts`, `public/config/game-config.json`
- Player: `src/core/systems/PlayerSystem.ts` (`setCrashSurfaceSampler`, respawn track and crash grace), `src/features/player/PlayerController.ts`
- Enemy and friendly AI: `src/features/enemy/EnemyAI.ts` (`setTargetVelocity`, `updateKinematic`), `src/features/enemy/FriendlyAI.ts` (formation slots), `src/core/systems/EnemySystem.ts` (`getFriendlySpawnPose`)
- Levels / crash surface: `src/features/levels/LevelManager.ts`, `src/features/terrain/TerrainGenerator.ts` (`WORLDSCAPE_WATER_Y`, `getCrashSurfaceY`, `sampleSurface`)

Long-form system notes remain in `TECHNICAL_DOCUMENTATION.md`. Live work ordering is `IMPLEMENTATION_PLAN.md`. Contracts and signatures: [`api.md`](api.md).
