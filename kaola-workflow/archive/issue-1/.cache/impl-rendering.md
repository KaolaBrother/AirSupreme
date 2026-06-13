evidence-binding: impl-rendering 8695ecae0c39
RED: npx vitest run src/__tests__/MissileSystem.test.ts failed before implementation with expected missile trail intensity > 1 but received 1.
GREEN: npx vitest run src/__tests__/MissileSystem.test.ts passed after setting player missile trail intensity above neutral and tuning trail visibility.
GREEN: npx tsc --noEmit passed.
GREEN: npm run lint passed.
Summary: water/cloud/weather/VFX transparency now keeps depthWrite disabled with explicit depthTest/renderOrder policy; missile trails emit more frequently and use stronger trail intensity so paths stay visible against ocean and cloud backgrounds.
