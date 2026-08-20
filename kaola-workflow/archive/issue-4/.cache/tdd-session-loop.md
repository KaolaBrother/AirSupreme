# TDD session-loop evidence (issue #4)

Role: tdd-guide (tests only; no production code).
Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Baseline commit (worktree HEAD, actually run against): `9d5ba103fcf15f0d9bb1903ae61930a04b572e76`
Branch: `workflow/issue-4`

## Test paths written

- `src/__tests__/SessionSettings.test.ts` — extended (existing test-score tests kept)
- `src/__tests__/HUD.test.ts` — settlement assertions added; lives/missiles tests unchanged
- `src/__tests__/PauseMenu.test.ts` — new

## Exact public APIs the tests import / pin

Implementer must match these names and signatures. Tests assert against the subject
(`SessionSettings` module, `HUD`, `PauseMenu`), not mocks of those subjects.
Collaborator callbacks on `PauseMenu` / HUD settlement are injected fakes.

### `src/core/SessionSettings.ts`

```ts
export const START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings';

export function loadStartFlowSettings(): StartFlowSettings;

export function saveStartFlowSettings(
  settings?: Partial<StartFlowSettings>,
): void;
```

Behavior pinned:

- Use existing `normalizeStartFlowSettings` on load and save.
- Round-trip `sfxVolume` / `musicVolume` / `qualityPreset` through `localStorage`
  at `START_MENU_STORAGE_KEY`.
- `sfxVolume: 0` / `musicVolume: 0` must survive (do not treat 0 as missing).
- Partial save **merges** with previously stored start-flow fields so a pause
  audio write cannot reset difficulty / lives / startLevel / gameMode / testScore.
- Empty storage → `DEFAULT_START_FLOW_SETTINGS`.
- Dirty JSON (unknown `qualityPreset`, `testScore: 25000`) is normalized
  (`auto`, `20000`) rather than crashing or storing raw junk.
- Corrupt JSON: `loadStartFlowSettings()` does not throw, returns defaults,
  and **removes** the bad key (current StartMenu behavior).
- `localStorage.getItem` throwing (private mode): load does not throw; returns defaults.

Existing test-score clamp `0 / 5000 / 10000 / 15000 / 20000` remains asserted
via `TEST_SCORE_OPTIONS` and `normalizeStartFlowSettings`.

Tests access the new exports through a namespace import so the two pre-existing
test-score cases still collect if the new symbols are missing.

### `src/ui/HUD.ts`

Existing methods still used:

```ts
class HUD {
  showMissionComplete(finalScore: number): void; // #game-over-title === 'MISSION COMPLETE'
  showGameOver(finalScore: number): void;        // #game-over-title === 'MISSION FAILED'
  hideGameOver(): void;
  dispose(): void;
}
```

New public hook the tests call:

```ts
type SettlementActions = {
  onRetry: () => void;
  onExitToMenu: () => void;
};

class HUD {
  setSettlementActions(actions: SettlementActions): void;
}
```

Settlement UI pinned:

- Primary `#game-over-title` after `showGameOver` is exactly `MISSION FAILED`
  (not `GAME OVER`). A subtitle `GAME OVER` is allowed **outside** `#game-over-title`.
- `showMissionComplete` title remains `MISSION COMPLETE` (must not become
  `GAME OVER` or `MISSION FAILED`).
- Both overlays expose two `<button>`s labeled **再来一局** and **返回菜单**.
- Clicks invoke the callbacks registered via `setSettlementActions`.
- Buttons are clickable: `pointer-events` is not `none`; not `disabled`.
- Touch: button `min-height` / height ≥ `48px` (computed, inline, or CSS text).
- Panel width equivalent to `min(360px, 100% - 32px)` or
  `max-width: 360px` + `calc(100% - 32px)`.
- Settlement CSS includes `env(safe-area-inset-*)`.

Lives ❤️ cap and missiles 🚀 cap tests were not restyled.

### `src/ui/PauseMenu.ts` (file does not exist on baseline)

```ts
import type { QualityPreset } from '@/config';
import type { StartFlowSettings } from '@/core/SessionSettings';

interface IPauseMenuOptions {
  onContinue: () => void;
  onUpgrade: () => void;
  onExitToMenu: () => void; // called only after confirm 确定
  applyAudio: (sfx: number, music: number) => void;
  applyQuality: (preset: QualityPreset) => void;
  loadSettings: () => StartFlowSettings;
  saveSettings: (partial: Partial<StartFlowSettings>) => void;
}

export class PauseMenu {
  constructor(options: IPauseMenuOptions);
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}
```

Preferred overlay id: `#pause-menu` (matches `#start-menu` / `#upgrade-menu`).
`hide()` / `dispose()` tests look for that id, then for leftover **继续** buttons.

Behavior pinned:

- Default view four buttons: **继续** / **升级** / **设置** / **返回菜单**.
  继续 → `onContinue`; 升级 → `onUpgrade`. Confirm copy is not visible yet.
- Overlay `z-index: 200` (covers mobile controls at 100).
- Settings view: 音效 / 音乐 / 画质 only. Must not contain
  `难度` / `生命` / `起始关卡` / `游戏模式` / `测试分数`.
- Settings `+` / `-` apply immediately via `applyAudio` / `applyQuality` and
  persist via `saveSettings`. Volume step `0.1`, clamp `[0, 1]`.
  Quality order `auto → performance → balanced → quality`, wrapping
  (auto `-` → `quality`), matching StartMenu.
- **返回菜单** opens confirm with exact copy
  `返回主菜单？当前进度将丢失。` plus **取消** / **确定**.
  取消 does not call `onExitToMenu`; 确定 does, once.
- Touch: those buttons (and confirm) `min-height` ≥ 48px; `pointer-events` not `none`.
- Panel width equivalent to `min(360px, 100% - 32px)`.
- CSS includes all four `env(safe-area-inset-top|right|bottom|left)`.
- `hide()` → `isVisible() === false` and overlay hidden or removed.
- `dispose()` removes `#pause-menu` / 继续 buttons from the document.

## Command run

From the worktree:

```bash
npx vitest run src/__tests__/HUD.test.ts src/__tests__/SessionSettings.test.ts src/__tests__/PauseMenu.test.ts
```

Vitest v3.2.4. Result: 3 files failed, 13 tests failed, 4 passed.

## Failure signatures (verbatim)

```
RED: SessionSettings > start-flow persist > exports START_MENU_STORAGE_KEY as air-supreme:start-menu-settings
AssertionError: expected undefined to be 'air-supreme:start-menu-settings'
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: SessionSettings > start-flow persist > returns defaults when storage is empty
AssertionError: expected undefined to be 'air-supreme:start-menu-settings'
(persistApi gate — loadStartFlowSettings / saveStartFlowSettings also absent)
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: HUD > shows mission completion without reusing the game over title
AssertionError: expected 'GAME OVER' to be 'MISSION FAILED'
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: HUD > keeps GAME OVER out of the primary failure title
AssertionError: expected 'GAME OVER' to be 'MISSION FAILED'
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: HUD > wires 再来一局 and 返回菜单 to HUD settlement callbacks
AssertionError: expected 'undefined' to be 'function'
(setSettlementActions missing; buttons therefore not present)
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: HUD > shows the same settlement actions after mission complete
TypeError: settlementHud(...).setSettlementActions is not a function
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: HUD > sizes settlement actions for touch and keeps a narrow panel width
TypeError: settlementHud(...).setSettlementActions is not a function
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76

RED: src/__tests__/PauseMenu.test.ts [suite]
Error: Failed to resolve import "@/ui/PauseMenu" from "src/__tests__/PauseMenu.test.ts". Does the file exist?
baseline: 9d5ba103fcf15f0d9bb1903ae61930a04b572e76
```

Full suite header from the run:

```
 FAIL  src/__tests__/PauseMenu.test.ts [ src/__tests__/PauseMenu.test.ts ]
Error: Failed to resolve import "@/ui/PauseMenu" from "src/__tests__/PauseMenu.test.ts". Does the file exist?
  Plugin: vite:import-analysis
  File: /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4/src/__tests__/PauseMenu.test.ts:4:26
  3  |  import { PauseMenu } from "@/ui/PauseMenu";
     |                             ^

 Test Files  3 failed (3)
      Tests  13 failed | 4 passed (17)
```

PauseMenu case tests (four default buttons, z-index 200, settings-only slice,
StartMenu stepping, confirm copy, touch/safe-area, hide/dispose) did not run
because the module is missing — that import failure **is** the baseline oracle
for the new file.

## Existing tests that still pass

```
✓ SessionSettings > uses the configured test score tiers up to 20000
✓ SessionSettings > clamps oversized test score values to the highest tier
✓ HUD > caps lives to 5 hearts when lives exceed the limit
✓ HUD > renders missile icons without exceeding GAME_CONSTANTS.MISSILE.MAX_MISSILES
```

`showMissionComplete` still asserts `MISSION COMPLETE` before the updated
failure-title assertion; that first expect passed on HEAD.

## Gaps not pinned (do not invent coordinator/main tests)

These are issue #4 acceptance items that these three files cannot honestly
falsify without constructing `GameCoordinator` / `main.ts`:

- **Game-over ignores ESC/P.** `pauseGame` must no-op when status is GAME_OVER.
  That is coordinator input wiring, not HUD/PauseMenu. Manual / later
  coordinator test.
- **`main.ts` hide-not-dispose session shell.** Keep the StartMenu instance,
  `hide()` on start, dispose old coordinator before `new GameCoordinator({ showStartMenu: false }).boot(settings)`,
  `onRetry` re-boots `lastSettings`, `onExitToMenu` disposes coordinator and
  StartMenu reload+show. Not pinned here.
- Duplicate canvas / `#hud` on retry (must `coordinator.dispose()` first).
- `InputHandler` listener leak on retry (no dispose today).
- Pause audio: `stopEngine()` on pause / `startEngine()` on continue.
- U-key path: pause first, then open UpgradeMenu (avoid sim running under shop).
- ESC/P while PauseMenu default view = continue; while confirm = cancel.
  Owner is ambiguous (PauseMenu vs coordinator); not frozen into the suite.
- UpgradeMenu text remains `▶ 返回战斗`; pause default uses **继续**. Wiring
  “continue from upgrade closes pause” is coordinator integration.
- Mobile `#upgrade-button` opening PauseMenu instead of the shop directly.

## Oracle note

No new test passed on HEAD except the four pre-existing cases listed above.
Failures are missing persist API, `GAME OVER` instead of `MISSION FAILED`,
missing `setSettlementActions` / settlement buttons, and missing `PauseMenu`.
