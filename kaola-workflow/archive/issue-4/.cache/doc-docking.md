# Documentation docking — issue-4

verdict: DOCKED

## Changed files reviewed

Production:
- `src/main.ts` — page-lifetime StartMenu hide/not dispose; retry/exit callbacks
- `src/core/SessionSettings.ts` — START_MENU_STORAGE_KEY, load/save merge-then-normalize
- `src/ui/StartMenu.ts` — persist via SessionSettings; reloadFromStorage; show reloads
- `src/ui/PauseMenu.ts` — new pause cabin
- `src/ui/HUD.ts` — MISSION FAILED / MISSION COMPLETE + settlement buttons
- `src/ui/UpgradeMenu.ts` — dispose then show is no-op
- `src/core/GameCoordinator.ts` — PauseMenu, pause/resume engine, settlement actions, upgrade race guards
- `src/core/Input/InputHandler.ts` — dispose; mobile #upgrade-button → pause

Tests:
- `src/__tests__/SessionSettings.test.ts`, `HUD.test.ts`, `PauseMenu.test.ts`, `UpgradeMenu.test.ts`

Docs:
- `IMPLEMENTATION_PLAN.md`, `CHANGELOG.md` Unreleased, `README.md` settlement copy, `docs/architecture.md` session shell

## Documents checked

| Surface | Result |
|---|---|
| README.md | Updated: settlement titles and PauseMenu in tree |
| CHANGELOG.md | Unreleased session-loop 1/5 section; did not rewrite historical 2.2.1 GAME OVER line |
| IMPLEMENTATION_PLAN.md | 1/5 done; A4 HUD-language still later; D3 pause cabin wording updated |
| docs/architecture.md | StartMenu hide-not-dispose, PauseMenu, SessionSettings persist |
| docs/api.md | no-impact — no EventBus/config contract change |
| docs/conventions.md | no-impact |
| docs/decisions/ | no-impact |
| TECHNICAL_DOCUMENTATION.md | no-impact — no pause/settlement section existed to contradict |
| .env.example | absent |

## Gaps found and fixed

None remaining after doc-updater. A4 “最终统一 HUD 与关卡视觉语言” left `[later]` (issues #5–#8).

## No-impact reasons

- Lock-on, radar, start-menu skin, mobile candy restyle, briefing copy were out of scope (#5–#8).
- No public npm API / schema / env contract changed.

## Verdict

DOCKED
