# Architecture

AirSupreme is a Three.js + TypeScript aerial combat game. Runtime assembly lives in `GameCoordinator`; systems talk through `EventBus`.

## Boundaries

- Entry: `src/main.ts` keeps one `StartMenu` for the page lifetime (`hide()`, not `dispose()`), then dynamically imports `GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu })`
- Combat, boss controllers, `PauseMenu`, upgrade menu, and presentation HUD load on demand
- `PresentationRuntimeLoader` creates `HUD`, health bars, lock-on, and related presentation objects
- `src/Game.ts` re-exports `GameCoordinator`. `src/Game.legacy.ts` is deprecated

## Runtime systems

Systems implement `IGameSystem` (`init` / `update` / `dispose`):

| System | Role |
|--------|------|
| `PlayerSystem` | Player control, health, shield, respawn; crash kill when world `Y <=` live surface from `setCrashSurfaceSampler` |
| `CombatSystem` | Projectiles, missiles, collisions |
| `EnemySystem` | Enemy spawn, friendlies, waves; `LevelManager.getCrashSurfaceY` |
| `PowerUpSystem` | Drops and effects |

Feature modules under `src/features/` own AI, terrain, effects, powerups, and bosses. UI lives in `src/ui/`. Audio lives in `src/core/Audio/`.

## Data flow

1. Input (`InputHandler`) and session settings feed the player controller.
2. Systems emit typed `GameEventType` events on `EventBus`.
3. Combat and presentation subscribe; they must not assume HUD exists before presentation runtime is loaded.
4. Hot objects (projectiles, enemies, particles) come from pools.
5. Crash: each `PlayerSystem.update` samples crash Y at the player XZ. `GameCoordinator` injects `LevelManager.getCrashSurfaceY` (forwards `TerrainGenerator.getCrashSurfaceY`); missing sampler or terrain falls back to `WORLDSCAPE_WATER_Y` (`-48`). Kill when `Y <=` that surface.
6. Presentation chrome: `injectHudTokens()` writes `:root` HUD CSS variables once (`style#hud-tokens`). `HUD` / `LockOnIndicator` keep a `HudLayoutDensity` (`desktop | touch-landscape | touch-portrait`). Lock chrome states: `search | track | lock | break | dry`.

## Site chrome

- Entry HTML: `index.html` — `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />` (file `public/favicon.svg`); viewport includes `viewport-fit=cover`.
- `PauseMenu` and HUD settlement overlay pad with `env(safe-area-inset-*)`.

## Key files

- Orchestration: `src/core/GameCoordinator.ts`
- Events: `src/core/EventBus.ts`
- Session persist: `src/core/SessionSettings.ts` (`START_MENU_STORAGE_KEY`, `loadStartFlowSettings` / `saveStartFlowSettings`)
- Pause cabin: `src/ui/PauseMenu.ts`
- Presentation boundary: `src/core/PresentationRuntimeLoader.ts`, `src/core/PresentationController.ts`
- HUD tokens: `src/ui/theme/hudTokens.ts` (`injectHudTokens`, `HUD_COLORS`, `HudLayoutDensity`, `LockOnState`)
- HUD / lock: `src/ui/HUD.ts`, `src/ui/LockOnIndicator.ts` (`setLayoutDensity`)
- Audio: `src/core/Audio/AudioManager.ts` (`playMissileLockBreak`, `playMissileDry`)
- Config: `src/config.ts`, `public/config/game-config.json`
- Player: `src/core/systems/PlayerSystem.ts` (`setCrashSurfaceSampler`), `src/features/player/PlayerController.ts`
- Enemy AI: `src/features/enemy/EnemyAI.ts`
- Levels / crash surface: `src/features/levels/LevelManager.ts`, `src/features/terrain/TerrainGenerator.ts` (`WORLDSCAPE_WATER_Y`, `getCrashSurfaceY`)

Long-form system notes remain in `TECHNICAL_DOCUMENTATION.md`. Live work ordering is `IMPLEMENTATION_PLAN.md`.
