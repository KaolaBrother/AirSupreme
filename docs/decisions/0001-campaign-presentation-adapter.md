# 0001 — Campaign presentation adapter and controller extraction

- **Status**: accepted
- **Date**: 2026-10-08 (records decisions taken during the ten-level campaign's integration passes: pass 1 `6368511`, pass 2 `c251b43`, bosses 6–10 extraction `7e505dd`)

## Context

- Before the campaign, `GameCoordinator` assembled every runtime system and held most gameplay wiring (2,554 lines at `a72359b`). The HUD and the rest of the presentation runtime already load lazily through `PresentationRuntimeLoader`, so presentation objects may not exist when gameplay code runs.
- The campaign added story cards, radio chatter, new HUD panels, new radar kinds, a sequencer-driven music engine (23 tracks, 13 of them new slots, and 7 stingers) and a new SFX set, plus ground / sea / air units, special weapons and flares, a first-/third-person camera rig, VFX hooks and bosses 6–10. These were built by parallel batches: the story UI and the audio engine landed in round 3, while integration pass 1 had to wire the gameplay before they existed.
- The shared API spec required new feature modules to load without `document` / `window` (so their logic is testable in a non-DOM runner) and heavy modules to stay out of the entry chunk.

## Decision

1. **One presentation seam.** Gameplay code tells the story, reports HUD state and makes campaign sounds only through `ICampaignPresentation` (`src/core/campaign/CampaignPresentation.ts`, 34 methods: story cards, radio, HUD panels, radar range, music, SFX events). `GameCoordinator` builds `DefaultCampaignPresentation` in its constructor and passes it to the campaign flow, unit, special-weapon and boss controllers. Integration pass 1 implemented the interface with pre-existing HUD / audio calls only; pass 2 swapped the bodies to `StoryOverlay`, `RadioComms`, the new HUD panels, `MusicSystem` and `CampaignSfxRouter` without touching the callers. The implementation:
   - lazy-loads `StoryOverlay` + `RadioComms` (preloaded at game start; `loadStoryUi` is injectable for tests) and buffers radio lines until they exist;
   - reads the HUD and radar through getters that return `null` until the presentation runtime is ready;
   - diffs per-frame HUD pushes so unchanged values cause no HUD call and no allocation.
2. **Per-feature controllers.** Campaign wiring lives in controllers under `src/core/<feature>/`, each with an explicit `…Deps` interface of callbacks into the coordinator: `CampaignFlowController` (decides what happens next; concrete operations such as `prepareLevel` and `showHangar` stay in the coordinator), `UnitController`, `SpecialWeaponsController`, `PlayerViewController`, `CombatVfxController` + `ContrailController`, `CombatHudFeed` (pass 2), and `AdvancedBossController`, extracted from `BossBattleController` for bosses 6–10. Each controller lazy-loads its feature module and is a no-op until it has loaded.
3. **No new EventBus event types.** Unit fire reuses `ENEMY_FIRED` / `FRIENDLY_FIRED` through `bridgeUnitFireToEventBus`; the other campaign links are direct callbacks (`on…` properties) and the `…Deps` interfaces.

## Consequences

- Story, radio, HUD panels, music and SFX were integrated in a second pass with no gameplay changes, and the presentation can be replaced by a fake in tests.
- `CameraRig`, `UnitSystem`, `WeaponSystem`, `CountermeasureSystem`, `ContrailSystem`, `StoryOverlay` / `RadioComms` and bosses 6–10 ship as separate chunks; the feature modules stay DOM-free at import time.
- `ICampaignPresentation` is wide; a new presentation need means extending the interface and `DefaultCampaignPresentation` together.
- `GameCoordinator` is still large: 3,267 lines after pass 1 (`6368511`) and 3,200 at `eaed7be`. `BossBattleController` went from 1,597 to 1,099 lines with the bosses 6–10 extraction (`7e505dd`) and was 1,221 lines at `eaed7be` after the bosses 1–5 hit-volume work.
- Some call orders are conventions rather than types — for example `SpecialWeaponsController.syncProgression` before `importState` when restoring a checkpoint (the upgrade level sets the ammo cap). They are documented next to the methods and in [`docs/api.md`](../api.md).

## References

- [`docs/architecture.md`](../architecture.md) — controller table, simulation step and campaign flow
- [`docs/api.md`](../api.md) — `ICampaignPresentation` and the controller contracts
- Run record (orchestrator-owned): `kaola-workflow/ten-level-campaign/integration-notes.md`, section "Integration pass 1 — what exists now"
