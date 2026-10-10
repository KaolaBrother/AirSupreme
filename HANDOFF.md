# Handoff — enemy fleet redesign round (`workflow/enemy-fleet`)

Written 2026-10-10 when the previous session stopped for usage reasons. Delete this file when
the round is closed. The live plan is `IMPLEMENTATION_PLAN.md` (section “敌机舰队重做轮次”); the
behaviour contract for the fleet is `docs/enemy-fleet-spec.md`. Read `AGENTS.md` first.

## 1. What the owner asked for

Verbatim (the owner plays mainly on an iPad):

> Yes, let's merge and push. And for enemy jet attacks, I think you can try to be more creative
> in this end, and to make a little bit challenging in the end game. And also for missile
> damage, at 80 is good. And for agent work trees, you can clean them up. Two phone only layout
> issues. Yes, you need to fix the phone only layout issue. And for others, you just do the
> right thing, follow the recommendations. And another add-on to the enemy jet attacks, just add
> more variety at early stage too. So just you can just redesign the entire enemy fleet, and to
> make sure they pose differently than friendly and the user, and a little bit challenging and
> fun to play.

Standing decisions:

- Player missile damage stays 80.
- The previous round is merged and pushed (`main` = `601def1`).
- **Do not merge this round to `main` without asking the owner** — the previous session
  promised to ask first.
- Agent worktrees may be cleaned up (see §6).

## 2. Where things are

| | |
|---|---|
| Round branch | `workflow/enemy-fleet`, pushed to `origin` |
| Base | `main` at `601def1` |
| Unfinished work | three `wip/*` branches, pushed (see §4) |
| Contract | `docs/enemy-fleet-spec.md` (§1 looks, §2 common rules, §3 roster, §3a clarifications, §4 / §4a waves and level curve, §5 dev hooks) |

Validation on the round branch at `2e3ec67` (the last code / test commit before this file):
`npx tsc --noEmit` clean; `npm run lint` 0 errors, 2 old warnings in `HUD.test.ts`;
`npm run test:run` 145 files passed, 7,218 tests passed, 2 skipped, 0 failed; production build
into a scratch directory succeeds. Known deviations are recorded as `it.fails` (§8), so a green
run does not mean the round is finished.

## 3. Done and merged on `workflow/enemy-fleet`

**Enemy fleet**

- Looks (complete): all eight enemy types in a dark gunmetal + red livery with a red sensor
  visor instead of a canopy; real per-type sizes and hit radius (`userData.hitRadius = 2.5 ×
  scale`); wingmen have their own blue / gold airframe; faction trail colours; new airframes for
  JAMMER, STRIKER, WRAITH; Hangar has 22 pages (wingman page 2, new types pages 8–10).
- Behaviour milestone 1: per-type doctrines (`src/features/enemy/doctrine/**`), attack tokens
  (`AttackDirector`), leash, threat awareness (`IJetThreatProvider`), heavy shell and lance
  rounds, Sniper aiming beam, wingmen decoupled from enemy AI, dev hooks.
- Behaviour milestone 2: Ace / Striker seeking missiles through the unit-missile system with the
  existing “locking” / “incoming” warnings (`MissileDirector` caps missiles in flight), Jammer
  (lock time ×2 within 800 m, violet “JAMMED / 受干扰” tag in the lock ring), Wraith cloak cycle
  (unlockable and absent from radar / bars / markers while cloaked), token-free Heavy tail gun,
  bigger red-orange heavy shells, health bar height by jet size.
- Checked live at 1180×820 with touch emulation: every type's look in the Hangar and in flight;
  Scout, Fighter, Heavy, Sniper cycles; Striker and Ace missile runs with both warnings; Jammer
  tag; Wraith cloak and decloak tell.

**Other items of the round (all complete)**

- Keyboard gun-cross assist with a tighter cone (1.25° / 2.5°), noted in How to Play.
- Background save on page hide / close; never lowers stored retry lives for the same save point.
- `public/config/game-config.json` and `ConfigLoader.ts` removed (they were not wired).
- Portrait-phone layout: compact radio box left of the control deck; off-screen arrows avoid
  touch buttons and the radio box; long radio lines scroll at reading pace on small phones.
- ADR 0003 written and updated; docs pass 1 merged (everything above except the fleet).

**Tests** (separate custody — see §7): merged for all of the above, including 500+ enemy fleet
cases, coordinator-level jamming / cloak / jet-missile wiring, cloaked-jet HUD filtering, radio
box geometry and text follow, Hangar pages.

## 4. Unfinished work (stopped mid-task; none of it is validated)

Each is a single WIP commit on top of the round branch. Do not merge as is.

### `wip/enemy-fleet-m3-behaviour` (`6a7bb17`) — behaviour milestone 3

Contract: spec §4, §4a, §3a. The stopped implementer's brief asked for:

1. Authored waves: every wave of every level spawns exactly its line-up with its arrival
   pattern (group / pincer / trail); level 10 `enemiesPerWave` becomes `[4,5,5,5,6,6,6,6]`.
2. First-contact hint lines (text only, both languages) via the existing onboarding channel.
3. Elite hunt counts STRIKER, JAMMER, WRAITH as well.
4. Level-curve retune (`src/core/Difficulty.ts`) with the balance harness: pressure never falls
   level to level on Very Easy / Normal / Expert and level 10 is the highest.
5. Cloaked jets not selectable by auto-targeting player weapons or friendly units.
6. Wingman health-bar label “Allied Wingman / 友军僚机” (Hangar already says so).
7. A dev hook to start at a given level / wave (for late-level acceptance).
8. Fixes for test findings: Heavy tail gun fires at an untargetable player; non-finite time
   step leaves a non-finite position; Scout sits in a tail chase; Scout pairs do not attack from
   opposite sides; Sniper does not hold 380–520 m; a stunned Jammer must not jam.

State of the WIP: 20 source files changed (+1,509 lines), new `src/features/levels/WaveArrival.ts`;
`npx tsc --noEmit` passes. Touched: `LevelConfig.ts`, `LevelManager.ts`, `OnboardingManager.ts`,
`EnemyHealthBars.ts`, `WeaponTargeting.ts`, `ProjectileController.ts`, `DevHooks.ts`,
`AttackDirector.ts`, `EnemyAI.ts`, `EnemySystem.ts`, Scout / Sniper / Heavy / base doctrines,
`GameCoordinator.ts`. **Not touched yet:** `src/core/Difficulty.ts` (item 4 not started).
Unknown: which of items 1–8 are complete — read the diff against the list. Lint, tests, the
harness tables and live checks were not run.

### `wip/radio-follow-fixes` (`058d930`) — four small fixes in `src/ui/RadioComms.ts`

Asked for: (1) a voice starting mid-slide must still leave the text on a whole line;
(2) infinite content height must return 0, not loop forever; (3) never return NaN;
(4) fractional box heights count whole lines downward. State: `tsc` passes and the eight
matching `it.fails` cases in `src/__tests__/RadioFollow.test.ts` now pass — so they report
“expected to fail” until a test author turns them into plain tests. The other four `it.fails`
there (reduced motion, Chinese reader up to 0.06 s behind) are accepted: relax or drop them.

### `wip/enemy-fleet-m2-tests` (`f779604`) — tests for behaviour milestone 2

Asked for: jet missiles (who launches, token + grant, caps 1 / 2 / 0, lock before launch,
Ace 14 s, Striker pair and reload), Jammer doctrine, Wraith cycle and stagger, `CloakFade`
resource handling (shared materials never modified or disposed), boss-fight bans, mutation
checks. State: `EnemyJetMissiles.test.ts` started, `enemyFleetRig.ts` changed, and
`zzProbeM2.test.ts` is a throwaway probe to delete. The accepted deviations these tests must
treat as the rule are listed in `IMPLEMENTATION_PLAN.md` (E-B entry) and spec §3a.

## 5. Remaining steps, in order

1. Finish milestone 3 on its WIP branch (new implementer agent), then merge.
2. Tests for milestone 3 by a different agent: spec §4a's eight rules, hint lines, elite list,
   level curve; rewrite what goes stale (the five `getEnemyTypesForWave` cases in
   `EnemyTypes.test.ts`; one case in `CoordinatorJamCloakJetMissiles.test.ts` that pins
   “a stunned Jammer still jams”; wingman label “Allied Fighter” in `CloakedJetHud.test.ts`);
   turn fixed findings' `it.fails` into plain tests.
3. Finish the milestone 2 tests and the radio follow fixes (+ flip its eight `it.fails`).
4. Docs pass 2: the fleet redesign in `CHANGELOG.md`, both READMEs, `TECHNICAL_DOCUMENTATION.md`,
   `docs/api.md`, `docs/architecture.md`, `docs/conventions.md`; radio text follow; rename the
   provisional CHANGELOG section title. The previous docs author's line-by-line list of stale
   places is in the plan's history only in summary — search the docs for “five enemy”, “three
   behaviour states”, “no new event types” (`ENEMY_TELL` and the extended `ENEMY_FIRED` exist now).
5. Final validation on the tip: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`,
   `npx vite build --outDir <scratch> --emptyOutDir`.
6. Live acceptance at iPad size (§7 recipe): level 1 start to finish for feel, one late level
   (8+) with Wraiths, Ace missiles and a Jammer; each first-contact hint once.
7. Update `IMPLEMENTATION_PLAN.md`, remove this file, clean up worktrees and `wip/*` branches.
8. Report to the owner and **ask before merging to `main` / pushing `main`**.

## 6. Housekeeping left

- 13 agent worktrees under `.claude/worktrees/` with `worktree-agent-*` branches. Ten are fully
  merged and can go (`git worktree remove`, then `git branch -d`); the three with WIP are
  `agent-a761123522144f04e` (= `wip/enemy-fleet-m3-behaviour`), `agent-abcaacdc17c64d9f5`
  (= `wip/radio-follow-fixes`), `agent-ac0a5d76544ad5346` (= `wip/enemy-fleet-m2-tests`).
  Agents from the previous session cannot be resumed; start new ones from the WIP branches.
- The dev server and Browser pane of the previous session are closed.

## 7. Working rules and traps

- Main session is PM: delegate implementation to sub-agents with disjoint file ownership, in
  their own worktrees; integrate with `git merge --no-ff`; validate. **Whoever implements a
  behaviour does not write its tests**; test authors test against the spec, record defects as
  `it.fails` with a `FINDING:` comment, and never edit production code. Implementers list the
  tests their change makes stale instead of editing them.
- About 2,000 files under `node_modules/` and `dist/index.html` are tracked by accident and
  always show as modified. Stage by explicit path, never `git add -A`. Build only into a scratch
  `--outDir`. In an agent worktree `node_modules` may be a symlink: remove it before
  `git merge --no-autostash`, then recreate it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Live check recipe (Browser pane, dev server `npm run dev` on port 3000 serves the main
  checkout): `resize_window` 767×1024 → navigate → wait ~4 s → `resize_window` 1180×820 (width
  < 768 at load turns on the touch layout). Reset with preset `desktop` afterwards.
- If the app window is not in front, the page is hidden and `requestAnimationFrame` never
  fires — the game freezes while scripts still answer. Workaround: right after navigating and
  before starting a mission, replace `requestAnimationFrame` / `cancelAnimationFrame` in the
  page with a `MessageChannel` pump gated to 16 ms.
- Sub-agents share the Browser pane: tell each to create its own tab, never touch the tab
  `seed`, and run its own dev server from its worktree on another port.
- Dev hooks (`window.__AIR_SUPREME_DEV__`, dev build): `getState`, `setGodMode`, `holdWaves`,
  `clearJets`, `spawnEnemy(type, {distance, bearingDeg, count})`, `listJets` (type, health,
  distance, phase, hasAttackToken, cloaked), `placePlayerFacing(position, distance, height)`,
  `setTimeScale`, `killWave`, `continueHangar`, `balance`. Recipes that worked:
  `spawnEnemy('STRIKER', {distance: 560, bearingDeg: 10})` → `standoff → lock → reload`;
  `spawnEnemy('ACE', {distance: 420, bearingDeg: 20})` → missile run after ~18 s;
  `spawnEnemy('WRAITH', {distance: 200})` → `stalk → fade → cloaked → decloak → attack`;
  `#hud-missile-warning` `dataset.level` goes `none → locking → incoming`.

## 8. Known failing cases and watch items

`it.fails` on the round branch (each documents a real, known deviation):

- Enemy fleet findings awaiting milestone 3 (search for `FINDING:`): `EnemyFleetRules`
  (non-finite time step), `EnemyDoctrineScout` (pairs not from opposite sides; the tail-chase
  case was re-aligned to the spec §3a rule), `EnemyDoctrineSniper` (standoff band),
  `EnemyDoctrineHeavy` (tail gun at an untargetable player).
- `CoordinatorJamCloakJetMissiles` ×2: jamming and the tag last one extra simulation step after
  the last Jammer dies — **accepted** (spec §3a); turn into plain tests with the one-step bound.
- `RadioFollow` ×12: eight fixed by the WIP branch, four accepted (see §4).
- `ChevronAvoidance` ×4: a shown radio box pushes off-screen arrows 4–32 px further than needed
  on 390×844 / 430×932 (also 14–31 px for 4- and 5-line boxes). Minor, open.
- `CloakedJetHud` ×1: an off-screen arrow is not created while neither player nor camera has
  moved since the last frame (old, cannot happen in flight).

Watch items not covered by a test:

- A Wraith's five-round burst lands almost fully on a player flying straight (about 22 damage
  per seven-second cycle on level 1, Normal) — check against late-level multipliers.
- A Striker's lock is broken twice by a player closing inside 400 m (intended reward; confirm it
  feels fair). The Wraith may be nearly invisible on the darkest levels.
- A cloaked Wraith as a wave's last jet leaves “ENEMIES 1” with nothing on the radar for up to
  5 s (accepted).
- Portrait widths 431–699 (foldables) keep about 10.8 px instead of 12 px between the radio box
  and the warning rows; no overlap.
- `TerrainDetail.test.ts` “regenerating disposes the previous level (city → lake)” timed out
  once in a full run under load.
- Not verified on a real iPad or iPhone (Safari font fallback, backdrop blur, scrolling text).
- Owner decision still open from earlier: whether to untrack `node_modules/` and `dist/`.
