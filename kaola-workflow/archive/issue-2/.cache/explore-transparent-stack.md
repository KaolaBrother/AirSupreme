evidence-binding: explore-transparent-stack bcc1df65601e

Findings:
- src/scenes/GameScene.ts: renderer is standard THREE.WebGLRenderer; one renderer.render(scene, camera). No custom transparent pass or sortObjects override found.
- src/features/terrain/TerrainGenerator.ts defines TRANSPARENT_LAYER_RENDER_ORDER with water 2, clouds 6, cirrus 8, haze 9, weather 10.
- src/features/terrain/worldscape/water.ts builds transparent water with depthWrite false, depthTest true, renderOrder 2.
- src/features/terrain/worldscape/clouds.ts sets cloud group and instanced meshes to renderOrder 6 with transparent material, depthWrite false, depthTest true.
- TerrainGenerator creates cirrus, weather particles, and haze with transparent materials, depthWrite false, depthTest true or implicit true, and render orders 8, 10, and 9.
- ProjectilePool and BossProjectilePool projectile glow/trail/ember surfaces are transparent with depthWrite false and default renderOrder 0.
- MissileSystem and BossMissileSystem flame/glow materials are additive transparent with depthWrite false and no explicit renderOrder.
- BalloonPowerUp icon billboard is a transparent sprite with depthWrite false, depthTest true, and no explicit renderOrder.
- ParticleSystem already uses high VFX renderOrder 20/21 and may already bypass spatial ordering for some particles.
- TrailRenderer glow line has depthTest false and renderOrder -1; ParticleTrailRenderer sprite trails use default renderOrder with depthTest true.

Likely root cause:
Three.js transparent sorting considers renderOrder before normal transparent depth sorting. Environment transparent layers have positive render orders while most gameplay transparent VFX stay at default 0. Because both sides typically use depthWrite false, environment layers forced later in the transparent queue can draw over gameplay transparent objects even when the gameplay object is spatially in front. This matches water/cloud occluding missile flames, projectile glows/trails, boss projectile embers, and BalloonPowerUp billboards.

Tests to add:
- A focused transparent-layer depth policy test asserting water/cloud/cirrus/weather/haze do not outrank normal gameplay transparent objects via fixed late overlay ordering.
- Assert buildWorldscapeWater keeps transparent true, depthTest true, depthWrite false, and the selected renderOrder policy.
- Assert CloudField group/instanced meshes follow the selected renderOrder/material policy.
- Regression coverage for representative gameplay transparent effects keeping depthTest against opaque terrain/buildings/Boss/player and not receiving blanket high renderOrder.

Implementation risks and boundaries:
- Environment-owned files in the frozen write set: TerrainGenerator.ts, worldscape/water.ts, worldscape/clouds.ts.
- Gameplay VFX-owned files in the frozen write set: ParticleSystem.ts and TrailRenderer.ts; other gameplay files are useful for read-only comparison but not in the implementation write set.
- Do not fix by globally raising gameplay VFX renderOrder; that reverses the same bug.
- Do not broadly set depthWrite true on large transparent environment layers; that risks hard transparent self-occlusion artifacts.
- Haze/weather/cirrus should be considered along with water/cloud to avoid a partial transparent-stack fix.
- There is no existing pixel/visual regression test for true camera-space transparent occlusion; structural policy tests are the practical automated guard.
