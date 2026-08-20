# Close lake-crash death, favicon 404, and avionics HUD chrome for #10 #11 #5

- item: Make a dive that reaches the live water or terrain surface emit PLAYER_DEATH on PlayerSystem.update so last-life can settle; re-measured at HEAD d34a6c7: GROUND_COLLISION_Y is still -45, WORLDSCAPE_WATER_Y is still -48, PlayerController has a ceiling and no floor.
  status: done
  dispatched: implementer (standard tier) after tdd-guide tests landed at src/__tests__/PlayerSystem.test.ts (RED: missing WORLDSCAPE_WATER_Y export, missing setCrashSurfaceSampler, Y at water does not die). Production to land in worktree src/core/systems/PlayerSystem.ts, src/features/terrain/TerrainGenerator.ts, src/features/levels/LevelManager.ts, src/core/GameCoordinator.ts (sampler wire only).
  result: WORLDSCAPE_WATER_Y exported; PlayerSystem.setCrashSurfaceSampler + Y<=surface kill; LevelManager/GameCoordinator wire terrain sample. npx vitest run src/__tests__/PlayerSystem.test.ts — 11 passed. Log: {scratch}/impl-10.log

- item: Cold-load the shipped page with a declared, served site icon (no 404) and viewport-fit=cover.
  status: done
  dispatched: implementer (standard tier) after tdd-guide tests landed at src/__tests__/siteChrome.test.ts (RED: no rel=icon, no viewport-fit=cover). Production to land in worktree index.html and public/favicon.svg.
  result: index.html declares /favicon.svg with viewport-fit=cover; public/favicon.svg is a non-empty SVG pipper. npx vitest run src/__tests__/siteChrome.test.ts — 3 passed. Log: {scratch}/impl-11.log

- item: Replace HUD emoji chrome and the filled lock disk with shared --hud-* tokens, life/missile pips, and SEARCH/TRACK/LOCK/BREAK/DRY hollow-ring states (comments win: three layout tiers desktop|touch-landscape|touch-portrait; LOCK mint not #00ff00; DRY is NO MSL not center NO MISSILE).
  status: done
  dispatched: implementer (standard tier) after tdd-guide tests RED (12 failed / 5 passed). Production to land in worktree src/ui/theme/hudTokens.ts, src/ui/HUD.ts, src/ui/LockOnIndicator.ts, src/ui/PauseMenu.ts (tokens only), src/core/PresentationController.ts, src/core/Audio/AudioManager.ts, src/core/GameCoordinator.ts (lock audio only; keep existing crash sampler).
  result: Tokens, pips, three layout densities, hollow SEARCH/LOCK mint/BREAK/DRY NO MSL landed. npx vitest run HUD+LockOn+PlayerSystem+PauseMenu+siteChrome — 38 passed. Log: {scratch}/impl-5.log
