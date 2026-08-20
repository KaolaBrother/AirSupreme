# tdd-at-fix evidence

Worktree: `/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4`
Branch: `workflow/issue-4`
Baseline SHA: `9d5ba103fcf15f0d9bb1903ae61930a04b572e76`
Date: 2026-08-20

## Change

File only: `src/__tests__/PauseMenu.test.ts`

Replaced ES2022 `Array.prototype.at(-1)` with ES2020-safe last-index access
`mock.calls[mock.calls.length - 1]` (and the equivalent optional last-call form).
Assertion intent unchanged.

Sites:

- `applyAudio.mock.calls[applyAudio.mock.calls.length - 1]` (destructure last `[sfx, music]`)
- `saveSettings.mock.calls[saveSettings.mock.calls.length - 1]?.[0]` (last saved partial)
- `applyAudio.mock.calls[applyAudio.mock.calls.length - 1]?.[0]` / `?.[1]` (clamp checks)

No production files were modified for this fix.

## `npx tsc --noEmit`

Command run from worktree.

Exit: `0`

Stdout/stderr: empty (clean). The prior `TS2550` errors on
`src/__tests__/PauseMenu.test.ts` lines 214, 218, 223, 238, 240 (`Property 'at'
does not exist on type 'any[][]'`) are gone. No other `tsc` errors.

## `npx vitest run src/__tests__/PauseMenu.test.ts src/__tests__/HUD.test.ts src/__tests__/SessionSettings.test.ts`

```
RUN  v3.2.4 /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/issue-4

 ✓ src/__tests__/SessionSettings.test.ts (10 tests) 4ms
 ✓ src/__tests__/PauseMenu.test.ts (7 tests) 96ms
 ✓ src/__tests__/HUD.test.ts (7 tests) 134ms

 Test Files  3 passed (3)
      Tests  24 passed (24)
   Start at  19:31:11
   Duration  574ms (transform 72ms, setup 25ms, collect 88ms, tests 234ms, environment 501ms, prepare 123ms)
```

Exit: `0`

PauseMenu tests still pass (7/7). HUD (7/7) and SessionSettings (10/10) also pass.

## Verdict

- `npx tsc --noEmit`: clean
- PauseMenu `.at` TS2550 errors: gone
- PauseMenu tests: pass
