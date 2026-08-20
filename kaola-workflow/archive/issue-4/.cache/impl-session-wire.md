# Implementer evidence — issue #4 session shell wiring

Role: implementer (production code only; tests not written/edited/weakened).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Branch: `workflow/issue-4`
HEAD at start: `9d5ba103fcf15f0d9bb1903ae61930a04b572e76`

## task

Wire the page-lifetime StartMenu session loop and in-game pause/settlement callbacks:

- Keep one `StartMenu` for the page lifetime (`hide()` on start, never dispose)
- `GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu }).boot(settings)`
- Retry disposes coordinator and reboots `lastSettings` (startLevel / gameMode / testScore included); StartMenu stays hidden
- Exit-to-menu disposes coordinator, `reloadFromStorage()` + `show()`
- Loading copy `正在进入战场` on every boot including retry
- Split ESC/P (PauseMenu) from KeyU (pause then UpgradeMenu); GAME_OVER ignores both
- Pause stops engine, continue restarts it; music is not stopped
- Settlement HUD buttons call main’s onRetry / onExitToMenu
- `InputHandler.dispose()` + mobile `#upgrade-button` → pausePressed
- `PauseMenu.handleEscape()` consumes confirm/settings, default view resumes

Did not restyle lock-on, radar, start-menu chrome, or mobile candy CSS.
Did not rewrite lock-on, boss AI, waves, or onboarding.
Did not touch `src/__tests__/**`.

## verification tier

`smoke-integration` plus targeted `tests-green`

Coordinator/main session loop has no unit fit (tdd-guide explicitly did not pin GameCoordinator/main tests). Targeted HUD / SessionSettings / PauseMenu suites stayed green (24/24). Production files typecheck and lint clean.

## files changed

- `src/main.ts`
  - page-lifetime `StartMenu`; `hide()` on start, never `dispose()`
  - `game: GameCoordinator | null`, `lastSettings`
  - `onStart` → hide menu, dispose previous coordinator, boot with `showStartMenu: false`
  - `onRetry` → hide menu, reboot `lastSettings`
  - `onExitToMenu` → dispose coordinator, `reloadFromStorage()` + `show()`
  - `showEnteringBattlefield()` on every boot including retry
- `src/core/GameCoordinator.ts`
  - `GameCoordinatorOptions` adds `onRetry` / `onExitToMenu`
  - lazy `ensurePauseMenu()`; pause settings apply audio + `setQualityPreset`
  - `pauseGame` no-ops on `!isPlaying()` / GAME_OVER; otherwise pause + `stopEngine` + PauseMenu
  - `resumeGame` hides PauseMenu and UpgradeMenu, `startEngine` if lives remain
  - ESC/P vs KeyU split; U pauses then opens UpgradeMenu without resuming
  - HUD `setSettlementActions` after presentation runtime exists
  - hide pause/upgrade on mission failed / mission complete; complete also `stopEngine`
  - `dispose` now disposes PauseMenu, UpgradeMenu, and `inputHandler.dispose()`
- `src/core/Input/InputHandler.ts`
  - tracked listeners + `dispose()`
  - mobile `#upgrade-button` sets `pausePressed` (KeyU remains `upgradePressed`)
- `src/ui/PauseMenu.ts`
  - private `PauseMenuView` + public `handleEscape()`
  - confirm/settings → default view (consumed); default view returns false

## verification commands

### before

```
npx vitest run src/__tests__/HUD.test.ts src/__tests__/SessionSettings.test.ts src/__tests__/PauseMenu.test.ts
```

exit code: `0`

```
 Test Files  3 passed (3)
      Tests  24 passed (24)
```

PauseMenu / HUD settlement / start-flow persist were already implemented on this worktree (other agents). Session shell (main + coordinator pause/retry) was not.

### after

```
npx vitest run src/__tests__/HUD.test.ts src/__tests__/SessionSettings.test.ts src/__tests__/PauseMenu.test.ts
```

exit code: `0`

```
 RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/SessionSettings.test.ts (10 tests) 3ms
 ✓ src/__tests__/PauseMenu.test.ts (7 tests) 96ms
 ✓ src/__tests__/HUD.test.ts (7 tests) 133ms

 Test Files  3 passed (3)
      Tests  24 passed (24)
```

```
npx tsc --noEmit
```

exit code: `0`

```
npx eslint src/main.ts src/core/GameCoordinator.ts src/core/Input/InputHandler.ts src/ui/PauseMenu.ts
```

exit code: `0`

## session-shell flow actually wired

1. Page constructs one `StartMenu` and keeps it.
2. Start → `startMenu.hide()` → dispose any previous `GameCoordinator` → dynamic import → `new GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu }).boot(settings)` → store `lastSettings`. Loading overlay shows `正在进入战场`.
3. In combat, ESC/P or mobile `#upgrade-button` opens PauseMenu (engine stopped, music continues). Default 继续 resumes. 升级 opens UpgradeMenu on top of the paused sim. 设置 writes sfx/music/quality through existing persist APIs. 返回菜单 confirms, then `onExitToMenu`.
4. KeyU pauses if needed, then opens UpgradeMenu without resuming. ESC on the shop still resumes (closes both menus).
5. GAME_OVER: pause/upgrade toggles are consumed and ignored; no PauseMenu. Settlement 再来一局 → `onRetry` (same `lastSettings`, menu stays hidden). 返回菜单 → dispose coordinator, reload + show StartMenu.
6. Coordinator dispose removes PauseMenu, UpgradeMenu, and InputHandler listeners so retry does not stack canvases, `#hud`, or window listeners.
