# Upgrade Air Supreme into a 10-level story campaign with new units, weapons, bosses, camera modes, autosave, progressive upgrades, and full VFX/audio overhaul

Source of truth: claude.ai project "Air supreme 3D Game" description (user's standing requirements):
R1 tremendous visual updates · R2 gameplay/mechanism improvements · R3/R9 ten levels with a complete story ·
R4 music + SFX improvements · R5 first/third-person switch · R6 more ground/sea/air units (neutral/hostile/friendly,
distinct behaviours) · R7 more weapons · R8 better VFX everywhere · R10 creative bosses for new levels ·
R11 mid-game autosave · R12 upgrades progressive with difficulty per level.

Sandbox facts: npm registry is blocked by the egress allowlist (vitest/eslint/jsdom/vite-native cannot install;
repo node_modules carries darwin-only rollup/esbuild natives, so `vite build` cannot run either).
Verification here = `tsc` (prod + tests with a vitest type shim), `bun test` (with browser-globals preload,
baseline 320 pass / 79 env-fail recorded), esbuild bundle, Prettier, and headless-Chromium playthrough screenshots.
Harness: /tmp/claude-0/-home-claude/a4310de8-0318-594d-9aae-8abaedc5bdca/scratchpad/harness (README inside).

Run log: session 2 (12:34 UTC) found the container had been reclaimed ~10:20 UTC; all 11 first-wave dispatches
were dead (no commits; 3 left partial files). Width 12 on a 2-core/7.8 GB box was too wide. Re-dispatching in
rounds of ~5 with commit-as-you-go so a reclaim can no longer lose work.

- item: Survey the codebase and build a sandbox verification harness (esbuild bundle + static server + Playwright smoke + bun test baseline + vitest type shim)
  status: done
  dispatched: self; four read-only Explore maps (terrain, audio, VFX, bosses) returned inline
  result: harness in session scratchpad; baseline screenshots render level 1; prod/tests typecheck clean; bun baseline 320 pass

- item: Lay foundation contracts — CampaignData (10-chapter story), BossTypes 6-10 + BossContracts, CombatContracts, Faction.CIVILIAN, getLevelScaling
  status: done
  dispatched: self on workflow/ten-level-campaign
  result: tsc clean; BossTypes/Boss.integration pins of "level 6 → null" now intentionally stale (routed to tests mission)

- item: Recover the first wave after the container reclaim — salvage partial work, record it, re-plan width
  status: done
  dispatched: self
  result: WIP committed on batch branches (audio 607469a, progression cffadff, story-ui efe9a90); other 9 worktrees had nothing; harness verified alive (tsc 5.5 s, esbuild bundle OK)

- item: Terrain core — TerrainType 6-10, LevelConfig 6-10, postFx for all levels, sampleSurface, ash/aurora weather, environment-module dispatch, full VOLCANO (L6) + ARCTIC (L7) environments, working placeholders for CANYON/STRATOSPHERE/CITADEL
  status: in-flight
  dispatched: round 1 · implementer (reasoning tier) in /home/claude/wt/terrain on batch/terrain; output = commits on batch/terrain + final report

- item: Terrain B — full CANYON (L8), STRATOSPHERE (L9), CITADEL (L10) environment modules replacing terrain-core placeholders
  status: todo
  hint: needs terrain core merged first (same dispatch hook); prior first-wave terrain dispatch died with no output

- item: Build bosses 6-7 (Magma Colossus walker with vents/mortars/geysers; Abyssal Leviathan submarine with dive cycle/mines)
  status: in-flight
  dispatched: round 1 · implementer (reasoning tier) in /home/claude/wt/bosses-a on batch/bosses-a; output = commits on batch/bosses-a + final report

- item: Build bosses 8-9 (Tempest Zeppelin gas cells/chain lightning/drones; Phantom Wing cloak/laser lance/holo decoys)
  status: todo
  hint: round 2; first-wave dispatch died with no output; worktree /home/claude/wt/bosses-b

- item: Build final boss Oracle Prime (3 phases: shield pylons, exposed core + laser arrays, overload shockwaves)
  status: todo
  hint: round 2; first-wave dispatch died with no output; worktree /home/claude/wt/boss-final

- item: Add 17 ground/sea/air units across hostile/friendly/civilian factions with behaviours, SAM missiles + decoys, per-level deployments
  status: in-flight
  dispatched: round 1 · implementer (reasoning tier) in /home/claude/wt/units on batch/units; output = commits on batch/units + final report

- item: Add special weapons (rockets, laser, swarm, railgun, EMP) + flare countermeasures with logic core and pooled visuals
  status: in-flight
  dispatched: round 1 · implementer (reasoning tier) in /home/claude/wt/weapons on batch/weapons; output = commits on batch/weapons + final report

- item: VFX overhaul — instanced particle backend, upgraded recipes, contrails, post-processing (bloom/grade/vignette/screen effects), hex shield
  status: in-flight
  dispatched: round 1 · implementer (reasoning tier) in /home/claude/wt/vfx on batch/vfx; output = commits on batch/vfx + final report

- item: CameraRig first/third-person with cockpit model, shake, FOV kick; friendly livery; afterburner polish
  status: todo
  hint: round 2; first-wave dispatch died with no output; worktree /home/claude/wt/camera

- item: Music sequencer + 23 tracks/stingers and new SFX set with compressor
  status: todo
  hint: WIP music engine at batch/audio 607469a (unverified) — resume from it

- item: Progressive tiered upgrades, SaveSystem checkpoints, StartMenu continue/level 1-10/camera setting, hangar-mode UpgradeMenu
  status: todo
  hint: WIP at batch/progression cffadff (UpgradeSystem +SessionSettings + SaveSystem draft, unverified) — resume from it

- item: StoryOverlay (chapter intro/debrief/ending), RadioComms, HUD weapon/flare/boss/missile/autosave/camera panels, radar kinds, mobile buttons
  status: todo
  hint: WIP at batch/story-ui efe9a90 (hudTokens only) — resume from it

- item: Separate-custody tests pinning api-spec (campaign, scaling, factions, bosses 6-10, save, upgrades, weapons, flares, units, camera, music catalog, settings) + refresh stale boss pins
  status: todo
  hint: run after rounds 1-2 are merged so the tests execute against real code; tests pin the SPEC, not the implementation

- item: Integrate every batch into the runtime (GameCoordinator, BossBattleController, LevelManager, InputHandler, HUD, menus) per api-spec §10 — level flow, units per wave, weapons/flares input, camera toggle, autosave, story cards, music/SFX hooks
  status: todo

- item: Dock docs against the code (README/README.zh-CN, CHANGELOG, IMPLEMENTATION_PLAN, docs/architecture, docs/api, TECHNICAL_DOCUMENTATION)
  status: todo

- item: Final audit against R1-R12, full sandbox validation + Chromium playthrough of all 10 levels, then merge to main and push (user asked for merge + resync)
  status: todo
