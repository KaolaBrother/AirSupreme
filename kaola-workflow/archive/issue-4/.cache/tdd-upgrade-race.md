# TDD UpgradeMenu dispose/show resurrection (review R1)

Role: tdd-guide (tests only; no production code).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Baseline commit (worktree HEAD, actually run against): `9d5ba103fcf15f0d9bb1903ae61930a04b572e76`
Branch: `workflow/issue-4`
Blocking review: `kaola-workflow/issue-4/.cache/code-review.md` (R1)

## Test path written

- `src/__tests__/UpgradeMenu.test.ts` — extended. The five existing cases were not rewritten.

New case:

```
UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
```

Sequence pinned against the real `UpgradeMenu` subject (jsdom `document`, not a mock of the menu):

1. `show()` → `#upgrade-menu` is in `document`, `isVisible()` is true
2. `dispose()` → `#upgrade-menu` is gone (`getElementById` is null)
3. `show()` again → still no `#upgrade-menu`, `isVisible()` is false

HEAD fails this because `UpgradeMenu.show()` recreates and appends the container when `this.container` is null (`src/ui/UpgradeMenu.ts` ~55-63). `dispose()` nulls the container (`~649-655`) and does not mark the instance dead, so a late `show()` after coordinator teardown resurrects `#upgrade-menu` at z-index 999.

## Command run

From the worktree:

```bash
npx vitest run src/__tests__/UpgradeMenu.test.ts
```

Vitest v3.2.4. Result: 1 file failed, 1 test failed, 5 passed.

## Failure signature (verbatim)

```
RED: UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
AssertionError: expected <div id="upgrade-menu" …(1)>…(4)</div> to be null
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76
```

Assertion site (second `show()` after `dispose()`):

```
 FAIL  src/__tests__/UpgradeMenu.test.ts > UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
AssertionError: expected <div id="upgrade-menu" …(1)>…(4)</div> to be null

- Expected:
null

+ Received:
<div
  id="upgrade-menu"
  style="display: flex;"
>

 ❯ src/__tests__/UpgradeMenu.test.ts:114:53
    113|     menu.show();
    114|     expect(document.getElementById('upgrade-menu')).toBeNull();
       |                                                     ^
    115|     expect(menu.isVisible()).toBe(false);
```

Vitest summary:

```
 ❯ src/__tests__/UpgradeMenu.test.ts (6 tests | 1 failed) 52ms
   ✓ UpgradeMenu > shows menu and updates points display from upgrades state
   ✓ UpgradeMenu > updates upgrade button state and points after upgrade click
   ✓ UpgradeMenu > shows current, next and gain values for each upgrade card
   ✓ UpgradeMenu > shows missile lock radius upgrade card with multiplier values
   ✓ UpgradeMenu > triggers resume callback and toggles visibility with show/hide
   × UpgradeMenu > does not recreate #upgrade-menu when show() is called after dispose()
     → expected <div id="upgrade-menu" …(1)>…(4)</div> to be null

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

The received node is the resurrected shop (`display: flex`, `z-index: 999` in its injected CSS). The `isVisible() === false` assertion did not run because the DOM assertion failed first; both must hold after the production fix.

## Existing tests that still pass

```
✓ UpgradeMenu > shows menu and updates points display from upgrades state
✓ UpgradeMenu > updates upgrade button state and points after upgrade click
✓ UpgradeMenu > shows current, next and gain values for each upgrade card
✓ UpgradeMenu > shows missile lock radius upgrade card with multiplier values
✓ UpgradeMenu > triggers resume callback and toggles visibility with show/hide
```

## Production still required on UpgradeMenu

`show()` after `dispose()` must no-op: do not recreate `#upgrade-menu`, and `isVisible()` must stay false. A believable near-miss is “`if (!this.container) return` without clearing `visible`” — the current oracle would still fail `isVisible()`. Implementer owns `src/ui/UpgradeMenu.ts`.

## Coordinator `then()` guards — production-only pin (not tested here)

`GameCoordinator.session.test.ts` was **not** added. Constructing `GameCoordinator` is not cheap in this repo: the constructor builds `GameScene` / WebGL and is not a unit-testable subject without a stand-in of the thing under test.

These R1 coordinator claims remain a **production-only pin** and **must still be implemented**. They are not falsified by the UpgradeMenu unit test:

- `PauseMenu` `onUpgrade` `then()` (`GameCoordinator.ts` ~1916-1920) has zero guards. Must no-op unless `isDisposed === false` **and** `sessionState.isPaused()` **and** `sessionState.isPlaying()`.
- `handleUpgradeToggle` `then()` (`~2246-2252`) checks `isDisposed` and `isPlaying` but **not** `isPaused`, so a completed `resumeGame()` still shows the shop on a live sim. Same triple guard as `pauseGame`’s `ensurePauseMenu().then` (`~2267-2272`).
- `ensureUpgradeMenu` factory (`~1887-1904`) always assigns `this.upgradeMenu` and never disposes on `isDisposed`. Mirror `ensurePauseMenu` (`~1932-1937`): if disposed, `menu.dispose()` and do not keep the field.
- `dispose()` (`~2347-2348`) calls `upgradeMenu?.dispose()` but does **not** null `this.upgradeMenu` (`pauseMenu` is nulled). Null `upgradeMenu` on dispose.

Without those guards, a delayed `ensureUpgradeMenu().then(show)` after resume or exit-to-menu still reaches `UpgradeMenu.show()`. The new unit test only catches the last hop (a disposed instance must not resurrect DOM). The race itself is coordinator production work.

Do not invent a coordinator/session suite to stand in for those guards.
