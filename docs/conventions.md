# Conventions

## Coding

- Strict TypeScript. Avoid `any` unless there is no practical alternative.
- Three.js: `import * as THREE from 'three';`
- App imports: prefer `@/`. Same-feature imports: relative paths.
- Classes/enums `PascalCase`, methods/variables `camelCase`, constants `UPPER_SNAKE_CASE`, interfaces `IPascalCase`.
- Comments/JSDoc in Chinese when useful; identifiers in English.
- Semicolons, single quotes, trailing commas, print width about 100.
- Runtime systems implement `IGameSystem`. Cross-system communication uses `EventBus`, not hidden direct graphs.
- Pools for projectiles, enemies, particles, indicators.
- Aircraft rotation: quaternions, not Euler.
- Validate positions; reject `NaN` / `Infinity`.

## Testing and review

- Meaningful changes finish with `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`.
- Whoever implements a behavior does not author its tests.
- Do not merge to `main` unless explicitly asked. Confirm the current branch with `git branch --show-current`.

## Agent execution

- Main session is PM: split, assign disjoint files, integrate, validate.
- Medium/large rounds use Batch A (visuals), Batch B (combat/feedback), Batch C (runtime/tests). Shared files serialize.
- Update `IMPLEMENTATION_PLAN.md` when work changes plan state.

## Adding content

- New enemy type: `EnemyTypes.ts` enum + `ENEMY_CONFIGS`, then wave rules in spawn selection.
- Cannon / missile tuning: `GAME_CONSTANTS` in `src/config.ts` and the upgrade tracks in `src/features/upgrade/UpgradeSystem.ts`.
- New special weapon: `SpecialWeaponId` / `SPECIAL_WEAPON_IDS` (`src/core/CombatContracts.ts`), `SPECIAL_WEAPON_CONFIGS` + stat table (`src/features/weapons/WeaponTypes.ts`), fire logic in `WeaponSystem`, the unlock chapter (`unlockedWeapons` in `CampaignData.ts`) and an upgrade track (`WEAPON_UPGRADE_TYPES`).
- New unit: `UnitType` + `UNIT_CONFIGS` (`src/features/units/UnitTypes.ts`), a mesh in `UnitMeshFactory`, a behaviour in `updateUnitBehavior` (`UnitBehaviors.ts` / `UnitBehaviorsAir.ts`), wave placement in `UnitDeployments.ts`, a first-contact line in `UNIT_FIRST_CONTACT_RADIO`.
- New boss: `BossType` + `BOSS_CONFIGS` + the level table behind `getBossForLevel` (`BossTypes.ts`), a class implementing `IAdvancedBoss` with a mesh factory, then its creation in `AdvancedBossController`.
- New level / chapter: `LEVELS` (`LevelConfig.ts`) and `CAMPAIGN_CHAPTERS` (`src/features/campaign/CampaignChapters.ts`), with the title added to `CHAPTER_TITLES` (`ChapterTitles.ts`) so the chapter `title` and the level `name` are the same object; keep `TOTAL_LEVELS` and `CAMPAIGN_LEVEL_CAP` equal; add unit deployments, level / boss music (`getLevelMusicForLevel` / `getBossMusicForLevel`) and a start heading (`LevelStartPose.ts`).
- New powerup: `PowerUpType`, manager effect, and config.
- Player-facing text: a `LocalizedText` (`{ en, zh }`, both filled) written next to the data it belongs to and resolved with `tr()` where it is displayed (`src/i18n/index.ts`); per-frame code keeps the object as a module-level constant. Snapshots handed to the HUD stay `string`.
- New voiced line (radio line, briefing / prologue / epilogue paragraph): a stable id that follows the id patterns, recordings in both packs, and `manifest.json` / `provenance.json` entries ([voice-lines.md](voice-lines.md)); `VoicePack.test.ts` fails until both packs have it.
- New terrain: `TerrainType`, `LevelConfig.ts`, `TerrainGenerator` / worldscape, or an environment module extending `EnvironmentBase` registered in `TERRAIN_ENVIRONMENT_FACTORIES` (`src/features/terrain/environments/index.ts`).
- Balance: prefer `public/config/game-config.json` and existing config objects over new hardcoded constants.

New campaign modules follow the shared rules in the campaign API spec: no `document` / `window` access at import time; per-frame code reuses preallocated vectors and guards `NaN` / `Infinity`; transparent VFX / environment materials use `transparent: true`, `depthTest: true`, `depthWrite: false`, `renderOrder 0`; everything added to a scene is removed and disposed in `dispose()` / `clear()` (skip `userData.sharedResource === true`); large meshes declare `userData.hitRadius`. Story, HUD, music, SFX and voice calls from gameplay code go through `ICampaignPresentation` ([ADR 0001](decisions/0001-campaign-presentation-adapter.md)); player-facing text and voice assets follow [ADR 0002](decisions/0002-bilingual-text-and-voice-packs.md).

## Git

Suggested commit subject: `type(scope): short description`. Keep the body factual. Do not commit unless asked.
