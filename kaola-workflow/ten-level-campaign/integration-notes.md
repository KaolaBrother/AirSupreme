# Integration notes — round 1 batches

Condensed from each batch's final report (and the orchestrator's own checks). This is what the
integration mission wires; nothing below is wired into the running game yet.

Round-1 merges on `workflow/ten-level-campaign`: terrain 248bacc · units 61d01a6 · weapons 8995456 ·
bosses-a c58678e · vfx 310cd42 · integration fix c11ee94.
Orchestrator checks on the merged tree (sandbox): tsc prod + tests clean; bun 318 pass / 81 fail with a
failing set identical to the pre-round baseline at 9277b5d (79 no-DOM env failures + 2 stale boss pins);
esbuild bundle OK; headless smoke run of level 1: no console errors — but see the VFX regression below.

---------------------------------------------------------------------------------------------------
## Terrain core — batch/terrain

Built: TerrainType 6-10; LEVELS 6-10 (7/7/7/7/8 waves, difficulty 10, names = CampaignData titles);
postFx reviewed for all 10 levels (levels 1-5 changed only in postFx); `TerrainGenerator.sampleSurface`
for all 10 terrains; `getCrashSurfaceY` unchanged for 1-5 and equal to `sampleSurface().y` for 6-10;
environment modules in `src/features/terrain/environments/`; full VOLCANO and ARCTIC; CANYON /
STRATOSPHERE / CITADEL are working placeholders; weather presets `ash`, `aurora`, and `storm` for CANYON.

Extras beyond spec: `LevelWeatherPreset` type alias; `getSurfaceKind(x, z)` → `'water' | SurfaceImpactType`;
the aurora lives in the `aurora` weather preset (any level can use it).
sampleSurface semantics: LAKE is water only where ≥ 2 m deep; OCEAN islands are not water; DESERT and
CITY report y = -50 (the mesh base); ARCTIC drifting floes never affect sampling (`floeTop()` exists).

Wiring:
- LevelManager: add `getSurfaceSample(x, z)` delegating to `terrainGenerator?.sampleSurface(x, z)`, falling
  back to `{ y: WORLDSCAPE_WATER_Y, water: false }` until the lazy terrain chunk loads; same for
  `getSurfaceKind`.
- `unitSystem.setSurfaceSampler((x, z) => lm.getSurfaceSample(x, z))`;
  `boss.setGroundSampler((x, z) => lm.getSurfaceSample(x, z).y)`.
- Leviathan spawn: check `.water` first — an ice shelf may sit at the spawn point.
- No new per-frame hook: environment animation runs inside `TerrainGenerator.update` / `updateLOD`, which
  `LevelManager.updateVisuals` already calls.
- Impacts: replace GameCoordinator's `getSurfaceImpactType` and hard-coded `isWaterImpact` (lake radius
  210) with `getSurfaceKind`; the environment impact plane at a flat -48.6 misses raised ground on levels
  6-10 — use sampled heights.

Known gaps: enemy jets do not avoid terrain (`combatBounds.minHeight` is -20) and can fly through the
volcano (summit y≈308), canyon walls (y≈100) and the crater rim. Placeholders are plain (CITADEL very red
and monochrome). Existing clouds look blocky under the ash/storm palettes. VOLCANO takes ~0.5-0.9 s to
build on a desktop CPU. Budgets: VOLCANO 32 draws / ~230k tris desktop (~123k mobile); ARCTIC 29 draws.

Environment contract (terrain B builds on it): extend `EnvironmentBase`; implement `terrain`, `hasWater`,
`build(ctx)` (ctx: config, tokens, waterY, halfExtent, detailScale, isMobile, sunDirection, wind),
`sampleHeight(x, z)` (solid surface, or seabed under water), `isWater(x, z)`, optional `surfaceKindAt`.
Per-frame work via `this.animate(cb)`; the base `dispose()` disposes the whole tree;
`sampleEnvironmentSurface` turns height + water into the `sampleSurface` result. Replace the placeholder
classes behind CANYON / STRATOSPHERE / CITADEL in `environments/index.ts`. Helpers: `envKit` (height grid,
puff fields, `PolarShape`, `mergeStaticMeshes`, noise GLSL), lava/glow materials, ice material.

---------------------------------------------------------------------------------------------------
## Units — batch/units

Built: UnitTypes (Chinese names; hostiles `Faction.ENEMY`, allies `FRIENDLY`, civilians `CIVILIAN`);
UnitDeployments for levels 1-10 (5,5,6,6,7,7,7,7,7,8 waves); 17 procedural meshes (UnitMeshFactory +
UnitMeshKit + ground/sea/air builders, 7-26 draw calls each, shared resources flagged); UnitSystem +
UnitBehaviors with SAM lock/launch, flare decoys, submarine dive cycle, escorts, civilians, unit-vs-unit
fire resolved inside the system with its own pools. Logic runs with no DOM and `particleSystem = null`.

Deviations: `getUnits()` returns live units only; `applyAreaDamage` has no falloff; player weapons spare
friendly units and enemy/boss sources spare enemy units; small vehicles drawn 1.2-1.6× for readability
(hit radii match); mesh origin at ground/waterline with `userData.aimPoint` at hull centre; first-contact
tracking survives `clear()` (`resetFirstContacts()` for a new game); sea units are skipped where the
sampler finds no water. Extras: `hitTest`, `getPlayerLockState`, `setEffectOverrides`,
`resetFirstContacts`, `getLevelScaling`, `onUnitEvent` / `onUnitDamaged` / `onUnitDeparted` /
`onMissileDecoyed`, and `bridgeUnitFireToEventBus` (own file, keeps UnitSystem free of EventBus).

Wiring:
- Setup: `new UnitSystem(scene, particleSystem)`; `setSurfaceSampler(...)`; `setDecoyProvider(countermeasures)`;
  `setLevelScaling(getLevelScaling(level))` (optionally × difficulty profile); `prewarmUnitMeshes()` during
  loading (a model's first build costs 5-40 ms).
- Unit fire: `bridgeUnitFireToEventBus(units)` — enemy fire enters the enemy projectile pool (hurts the
  player and friendly jets); ally fire hurts enemy jets; shot sounds come along.
- Per frame: `updateWithContext(dt, { playerMesh, playerPosition, enemyAirMeshes:
  enemySystem.getEnemyMeshes(), friendlyAirMeshes: friendlyAIs.map((f) => f.getMesh()) })`.
- Waves: `spawnForWave(level, wave, playerPos)` at wave start; a wave is done when the jet count and
  `getAliveHostileCount()` are both 0.
- Player bullets: the existing pool only hits within 5 m of a target centre, which misses big ships — per
  active bullet call `units.hitTest(pos, 1)` then `applyDamage(dmg, 'cannon', pos)` and deactivate the
  bullet, or make `checkCollisions` radius-aware via `getDeclaredHitRadius`.
- Lock-on missiles: aim at `unit.mesh.userData.aimPoint`; on impact `findByMesh(target)?.applyDamage(…,
  'missile', impact)`. Enemy bullets on friendly units: `findByMesh` + source `'enemy-fire'`.
- Special weapons: include `getCombatTargets()` in `setTargetProvider`; EMP → `applyAreaStun` +
  `destroyMissilesInRadius`.
- HUD/radar: `setMissileWarning(getPlayerLockState())` each frame; blip kinds `'ally'` → `'ally-unit'`,
  `'enemy-air'` → the existing enemy kind; `setRangeMultiplier(getRadarRangeMultiplier())`; add
  `getHostileRadarBonus()` to enemy-jet accuracy.
- Score: `onUnitDestroyed` with `byPlayer` → `+scoreValue × scoreMultiplier` for hostiles; otherwise subtract
  `penalty` and count civilians/allies lost. `onPlayerDamaged` → PlayerSystem.
- Radio: `onCivilianHit` / `onEscortResult` / `onFirstContact` → `GENERIC_RADIO` /
  `UNIT_FIRST_CONTACT_RADIO[type]`. Audio: `onLockWarning` → lock-warning / SAM-launch sounds;
  `onUnitEvent` → unit sounds; `onUnitDestroyed` → `playUnitDestroyed(unit.domain)`.
- Effects: the system draws its own particles — use `onExplosion` only for camera shake and sound (else
  explosions double); once VFX is live, `setEffectOverrides({ damageSmoke, splash, muzzleFlash })`.
- `clear()` per level (leaves the scene empty); `dispose()` at teardown.

Known gaps: never run inside the full game yet; damage smoke thin until VFX smoke is plugged in; ground
units can overlap and only steer around water; wake foam 0.08 m above water may clip with waves; balance
numbers are inline in the behaviour files; UnitSystem.ts 1,213 lines and UnitBehaviors.ts 995.

---------------------------------------------------------------------------------------------------
## Special weapons & flares — batch/weapons

Built per api-spec §4 in 11 files (`WeaponTypes`, `WeaponTargeting`, `WeaponSystem`, `WeaponContext`,
`ProjectileController`, `EnergyWeaponControllers`, `WeaponFx`, `WeaponFxParticles`, `WeaponFxShaders`,
`WeaponParticleField`, `CountermeasureSystem`); reuses `SPECIAL_WEAPON_IDS` from CombatContracts.
Rockets 6→12 per salvo, 3.5 m proximity fuse, splash falls to 40 % at the edge; laser heat → overheat
lock until fully cooled, then needs a fresh press; swarm 6→12 micro-missiles across distinct ENEMY targets
in a 42° cone; railgun releases below 25 % charge cancel (`onDryFire`), damage × charge; EMP 10→6 s
cooldown, 2-3 charges, stuns ENEMY targets (measured to their surface), damages projectiles and DRONE
units; flares: fan of 6, ~3.6 s, decoy strength fades as they burn.

Deviations: hit radius = max(`target.hitRadius`, `getDeclaredHitRadius(mesh)`); salvo ammo counts salvos;
HUD `cooldown` = fraction remaining (1 = just fired), `reloadProgress` = 1 when full; railgun cancel →
`onDryFire('railgun')`; no `onImpact` for EMP; laser `onImpact` throttled to 4/s at scale 0.35. Extras:
`setSurfaceSampler`, `setViewMode`, `setEffectDensity`, `refill`, `getStats`, `getUpgradeLevel`,
`isUnlocked`, `isBeamActive`, `getActiveProjectileCount`, `onBeamEnd`, optional `velocity` on `deploy`.

Wiring:
- Input: F → `setTriggerHeld(true/false)` on key-state change (the system detects edges); Tab/X →
  `selectNext()`; 1-5 → `selectIndex(n - 1)`; G → `flares.deploy(pos, quat, playerVelocity)`.
- Muzzle: aircraft position + (0, 0.3, -0.5) rotated by its quaternion (forward is local −Z). Per frame
  `update(dt, muzzle)` and `flares.update(dt)`; `setSurfaceSampler(terrain.sampleSurface)`;
  `setViewMode(cameraRig.getMode())`.
- Target provider: enemy jets (`getEnemies()`, ENEMY, `'air'`, radius 5, `takeDamage` + hit feedback,
  optional stun), `unitSystem.getCombatTargets()`, each boss part from `getCollisionParts()`
  (`'boss-part'`, `takeDamageAt(part, n)` or `takeDamage`, `applyStun → boss.applyStun?.()`), boss and unit
  missiles as `kind: 'projectile'` (boss missiles have 20 HP, so EMP kills them). Apply civilian-hit
  penalties inside the wrapper.
- `onEmpPulse(c, r, s)` → `unitSystem.applyAreaStun(c, r, s)` + `destroyMissilesInRadius(c, r)`, damage boss
  missiles in range, `GameScene.setScreenEffects({ empFlash })`; do NOT also call `createEmpBurst`.
- Audio: `onFired` rockets→`playRocketSalvo`, swarm→`playSwarmLaunch`, laser→`playLaserStart`,
  railgun→`playRailgunFire`, emp→`playEmpPulse`; `onBeamEnd`→`playLaserStop`;
  `onOverheat`→`playLaserOverheat`; `onChargeStart`→`playRailgunCharge`; railgun `onDryFire` →
  `playRailgunChargeCancel`; use `onImpact` scale for camera shake and throttle sounds (a salvo can make 12
  impacts).
- Progression: on level start `setUnlocked(getUnlockedWeaponsThrough(level))` (newly unlocked weapons start
  full) and `setUpgradeLevel(id, stats.getWeaponUpgradeLevel(id))`; on respawn `refill()` + `clear()`;
  flares `setCapacity(getFlareCapacity())`.
- HUD: poll `getHudState()` and `flares.getCharges()` / `getMaxCharges()` / `getRechargeProgress()`.
- Saves: `exportState()` and `flares.exportState().charges`; call `setUpgradeLevel` before `importState`
  (ammo is clamped to the level's max).

Known gaps: tuned under SwiftShader only — additive glows may dim through post-fx, needs a real-GPU pass;
enemy jets have no stun (EMP only slows them if the wrapper adds one); hit sparks can sit slightly off the
model; flares are visible ~1 s in the chase camera and not in first person.

---------------------------------------------------------------------------------------------------
## Bosses 6-7 — batch/bosses-a

Built: `MagmaColossusAI` / `createMagmaColossusMesh` (four-legged basalt walker ~95 m at scale 5, IK legs,
circles the player at ~230 m within 460 m of spawn; head cannons via `onFire`; 6-shell mortar salvos with
shrinking markers; missile volleys from its own BossMissileSystem; 4 back vents open after salvos (×2.6,
own HP, destroying one strips armour); telegraphed stomp ring hurts low flyers; P2 at ≤66 % HP or all vents
gone: core exposed ×2.2, telegraphed lava columns, beam sweep with a danger fan, drones; P3 at ≤33 %:
brighter cracks, vents locked open, lava-column lines, stumbles below 25 %).
`AbyssalLeviathanAI` / `createAbyssalLeviathanMesh` (spawns mid-breach; submerged = invulnerable with sonar
rings, wake and bubble-telegraphed underwater shots; red water ring 2.2 s before each breach, which throws
ice and a shock ring; deck turrets via `onFire`; missile salvos from deck hatches ×2.4 while open;
sub-targets: conning tower, 4 ballast tanks (each loss shortens dives, all lost stops diving), missile bay
(8 hatches share one HP pool, destroying it ends salvos); P2 lobbed contact mines (shootable), shorter
dives, drones; P3 stays surfaced, lists and burns, ram runs with a red lane warning).
Files: `MagmaColossusAI.ts`, `MagmaColossusMesh.ts`, `MagmaColossusBeam.ts`, `MagmaColossusHazards.ts`
(hazard blocks both bosses use), `AbyssalLeviathanAI.ts`, `AbyssalLeviathanMesh.ts`, `AbyssalLeviathanFx.ts`.

Open decision (integration): the death collapse is off by default. `setDeathSequenceEnabled(true)` plays a
3.6 s collapse (4.5 s hull break/sink for the Leviathan) before `onDestroy`, which bends the "onDestroy at
zero HP" contract. The batch recommends enabling it: the controller already keeps calling `update` while
`isDying()`, and a dying boss has no hit parts or hazards.

Deviations: extras `setDeathSequenceEnabled`, `isDying`, `onEffectCue(cue, position, intensity)`,
`getSubmergeLevel`; without a ground sampler the Colossus uses its spawn height; `takeDamage(amount)` is raw
(no armour) and ignored while invulnerable; mines take damage while the Leviathan is submerged (never the
boss's HP) and are not in `getSubTargets()`.

Wiring (BossBattleController):
- Spawn Colossus at (px, groundY, pz + 260) and call `setGroundSampler((x, z) => terrain.sampleSurface(x,
  z).y)` right after constructing; Leviathan at (px, -48, pz + 260) (check water).
- `onFire` → `BossProjectilePool.fire(…, Faction.ENEMY)`; `onMissileFired` → launch sound.
- `onSpawnMinion` kinds: Colossus `drone`, `heavy`; Leviathan `drone`, `fighter` — there is no DRONE enemy
  jet type, so map `drone` → SCOUT unless the units batch's DRONE is used.
- `onPhaseChange` → boss-phase radio, `playStinger('phase-change')`, `setIntensity`;
  `onHazardWarning` → `hud.flashWarning(label, 'threat')`; `onEffectCue`: geyser → `playLavaEruption`,
  sonar → `playSonarPing`, horn → `playShipHorn`, stomp/breach → heavy impact + camera shake.
- Every frame `boss.checkHazard(playerPos, ~6)` (and per friendly) with the 0.6 s per-target cooldown kept
  in the controller.
- Hits: route every weapon through `getCollisionParts()` hit-tested with `getDeclaredHitRadius(part, 5)`,
  then `takeDamageAt(part, rawDamage)`; weak points come first. The Leviathan rebuilds its parts list each
  frame (same array object). Mines carry `userData.bossHazardTarget` so lock-on can skip them.
- HUD: `setBossStatus(getStatusLabel(), { current: getPhase(), total: 3 })`; sub-target bars from
  `getSubTargets()`.

Known gaps: stale pins `BossTypes.test.ts:171` and `Boss.integration.test.ts:223` ("level 6 → null",
already failing since a6a76ec); the Leviathan's hazards mostly threaten low flyers; the arctic water must
keep `depthWrite: false` or the warning rings on the water disappear.

---------------------------------------------------------------------------------------------------
## VFX — batch/vfx (INCOMPLETE; known regression)

The VFX worker was stopped by the user's interrupt right after its last commit (70d039f, 14:03 UTC) and
never filed a report, so nothing below was verified by the batch itself.

Commits: e08b427 instanced particle backend + layered recipes behind ParticleSystem · dbd0ac7 HDR
post-processing pipeline + screen effects in GameScene · 684503d pooled wingtip contrails + hex shield
ripple · f96750c composer output faithful to the direct render path · dba5104 restore formatting ·
523abfc soften boost streak · 6f1a2df render the composer scene display-referred · 3430a76 match three's
fog colour space · 70d039f tone down EMP / shield-hit for bloom.
Files: `ParticleSystem.ts` (rewritten facade), `particles/` (ParticleBatch, ParticleTypes, VfxAtlas,
DebrisField, LegacyVfxTextures, recipes/{combat,environment,special,trail}Recipes), `postfx/`
(PostFxPipeline, GradeShader, ScreenEffectsState, ScreenOverlay), `ContrailSystem.ts`, `ShieldRipple.ts`,
`src/scenes/GameScene.ts`, `src/core/systems/PlayerSystem.ts` (notifyShieldHit).
batch/vfx on its own does not typecheck (GameCoordinator passes the widened `SurfaceImpactType` to
`AudioManager.playGroundImpact`); fixed on the integration branch by c11ee94.

REGRESSION — must be fixed before release. Orchestrator smoke run (headless Chromium, SwiftShader, level
1, ~12 s in): with `qualityPreset: 'quality'` (composer on) the player jet's body and wings are not drawn —
only the canopy, nav lights and engine flames under a large glow show — and enemy jets render translucent.
The same build with `qualityPreset: 'performance'` (composer off) renders correctly, and the tree before
the VFX merge (c58678e) renders correctly with `'quality'`. Suspect: depth is not preserved between the
composer passes, so background/water is composited over opaque aircraft — inspect `PostFxPipeline` and
`GameScene.render` (autoClear handling) and the display-referred change in 6f1a2df. Verify the fix on a
real GPU in a real browser.

Still unverified/unwired: `setScreenEffects` / `setPostFxEnabled` call sites and quality mapping, contrail
attachment to aircraft, callers of the new particle methods, `getBudget` per quality preset.

===================================================================================================
# Integration notes — round 2 batches (session 3)

Merged on `workflow/ten-level-campaign`: terrain-b 01e0ad8 · bosses-b b0dea6b · boss-final 3177a5a ·
camera 1362060 · progression 9ad535b · coordinator UPGRADE_FEEDBACK fix 1316d5d. Every batch passed
tsc/lint/vitest/real build on its own; none is wired into the running game yet.

---------------------------------------------------------------------------------------------------
## Terrain B — levels 8-10 (src/features/terrain/**)

- `TerrainGenerator.getEnvironment()` returns the level's environment module.
- L8 CANYON: river is water=true (bed below local −0.5; spawn (0,0) is over the river); storm ceiling y≈640;
  `CanyonEnvironment.getConvoyRoute()` for the 'route' placement; storm lightning strikes real ground.
- L9 STRATOSPHERE: crash surface = visible cloud top (y≈−25 at spawn) + vertical columns (trunk, pylons,
  anchors, relays); overhangs above y 640 are excluded (soft ceiling 540). No water.
- L10 CITADEL: true crater surface (lava level inside rifts) max'ed with structures/rocks; kinds city/lava/rock.
  `getCoreArena()` → (0, 160, −700): anchor Oracle Prime there (the spec's (px, 160, pz+280) would spawn it
  behind the player). `setCoreState('online'|'exposed'|'overload'|'offline')` mirrors boss phases;
  `getAssaultRoute()` for the L10 convoy. The four scenery obelisks (r≈165, crystals y 190-206) are not
  destructible — keep the boss's shield pylons visually distinct.
- `LevelWeatherConfig.cloudTone` optional override; clouds render smooth under dark weather (L5-7 softer).
- Sampling accuracy: worst ~3-4 m on near-vertical walls/rock edges, erring high.

---------------------------------------------------------------------------------------------------
## Bosses 8-10 (new TempestZeppelin*/PhantomWing*/OraclePrime* files)

Common: construct after the controller adds the positioned mesh; `setGroundSampler((x,z) =>
terrain.sampleSurface(x,z).y)`; `setDeathSequenceEnabled(true)` and wait for `onDestroy`; route every hit through
`takeDamageAt(part, raw)` with radius-aware hit tests (`getDeclaredHitRadius`) — the 5 m projectile threshold
misses big parts; `checkHazard(pos, ~6)` every frame for the player and each friendly with a ~0.6 s per-target
cooldown kept in the controller; HUD `setBossStatus(getStatusLabel(), { current: getPhase(), total: 3 })`,
sub-target bars from `getSubTargets()`, `onHazardWarning` → `hud.flashWarning`; audio via `onEffectCue`.
- Tempest Zeppelin (L8): spawn (px, 170, pz+300); minion kind 'drone' only (map to units DRONE or SCOUT);
  7 sub-targets (6 gas cells + hangar); cues = TempestZeppelinCue union.
- Phantom Wing (L9): spawn (px+120, py+40, pz+320); no minions (holo decoys instead — decoy roots are in
  `getCollisionParts()` with `userData.phantomDecoy`/`bossDecoy`); hide its radar/lock blip while `isCloaked()`;
  while cloaked it has no hittable parts, so EMP must call `applyEmpPulse(center, radius, seconds)`; 2 sub-targets.
- Oracle Prime (L10): spawn at the citadel core arena (see terrain); minion kinds 'drone' and 'fighter';
  `getCollisionParts()` includes a shield proxy with multiplier 0 and `userData.bossDeflector` — skip parts with
  multiplier 0 for lock-on; pylons take damage while the core is invulnerable (own HP, never boss HP);
  `getSubTargets()` swaps pylons → emitters at shield collapse (same array object); `MusicSystem.setIntensity(
  getMusicIntensity())`; cues: shield-hit → playShieldHit, lance-lock/judgement-lock → lock tone,
  pinwheel-*/shockwave-charge → laser warning/sweep, arc-strike/orbital-strike → playLightningStrike,
  shield-collapse/overload/last-light → playBossPhaseAlarm + 'phase-change' stinger. Finale: 6.4 s death —
  Oracle's last line on 'death-freeze', `setScreenEffects({ flash: 1 })` + big shake on 'death-flash' (4.6 s),
  then 'boss-defeated' stinger, remaining lines, `StoryOverlay.showEnding`; `getDeathProgress()` for fades.
  Also drive `citadel.setCoreState(...)` from its phases.

---------------------------------------------------------------------------------------------------
## Camera (src/features/camera/**, AircraftMeshFactory)

1. Replace `new ThirdPersonCamera(...)` (GameCoordinator ~l.344) with `new CameraRig(gameScene.camera,
   playerAircraft, { mode: settings.cameraMode })`; the rig tags the player mesh with PLAYER_EXTERIOR_LAYER and
   re-tags added children.
2. In render(), before `gameScene.render()`: preallocated `flight = { speedRatio: clamp01((speed − 0.5·max) /
   (0.5·max)), boosting: input.throttle }`; `updatePlayerAfterburner(playerAircraft, flight, renderDt)`;
   `cameraRig.update(interpolatedPos, interpolatedQuat, renderDt, flight)`.
3. Delete the `getObjectByName('engineGlow')` scaling block in update() (~l.860) — no longer applies.
4. `spawnFriendlyAI()`: `createEnemyMesh(config)` → `createFriendlyMesh(config)`.
5. V key and mobile `#camera-button` → `toggleMode()`; on start/checkpoint load `setMode(saved, true)` +
   `snapToTarget()`.
6. `onModeChanged = (m) => { weapons.setViewMode(m); hud.setCameraMode(m); audio.playCameraSwitch();
   persist settings.cameraMode }`.
7. Shake: PLAYER_HIT `min(0.6, 0.15 + damage/120)` · PLAYER_DEATH 1 · explosions (enemy death, unit onExplosion,
   boss blasts, weapon onImpact, lightning) `computeExplosionShake(distance, scale)` · own missile 0.05 · rocket
   salvo 0.1 · railgun 0.35 · EMP 0.25 · boss hazard hit 0.4.
Recommended: shrink the PlayerController flame sprite to ~1.4 (cruise) / 2.3 (boost) at opacity 0.5; in first
person hide the shield hex (tag it with PLAYER_EXTERIOR_LAYER) or fade it by `1 − 0.7·getBlend()`.

---------------------------------------------------------------------------------------------------
## Progression, save, menus

1. New game / boss mode at level L: `upgrades.reset()`, `setCampaignLevel(L)`,
   `setUnlockedWeapons(getUnlockedWeaponsThrough(L))`; if L > 1 `awardBonusPoints(getStartingUpgradePoints(L))`
   and open the hangar. Starting a new game should `clearCampaignCheckpoint()` (not done yet).
2. Every level start: `recordLevelReached(L)`; `weapons.setUpgradeLevel(id, stats.getWeaponUpgradeLevel(id))`;
   `flares.setCapacity(stats.getFlareCapacity())`; damage taken × (1 − `getArmorReduction()`); re-sync weapon
   levels/flare capacity after each purchase; scores × scoreMultiplier before `addScore`.
3. Checkpoints (normal mode only): 'level-start' wave 0 after the intro; 'wave' with wave = k+1 after wave k;
   'boss' with wave = totalWaves just before the boss. Payload: `upgrades.export()`, `weapons.exportState()`,
   flare charges, camera mode, score/lives/missiles/difficulty/stats. `hud.showAutosave()` when it returns true.
4. Restore (`StartMenu.setOnContinue` in main.ts and the settlement's 从检查点继续): reset → `import(save.upgrades)`
   → setCampaignLevel → setUnlockedWeapons → setUpgradeLevel → `weapons.importState` → `flares.importState` →
   resume at `save.wave`.
5. Between chapters: set next level's caps/unlocks, then `upgradeMenu.show({ mode: 'hangar', onContinue })`
   (hides itself before calling onContinue). Pause path `show()` unchanged.
6. After level 10: `markCampaignCompleted(score)` + `clearCampaignCheckpoint()`. Pass `GameSettings.cameraMode`
   to CameraRig as its starting mode.
Known: caps stay at level-1 values until setCampaignLevel is called; CampaignData now sits in the entry chunk.

===================================================================================================
# Integration notes — round 3 batches + integration pass 1 (session 3)

Merged: tests 2726d1a · story-ui 6deda8f · audio ef4c5f4 · integration pass 1 6368511 (records 10d1820).
Gates on the merged tree: tsc clean · lint 0 errors · vitest 838 pass / 2 skipped · real vite build OK.

---------------------------------------------------------------------------------------------------
## Integration pass 1 — what exists now

New controllers: src/core/campaign/{CampaignFlowController,CampaignPresentation}, units/UnitController,
combat/SpecialWeaponsController, camera/PlayerViewController, vfx/{CombatVfxController,ContrailController},
boss/AdvancedBossSupport, dev/DevHooks (dev builds only: window.__AIR_SUPREME_DEV__ — god mode, time scale);
src/ui/CheckpointResumeButton. Every presentation call goes through `ICampaignPresentation`
(src/core/campaign/CampaignPresentation.ts); `DefaultCampaignPresentation` (built in the GameCoordinator
constructor) only calls pre-existing HUD/Audio/Music methods. Pass 2 swaps the bodies:
- StoryOverlay: showChapterIntro, showDebrief, showEnding, isStoryActive.
- RadioComms.enqueue: radio, genericRadio, unitFirstContact.
- HUD: updateWeaponPanel, updateFlares, showAutosave (+ playAutosave), setCameraMode (+ playCameraSwitch),
  setBossStatus, setMissileWarning, flashWarning. RadarMinimap.setRangeMultiplier: setRadarRangeMultiplier.
- MusicSystem: playLevelMusic / playBossMusic (levels 6-10 still use old tracks), playStinger, setMusicIntensity.
- New AudioManager play* methods: onWeaponEvent, onUnitEvent, onBossCue.
Known gaps after pass 1: bosses 1-5 keep old spawn points (some ~200 m behind the player) and the old 5 m
bullet threshold; radar doesn't show neutral/new unit kinds; un-steered player dies in ~10-15 s on standard
difficulty (balance untuned); L6 starts facing the volcano (must pull up within ~8 s); GameCoordinator 3,267 and
BossBattleController 1,579 lines (extract bosses 6-10 into their own controller); remaining per-frame
allocations in WeaponSystem.prepareFrame, InputHandler.getDesktopState, CombatSystem collision closures;
`GameLoop.setTimeScale` ships but nothing in production calls it. Chunks: GameCoordinator 120.5 → 169 kB,
total JS 1.55 MB/23 chunks → 2.19 MB/41 chunks (new systems lazy-loaded).

---------------------------------------------------------------------------------------------------
## Audio (src/core/Audio/**)

API per §6 plus: `playRailgunCharge(chargeSeconds = 1.2)`; `pauseMusic()` fades and remembers, `resumeMusic()`
restores; `stopMusic` fades 280 ms (state changes immediately); `playBossMusic(level)` covers 1-10;
`setIntensity` resets to the new track's default on track change; 'boss-defeated', 'level-complete',
'game-over', 'campaign-complete' stingers end the current music themselves; extras getIntensity,
MUSIC_STINGERS, AudioManager.stopSustainedSounds(). Existing SFX are quiet (explosion ≈ −29 LUFS); music sits
under them (≈ −32 LUFS). The output chain needs ~100 ms to settle after the context is created.
Wiring:
- Replace getLevelMusic with getLevelMusicForLevel.
- Chapter card: playStoryMusic(), playChapterImpact(), playTypewriterTick() per character (StoryOverlay
  onTypeTick ≈ 29/s), playRadioOpen() per radio line; then playLevelMusic(...) followed by
  playStinger('chapter-start') (stinger after the music so it follows the new key).
- Waves cleared: playStinger('level-complete').
- Boss: playBossMusic(level); phases → setIntensity 0.35 / 0.6 / 0.85, 1.0 below 25 % HP, plus
  playStinger('phase-change') and playBossPhaseAlarm(); Oracle: setIntensity(getMusicIntensity()) every frame.
- Boss killed: playStinger('boss-defeated'). Debrief: playVictoryMusic() + playDebriefTally() per counted item.
- Autosave: playAutosave() + playStinger('checkpoint'). Game over: playStinger('game-over'). After level 10:
  playStinger('campaign-complete') then victory music.
- Menu: playMenuMusic() after the first user gesture. Pause: pauseMusic() + stopSustainedSounds(); resume:
  resumeMusic().
- Weapons/units/camera/flares/surfaces per the round-1/2 notes; playUnitDestroyed(unit.domain).

---------------------------------------------------------------------------------------------------
## Story UI + HUD (src/ui/StoryOverlay.ts, RadioComms.ts, HUD.ts, RadarMinimap.ts, theme/**, index.html)

Behaviour: unlock line only when `unlockLine` is passed; onCardShown once per card (prologue + chapter →
'chapter'; epilogue + credits → 'ending'); Space/Enter/tap reveals then advances, Esc / 跳过 / skip() ends the
whole sequence (callback once), hide() or a new show* cancels silently; debrief waits for 继续; while a card is up
`<html data-story-overlay>` hides HUD, radar, radio, mobile controls, lock-on/indicator layers, and the overlay
swallows Space/Enter/Esc (pause blocked during cards). RadioComms: idle → line shows immediately (synchronous
onLineShown); high priority interrupts and the interrupted line replays; duplicates ignored; queue cap 6; timing
only from update(dt). HUD: autosave/flashWarning timeouts tick from hud.update(dt) (freeze while paused);
setBossStatus(null) hides the strip; on touch, weapon/flare/camera/missile state shows on the new buttons.
Radar adds getRangeMultiplier().
Wiring:
1. Construct StoryOverlay + RadioComms in the presentation layer; radio.update(dt) per frame; radio.clear() on
   level end; dispose both at teardown.
2. showChapterIntro(getCampaignChapter(L), done, { includePrologue: L === 1 && newGame, unlockLine:
   ch.unlockLine }); showDebrief({...}, () => upgradeMenu.show({ mode: 'hangar', ... }));
   showEnding({ finalScore }, () => <mission complete>).
3. Radio: getChapterRadio lines + UNIT_FIRST_CONTACT_RADIO as normal; civilian-hit, missile-warning, low-health
   from GENERIC_RADIO with { priority: 'high' }; onLineShown + CAMPAIGN_SPEAKERS[speaker].tone for the radio
   sound.
4. HUD per frame: updateWeaponPanel({ ...weapons.getHudState(), visible: state.selected !== null });
   updateFlares(getCharges(), getMaxCharges(), getRechargeProgress()); setMissileWarning(...);
   setBossStatus(boss.getStatusLabel() ?? '', { current: getPhase(), total: <phase count> }) then null when
   the boss is gone.
5. HUD on events: checkpoint saved → showAutosave('第3波'); camera onModeChanged + level start →
   setCameraMode(m); boss onHazardWarning → flashWarning(label, 'threat').
6. Mobile buttons (touchstart + preventDefault, passive: false): #camera-button → toggleMode();
   #special-button → setTriggerHeld(true) on touchstart / false on touchend; #cycle-button → selectNext();
   #flare-button → flares.deploy(...). The HUD updates their labels/meter rings/alert state.
7. Radar kinds: 'enemy-air' → 'enemy', 'ally' → 'ally-unit'; ground/sea/neutral pass through;
   PresentationController passthrough radar.setRangeMultiplier(units.getRadarRangeMultiplier()).

---------------------------------------------------------------------------------------------------
## Test findings (tests batch)

- it.fails (spec disagreement): MagmaColossusMesh / AbyssalLeviathanMesh roots lack userData.hitRadius.
- BossMissileSystem.huntTarget (~l.756) copies playerMesh.position unchecked → a single NaN frame leaves
  in-flight boss missiles NaN forever (old code).
- Player-source applyDamage on an ally damages it with byPlayer = true (pinned as the ally-penalty path).
- Phantom Wing has no collision parts while cloaked at spawn (pinned).
- Boss-mode smoke showed the enemy-health-bars overlay reading "NaNm".
