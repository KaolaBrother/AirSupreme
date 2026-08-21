# Restore combat SFX (and stabilize BGM) by unlocking a shared AudioContext on the start/retry gesture

- item: Diagnose why shoot/hit/explosion SFX were gone while BGM was intermittent
  status: done
  dispatched: orchestrator read of AudioManager, MusicSystem, main.ts boot, GameCoordinator.startInternal
  result: Two AudioContexts; unlock after await import; beginSound required running and never resumed. MusicSystem.crossfadeTo retried resume, which matches intermittent BGM.

- item: Author failing tests for shared context, gesture unlock, and SFX resume-on-play
  status: done
  dispatched: tdd-guide; tests at src/__tests__/AudioUnlock.test.ts
  result: RED collection on missing @/core/Audio/AudioContextHost; IncomingWarning and StartMenu suites still passed.

- item: Implement shared AudioContextHost, StartMenu/main gesture unlock, beginSound resume
  status: done
  dispatched: implementer; production in AudioContextHost.ts, AudioManager.ts, MusicSystem.ts, StartMenu.ts, main.ts, GameCoordinator.ts
  result: 16 targeted tests green (AudioUnlock 12, IncomingWarning 1, StartMenu 3). tsc test-file cast routed back to tdd-guide.

- item: Fix AudioUnlock.test.ts TypeScript narrowing so tsc --noEmit passes
  status: done
  dispatched: tdd-guide only src/__tests__/AudioUnlock.test.ts
  result: captured[] snapshot; tsc clean.

- item: Full validation and documentation docking
  status: done
  dispatched: orchestrator validation; doc-updater on CHANGELOG / docs/architecture.md / docs/api.md
  result: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build` pass (40 files / 399 tests). Docs docked in this finalize.
