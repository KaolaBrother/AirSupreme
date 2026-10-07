# Kaola-Workflow State

## Project
name: ten-level-campaign
status: active

## Current Position
phase: adaptive
workflow_path: adaptive
runtime: claude
main_session_role: orchestrator
step: round 1 merged (terrain, units, weapons, bosses-a; VFX partial with a composer regression) — run moving to the user's computer; next: fix VFX regression, then round 2

## Selection
source: user directive (claude.ai project description) — no GitHub issue; all repo issues are closed
goal: see mission-list.md H1

## Sink
branch: workflow/ten-level-campaign
base: main @ 20845f9
sink: merge to main then push (explicitly requested by the user)
run_posture: per-batch git worktrees for parallel agents, serialized integration on the branch
width: rounds of ~5 agents (cloud box was 2 CPU / 7.8 GB; 12-wide first wave stalled); agents commit after every milestone
backup: workflow branch pushed to origin at milestones (feature branch only; main untouched until final merge)
home: from session 2 (14:10 UTC) the git home is the user's local clone (Claude desktop app); local worktrees go
  under <repo-root>/.kw/worktrees/<project>/ per CLAUDE.md; keep local and origin in sync after each milestone
remote_branches: workflow/ten-level-campaign (integration), batch/audio, batch/progression, batch/story-ui (WIP)

## Environment Notes
- npm registry blocked by egress allowlist → `npm install`, vitest, eslint plugins, vite native binaries unavailable
  (re-checked session 2: registry 403, npmmirror/jsdelivr/unpkg unreachable, node_modules natives are darwin-x64)
- GitHub GraphQL is blocked; use `gh api` REST for issues/PRs
- Validation substitutes (cloud sandbox only): tsc (prod + shimmed tests), bun test vs recorded baseline, esbuild bundle, Prettier, headless Chromium screenshots
- On the user's computer npm works: run the real gates (`npm install`, `npx tsc --noEmit`, `npm run lint`,
  `npm run test:run`, `npm run build`) and check visuals in a real browser on a real GPU (`npm run dev`)
