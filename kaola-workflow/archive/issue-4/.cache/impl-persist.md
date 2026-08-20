# Implementer evidence — issue #4 persist extraction

Role: implementer (production code only; tests not written/edited).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Branch: `workflow/issue-4`

## task

Extract start-menu persist into `SessionSettings` (`START_MENU_STORAGE_KEY`,
`loadStartFlowSettings`, `saveStartFlowSettings`) using existing
`normalizeStartFlowSettings`. Wire `StartMenu` to those helpers, keep
constructor load-before-DOM, persist-on-change via `updateDisplay`, add
public `reloadFromStorage()`, and have `show()` reload stored values.

## verification tier

`tests-green`

SessionSettings persist suite is green. HUD/PauseMenu remain another agent's
job; `npx tsc --noEmit` still fails only on `src/__tests__/PauseMenu.test.ts`
(missing `@/ui/PauseMenu` and `.at` lib errors), not on owned files.

## files changed

- `src/core/SessionSettings.ts`
  - exported `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'`
  - `loadStartFlowSettings()`: empty → defaults; dirty JSON through
    `normalizeStartFlowSettings`; corrupt JSON `removeItem` + defaults;
    `getItem` throw / missing storage → defaults, never throws
  - `saveStartFlowSettings(partial?)`: merge previously stored start-flow
    fields, normalize, `setItem` full normalized JSON (pause `{ sfxVolume }`
    cannot reset difficulty/lives/level/mode/testScore; `0` volumes survive)
- `src/ui/StartMenu.ts`
  - removed private `STORAGE_KEY` / `getStorage` copy of the key
  - `loadSettings` / `saveSettings` call the SessionSettings helpers
  - constructor still loads before building DOM
  - `updateDisplay` still persists via `saveStartFlowSettings(this.settings)`
  - public `reloadFromStorage()`; `show()` calls it; `hide()` unchanged

Did not touch HUD, PauseMenu, GameCoordinator, main.ts, InputHandler, or
`src/__tests__/**`.

## verification commands

### before (baseline, persist API absent)

```
npx vitest run src/__tests__/SessionSettings.test.ts
```

exit code: `1`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ❯ src/__tests__/SessionSettings.test.ts (10 tests | 8 failed) 5ms
   ✓ SessionSettings > uses the configured test score tiers up to 20000 1ms
   ✓ SessionSettings > clamps oversized test score values to the highest tier 0ms
   × SessionSettings > start-flow persist > exports START_MENU_STORAGE_KEY as air-supreme:start-menu-settings 2ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > returns defaults when storage is empty 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > round-trips sfx, music, and quality through localStorage 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > keeps a zero volume instead of treating it as missing 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > merges partial saves so pause audio writes do not reset start-flow fields 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > normalizes dirty stored JSON through normalizeStartFlowSettings 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > falls back to defaults and clears the key when stored JSON is corrupt 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality
   × SessionSettings > start-flow persist > does not throw when localStorage getItem fails 0ms
     → expected undefined to be 'air-supreme:start-menu-settings' // Object.is equality

 Test Files  1 failed (1)
      Tests  8 failed | 2 passed (10)
   Start at  19:21:45
   Duration  416ms
```

### after

```
npx vitest run src/__tests__/SessionSettings.test.ts
```

exit code: `0`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/SessionSettings.test.ts (10 tests) 3ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  19:23:29
   Duration  432ms (transform 25ms, setup 12ms, collect 13ms, tests 3ms, environment 169ms, prepare 38ms)
```

```
npx tsc --noEmit
```

exit code: `2` (out of owned scope)

```
src/__tests__/PauseMenu.test.ts(4,27): error TS2307: Cannot find module '@/ui/PauseMenu' or its corresponding type declarations.
src/__tests__/PauseMenu.test.ts(214,48): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(218,48): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(223,50): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(238,34): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(240,34): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

Owned-file filter (`grep SessionSettings|StartMenu` on that tsc output): no errors.

## before

Persist API missing. 8/10 SessionSettings tests failed at the
`START_MENU_STORAGE_KEY` gate. Two pre-existing test-score cases passed.

## after

All 10 SessionSettings tests passed (test-score + start-flow persist).
Owned production files typecheck; remaining `tsc` failures are PauseMenu
tests owned by another agent.
