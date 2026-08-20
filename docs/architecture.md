# Architecture

AirSupreme is a Three.js + TypeScript aerial combat game. Runtime assembly lives in `GameCoordinator`; systems talk through `EventBus`.

## Boundaries

- Entry: `src/main.ts` → start menu → dynamic import of `GameCoordinator`
- Combat, boss controllers, upgrade menu, and presentation HUD load on demand
- `PresentationRuntimeLoader` creates `HUD`, health bars, lock-on, and related presentation objects
- `src/Game.ts` re-exports `GameCoordinator`. `src/Game.legacy.ts` is deprecated

## Runtime systems

Systems implement `IGameSystem` (`init` / `update` / `dispose`):

| System | Role |
|--------|------|
| `PlayerSystem` | Player control, health, shield, respawn |
| `CombatSystem` | Projectiles, missiles, collisions |
| `EnemySystem` | Enemy spawn, friendlies, waves |
| `PowerUpSystem` | Drops and effects |

Feature modules under `src/features/` own AI, terrain, effects, powerups, and bosses. UI lives in `src/ui/`. Audio lives in `src/core/Audio/`.

## Data flow

1. Input (`InputHandler`) and session settings feed the player controller.
2. Systems emit typed `GameEventType` events on `EventBus`.
3. Combat and presentation subscribe; they must not assume HUD exists before presentation runtime is loaded.
4. Hot objects (projectiles, enemies, particles) come from pools.

## Key files

- Orchestration: `src/core/GameCoordinator.ts`
- Events: `src/core/EventBus.ts`
- Presentation boundary: `src/core/PresentationRuntimeLoader.ts`, `src/core/PresentationController.ts`
- Config: `src/config.ts`, `public/config/game-config.json`
- Player: `src/core/systems/PlayerSystem.ts`, `src/features/player/PlayerController.ts`
- Enemy AI: `src/features/enemy/EnemyAI.ts`
- Levels: `src/features/levels/LevelManager.ts`, `src/features/terrain/`

Long-form system notes remain in `TECHNICAL_DOCUMENTATION.md`. Live work ordering is `IMPLEMENTATION_PLAN.md`.
