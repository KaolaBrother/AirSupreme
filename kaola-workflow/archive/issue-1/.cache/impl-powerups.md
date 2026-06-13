evidence-binding: impl-powerups 2f1601036db1
RED: code review found PowerUpSystem.test used vi.restoreAllMocks in afterEach, an overbroad cleanup pattern for shared Vitest workers because it can restore unrelated spies outside this test file.
GREEN: npx vitest run src/__tests__/PowerUpSystem.test.ts passed after replacing global restoreAllMocks with tracked per-spy mockRestore cleanup.
GREEN: npx tsc --noEmit passed.
GREEN: npm run lint passed.
Summary: PowerUpSystem.test now restores only the canvas and SpawnBalloon spies it creates. A separate PresentationRuntimeLoader localStorage failure reproduces in isolation and remains for the UI-state lane.
