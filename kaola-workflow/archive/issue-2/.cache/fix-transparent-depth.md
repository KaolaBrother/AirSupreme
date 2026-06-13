evidence-binding: fix-transparent-depth b040181ccc96

RED:
Command: npx vitest run src/__tests__/TransparentLayerDepth.test.ts
Pre-implementation failing signature from the TDD worker after adding the test first:
- expected 2 to be +0 for worldscape water renderOrder.
- Expected scene object named worldscapeCirrus: expected undefined to be defined.
- expected 20 to be +0 for gameplay VFX renderOrder.

GREEN:
Command: npx vitest run src/__tests__/TransparentLayerDepth.test.ts
Main-session verification result: PASS, 1 test file passed, 3 tests passed. jsdom emitted HTMLCanvasElement.getContext not-implemented warnings, but assertions passed.
Additional worker validation: npx vitest run src/__tests__/ParticleSystem.test.ts passed; npx tsc --noEmit passed.

Files changed:
- src/__tests__/TransparentLayerDepth.test.ts added focused render strategy assertions.
- src/features/terrain/TerrainGenerator.ts sets water/cloud/cirrus/haze/weather transparent layer policy to renderOrder 0, replaces hardcoded haze/city/desert water render orders with the policy, and names testable transparent layers.
- src/features/terrain/worldscape/water.ts sets worldscape water mesh renderOrder to 0 while keeping transparent true, depthTest true, depthWrite false.
- src/features/terrain/worldscape/clouds.ts defaults cloud renderOrder to 0 while keeping group and mesh order synchronized.
- src/features/effects/ParticleSystem.ts sets shockwave/particle/debris renderOrder policy to 0.
- src/features/effects/TrailRenderer.ts keeps both trail lines depth-tested, non-depth-writing, and renderOrder 0.

Review note:
The implemented policy does not globally raise gameplay VFX renderOrder and does not enable depthWrite on broad transparent environment layers. Unrelated positive renderOrder terrain decals remain outside the scoped transparent water/cloud/VFX policy.
