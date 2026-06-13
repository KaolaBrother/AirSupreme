evidence-binding: explore 6f00e1e72c9d
Role fallback: code-explorer executed locally because multi_agent_v1 workflow role dispatch was unavailable after clean-root stash.
Explored files:
- src/features/terrain/worldscape/water.ts: transparent ShaderMaterial lacks depthWrite false; renderOrder is 2.
- src/features/terrain/worldscape/clouds.ts: CloudField uses transparent depthWrite false material, renderOrder 6 per instanced mesh.
- src/features/terrain/TerrainGenerator.ts: owns cloud/cirrus/weather particle creation and render ordering integration.
- src/features/powerups/BalloonPowerUp.ts: icon is a child Mesh PlaneGeometry, so it inherits the rotating balloon group.
- src/features/powerups/PowerUpSystem.ts and src/features/effects/SpawnBalloon.ts: SpawnBalloon onComplete splices/disposes from inside callback while update also splices finished effects; SpawnBalloon progress/fade values are unclamped.
- src/features/combat/MissileSystem.ts and src/features/effects/ParticleSystem.ts: missile trail interval is 0.035; createMissileTrail controls smoke/flame/flare/spark visibility.
- src/core/SessionSettings.ts and src/ui/StartMenu.ts: testScore is capped at 5000 and UI options are 0/2000/3000/4000/5000.
- src/core/GameCoordinator.ts and src/core/GameState.ts: applyGameSettings adds testScore only to PlayerStats, not GameState/HUD score; final level completion calls hud.showGameOver.
- src/ui/HUD.ts: game-over overlay title is hardcoded GAME OVER and showGameOver has no victory variant.
Relevant tests exist for HUD and MissileSystem; no current SessionSettings or PowerUpSystem test file exists despite issue validation suggestions, so implementation should add focused tests where needed.
