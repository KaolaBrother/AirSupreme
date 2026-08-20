# Finalization — Summary: issue-4

## Delivered

Session loop for GitHub #4 (experience-upgrade 1/5):

- Page-lifetime StartMenu (`hide()` not `dispose()`), retry with `lastSettings`, return-to-menu via `reloadFromStorage()` + `show()`.
- `PauseMenu` (`#pause-menu`, z-index 200): 继续 / 升级 / 设置 / 返回菜单; settings are SFX/music/quality only; confirm copy `返回主菜单？当前进度将丢失。`
- Settlement HUD: `MISSION FAILED` / `MISSION COMPLETE` with **再来一局** / **返回菜单**.
- `SessionSettings` persist: `START_MENU_STORAGE_KEY`, `loadStartFlowSettings` / `saveStartFlowSettings` (merge-then-normalize).
- ESC/P and mobile `#upgrade-button` open the pause cabin (`stopEngine`); KeyU pauses then UpgradeMenu; GAME_OVER ignores pause.
- `InputHandler.dispose()`; UpgradeMenu `show()` after `dispose()` is a no-op; coordinator UpgradeMenu `then()` requires `!disposed && paused && playing`.

Out of scope (issues #5–#8 / design source #3): HUD chrome tokens, lock-on state machine, radar, briefing, start-menu/mobile skin.

## Files Changed

- `src/main.ts`
- `src/core/SessionSettings.ts`
- `src/core/GameCoordinator.ts`
- `src/core/Input/InputHandler.ts`
- `src/ui/StartMenu.ts`
- `src/ui/HUD.ts`
- `src/ui/PauseMenu.ts` (new)
- `src/ui/UpgradeMenu.ts`
- `src/__tests__/SessionSettings.test.ts`
- `src/__tests__/HUD.test.ts`
- `src/__tests__/PauseMenu.test.ts` (new)
- `src/__tests__/UpgradeMenu.test.ts`
- `IMPLEMENTATION_PLAN.md`
- `CHANGELOG.md`
- `README.md`
- `docs/architecture.md`

## Test Coverage

- `src/__tests__/SessionSettings.test.ts` — persist key, round-trip, merge, corrupt JSON, zero volume
- `src/__tests__/HUD.test.ts` — MISSION FAILED vs MISSION COMPLETE, settlement buttons
- `src/__tests__/PauseMenu.test.ts` — four actions, z-index 200, settings-only, confirm, touch/safe-area
- `src/__tests__/UpgradeMenu.test.ts` — dispose then show does not resurrect `#upgrade-menu`
- Full suite: 33 files / 338 tests

Coordinator GAME_OVER/ESC and main.ts hide-not-dispose remain manual (jsdom cannot cheaply construct GameCoordinator).

## Validation

- verdict: pass
- command: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
- validated_candidate_hash: `aa00b5f28d45997e585808e06719bca51d9d4efcffb92e4e3278c01abc46f78e`
- evidence: `kaola-workflow/issue-4/.cache/final-validation.md`
- `vendor-three` chunk-size warning remains (~517 kB)

## Changed Paths

Recorded by the finalize transaction (do not soften).

## Mission List

All items `done` in `kaola-workflow/issue-4/mission-list.md`. Goal: close the session loop so a run can pause, retry, and return to the menu without a refresh.

## Documentation Docking

- Verdict: DOCKED
- Evidence: `kaola-workflow/issue-4/.cache/doc-docking.md`

## Run gaps

## Follow-Up Items

- Manual play: desktop fail→retry, complete→menu; mobile purple 升级 button opens PauseMenu; pause settings persist into StartMenu.
- Issues #5–#8 remain open (HUD chrome, radar, briefing, shell). Design source #3 stays open until those close.
- No GameCoordinator unit test for ESC-after-game-over (constructor pulls WebGL).

## Status: ARCHIVED AFTER FINAL GIT GATE

## Finalize Findings

### residue_stage_failed

The `chore: finalize` commit could not stage the finalization residue: `git add` exited non-zero, and the transaction recorded `finalize_commit: nothing_to_commit` — the run reports closed while work may still be uncommitted in the worktree.

Every path this call was given did reach the index despite the non-zero exit.

git said:

```
下列路径根据您的一个 .gitignore 文件而被忽略：
node_modules
提示： 如果您确实想添加它们，请使用 -f 选项。
提示： Disable this message with "git config set advice.addIgnoredFile false"
```

