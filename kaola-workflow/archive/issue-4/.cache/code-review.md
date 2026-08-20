behavior: code-reviewer
behavior_contract_version: 3
behavior_contract_hash: 308d49af0d19404ba0d50e28cee64b570df0a647c93f6b6f3636c3853835dfc7
resolved_profile_hash: a3fc3040f5cd0530569a869efba3606463e3fc7c6aeb701f528704dce1e3bb40
issue: 4
worktree: /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4
evidence_file: /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/kaola-workflow/issue-4/.cache/code-review.md

finding: id=R1 scope=in_scope action=fix status=open severity=high fix_role=tdd-guide failure_class=async-lifecycle-race rationale=unguarded-UpgradeMenu-show-after-resume-or-dispose

## R1

failure_class: async-lifecycle-race

trigger:
- First combat session while `@/ui/UpgradeMenu` is still a pending dynamic import (startInternal does not wait on that chunk; warmRuntimeChunks is fire-and-forget).
- Open the shop from the new pause cabin: KeyU (handleUpgradeToggle) or PauseMenu button 升级.
- Before the import settles, resume or tear down that cabin: ESC/P or 继续 (resumeGame), or PauseMenu 返回菜单 -> 确定 (onExitToMenu -> dispose).

expected:
- UpgradeMenu.show() only runs while this coordinator is still paused, playing, and not disposed.
- If resume, game-over, or dispose won the race, the later then() must no-op; a disposed shop must not recreate DOM.

observed:
- PauseMenu.show() is guarded with isDisposed && isPaused && isPlaying.
- PauseMenu onUpgrade then() has zero guards.
- handleUpgradeToggle then() checks isDisposed and isPlaying but not isPaused, so a completed resume still shows the shop on a live sim.
- ensureUpgradeMenu factory always assigns this.upgradeMenu and never disposes on isDisposed, unlike ensurePauseMenu.
- coordinator.dispose() disposes upgradeMenu but does not null the field (pauseMenu is nulled).
- UpgradeMenu.show() recreates and appends #upgrade-menu when container was cleared by dispose (z-index 999). After StartMenu.hide() on the next start, that orphan overlay covers the new run.

primary_anchor: src/core/GameCoordinator.ts:1916-1920
secondary_anchors:
- src/core/GameCoordinator.ts:1887-1904
- src/core/GameCoordinator.ts:2235-2253
- src/core/GameCoordinator.ts:2267-2272
- src/core/GameCoordinator.ts:2344-2348
- src/ui/UpgradeMenu.ts:55-63
- src/ui/UpgradeMenu.ts:649-655

proof:
- Repro A (live combat): cold start immediately, press U, then ESC before the UpgradeMenu chunk resolves. resumeGame clears paused and restarts the engine; the later then() still calls upgradeMenu.show() because isPlaying is still true.
- Repro B (orphan after exit): pause, click 升级, confirm 返回菜单 before the chunk resolves. dispose() runs first; the in-flight factory then constructs a new UpgradeMenu, assigns this.upgradeMenu, and onUpgrade then() calls show(), which appends #upgrade-menu. StartMenu z-index 1000 covers it until the next boot hides StartMenu, leaving the disposed coordinator's shop at z-index 999 over the new game.
- Existing pauseGame then() guards do not protect this path. No test covers handleUpgradeToggle, PauseMenu onUpgrade, or coordinator dispose vs in-flight ensureUpgradeMenu.

severity: high
scope: in_scope
action: fix
status: open
fix_role: tdd-guide

fix_notes:
- Pin a failing test that delays ensureUpgradeMenu, then resume and dispose before show().
- Production: guard both then() callbacks with isDisposed && isPaused && isPlaying; mirror ensurePauseMenu's isDisposed dispose-and-return; null upgradeMenu on dispose; do not show a disposed menu.

## Checked not admitted

double-click-retry-two-coordinators: not admitted. onRetry calls showEnteringBattlefield() synchronously (loading-screen z-index 1000) before await import, so a second settlement click cannot hit 再来一局. After a cached import, disposeGame() then assign game run in one microtask with no await between them.

GAME_OVER-pause-leak: not admitted. handlePauseToggle on !isPlaying calls pauseGame, which returns after resetPauseState/resetUpgradeState and never ensurePauseMenu. handleUpgradeToggle also returns on !isPlaying. PLAYER_DEATH / final-boss complete hide pause and upgrade, and pauseMenu.show() refuses !isPlaying.

StartMenu-still-disposed: not admitted. main.ts uses hide/reloadFromStorage/show and never startMenu.dispose(). GameCoordinator boots with showStartMenu false, so PresentationController.startMenu is null and its dispose cannot kill the page-lifetime menu.

InputHandler.dispose-missing-listener: not admitted. Tracked set matches the previous window keydown/keyup, joystick touchstart, document touchmove/touchend/touchcancel, fire/throttle/missile/upgrade touchstart/touchend, and mobile-controls touchmove preventDefault. Mobile #upgrade-button now sets pausePressed. Button touchcancel was already absent.

bootGame-in-flight-lock: not admitted as a separate defect. Loading overlay plus isDisposed abort in bootWhenReady cover the settlement double-tap case. No second live coordinator was shown.

tsc-unused-any: not admitted. Changed production files have no `any`. PauseMenu.test.ts no longer uses Array.at.

acceptance-held:
- StartMenu hide-not-dispose; retry lastSettings; exit reloadFromStorage + show
- PauseMenu z-index 200; four default buttons; settings sfx/music/quality only
- HUD titles MISSION FAILED / MISSION COMPLETE with 再来一局 / 返回菜单
- persist key air-supreme:start-menu-settings; partial save merges
- U pauses then UpgradeMenu; engine stop on pause and start on resume; music not stopped
- AutoAimSystem not enabled; lock-on/radar/start-menu skin/lives-missiles emoji not restyled

coverage-gap-nonblocking: GameCoordinator pause/GAME_OVER/main.ts retry-exit have no unit tests. That gap is how R1 landed; it is not a second functional defect.

verdict: fail
findings_blocking: 1
review_conclusion: Unguarded async UpgradeMenu show can overlay live combat or a later run after resume or dispose, so this review fails with one blocking defect.

## R1 recheck (production fix)

recheck_scope: R1 only (UpgradeMenu dispose/show race)
worktree: /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4
files: src/ui/UpgradeMenu.ts src/core/GameCoordinator.ts src/__tests__/UpgradeMenu.test.ts

landed:
- UpgradeMenu.disposed flag. show/hide/updateDisplay return immediately when disposed. show() does not recreate or append #upgrade-menu. dispose() sets disposed and visible=false, then removes the node.
- PauseMenu onUpgrade then() no-ops unless !isDisposed && isPaused() && isPlaying().
- handleUpgradeToggle then() uses the same triple guard (isPaused was previously missing).
- ensureUpgradeMenu factory: if isDisposed after construct, menu.dispose() and do not assign this.upgradeMenu.
- coordinator.dispose() now does upgradeMenu?.dispose(); upgradeMenu = null; upgradeMenuPromise = null.

repro_a_closed: resume before the chunk settles sets isPaused false; the later then() returns before show().
repro_b_closed: dispose before the chunk settles sets isDisposed, factory disposes without assigning, then() returns; a disposed instance cannot resurrect #upgrade-menu.

test: npx vitest run src/__tests__/UpgradeMenu.test.ts — 6 passed, including dispose-then-show.

no_new_blocking_race: remaining factory still returns the disposed instance (mirrors ensurePauseMenu); callers no-op via the triple guard and show() would no-op anyway.

finding: id=R1 scope=in_scope action=fix status=closed severity=high fix_role=tdd-guide rationale=unguarded-UpgradeMenu-show-after-resume-or-dispose

R1 status: closed
verdict: pass
findings_blocking: 0
review_conclusion: Recheck of R1 confirms the UpgradeMenu show-after-resume-or-dispose race is closed in production, so this review now passes with zero blocking findings.
