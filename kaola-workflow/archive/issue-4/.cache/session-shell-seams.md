# Session-shell seams (issue #4)

Source: code-explorer on `.kw/worktrees/issue-4`. Facts about **current** code, not desired APIs.
Comments on GitHub #4 override the issue body for touch layout.

## Missing today

- `src/ui/PauseMenu.ts` does not exist.
- `onRetry` / `onExitToMenu` do not exist.
- `SessionSettings` has no storage key, no `loadStartFlowSettings`, no `saveStartFlowSettings`.
- Pause is UpgradeMenu. ESC/P/U are identical toggles.
- HUD settlement has no buttons; title is `GAME OVER` / `MISSION COMPLETE`.
- `pauseGame` has no game-over guard (update() bails because `!isPlaying()`).
- Pause does not stop/start engine.
- `InputHandler` has no dispose; retry would stack window listeners.
- Mobile has `#upgrade-button` labeled 升级; no pause button. z-index 100.

## `src/main.ts`

- Constructs `StartMenu`, `setOnStart`.
- On start: show loading “正在进入战场”, dynamic import GameCoordinator, **`startMenu.dispose()`**, `new GameCoordinator({ showStartMenu: false }).boot(settings)`.
- `game` typed `{ dispose: () => void }`.
- `beforeunload` → `game?.dispose()`. No retry/exit.

## `src/core/SessionSettings.ts`

Exports: `GameMode`, `AudioSettings`, `PresentationSettings`, `StartFlowSettings`, `SessionSettingsSnapshot`, `DEFAULT_START_FLOW_SETTINGS`, `TEST_SCORE_OPTIONS`, `MAX_TEST_SCORE`, `normalizeStartFlowSettings`, `getAudioSettings`, `getPresentationSettings`, `createSessionSettingsSnapshot`.

Storage lives privately on StartMenu: `private static readonly STORAGE_KEY = 'air-supreme:start-menu-settings'`.

Tests only cover test-score normalize/clamp.

## `src/ui/StartMenu.ts`

- Private `loadSettings` / `saveSettings` / `getStorage`.
- Public: constructor, `setOnStart`, `show` (display flex, **does not reload storage**), `hide`, `dispose`.
- Volume/quality stored and persisted; **not applied to AudioManager/GameConfig from StartMenu**. Runtime apply is `GameCoordinator.applyGameSettings`.
- Settings rows include difficulty/lives/level/mode/testScore — pause settings must NOT include those.

## `src/core/GameCoordinator.ts`

Unexported `interface GameCoordinatorOptions { showStartMenu?: boolean }`. Default true would create a second StartMenu — keep false.

Public: `warmRuntimeChunks`, constructor, `boot(settings)`, `start()`, `setQualityPreset`, `stop`, `dispose`.

Private `pauseGame` always `ensureUpgradeMenu().show()`. Private `resumeGame` hides upgrade menu.

Quality: `setQualityPreset` → GameConfig + session + GameLoop + GameScene.applyQualitySettings.

Dispose does not remove InputHandler listeners. GameLoop.start no-ops if already running; game-over does not stop the loop.

PLAYER_DEATH lives≤0: `setGameOver`, `stopEngine`, `playGameOver`, `stopMusic`, `hud.showGameOver`.
handleBossDestroy nextLevel>5: `setGameOver`, `stopMusic`, `hud.showMissionComplete` (engine not explicitly stopped).

## `src/ui/HUD.ts`

- Overlay z-index 100; entire overlay `pointer-events: auto` when shown.
- IDs: `#game-over-title`, `#final-score`.
- `showGameOver` title `GAME OVER` color `#ff3333`.
- `showMissionComplete` title `MISSION COMPLETE` color `#66ffcc`.
- No buttons. `dispose` removes overlay.

HUD tests: lives ❤️ cap, missiles 🚀 cap, mission complete vs GAME OVER. Do **not** restyle lives/missiles chrome in this issue (later #5). Settlement tests must change GAME OVER → MISSION FAILED and add buttons.

## `src/ui/UpgradeMenu.ts`

- Constructor `(upgrades, onUpgrade, onResume)`.
- Continue button `.resume-btn` text `▶ 返回战斗` (not 继续作战).
- z-index 999. onResume already wired to `resumeGame()`.

## Input / audio / session

- ESC/KeyP → pausePressed; KeyU → upgradePressed; mobile `#upgrade-button` → upgradePressed.
- `audioManager.startEngine` / `stopEngine` / `setSFXVolume` / `setMusicVolume`. No pause-duck API; SFX-hit duck only.
- `GameSessionState`: `paused` boolean + `status` PLAYING/GAME_OVER. `GameStatus.PAUSED` unused.

## Z-index (current)

Lock-on 40, HUD 50, damage 70, power-up 80, game-over 100, mobile 100, **PauseMenu desired 200**, upgrade 999, start/loading 1000.

## Duplicate HUD / canvas on retry

Must `coordinator.dispose()` before `new GameCoordinator`. Each constructor appends a canvas; each `hud.init()` appends `#hud`. Keep `showStartMenu: false` so dispose does not kill main’s StartMenu.

## Must-not-touch this issue

Lock-on, radar, start-menu skin, mobile candy restyle, difficulty/lives/level/mode/testScore in pause, AutoAimSystem, boss/wave internals besides settlement overlay call.
