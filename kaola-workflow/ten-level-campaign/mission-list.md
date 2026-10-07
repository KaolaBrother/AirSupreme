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

- item: Build levels 6-10 environments (volcano foundry, polar aurora sea, storm canyon, stratosphere space-elevator, obsidian citadel) + LevelConfig 6-10 + postFx for all levels + sampleSurface
  status: in-flight
  dispatched: implementer (reasoning tier) in worktree /home/claude/wt/terrain on branch batch/terrain; output = commits on batch/terrain + final report

- item: Build bosses 6-7 (Magma Colossus walker with vents/mortars/geysers; Abyssal Leviathan submarine with dive cycle/mines)
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/bosses-a on batch/bosses-a

- item: Build bosses 8-9 (Tempest Zeppelin gas cells/chain lightning/drones; Phantom Wing cloak/laser lance/holo decoys)
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/bosses-b on batch/bosses-b

- item: Build final boss Oracle Prime (3 phases: shield pylons, exposed core + laser arrays, overload shockwaves)
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/boss-final on batch/boss-final

- item: Add 17 ground/sea/air units across hostile/friendly/civilian factions with behaviours, SAM missiles + decoys, per-level deployments
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/units on batch/units

- item: Add special weapons (rockets, laser, swarm, railgun, EMP) + flare countermeasures with logic core and pooled visuals
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/weapons on batch/weapons

- item: VFX overhaul — instanced particle backend, upgraded recipes, contrails, post-processing (bloom/grade/vignette/screen effects), hex shield
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/vfx on batch/vfx

- item: CameraRig first/third-person with cockpit model, shake, FOV kick; friendly livery; afterburner polish
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/camera on batch/camera

- item: Music sequencer + 23 tracks/stingers and new SFX set with compressor
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/audio on batch/audio

- item: Progressive tiered upgrades, SaveSystem checkpoints, StartMenu continue/level 1-10/camera setting, hangar-mode UpgradeMenu
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/progression on batch/progression

- item: StoryOverlay (chapter intro/debrief/ending), RadioComms, HUD weapon/flare/boss/missile/autosave/camera panels, radar kinds, mobile buttons
  status: in-flight
  dispatched: implementer (reasoning tier) in /home/claude/wt/story-ui on batch/story-ui

- item: Separate-custody tests pinning api-spec (campaign, scaling, factions, bosses 6-10, save, upgrades, weapons, flares, units, camera, music catalog, settings) + refresh stale boss pins
  status: in-flight
  dispatched: tdd-guide (reasoning tier) in /home/claude/wt/tests on batch/tests
