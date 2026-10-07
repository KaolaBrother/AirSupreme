# Kaola-Workflow State

## Project
name: ten-level-campaign
status: active

## Current Position
phase: adaptive
workflow_path: adaptive
runtime: claude
main_session_role: orchestrator
step: session 3 — fixing the VFX composer regression and making the real gates runnable; next: round 2

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
home: session 3 — the git home is the cloud clone /home/claude/airsupreme (pushes to origin); worktrees under
  /home/claude/wt/<name>. The user's local clone (/Volumes/WorkspaceA/ylminiserver/workspace/airsupreme, reached
  through the device bridge, which has no GitHub/npm route) is synced after each milestone by a git bundle →
  `git fetch <bundle> refs/remotes/origin/*` → fast-forward; never touch the user's uncommitted
  node_modules/.vite/deps edits or untracked .claude/
remote_branches: workflow/ten-level-campaign (integration), batch/audio, batch/progression, batch/story-ui (WIP)

## Environment Notes
- npm registry blocked by egress allowlist → `npm install`, vitest, eslint plugins, vite native binaries unavailable
  (re-checked session 2: registry 403, npmmirror/jsdelivr/unpkg unreachable, node_modules natives are darwin-x64)
- GitHub GraphQL is blocked; use `gh api` REST for issues/PRs
- Validation substitutes (cloud sandbox only): tsc (prod + shimmed tests), bun test vs recorded baseline, esbuild bundle, Prettier, headless Chromium screenshots
- Session 3 correction: the Claude desktop app's sandbox shell on the user's Mac is a Linux VM with loopback only
  (no npm, no GitHub), Terminal is click-only for computer use, and the user cannot run npm. Real gates therefore
  run in the cloud on a copy of the user's installed node_modules at /home/claude/node_modules (eslint 9.39.2,
  vitest 3.2.4, jsdom 27, typescript 5.9.3, vite 5.4.21, rollup 4.57.1, esbuild 0.21.5 JS). Linux natives are
  stood in: esbuild via /home/claude/harness/esbuild-shim.sh (sandbox esbuild 0.28.2), Rollup via a JS stand-in.
  Real-GPU checks: publish the built game as a private artifact and open it in the user's Claude browser pane.
