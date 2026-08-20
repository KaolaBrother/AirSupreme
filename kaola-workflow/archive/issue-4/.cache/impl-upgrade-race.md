# Implementer evidence — issue #4 UpgradeMenu dispose/show race (review R1)

Role: implementer (production code only; tests not written/edited).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Branch: `workflow/issue-4`
HEAD at start: `9d5ba103fcf15f0d9bb1903ae61930a04b572e76`
Review R1: `kaola-workflow/issue-4/.cache/code-review.md`
Test pin: `kaola-workflow/issue-4/.cache/tdd-upgrade-race.md`

## task

Close review R1 (`async-lifecycle-race`): unguarded `UpgradeMenu.show()` after resume or
dispose must not overlay live combat or a later run.

Production only:

- `src/ui/UpgradeMenu.ts`: after `dispose()`, `show()` / `updateDisplay()` / `hide()` are
  no-ops. Do not recreate `#upgrade-menu`. `isVisible()` stays false.
- `src/core/GameCoordinator.ts` (UpgradeMenu lifecycle only):
  1. PauseMenu `onUpgrade` `then()`: show only if `!isDisposed && isPaused() && isPlaying()`.
  2. `handleUpgradeToggle` `then()`: same three guards (add `isPaused`, previously missing).
  3. `ensureUpgradeMenu` factory: if `isDisposed` after construct, `menu.dispose()` and do
     not assign `this.upgradeMenu` (mirror `ensurePauseMenu`).
  4. `dispose()`: `upgradeMenu?.dispose(); upgradeMenu = null; upgradeMenuPromise = null`.

Did not restyle UpgradeMenu chrome. Did not edit tests.

## verification tier

`tests-green`

Authored suite (UpgradeMenu + HUD + PauseMenu + SessionSettings) passes 30/30 after the
change. The new dispose-then-show case now passes. `npx tsc --noEmit` exit 0.
`npx eslint src/ui/UpgradeMenu.ts src/core/GameCoordinator.ts` exit 0.

Coordinator `then()` guards are a production-only pin (no `GameCoordinator.session.test.ts`);
they are implemented, not unit-falsified here.

## files changed

- `src/ui/UpgradeMenu.ts`
  - `disposed` flag; `dispose()` sets it and `visible = false`, then removes `#upgrade-menu`
  - `show()` / `hide()` / `updateDisplay()` return immediately when disposed
  - late `show()` does not recreate or append `#upgrade-menu`; `isVisible()` remains false
- `src/core/GameCoordinator.ts`
  - `ensureUpgradeMenu` factory: disposed → `menu.dispose()`, do not assign `this.upgradeMenu`
  - PauseMenu `onUpgrade` then: `isDisposed || !isPaused() || !isPlaying()` → no-op
  - `handleUpgradeToggle` then: same triple guard (was missing `isPaused`)
  - `dispose()` now nulls `this.upgradeMenu` as well as `upgradeMenuPromise`

## verification commands

### before (baseline, dispose-then-show red)

```
npx vitest run src/__tests__/UpgradeMenu.test.ts src/__tests__/HUD.test.ts src/__tests__/PauseMenu.test.ts src/__tests__/SessionSettings.test.ts
```

exit code: `1`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/SessionSettings.test.ts (10 tests) 5ms
 ❯ src/__tests__/UpgradeMenu.test.ts (6 tests | 1 failed) 86ms
   ✓ UpgradeMenu > shows menu and updates points display from upgrades state 32ms
   ✓ UpgradeMenu > updates upgrade button state and points after upgrade click 13ms
   ✓ UpgradeMenu > shows current, next and gain values for each upgrade card 7ms
   ✓ UpgradeMenu > shows missile lock radius upgrade card with multiplier values 5ms
   ✓ UpgradeMenu > triggers resume callback and toggles visibility with show/hide 7ms
   × UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose() 22ms
     → expected <div id="upgrade-menu" …(1)>…(4)</div> to be null
 ✓ src/__tests__/PauseMenu.test.ts (7 tests) 181ms
 ✓ src/__tests__/HUD.test.ts (7 tests) 245ms

 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 29 passed (30)
```

Assertion site (second `show()` after `dispose()`):

```
 FAIL  src/__tests__/UpgradeMenu.test.ts > UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
AssertionError: expected <div id="upgrade-menu" …(1)>…(4)</div> to be null
 ❯ src/__tests__/UpgradeMenu.test.ts:114:53
```

### after

```
npx vitest run src/__tests__/UpgradeMenu.test.ts src/__tests__/HUD.test.ts src/__tests__/PauseMenu.test.ts src/__tests__/SessionSettings.test.ts
```

exit code: `0`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/SessionSettings.test.ts (10 tests) 6ms
 ✓ src/__tests__/UpgradeMenu.test.ts (6 tests) 96ms
 ✓ src/__tests__/PauseMenu.test.ts (7 tests) 304ms
 ✓ src/__tests__/HUD.test.ts (7 tests) 362ms

 Test Files  4 passed (4)
      Tests  30 passed (30)
   Start at  19:55:19
   Duration  1.34s
```

New case green:

```
✓ UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
```

```
npx tsc --noEmit
```

exit code: `0`

```
npx eslint src/ui/UpgradeMenu.ts src/core/GameCoordinator.ts
```

exit code: `0` (no output)

## production notes

`UpgradeMenu.dispose()` is now terminal for that instance: a later `show()` cannot rebuild
DOM even if a coordinator `then()` still holds the reference. Coordinator guards still
prevent calling `show()` after resume/game-over/dispose; the menu flag is the last hop.

`ensureUpgradeMenu` still returns the constructed (and disposed) menu when the coordinator
is already dead, matching `ensurePauseMenu`. Callers must not assign that instance to the
field; they already no-op via the triple guard, and `show()` would no-op anyway.
