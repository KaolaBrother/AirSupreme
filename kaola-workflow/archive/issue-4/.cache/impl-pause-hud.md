# Implementer evidence — issue #4 PauseMenu + HUD settlement

Role: implementer (production code only; tests not written/edited).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Branch: `workflow/issue-4`

## task

HUD settlement overlay + new PauseMenu:

- `HUD.setSettlementActions({ onRetry, onExitToMenu })`
- `showGameOver` primary `#game-over-title` is `MISSION FAILED` (not `GAME OVER`)
- `showMissionComplete` title remains `MISSION COMPLETE`
- `#final-score` stays `最终得分: N`
- Shared settlement buttons **再来一局** / **返回菜单**, touch-sized, hidden with overlay
- New `src/ui/PauseMenu.ts` with `#pause-menu` z-index 200, default 继续/升级/设置/返回菜单,
  settings 音效/音乐/画质 only, confirm copy, hide/dispose

Did not touch SessionSettings.ts, StartMenu.ts, GameCoordinator.ts, main.ts,
InputHandler.ts, or `src/__tests__/**`. Did not restyle HUD lives/missiles/score glass.

## verification tier

`tests-green`

Authored HUD + PauseMenu suites pass (14/14). Production `HUD.ts` / `PauseMenu.ts`
have no `tsc` errors. `npx tsc --noEmit` still exits 2 on `src/__tests__/PauseMenu.test.ts`
Array `.at()` vs `lib: ES2020` — test-author file, not owned here.

## files changed

- `src/ui/HUD.ts`
  - `setSettlementActions({ onRetry, onExitToMenu })`
  - settlement panel `#hud-settlement-overlay` z-index 120 (below PauseMenu 200)
  - `#game-over-title` failure text `MISSION FAILED`; complete remains `MISSION COMPLETE`
  - buttons **再来一局** / **返回菜单**, `min-height: 48px`, `pointer-events: auto`
  - panel `width: min(360px, calc(100% - 32px))` + `env(safe-area-inset-*)`
  - narrow-screen button row `flex-direction: column`
  - `hideGameOver` hides the action row with the overlay; `dispose` still removes overlay
- `src/ui/PauseMenu.ts` (new)
  - constructor options match pinned `IPauseMenuOptions`
  - root `#pause-menu`, z-index 200, full-screen glass overlay
  - default view 继续 / 升级 / 设置 / 返回菜单
  - settings 音效 / 音乐 / 画质; volume step 0.1 clamp [0,1]; quality wrap auto- → quality
  - each adjust `applyAudio`/`applyQuality` + `saveSettings(partial)` immediately
  - 返回菜单 → `返回主菜单？当前进度将丢失。` + 取消/确定; 确定 calls `onExitToMenu` once
  - confirm copy is not in the DOM until 返回菜单 is clicked
  - touch min-height 48px; panel `min(360px, calc(100% - 32px))`; all four safe-area insets
  - `show()` reloads `loadSettings()` and default view; `hide()` display none; `dispose()` removes root

## verification commands

### before (baseline, settlement APIs and PauseMenu missing)

```
npx vitest run src/__tests__/HUD.test.ts src/__tests__/PauseMenu.test.ts
```

exit code: `1`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ❯ src/__tests__/HUD.test.ts (7 tests | 5 failed) 100ms
   ✓ HUD > caps lives to 5 hearts when lives exceed the limit 75ms
   ✓ HUD > renders missile icons without exceeding GAME_CONSTANTS.MISSILE.MAX_MISSILES 5ms
   × HUD > shows mission completion without reusing the game over title 6ms
     → expected 'GAME OVER' to be 'MISSION FAILED'
   × HUD > keeps GAME OVER out of the primary failure title 4ms
     → expected 'GAME OVER' to be 'MISSION FAILED'
   × HUD > wires 再来一局 and 返回菜单 to HUD settlement callbacks 4ms
     → expected 'undefined' to be 'function'
   × HUD > shows the same settlement actions after mission complete 4ms
     → settlementHud(...).setSettlementActions is not a function
   × HUD > sizes settlement actions for touch and keeps a narrow panel width 3ms
     → settlementHud(...).setSettlementActions is not a function

 FAIL  src/__tests__/PauseMenu.test.ts
 Error: Failed to resolve import "@/ui/PauseMenu" from "src/__tests__/PauseMenu.test.ts". Does the file exist?

 Test Files  2 failed (2)
      Tests  5 failed | 2 passed (7)
   Start at  19:23:39
   Duration  539ms
```

### after

```
npx vitest run src/__tests__/HUD.test.ts src/__tests__/PauseMenu.test.ts
```

exit code: `0`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/PauseMenu.test.ts (7 tests) 104ms
 ✓ src/__tests__/HUD.test.ts (7 tests) 140ms

 Test Files  2 passed (2)
      Tests  14 passed (14)
   Start at  19:27:13
   Duration  665ms
```

```
npx tsc --noEmit
```

exit code: `2` (test file only; production HUD/PauseMenu clean)

```
src/__tests__/PauseMenu.test.ts(214,48): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(218,48): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(223,50): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(238,34): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/__tests__/PauseMenu.test.ts(240,34): error TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
```

```
npx eslint src/ui/HUD.ts src/ui/PauseMenu.ts
```

exit code: `0`

## finding (not owned)

`src/__tests__/PauseMenu.test.ts` uses `mock.calls.at(-1)` which TypeScript
ES2020 lib does not type. Route to tdd-guide if `tsc --noEmit` must be green
on the test file; implementer cannot edit tests.
