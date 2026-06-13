evidence-binding: update-plan-state 3e98ca8111ff

Files changed:
- IMPLEMENTATION_PLAN.md

Summary:
Updated the implementation plan date to 2026-06-13 and recorded issue #2 transparent depth sorting work as complete. The plan now notes that water/cloud/cirrus/haze/weather and scoped gameplay VFX/trails use normal transparent depth sorting with renderOrder 0, depthTest enabled, and depthWrite disabled, plus the new TransparentLayerDepth.test.ts coverage.
