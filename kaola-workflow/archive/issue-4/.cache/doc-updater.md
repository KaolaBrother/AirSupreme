# Doc-updater record — GitHub #4 session loop (experience-upgrade 1/5)

Role: doc-updater. Transcribed verified ground truth only. Did not invent APIs, numbers, or enum values.
Worktree (edits): `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Date: 2026-08-20
Issue: GitHub #4 session loop (pause cabin, settlement retry/exit). Experience-upgrade 1/5 only.

Did **not** mark design-source #3 or issues #5–#8 done.
Did **not** flip IMPLEMENTATION_PLAN A4 「最终统一 HUD 与关卡视觉语言」 from `[later]`.
Did **not** claim HUD chrome / lock-on / radar / mobile skin work.

## Detection

- `scripts/codemaps/` — **absent** (no `scripts/` directory in worktree).
- `docs/CODEMAPS/` — **absent** (`docs/` is api/architecture/conventions/decisions/README only).
- Codemaps: **skipped**. Did not invent `docs/CODEMAPS/` or `scripts/codemaps/`.

## Commands run

```
ls -la /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4
ls -la /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/kaola-workflow/issue-4/.cache
find … -name impl-persist.md -o -name final-validation.md -o -name impl-pause-hud.md
```

Read (not re-run) evidence:

- `kaola-workflow/issue-4/.cache/impl-persist.md`
- `kaola-workflow/issue-4/.cache/impl-pause-hud.md`
- `kaola-workflow/issue-4/.cache/impl-session-wire.md`
- `kaola-workflow/issue-4/.cache/impl-upgrade-race.md`
- `kaola-workflow/issue-4/.cache/final-validation.md` (`verdict: pass`, command `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`)

Verified against source (read, not guessed):

- `src/main.ts` — `startMenu.hide()` on start/retry; never `dispose()`; `new GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu })`; retry `lastSettings`; exit `reloadFromStorage()` + `show()`
- `src/core/SessionSettings.ts` — `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'`; `loadStartFlowSettings` / `saveStartFlowSettings` merge-then-normalize
- `src/ui/PauseMenu.ts` — `#pause-menu` z-index 200; 继续/升级/设置/返回菜单; settings 音效/音乐/画质; confirm `返回主菜单？当前进度将丢失。`
- `src/ui/HUD.ts` — `#game-over-title` `MISSION FAILED` / `MISSION COMPLETE`; 再来一局 / 返回菜单; `setSettlementActions`
- `src/core/GameCoordinator.ts` — ESC/P → PauseMenu + `stopEngine`; KeyU pause then UpgradeMenu; GAME_OVER `!isPlaying()` ignores pause; UpgradeMenu `then()` guards
- `src/core/Input/InputHandler.ts` — mobile `#upgrade-button` sets `pausePressed`; `dispose()`
- `src/ui/UpgradeMenu.ts` — `show()` after `dispose()` is no-op
- `dist/assets/PauseMenu-B-Q-_djS.js` — PauseMenu is its own chunk

Did **not** re-run `tsc` / lint / test / build. `final-validation.md` already recorded pass on hash `9913b37d…`; this turn is docs-only.

Validation numbers used (from the assigned verified facts, not invented):

- Tests: **33 files / 338 tests**
- `vendor-three` chunk-size warning still present (~517 kB)
- PauseMenu chunk `PauseMenu-*.js`

## Files changed (worktree)

### 1. `IMPLEMENTATION_PLAN.md`

Reconciled against: GitHub #4 session loop landing + `src/main.ts` / `PauseMenu.ts` / `HUD.ts` / `SessionSettings.ts` / `InputHandler.ts` / `UpgradeMenu.ts` / `final-validation.md`.

- Last-updated date `2026-06-13` → `2026-08-20`.
- Current-overview note: experience-upgrade 1/5 (GitHub #4) done; A4 HUD-language still `[later]`; #3 and #5–#8 not this round.
- 已完成基线: added session-loop 1/5 done item (`hide()` not `dispose()`, PauseMenu cabin, settlement retry/exit, SessionSettings persist).
- D3: replaced stale “暂停菜单 / 移动端升级按钮 / 桌面 U 键已接入” with PauseMenu facts (ESC/P opens cabin; U pauses then shop; mobile `#upgrade-button` currently opens pause cabin). Added settlement titles + 再来一局 / 返回菜单.
- E1: PauseMenu on-demand import + independent chunk `PauseMenu-*.js`.
- F1: session-loop tests (`PauseMenu.test.ts`, HUD settlement, SessionSettings persist).
- Watch: `vendor-three` observed size `503 kB` → `517 kB` (this validation).
- Left `[later]` A4 「最终统一 HUD 与关卡视觉语言」.
- Left unrelated `[active]` aircraft / explosion / audio / onboarding / wave items.

### 2. `CHANGELOG.md`

Reconciled against the same code + `final-validation.md`. Kept the existing Unreleased bullet. Did not rewrite `[2.2.1]` historical “玩家死亡仍显示 `GAME OVER`”.

Exact Unreleased bullets written:

```
## Unreleased

- Initialized Kaola-Workflow documentation structure.

### 会话循环（experience-upgrade 1/5）

- 页级 `StartMenu`：开局调用 `hide()`，不再 `dispose()`；`GameCoordinator` 以 `{ showStartMenu: false, onRetry, onExitToMenu }` 启动
- 结算 HUD：`#game-over-title` 失败为 `MISSION FAILED`、通关为 `MISSION COMPLETE`；按钮 **再来一局** / **返回菜单**（`setSettlementActions`）
- 再来一局使用本局 `lastSettings` 重开；返回菜单调用 `reloadFromStorage()` 后 `show()` StartMenu
- 新增 `PauseMenu`（`#pause-menu`，z-index 200）：继续 / 升级 / 设置 / 返回菜单；设置仅 音效 / 音乐 / 画质；返回菜单确认文案 `返回主菜单？当前进度将丢失。`
- ESC / P 与移动端 `#upgrade-button` 打开暂停舱（引擎 `stopEngine`）；桌面 `U` 先暂停再打开升级商店；`GAME_OVER` 忽略暂停
- `SessionSettings` 以 `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'` 通过 `loadStartFlowSettings` / `saveStartFlowSettings`（先合并再规范化）持久化开始流程设置
- `InputHandler.dispose()` 清理监听；`UpgradeMenu.show()` 在 `dispose()` 之后为空操作
- 构建拆出独立 chunk `PauseMenu-*.js`
- 全量门槛通过：`npx tsc --noEmit`、`npm run lint`、`npm run test:run`、`npm run build`（**33 个测试文件 / 338 个测试**）；`vendor-three` chunk-size warning 仍在（约 517 kB）
```

### 3. `README.md`

Reconciled against player-facing controls that the session loop made false (`ESC / P` was documented as 暂停/升级菜单; mobile 升级 button was 暂停/升级菜单). Not HUD chrome restyle.

- Overview: 暂停舱与局内结算 (`MISSION FAILED` / `MISSION COMPLETE`, 再来一局 / 返回菜单).
- Upgrade copy: ESC/P opens pause cabin then 升级; U pauses then shop.
- Controls table: ESC/P → 打开暂停舱（继续 / 升级 / 设置 / 返回菜单）; added U → 暂停后打开升级商店.
- Mobile: 右侧紫色按钮 → 打开暂停舱 (kept existing color word; did not claim a skin change).
- Engineering status: **33 个测试文件 / 338 个测试**; `vendor-three` ~517 kB.
- Tree: `src/ui/PauseMenu.ts`; tests count 338.

### 4. `docs/architecture.md`

Reconciled against `src/main.ts` page-lifetime StartMenu and on-demand PauseMenu.

- Entry: one `StartMenu`, `hide()` not `dispose()`, `GameCoordinator({ showStartMenu: false, onRetry, onExitToMenu })`.
- On-demand list now includes `PauseMenu`.
- Key files: `SessionSettings.ts` persist helpers; `src/ui/PauseMenu.ts`.

## Surfaces skipped (with reason)

| Surface | Reason |
|---|---|
| `docs/CODEMAPS/` / `scripts/codemaps/` | Neither exists; did not invent. |
| `.env.example` | File does not exist; no env-var change in this issue. |
| `docs/api.md` | No existing SessionSettings / PauseMenu / settlement contract section; would invent a new API surface. |
| `docs/conventions.md` | No session-loop content. |
| `docs/decisions/` | No ADR for this change. |
| `docs/README.md` | Index still lists the same files; no new doc page. |
| `TECHNICAL_DOCUMENTATION.md` | Dated 2026-03 snapshot; no pause/settlement section. Did not invent one or silently rewrite the 28/304 test line as if this issue owned that whole doc. |
| CHANGELOG `[2.2.1]` “GAME OVER” bullet | Released history; new behavior lives under Unreleased. |
| HUD chrome / lock-on / radar / mobile skin | Issues #5–#8; not this landing. |

## Result landings

Worktree docs:

- `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4/IMPLEMENTATION_PLAN.md`
- `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4/CHANGELOG.md`
- `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4/README.md`
- `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4/docs/architecture.md`

This record:

- `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/kaola-workflow/issue-4/.cache/doc-updater.md`
