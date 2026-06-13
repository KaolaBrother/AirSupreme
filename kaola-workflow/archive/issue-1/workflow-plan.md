# Workflow Plan - issue #1

<!-- plan_hash: 78f52062718e8224a33b69a86f9b9618a88e4810533cc32b0ce8754d27d1cc0d -->

## Meta
labels:

## Nodes

| id | role | depends_on | declared_write_set | cardinality | shape | model |
|----|------|------------|--------------------|-------------|-------|-------|
| explore | code-explorer | - | - | 1 | sequence | sonnet |
| plan | planner | explore | - | 1 | sequence | opus |
| impl-rendering | tdd-guide | plan | src/features/terrain/worldscape/water.ts, src/features/terrain/worldscape/clouds.ts, src/features/terrain/TerrainGenerator.ts, src/features/effects/ParticleSystem.ts, src/features/combat/MissileSystem.ts, src/__tests__/MissileSystem.test.ts | 1 | sequence | sonnet |
| impl-powerups | tdd-guide | impl-rendering | src/features/powerups/BalloonPowerUp.ts, src/features/powerups/PowerUpSystem.ts, src/features/effects/SpawnBalloon.ts, src/__tests__/PowerUpSystem.test.ts | 1 | sequence | sonnet |
| impl-ui-state | tdd-guide | impl-powerups | src/ui/StartMenu.ts, src/ui/HUD.ts, src/core/SessionSettings.ts, src/core/GameCoordinator.ts, src/__tests__/HUD.test.ts, src/__tests__/SessionSettings.test.ts | 1 | sequence | sonnet |
| review | code-reviewer | impl-rendering, impl-powerups, impl-ui-state | - | 1 | sequence | opus |
| security | security-reviewer | review | - | 1 | sequence | opus |
| finalize | finalize | security | CHANGELOG.md | 1 | sequence | - |

## Node Ledger

| id | status | evidence |
|----|--------|----------|
| explore | complete | - |
| plan | complete | - |
| impl-rendering | complete | - |
| impl-powerups | complete | - |
| impl-ui-state | complete | - |
| review | complete | - |
| security | complete | - |
| finalize | complete | - |

## Required Agent Compliance

| Requirement | Status | Evidence | Skip Reason |
|-------------|--------|----------|-------------|
| code-explorer (explore) | subagent-invoked | evidence-binding: explore 6f00e1e72c9d | |

| planner (plan) | subagent-invoked | evidence-binding: plan 929cee403627 | |
| tdd-guide (impl-rendering) | subagent-invoked | evidence-binding: impl-rendering 8695ecae0c39 | |
| tdd-guide (impl-powerups) | subagent-invoked | evidence-binding: impl-powerups 2ce6d4686878 | |
| tdd-guide (impl-ui-state) | subagent-invoked | evidence-binding: impl-ui-state 8e2f5402193f | |
| code-reviewer | subagent-invoked | evidence-binding: review d7aa26095680 | |
| security-reviewer | subagent-invoked | evidence-binding: security 84d49af453a9 | |
| finalize (finalize) | main-session-direct | evidence-binding: finalize d2b73c96f598 | |
## Compliance Ledger

| item | status | evidence |
|------|--------|----------|
| workflow-planner delegation | local-fallback-tool-unavailable | kaola-workflow/issue-1/.cache/workflow-planner-fallback.md |
