# Project Instructions

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

## First Principles

The numbered axioms are tie-breakers, applied in priority order whenever a situation is not already settled; the paragraphs that follow them are standing defaults that hold whether or not anything else settles the case.

1. **Correct first.** Never trade correctness for speed or cost; rework is the most expensive outcome.
2. **Then save human time.** Remove manual steps and shorten the wait, without weakening axiom 1.
3. **Then spend as little as possible.** Use the cheapest sufficient mechanism — parallelism, extra agents, and higher model tiers are means, not goals.
4. **Machines decide facts; humans decide values.** Take irreversible and value-laden calls to the user and ask, in conversation; leave everything checkable to run automatically.
5. **Own your own verdicts.** Never let a system the workflow does not own (CI, an external service) be the judge of done.

**Tie-breaker protocol:** when nothing else covers a situation, resolve it by walking these axioms in order and record a one-line derivation alongside the work. Recording it is useful and never required.

**Check the premise before it shapes the work:** an issue is a claim recorded earlier against a tree that has since moved, so establish what is true *now* at the place it points and let the measurement rather than the filed text decide what gets built. The usual outcome is neither *right* nor *wrong* but right-with-a-detail-that-misroutes — a stale locator, a miscounted set, a clause that breaks if executed literally — so carry the measurement forward, never a bare verdict. Where the two disagree the issue gets corrected, not quietly worked around. Nothing inspects that you did this.

**Dispatch production; keep decisions:** the orchestrator's context is the run's scarcest resource — a handoff costs once, inline residue taxes every later decision — so delegating discretionary production is the default and only the deciding stays inline; weigh the economics per case by judgment, with no justifier, evidence line, or approval attached.

**Parallel by default:** concurrency is the standing default for independent work, and work that genuinely feeds other work runs in order because it has to. Nothing inspects that choice — no proof, no evidence line, no cap: you can tell the difference, and the frontier is in front of you. Width stays sized to the true shape of the task rather than pushed as wide as it will go.

## Validation Policy

- Treat background hooks, CI status, and editor diagnostics as advisory. They do not decide done.
- Do not re-run a full validation suite that just completed unless the tree changed.
- After meaningful code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, and `npm run build`.
- Narrow local fixes may use targeted checks first; final handoff still runs the full set unless blocked.

## Kaola-Workflow

<!-- KW-CLAUDE-MANAGED-START -->
Everything between this marker and its matching END below is owned by `workflow-init`: a later run
may replace it in full. Nothing outside the two markers is touched — that content, wherever you have
added or changed it in this file, is yours.

- Start and resume all workflow work through the workflow router entrypoint your runtime installs.
- A run claims an explicitly selected set of issues — normally three to five, sometimes one — each open, unclaimed, and closeable on its own evidence, and records what it owns in `kaola-workflow/{project}/workflow-state.md`: which issues, which branch, which worktree. An issue runs alone when it moves something the others read, when closing it needs a value call from the user, or when its scope is not knowable until it has been investigated.
- `kaola-workflow/{project}/mission-list.md` is the run's coordination record and the one file a successor needs. No script owns this file; you write it. An H1 carrying the goal in one line, then one item per mission.
- An item is a **mission, not a specification**. One line of prose: what to achieve, plus the hints and facts you already know. It carries no role, no file list, no dependency edge, no model, no cardinality and no shape, because you decide all of that when you reach it.
- The frontier is not computed — it is the list minus done minus in-flight, visible by reading. When you reach an item, decide whether to dispatch subagents or do the work yourself, and at what width.
- **Three write moments.** These are the whole discipline. **Created** — write `item` and `status: todo`. **Dispatched** — write `dispatched` and flip `status` to `in-flight`, **before the work goes out**. Writing it afterwards is precisely the failure this file exists to prevent. Name **where the output was to land** — that locator is what makes recovery possible at all. **Closed** — write `result` and flip `status` to `done`.
- Delegate work to the vendored subagents by default; the main session owns orchestration, review, validation, integration, and final decisions. Subagents and worktrees are tools — offered, and declinable.
- Name roles by function and reasoning tier, never by a vendor model name — write `planner (reasoning tier)`, not `planner (<model>)`. Keep this section runtime-neutral so it reads correctly on every runtime that reads this repo.
- For read/research work, spawn `code-explorer` for codebase research and `knowledge-lookup` when external library/API behavior or open-web/expertise knowledge that cannot be confirmed locally is needed.
- Custody, not order, splits the two writing roles: `tdd-guide` authors the tests and writes no production code; `implementer` writes the production code and reads and runs the tests but never writes them.
- Route build/type/lint validation failures to `build-error-resolver`; route behavior, coverage, and test-defect failures back to `tdd-guide`, the role that owns the test artifact.
- Route documentation work to `doc-updater`, and require it to transcribe verified ground truth — real command output, real signatures, existing schema — or to say what it needs; never let it invent field names, keys, enum values, or example numbers.
- Use the vendored agent role names exactly as installed; prefer short names like `planner`. When spawning a Kaola subagent, pass the role's configured model on the spawn call — each agent ships its model in its installed profile.
- At workflow-router startup, fetch remote-tracking refs, classify local/upstream sync state, and ask before any risky synchronization.
- Use a persistent-objective prompt so work continues until its objective and completion audit are satisfied.
- That objective prompt must not use "next issue in line" or any phrasing that implies automatic cross-issue continuation. Each workflow run targets one selected set of issues; finishing the set is the terminal event. The completion contract requires explicit re-direction for the next set.
- Treat nonessential workflow bookkeeping as autonomous: generated project names, collision suffixes like `-2`, cache/artifact paths, and harmless ordering choices are selected automatically and recorded.
- For essential technical decisions, apply your own judgment, apply the selected answer, and say what the evidence was.
- Take irreversible and value-laden calls to the user and ask, in conversation, before acting: risky Git synchronization, destructive rewrites, deployment or credential actions, and issue reorganization. Nothing collects that approval for you.
- GitHub issues are the backlog: title, labels and comments are what the work is — comments override the body.
- `kaola-workflow/.roadmap/_rules.md` is the one optional local file that survives, for standing
  project-local rules read directly; nothing else is generated or tracked under
  `kaola-workflow/.roadmap/`.
- Active work lives in `kaola-workflow/{project}/` until archived or safely discarded.
- Roadmap/research sessions create or refine issues on the forge; workflow runs implement one selected set — there is no local mirror to refresh.
- After resume or compaction, read `workflow-state.md` and `mission-list.md` before continuing: the H1 is the goal, `done` items carry what is already known, `in-flight` items are the decision to make, `todo` items are what remains.
- Resuming an `in-flight` item means looking for the WORK, not the worker: if the output its `dispatched` line promised has landed, close it; otherwise re-dispatch, unless the dispatch is provably still alive.
- End each cycle by docking docs against code changes, resolving closure decisions, updating issues, archiving completed workflow folders, and then the final commit and push.
- Active issue work runs in a repo-local worktree at `<repo-root>/.kw/worktrees/<project>/` by default; set `KAOLA_WORKTREE_NATIVE=0` to disable. See README for the full contract.
- Top-priority labels: declare in `kaola-workflow/config.json` (`priority_top_tier_labels`) when the repo uses something other than P0–P3 naming.
<!-- KW-CLAUDE-MANAGED-END -->

## Project Conventions

- Live plan: `IMPLEMENTATION_PLAN.md`. Align non-trivial work with it; update it when a completed or redirected task changes plan state. The user's latest explicit instruction wins.
- Parallel batches for medium/large work: Batch A visuals/models, Batch B combat/feedback, Batch C runtime/performance/tests. Declare owned files and acceptance checks; serialize any shared file.
- TypeScript strict. Avoid `any` unless there is no practical alternative.
- Three.js: `import * as THREE from 'three';`. App imports: prefer `@/`. Same-feature imports: relative paths.
- Naming: classes/enums `PascalCase`, methods/variables `camelCase`, constants `UPPER_SNAKE_CASE`, interfaces `IPascalCase`.
- Comments/JSDoc: Chinese when useful; identifiers English. Semicolons, single quotes, trailing commas, ~100 print width.
- Use `EventBus` for decoupled communication. Runtime systems implement `IGameSystem`. Hot paths reuse pools (projectiles, enemies, particles, indicators). Aircraft rotation uses quaternions, not Euler. Guard positions against `NaN` / `Infinity`.
- Healing/respawn: call `playerSystem.syncMaxHealth()` before healing to full. Powerups must not be collectible during respawn.
- Runtime settings shown in menus must be wired to actual gameplay. Prefer config-driven balance when config already exists (`public/config/game-config.json`, `src/config.ts`).
- Priority: correctness, then performance/lifecycle, then visual/audio polish. Prefer low-risk testable changes over broad rewrites.

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

## Maintenance

- Keep this file under 200 lines — a recommendation, not a limit; move detail to docs or skills.
- Add rules only after repeated mistakes, review feedback, or stable project conventions.
- Do not use `@path` imports for optional reference material.
- Do not paste changelogs, API dumps, how-to tutorials, or source files here.
