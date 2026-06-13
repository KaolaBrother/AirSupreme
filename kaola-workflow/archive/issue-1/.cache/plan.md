evidence-binding: plan 929cee403627
Role fallback: planner executed locally because multi_agent_v1 workflow role dispatch is unavailable in the cleaned checkout.
Strategy:
1. Rendering lane: add named transparent render-order constants, set worldscape water depthWrite false, keep depthTest true, use explicit ordering for clouds/cirrus/weather, and increase missile trail readability only in MissileSystem/ParticleSystem. Add focused MissileSystem expectations for interval/intensity where practical.
2. Powerup lane: convert BalloonPowerUp icon plane to THREE.Sprite/SpriteMaterial while preserving canvas texture and balloon rotation; make PowerUpManager.update the single owner of SpawnBalloon effect removal/disposal; clamp SpawnBalloon progress/fade values. Add PowerUpSystem tests for concurrent spawn completion and cleanup.
3. UI/state lane: export shared start-score tiers/max from SessionSettings, update StartMenu options to 0/5000/10000/15000/20000, sync testScore into both PlayerStats and GameState/HUD, and split HUD failure vs completion overlay text. Add focused SessionSettings/HUD tests and targeted GameCoordinator or method-level coverage if feasible.
Risk controls:
- Keep all edits within declared write sets.
- Preserve respawn collection guard by not changing player collision gating outside current flow.
- Use existing Three.js import and object lifecycle conventions.
- Run focused tests before full tsc/lint/test/build validation.
