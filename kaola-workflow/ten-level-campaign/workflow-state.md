# Kaola-Workflow State

## Project
name: ten-level-campaign
status: active

## Current Position
phase: adaptive
workflow_path: adaptive
runtime: claude
main_session_role: orchestrator
step: foundation landed; dispatching parallel implementation batches

## Selection
source: user directive (claude.ai project description) — no GitHub issue; all repo issues are closed
goal: see mission-list.md H1

## Sink
branch: workflow/ten-level-campaign
base: main @ 20845f9
sink: merge to main then push (explicitly requested by the user)
run_posture: per-batch git worktrees for parallel agents, serialized integration on the branch

## Environment Notes
- npm registry blocked by egress allowlist → `npm install`, vitest, eslint plugins, vite native binaries unavailable
- Validation substitutes: tsc (prod + shimmed tests), bun test vs recorded baseline, esbuild bundle, Prettier, headless Chromium screenshots
