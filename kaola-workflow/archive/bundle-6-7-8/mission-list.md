# Land radar/chevrons/shield, briefing/respawn, and shell chrome for #6 #7 #8

- item: Desktop and touch radars plus one offscreen chevron set, incoming warning with minInterval, and a non-cyan shield; comment voids "no mobile radar" — three layout tiers, 72px/64px above the stick.
  status: in-flight
  dispatched: tdd-guide (standard tier) to author failing tests in src/__tests__/RadarMinimap.test.ts, src/__tests__/OffscreenChevron.test.ts, and shield/incoming asserts (PlayerSystem.test.ts shield visual + AudioManager incoming if a new src/__tests__/IncomingWarning.test.ts) in worktree /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/bundle-6-7-8

- item: HUD.showBriefing with the issue 1–5 关 and Boss titles, and LIFE × N respawn overlay on non-game-over death.
  status: in-flight
  dispatched: tdd-guide (standard tier) to extend src/__tests__/HUD.test.ts with briefing/respawn in worktree /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/bundle-6-7-8

- item: Start/load/upgrade/mobile shell on --hud-* tokens: no Material #4CAF50 capsules, no ✈️🎮👹 title chrome, StartMenu min-width 400px gone, viewport-fit=cover kept.
  status: in-flight
  dispatched: tdd-guide (standard tier) to author src/__tests__/StartMenu.test.ts and extend src/__tests__/UpgradeMenu.test.ts plus siteChrome index.html mobile deck if needed in worktree /Volumes/WorkspaceA/ylminiserver/workspace/airsupreme/.kw/worktrees/bundle-6-7-8
