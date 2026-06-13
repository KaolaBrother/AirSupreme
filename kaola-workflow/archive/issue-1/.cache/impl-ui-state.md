evidence-binding: impl-ui-state 824d9e1cf4f1
RED: npx vitest run src/__tests__/PresentationRuntimeLoader.test.ts failed before the repair because StartMenu.loadSettings called window.localStorage.getItem when getItem was not a function in the Vitest localStorage environment.
GREEN: npx vitest run src/__tests__/PresentationRuntimeLoader.test.ts passed after adding a defensive StartMenu storage guard.
GREEN: npx vitest run src/__tests__/SessionSettings.test.ts src/__tests__/HUD.test.ts src/__tests__/PresentationRuntimeLoader.test.ts passed.
GREEN: npx tsc --noEmit passed.
GREEN: npm run lint passed.
GREEN: npm run test:run passed with 31 test files and 315 tests.
Summary: StartMenu now skips load/save persistence when localStorage is absent, inaccessible, or missing Storage methods; score tiers, HUD mission completion, and GameCoordinator score sync remain green.
