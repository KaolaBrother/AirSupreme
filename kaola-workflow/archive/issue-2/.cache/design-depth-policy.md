evidence-binding: design-depth-policy 892fec2141b0

Root cause:
Three.js transparent sorting orders by renderOrder before camera-space depth. The terrain environment layers currently assign elevated renderOrder values to water/cloud/cirrus/haze/weather while most gameplay transparent VFX use renderOrder 0. Because both sides commonly use depthWrite false, environment layers drawn later can cover gameplay VFX even when the VFX object is spatially in front.

Implementation strategy:
Use one local policy within the frozen write set: transparent environment layers and scoped gameplay VFX participate in normal Three transparent depth sorting with renderOrder 0, depthTest true, and depthWrite false. Do not change renderer sorting, do not set broad transparent environment depthWrite true, and do not raise gameplay VFX renderOrder.

RED/GREEN test plan:
- Add src/__tests__/TransparentLayerDepth.test.ts before production changes.
- Assert buildWorldscapeWater returns renderOrder 0 with transparent material, depthTest true, depthWrite false.
- Assert CloudField group and instanced cloud meshes use renderOrder 0 with transparent material, depthTest true, depthWrite false.
- Assert representative TerrainGenerator transparent layers for lake/cloud/city water policy use renderOrder 0 and transparent materials keep depthTest enabled and depthWrite disabled.
- Assert ParticleSystem and TrailRenderer scoped VFX use renderOrder 0, depthTest enabled, depthWrite false.
Expected RED failures before implementation: water 2, clouds 6, cirrus 8, weather 10, haze 9, city/desert water overrides, ParticleSystem 20/21, TrailRenderer glow depthTest false/renderOrder -1.

File guidance:
- TerrainGenerator.ts: set TRANSPARENT_LAYER_RENDER_ORDER water/clouds/cirrus/haze/weather to 0; replace hardcoded haze/city pond/desert oasis render orders with policy values; name testable layers worldscapeCirrus, weatherParticles, cityParkPondWater, desertOasisWater where needed.
- worldscape/water.ts: set worldscape water mesh renderOrder to 0 while preserving transparent true, depthTest true, depthWrite false.
- worldscape/clouds.ts: default cloud render order 0, synchronized group and mesh renderOrder, preserve material depthTest true/depthWrite false.
- ParticleSystem.ts: set VFX_RENDER_ORDER shockwave/particle/debris to 0 and preserve depth-tested non-depth-writing materials.
- TrailRenderer.ts: set main and glow material depthTest true/depthWrite false, renderOrder 0; remove depthTest false behavior.

Risks:
Large transparent planes still rely on Three object-level sorting rather than per-pixel OIT. If residual angle-specific artifacts remain, route to a depth pre-pass/OIT design rather than renderOrder escalation. Avoid broadening assertions to unrelated ground overlay decals. If TerrainGenerator integration tests are heavy, keep assertions focused through a typed test harness rather than weakening the policy.

Validation commands:
- npx vitest run src/__tests__/TransparentLayerDepth.test.ts
- npx tsc --noEmit
- npm run lint
- npm run test:run
- npm run build
