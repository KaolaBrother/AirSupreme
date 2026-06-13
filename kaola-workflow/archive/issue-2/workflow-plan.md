# Workflow Plan — issue #2

<!-- plan_hash: 07b3c9a1c4ad3ecf3d0a6a405e79d1dd628752ded3ba59a058f96cffda158ab9 -->

## Meta
labels: workflow:in-progress

## Nodes

| id | role | depends_on | declared_write_set | cardinality | shape | model |
|---|---|---|---|---|---|---|
| explore-transparent-stack | code-explorer | — | — | 1 | sequence | sonnet |
| design-depth-policy | code-architect | explore-transparent-stack | — | 1 | sequence | opus |
| fix-transparent-depth | tdd-guide | design-depth-policy | src/features/terrain/TerrainGenerator.ts, src/features/terrain/worldscape/water.ts, src/features/terrain/worldscape/clouds.ts, src/features/effects/ParticleSystem.ts, src/features/effects/TrailRenderer.ts, src/__tests__/TransparentLayerDepth.test.ts | 1 | sequence | sonnet |
| review-depth-fix | code-reviewer | fix-transparent-depth | — | 1 | sequence | opus |
| update-plan-state | doc-updater | review-depth-fix | IMPLEMENTATION_PLAN.md | 1 | sequence | sonnet |
| finalize | finalize | update-plan-state | CHANGELOG.md | 1 | sequence | — |

## Node Ledger

| id | status |
|---|---|
| explore-transparent-stack | complete |
| design-depth-policy | complete |
| fix-transparent-depth | complete |
| review-depth-fix | complete |
| update-plan-state | complete |
| finalize | complete |

## Required Agent Compliance

| Requirement | Status | Evidence | Skip Reason |
|-------------|--------|----------|-------------|
| code-explorer (explore-transparent-stack) | subagent-invoked | evidence-binding: explore-transparent-stack bcc1df65601e | |

| code-architect (design-depth-policy) | subagent-invoked | evidence-binding: design-depth-policy 892fec2141b0 | |
| tdd-guide (fix-transparent-depth) | subagent-invoked | evidence-binding: fix-transparent-depth b040181ccc96 | |
| code-reviewer | subagent-invoked | evidence-binding: review-depth-fix 8a7b916ba7ac | |
| doc-updater (update-plan-state) | subagent-invoked | evidence-binding: update-plan-state 3e98ca8111ff | |
| finalize (finalize) | main-session-direct | evidence-binding: finalize ea847edbdf6f | |
## Planning Notes

- `fix-transparent-depth` must start RED with an automated render-strategy assertion covering at least two water-bearing levels and one high-cloud/obvious-cloud level. The assertion should prove environment transparent layers participate in normal spatial depth sorting instead of fixed late overlay ordering.
- Do not fix by globally raising gameplay VFX `renderOrder`. Objects in front of water/clouds should remain visible; objects behind water/clouds should remain occluded or attenuated by the environment layer.
- Include representative gameplay transparent effects in the test strategy: missile exhaust/glow, ordinary projectile glow/trails, boss projectile or particle embers, and the `BalloonPowerUp` billboard. Preserve `depthTest` against opaque terrain, buildings, bosses, and the player.
