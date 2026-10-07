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
