# AirSupreme Agent Guide

`AGENTS.md` is the single authority for project facts and owner rules. Read it at session start.

## Project Snapshot

- Purpose: AirSupreme is a 3D aerial combat game for desktop and mobile.
- Stack: Three.js + TypeScript + Vite
- Architecture:
  - `GameCoordinator` assembles runtime systems over a typed `EventBus`
  - Runtime systems implement `IGameSystem`; combat and presentation runtimes load on demand
  - Do not use `src/Game.legacy.ts`

## Commands

- Install: `npm install`
- Test: `npm run test:run` (watch: `npm run test`; coverage: `npm run test:coverage`; one file: `npx vitest run path/to/file.test.ts`)
- Lint/typecheck/build: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npx tsc --noEmit`, `npm run build`
- Dev server: `npm run dev` (http://localhost:3000); preview: `npm run preview`

## Non-Negotiable Rules

- Think before coding: state assumptions, surface ambiguity, and ask when unclear.
- Read before writing: inspect the target file and relevant surrounding conventions immediately before editing or creating files.
- Keep it simple: solve the requested problem without speculative abstractions.
- Make surgical changes: touch only what the task requires.
- Goal-driven execution: Define verifiable success criteria before starting. Keep the tests in separate custody from the code they judge — whoever implements a behavior does not author its tests. Loop until criteria pass; don't declare done on weak signals.
- Verify facts, don't fabricate: do not guess API/library behavior, interfaces, or signatures — confirm them against documentation, source, or a run before relying on them. Do not claim to understand code, errors, or requirements you have not verified; name what you do not know and find out.
- Reuse before adding: before writing a new interface, search for an existing equivalent and extend it rather than duplicate functionality.
- Escalate irreversible changes: do not unilaterally make hard-to-reverse changes or alter a user-owned contract (public API, schema or data migration, dependency or build-tooling swap, deletion of working capability); state the decision and its evidence, then get confirmation before proceeding.
- Check `git branch --show-current` before assuming a branch. Do not merge to `main` unless explicitly asked.
- Orchestrate as PM by default: split work, assign disjoint file ownership, integrate, and validate. Do not implement production code in the main session unless the user asked for a single-file or last-mile change.

## Validation Policy

- Treat background hooks, CI status, and editor diagnostics as advisory. They do not decide done.
- Do not re-run a full validation suite that just completed unless the tree changed.
- After meaningful code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, and `npm run build`.
- Narrow local fixes may use targeted checks first; final handoff still runs the full set unless blocked.

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

## Project Conventions

- Live plan: `IMPLEMENTATION_PLAN.md`. Align non-trivial work with it; update it when a completed or redirected task changes plan state. The user's latest explicit instruction wins.
- Parallel batches for medium/large work: Batch A visuals/models, Batch B combat/feedback, Batch C runtime/performance/tests. Declare owned files and acceptance checks; serialize any shared file.
- TypeScript strict. Avoid `any` unless there is no practical alternative.
- Three.js: `import * as THREE from 'three';`. App imports: prefer `@/`. Same-feature imports: relative paths.
- Naming: classes/enums `PascalCase`, methods/variables `camelCase`, constants `UPPER_SNAKE_CASE`, interfaces `IPascalCase`.
- Comments/JSDoc: Chinese when useful; identifiers English. Semicolons, single quotes, trailing commas, ~100 print width.
- Use `EventBus` for decoupled communication. Runtime systems implement `IGameSystem`. Hot paths reuse pools (projectiles, enemies, particles, indicators). Aircraft rotation uses quaternions, not Euler. Guard positions against `NaN` / `Infinity`.
- Healing/respawn: call `playerSystem.syncMaxHealth()` before healing to full. Powerups must not be collectible during respawn.
- Runtime settings shown in menus must be wired to actual gameplay. Prefer config-driven balance when config already exists (`src/config.ts`).
- Priority: correctness, then performance/lifecycle, then visual/audio polish. Prefer low-risk testable changes over broad rewrites.

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

## Known Gotchas

- `src/Game.legacy.ts` is deprecated; `src/Game.ts` re-exports `GameCoordinator`.
- `EnemyFSM.ts` is a leftover state machine; do not extend it.
- Presentation HUD and related runtime may not exist at construct time — they load through `PresentationRuntimeLoader`.
- On macOS the working tree is case-insensitive: `CLAUDE.md`/`Claude.md` and `AGENTS.md`/`Agents.md` are the same files.

## Documentation Map

- `README.md` — player-facing overview and usage.
- `CHANGELOG.md` — user-visible changes.
- `IMPLEMENTATION_PLAN.md` — live implementation plan and batch ownership.
- `TECHNICAL_DOCUMENTATION.md` — long-form systems reference.
- `docs/README.md` — documentation index.
- `docs/architecture.md` — system structure and data flow.
- `docs/api.md` — EventBus, config, logger, and contracts.
- `docs/conventions.md` — coding, testing, Git, and review rules.
- `docs/decisions/` — architecture decision records.

## Documentation Update Checklist

When behavior, contracts, or plan status change, update the matching map entry or record a no-impact reason: `CHANGELOG.md` (player-visible), `docs/architecture.md` / `docs/api.md` (structure and contracts), `IMPLEMENTATION_PLAN.md` (phase status).

## Workflow Setup

- `kaola-workflow-init` refreshes repository setup and project guidance; it does not start a run.
- The preserved legacy `kaola-workflow/ROADMAP.md` is frozen and inert, not a backlog mirror.

## Maintenance

- Keep this file under 200 lines — a recommendation, not a limit; move detail to docs or skills.
- Add rules only after repeated mistakes, review feedback, or stable project conventions.
- Do not use `@path` imports for optional reference material.
- Do not paste changelogs, API dumps, how-to tutorials, or source files here.
