# AirSupreme Agent Guide

## Project
- Stack: `Three.js + TypeScript + Vite`
- Architecture: modular, event-driven
- Do not assume a fixed branch; check `git branch --show-current` when branch context matters
- Do not merge to `main` unless explicitly asked
- Use `src/core/GameCoordinator.ts`, not `src/Game.legacy.ts`

## Execution Plan
- The live project plan is `IMPLEMENTATION_PLAN.md` at the repository root.
- Before substantial visual, audio, gameplay, architecture, or performance work, read the relevant parts of `IMPLEMENTATION_PLAN.md`.
- For non-trivial tasks, align implementation priority with the current phases and statuses in `IMPLEMENTATION_PLAN.md`.
- If a completed or materially changed task affects plan state, update `IMPLEMENTATION_PLAN.md` in the same turn when practical.
- If the user explicitly redirects priorities, follow the user and then reflect the change in `IMPLEMENTATION_PLAN.md`.

## Execution Principle (PM-First)
- Treat the main agent as product-manager role by default: define priorities, split work into clear sub-agent batches, supervise progress, run verification, and decide next iteration.
- The main agent should not implement or edit source code directly unless explicitly requested for single-file/last-mile tasks. Normal implementation should be delegated to sub-agents with non-overlapping file ownership.
- After each agent cycle, require a validation step (build/tests/checks) and reconcile results before proceeding.
- Record task ownership and handoff decisions in `IMPLEMENTATION_PLAN.md` so future work remains traceable.
- If delegation is feasible, use at least one sub-agent and avoid duplicate edits on the same file.

## Default Workflow
- Default to **multi-subagent parallel development** for any non-trivial task.
- Main agent responsibilities:
  - split work into independent subtasks
  - assign disjoint ownership by file/module
  - keep shared interfaces consistent
  - integrate results
  - run final validation
- Subagents must not edit the same file in parallel.
- If multiple changes need the same file, serialize them and hand off explicitly.
- Small single-file changes can stay local; medium/large work should be parallelized.
- For each medium/large round, define a concrete parallel batch before coding:
  - `Batch A`: visuals / models / rendering
  - `Batch B`: combat / gameplay / feedback
  - `Batch C`: runtime / performance / code-splitting / tests
- Each batch should declare:
  - owned files
  - acceptance checks
  - final integration by the main agent

## Commands
```bash
# Dev
npm run dev

# Type / build
npx tsc --noEmit
npm run build

# Lint / format
npm run lint
npm run lint:fix
npm run format

# Test
npm run test:run
npx vitest run path/to/file.test.ts
```

## Code Rules
- Use strict TypeScript. Avoid `any` unless there is no practical alternative.
- `Three.js` imports: `import * as THREE from 'three';`
- Local imports: prefer alias `@/`
- Same-feature imports: prefer relative paths
- Naming:
  - classes / enums: `PascalCase`
  - methods / variables: `camelCase`
  - constants: `UPPER_SNAKE_CASE`
  - interfaces: `IPascalCase`
- Comments:
  - code comments / JSDoc: Chinese when useful
  - identifiers: English
- Formatting:
  - semicolons
  - single quotes
  - trailing commas where valid
  - print width about 100

## Architecture Rules
- Use `EventBus` for decoupled communication.
- All runtime systems should implement `IGameSystem`.
- Reuse objects for hot paths: projectiles, enemies, particles, indicators.
- Aircraft rotation should use quaternions, not Euler rotations.
- Validate positions before use; guard against `NaN` / `Infinity`.

## Game-Specific Rules
- Healing / respawn flow:
  - call `playerSystem.syncMaxHealth()` before healing to full
- Powerup flow:
  - powerups must not be collectible during respawn
- Runtime settings shown in menus must be wired to actual gameplay/runtime behavior
- Prefer config-driven behavior over hardcoded balance values when config already exists

## Key Files
- Core orchestration: `src/core/GameCoordinator.ts`
- Presentation/runtime boundary: `src/core/PresentationRuntimeLoader.ts`, `src/core/PresentationController.ts`
- Event system: `src/core/EventBus.ts`
- Game config: `src/config.ts`
- Session/settings: `src/core/GameSessionState.ts`, `src/core/SessionSettings.ts`
- Player: `src/core/systems/PlayerSystem.ts`, `src/features/player/PlayerController.ts`
- Enemy: `src/core/systems/EnemySystem.ts`, `src/features/enemy/EnemyAI.ts`
- Levels/environment: `src/features/levels/LevelManager.ts`, `src/features/terrain/LevelConfig.ts`, `src/features/terrain/TerrainGenerator.ts`
- Bosses:
  - `src/features/boss/BossAI.ts`
  - `src/features/boss/DesertFortressAI.ts`
  - `src/features/boss/OctopusWarshipAI.ts`
  - `src/features/boss/MissileDestroyerAI.ts`
  - `src/features/boss/SkyCarrierAI.ts`
- UI: `src/ui/StartMenu.ts`, `src/ui/HUD.ts`
- Audio: `src/core/Audio/AudioManager.ts`, `src/core/Audio/MusicSystem.ts`

## Validation
- For any meaningful code change, finish with:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test:run`
  - `npm run build`
- If doing a narrow local fix, targeted checks are fine first, but final handoff should still run the full set unless blocked.

## Implementation Priorities
- Fix correctness first
- Then performance / memory / lifecycle cleanup
- Then visuals / audio polish
- Prefer low-risk, testable changes over broad rewrites
