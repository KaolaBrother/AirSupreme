# Close the session loop so a run can pause, retry, and return to the menu without a refresh

- item: Investigate the current session shell, pause-as-upgrade binding, HUD settlement, and StartMenu persist so later work lands on real seams rather than the issue's guessed locators; comments on #4 override the body for touch layout
  status: done
  dispatched: code-explorer (read-only) from the issue-4 worktree; output to land at kaola-workflow/issue-4/.cache/session-shell-seams.md
  result: kaola-workflow/issue-4/.cache/session-shell-seams.md — PauseMenu absent; persist is private on StartMenu; pause opens UpgradeMenu; HUD titles GAME OVER / MISSION COMPLETE with no buttons; InputHandler leaks listeners on retry

- item: Author failing tests for SessionSettings persist, PauseMenu actions (continue/upgrade/settings/exit-confirm, game-over ignores ESC), and HUD settlement buttons plus failed-vs-complete titles
  status: done
  dispatched: tdd-guide on the issue-4 worktree; tests to land at src/__tests__/SessionSettings.test.ts, src/__tests__/HUD.test.ts, src/__tests__/PauseMenu.test.ts; baseline-fail evidence at kaola-workflow/issue-4/.cache/tdd-session-loop.md
  result: RED 13 failed / 4 passed on 9d5ba10; APIs pinned in kaola-workflow/issue-4/.cache/tdd-session-loop.md. Coordinator ESC-after-game-over and main.ts hide-not-dispose left as wiring gaps.

- item: Implement SessionSettings persist and StartMenu rewrite onto load/save, plus PauseMenu and HUD settlement UI matching the pinned tests
  status: done
  dispatched: implementer-persist owns src/core/SessionSettings.ts and src/ui/StartMenu.ts; implementer-ui owns src/ui/HUD.ts and new src/ui/PauseMenu.ts; both in .kw/worktrees/issue-4; notes at kaola-workflow/issue-4/.cache/impl-persist.md and impl-pause-hud.md
  result: 24 targeted tests green in worktree. tsc still fails on PauseMenu.test.ts Array.at (test custody). Production HUD/PauseMenu/SessionSettings/StartMenu landed.

- item: Replace PauseMenu.test.ts mock.calls.at(-1) with ES2020-safe indexing so tsc --noEmit passes
  status: done
  dispatched: tdd-guide only src/__tests__/PauseMenu.test.ts in the issue-4 worktree; evidence kaola-workflow/issue-4/.cache/tdd-at-fix.md
  result: tsc clean; 24 session tests still pass. kaola-workflow/issue-4/.cache/tdd-at-fix.md

- item: Wire main.ts hide-not-dispose session shell and GameCoordinator pause cabin, retry/exit, engine stop/start, game-over pause no-op, and InputHandler dispose
  status: done
  dispatched: implementer-wire owns src/main.ts, src/core/GameCoordinator.ts, src/core/Input/InputHandler.ts, and may add PauseMenu.handleEscape; evidence kaola-workflow/issue-4/.cache/impl-session-wire.md
  result: Session shell wired. Full worktree validation 337 tests + lint + tsc + build green. Code review failed on R1 (unguarded UpgradeMenu show after resume/dispose).

- item: Pin and fix the UpgradeMenu async show race after resume or dispose (review R1)
  status: done
  dispatched: tdd-guide first on src/__tests__/UpgradeMenu.test.ts (and a coordinator session test if constructible); then implementer on src/ui/UpgradeMenu.ts and src/core/GameCoordinator.ts; evidence kaola-workflow/issue-4/.cache/tdd-upgrade-race.md and impl-upgrade-race.md
  result: UpgradeMenu.show after dispose is a no-op; coordinator then() requires !disposed && paused && playing; upgradeMenu nulled on dispose. Targeted 30 tests green.

- item: Prove the loop with the issue's targeted vitest files plus tsc/lint/full test/build on the worktree, and repair what fails
  status: done
  dispatched: self; full suite in .kw/worktrees/issue-4; evidence kaola-workflow/issue-4/.cache/final-validation.md
  result: tsc/lint/test/build pass; 33 files / 338 tests; receipt hash aa00b5f28d45997e585808e06719bca51d9d4efcffb92e4e3278c01abc46f78e

- item: Dock IMPLEMENTATION_PLAN / CHANGELOG against the landed session loop, then finalize issue-4
  status: done
  dispatched: doc-updater on IMPLEMENTATION_PLAN.md, CHANGELOG.md, README.md, docs/architecture.md; docking at kaola-workflow/issue-4/.cache/doc-docking.md
  result: DOCKED. A4 HUD-language still later. R1 closed in code-review.md. Ready for finalize.
