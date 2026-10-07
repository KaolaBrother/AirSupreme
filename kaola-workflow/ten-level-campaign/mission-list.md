# Upgrade Air Supreme into a 10-level story campaign with new units, weapons, bosses, camera modes, autosave, progressive upgrades, and full VFX/audio overhaul

Source of truth: claude.ai project "Air supreme 3D Game" description (user's standing requirements):
R1 tremendous visual updates · R2 gameplay/mechanism improvements · R3/R9 ten levels with a complete story ·
R4 music + SFX improvements · R5 first/third-person switch · R6 more ground/sea/air units (neutral/hostile/friendly,
distinct behaviours) · R7 more weapons · R8 better VFX everywhere · R10 creative bosses for new levels ·
R11 mid-game autosave · R12 upgrades progressive with difficulty per level.

Sandbox facts: npm registry is blocked by the egress allowlist (vitest/eslint/jsdom/vite-native cannot install).
Verification here = `tsc` (prod + tests with a vitest type shim), `bun test` (with browser-globals preload,
baseline 320 pass / 79 env-fail recorded), esbuild bundle, Prettier, and headless-Chromium playthrough screenshots.

- item: Survey the codebase and build a sandbox verification harness (esbuild bundle + static server + Playwright smoke + bun test baseline + vitest type shim)
  status: done
  dispatched: self; four read-only Explore maps (terrain, audio, VFX, bosses) returned inline
  result: harness in session scratchpad; baseline screenshots render level 1; prod/tests typecheck clean; bun baseline 320 pass

- item: Lay foundation contracts — CampaignData (10-chapter story), BossTypes 6-10 + BossContracts, CombatContracts, Faction.CIVILIAN, getLevelScaling
  status: done
  dispatched: self on workflow/ten-level-campaign
  result: tsc clean; BossTypes/Boss.integration pins of "level 6 → null" now intentionally stale (routed to tests mission)
