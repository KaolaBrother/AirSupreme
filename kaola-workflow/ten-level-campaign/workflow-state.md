# Kaola-Workflow State

## Project
name: ten-level-campaign
status: active

## Current Position
phase: adaptive
workflow_path: adaptive
runtime: claude
main_session_role: orchestrator
step: session 2 — first wave lost to a container reclaim; round 1 re-dispatched (terrain, units, weapons, bosses-a, vfx)

## Selection
source: user directive (claude.ai project description) — no GitHub issue; all repo issues are closed
goal: see mission-list.md H1

## Sink
branch: workflow/ten-level-campaign
base: main @ 20845f9
sink: merge to main then push (explicitly requested by the user)
run_posture: per-batch git worktrees for parallel agents, serialized integration on the branch
width: rounds of ~5 agents (2 CPU / 7.8 GB box; 12-wide first wave stalled); agents commit after every milestone
backup: workflow branch pushed to origin at milestones (feature branch only; main untouched until final merge)

## Environment Notes
- npm registry blocked by egress allowlist → `npm install`, vitest, eslint plugins, vite native binaries unavailable
  (re-checked session 2: registry 403, npmmirror/jsdelivr/unpkg unreachable, node_modules natives are darwin-x64)
- GitHub GraphQL is blocked; use `gh api` REST for issues/PRs
- Validation substitutes: tsc (prod + shimmed tests), bun test vs recorded baseline, esbuild bundle, Prettier, headless Chromium screenshots
