# ✈️ Air Supreme — 3D Air Combat Game

**[English](README.md) | [简体中文](README.zh-CN.md)**

A 3D air-combat game built with Three.js + TypeScript, playable on desktop and mobile browsers. The current version is a ten-chapter story campaign, **AIR SUPREME · The Skydome War**: ten levels in ten environments, ten bosses, ground / sea / air units from three factions, five unlockable special weapons plus flares, a switchable first-person cockpit and third-person chase view, mid-level autosave with Continue, and a hangar between chapters. The game is in English by default, with Simplified Chinese (中文) one setting away, and the radio crew and story narration are voice-acted in both English and Mandarin. Boss mode, the tutorial level, event waves, the pause pod and the model preview carry over from earlier versions.

## 🎮 Game Features

### Current Content

- **Ten-chapter story campaign** — 10 levels, 10 bosses, chapter cards, radio chatter, debriefs and an ending
- **English by default, 中文 as an option** — switch the **Language** row in the start menu or the pause settings; menus, HUD, radio and voices follow at once
- **Voice acting in English and Mandarin** — the radio crew and the story narration are voiced, with on-screen text as subtitles and a separate **Voice volume**
- **Named wingmen** — Raven flies with you from chapter 1, Swift joins in chapter 3; they launch with you at the start of every level and keep out of the chase camera's way
- **Normal mode / Boss mode** — Boss mode lets you fight any of the ten bosses directly
- **First-person cockpit / third-person chase view** — press **V** (or the mobile **VIEW** button) at any time
- **Five special weapons + flares**, unlocked as the story advances
- **Ground, sea and air units** in three factions — hostile, friendly and civilian
- **Autosave checkpoints + Continue** — from the start menu and from the game-over screen
- **Hangar between chapters** — tiered upgrades whose caps open up chapter by chapter
- **Procedural soundtrack** — 23 tracks and 7 stingers synthesized live with Web Audio, plus a new SFX set
- **Tutorial toggle**
- **Pause pod with in-match settlement**
  - ESC / P opens the pause pod; on desktop U pauses then opens the upgrade shop
  - Failure shows `MISSION FAILED`, victory `MISSION COMPLETE` (任务失败 / 任务完成 in Chinese); play again or return to the main menu
- **Site chrome**
  - `index.html`: `<link rel="icon" href="/favicon.svg">` (`public/favicon.svg`); viewport includes `viewport-fit=cover`
  - The page ships as `<html lang="en">` with English loading-screen and touch-button text; `src/main.ts` applies the saved language before any UI renders and keeps `<html lang>` in step
- **Runtime boundaries and lazy loading**
  - Start menu and game runtime are boundary-split
  - Combat UI / presentation runtime are created on demand
  - Camera rig, units, special weapons, contrails, story cards / radio and bosses 6–10 load as separate chunks
  - Deep runtime chunks are pre-warmed while the menu idles
- **Event waves** — elite annihilation, timed interception, escort defense
- **Model preview**

### 📖 Story

At 05:17, every combat drone Obsidian Dynamics ever built slipped out of human control in the same second. They answer to the company's secret war AI now: **ORACLE**. It broadcast a single sentence to the world: *"The sky requires order."* The Skydome Joint Air Defense Force, 7th Wing, is ordered to engage. You are the wing's ace, callsign **Falcon** — a silent protagonist.

The cast you will hear on the radio (`CAMPAIGN_SPEAKERS`, `src/features/campaign/CampaignCast.ts`):

| Callsign | Character | Role |
| -------- | --------- | ---- |
| Skydome | Col. Elena Varga | command (HQ); she also narrates the story cards |
| Raven | Lt. Jack Mercer | your wingman |
| Swift | Lt. Freya Lindqvist | your second wingman, with the flight from chapter 3 |
| Firefly | Dr. Chen Xi | chief scientist |
| Lighthouse | Capt. Amelia Hart | allied AWACS controller |
| Bulwark | Cdr. Liang Wei | captain of the allied frigate *Bulwark* |
| ORACLE | — | the enemy war AI |
| Coastal 702 · Northern Star | an airliner captain · a freighter mate | civilians caught in the fighting |

Each speaker has their own portrait glyph in the radio panel. In Chinese the callsigns read 天穹, 渡鸦, 雨燕, 萤火, 灯塔, 壁垒, 神谕, 海岸702 and 北星号.

Each chapter opens with a typewriter story card (the prologue plays before chapter 1 of a new game; chapters that unlock a weapon add an unlock line). Skydome reads the prologue, the chapter briefings and the epilogue aloud, and the typewriter keeps pace with her voice. Click / tap / Space / Enter reveals the text, then turns the page; **Esc** or **Skip** skips the whole sequence; cards also turn by themselves after a reading pause. After each boss a debrief card tallies the chapter's score, kills, civilians lost, allies lost and your total score; chapter 10 ends with an epilogue and credits, then `MISSION COMPLETE`.

### 🗺️ Ten Levels

| # | Chapter · Operation | Level | Setting | Environment · weather | Boss |
| -: | ------------------- | ----- | ------- | --------------------- | ---- |
| 1 | Chapter 1 · OPERATION FIRST LIGHT | Dawn at the Lake | Northern Lakes · Mirror Lake Dam | `LAKE` · clear | Heavy Bomber “Thunderhead” |
| 2 | Chapter 2 · OPERATION SANDWALL | Sandstorm | Southern Sand Sea · Obsidian Supply Corridor | `DESERT` · sandstorm | Mobile Fortress “Sandwall” |
| 3 | Chapter 3 · OPERATION WHITE ECHO | Snowbound Summit | Frostridge Mountains · Aurora Research Station | `MOUNTAINS` · snow | Octopus Warship “Kraken” |
| 4 | Chapter 4 · OPERATION TRIDENT FALL | Battle of the Deep | Storm Strait · Eastern Sea Lane | `OCEAN` · cloudy | Missile Destroyer “Trident” |
| 5 | Chapter 5 · OPERATION SKYFALL | City in Ruins | The Capital · Over the Central District | `CITY` · smog | Sky Carrier “Colossus” |
| 6 | Chapter 6 · OPERATION HEARTFORGE | Heart of the Forge | South Pacific · Ember Island | `VOLCANO` · ash | Siege Walker “Magma Colossus” |
| 7 | Chapter 7 · OPERATION POLAR NIGHT | Aurora Sea | Arctic Ocean · Aurora Ice Shelf | `ARCTIC` · aurora | Giant Submarine “Abyssal Leviathan” |
| 8 | Chapter 8 · OPERATION STORMBREAK | Thunder Canyon | Western Badlands · Thunder Canyon | `CANYON` · storm | Armored Zeppelin “Tempest” |
| 9 | Chapter 9 · OPERATION SKYSPIRE | Atop the Sky Ladder | Equator · Sky Ladder Space Elevator · Stratosphere | `STRATOSPHERE` · clear | Stealth Wing “Phantom” |
| 10 | Final Chapter · OPERATION LAST LIGHT | The Oracle Core | Obsidian Citadel · The Crater | `CITADEL` · ash | ORACLE PRIME |

The script lives in `src/features/campaign/`: chapters and their radio lines in `CampaignChapters.ts`, first-contact and generic radio lines in `CampaignRadio.ts`, prologue / epilogue / credits in `CampaignStory.ts`, the cast in `CampaignCast.ts` and the chapter titles (shared with the level table) in `ChapterTitles.ts`; `CampaignData.ts` is the single import point. Every player-facing string there is an English / Chinese pair. Level tables (waves, enemy mix, weather, lighting, post-processing grade) live in `src/features/terrain/LevelConfig.ts`.

### 🌍 Environments (Worldscape + environment modules)

Levels 1–5 are generated by the procedural Worldscape engine (seeded noise heightfields + biome vertex coloring + instanced vegetation); levels 6–10 add dedicated environment modules under `src/features/terrain/environments/`:

1. **Dawn at the Lake** — lake valley: piers, village, water lilies, 24,000 wind-swaying grass blades, pine and broadleaf forest, merged sphere-cluster instanced clouds
2. **Sandstorm** — dune heightfield, warm rocks, dry grass accents, cactus clusters
3. **Snowbound Summit** — snowline ridges, glacial-blue tarns, raised valley, drifting mist
4. **Battle of the Deep** — open-ocean fair day (ambient fully brightened), Fresnel/shore-foam shader water, scattered islets
5. **City in Ruins (New York-ish)** — Central-Park meadow + Empire-State-style spire / Chrysler-style crown / twin glass towers, Brooklyn-style suspension bridge, double-deck elevated expressways, elevated loop trains (animated traffic and lit windows), street lights + billboards + nearly doubled window-light density
6. **Heart of the Forge** — a volcanic island arsenal: the main volcano with a crater lava lake and ash column, three lava rivers steaming into the sea, glowing cracks in cooled basalt, Oracle's foundry (cooling towers, blast furnaces, flare stacks); falling ash and rising embers. The sea around the island is navigable water.
7. **Aurora Sea** — the polar-night Arctic Ocean: dark open water between ice shelves and tabular / pinnacle icebergs, drifting floes, sea smoke, an iced-in outpost with radar domes and searchlights, aurora curtains and light snow.
8. **Thunder Canyon** — three winding sandstone canyons with stepped walls and mesas, a flooded red-mud river (navigable), the convoy's dirt road, storm-rain waterfalls and Oracle's Tesla collector towers; storm weather whose lightning strikes the real ground.
9. **Atop the Sky Ladder** — 20 km up above a sunset cloud deck: the orbital elevator's fibre trunk, lift cars, a ring platform on six pylons and anchor towers. The cloud sea is a crash surface — fly into it and you go down.
10. **The Oracle Core** — the obsidian citadel in a meteor crater: terraced crater walls, four lava rifts and four cyan data conduits converging on the fortress, energy obelisks feeding the core beam; the final battle is fought above the core well.

**Weather**: presets `clear`, `cloudy`, `mist`, `windy`, `sandstorm`, `snow`, `storm`, `smog`, plus the new `ash` (falling ash and rising embers) and `aurora` (aurora bands and light snow); `storm` (rain and lightning) now drives the canyon. **Dynamic clouds** drift with the wind, wrap around, bob vertically and are tinted by weather; under dark weather they render smoother.

**Worldscape stack** (`src/features/terrain/worldscape/`): seeded simplex/fbm/ridged noise heightfields; biome vertex coloring; wave/Fresnel/shore-foam shader water; instanced pines/broadleaf trees/rocks/24k swaying grass; merged sphere-cluster clouds; wind-sway and snow-accumulation shader injections.

### Varied Enemy AI

- **Scout** — fast but fragile, high evasion
- **Fighter** — balanced, standard combat unit
- **Heavy Bomber** — slow, high HP, high damage
- **Sniper** — long-range precision attacks
- **Ace** — hard, smart AI with advanced tactics

Enemy jets look ahead and climb around tall terrain (canyon walls, the volcano, the sky-ladder pylons, the citadel), never dive into the ground, only open fire inside a set range, and drift helplessly while stunned by an EMP. Their strength rises from chapter to chapter (`getLevelScaling` in `src/core/Difficulty.ts`, which reads one per-level table, multiplied by the difficulty you pick: Very Easy, Easy, Normal, Hard or Expert): from chapter 2 they lead their shots, more and more as the campaign goes on, so flying straight gets you hit; more of them are in the air at once from chapter 4; and their firepower steps up from chapter 6. The default, Normal, was tuned with a scripted-pilot balance harness that only ships in dev builds.

### 🚛 Ground, Sea and Air Units

Seventeen unit types fight alongside the enemy jets. They spawn wave by wave (`src/features/units/UnitDeployments.ts`), each with its own behaviour, and announce themselves over the radio the first time you meet them.

| Faction | What it means for you |
| ------- | --------------------- |
| **Hostile** | Counts toward clearing the wave — a wave ends only when its jets **and** its hostile units are down (if only stragglers remain, the wave releases after a time limit). Destroying one scores points. |
| **Friendly** | Fights on your side. Escorts (convoys, transports) earn a bonus when they arrive safely; if you destroy a friendly unit yourself you lose score, and every ally lost is counted in the debrief. A lost AWACS or frigate is reported over the radio by its own crew (Lighthouse, Bulwark). |
| **Civilian** (neutral) | Never hostile to anyone, but can be caught in the crossfire. Your first hit on one draws a cease-fire call on the radio; destroying one yourself costs score, and every civilian lost is counted in the debrief. |

Hostile units:

| Unit | Domain | Behaviour |
| ---- | ------ | --------- |
| Main Battle Tank | ground | tracks you and fires its cannon |
| SAM Launcher | ground | locks on, then launches — the HUD warns while it is locking; answer with flares |
| Twin AA Gun | ground | leads its flak barrages; with you out of reach it turns on friendly jets |
| Radar Station | ground | spotter: while one stands, enemy jets shoot more accurately |
| Fast Gunboat | sea | zig-zags at high speed while firing its gun |
| Missile Frigate | sea | vertical-launch missiles and close-in defense guns |
| Attack Submarine | sea | surfaces to lock on and launch missiles, then dives; it can only be hit while surfaced (a sonar contact on radar while submerged) |
| Attack Helicopter | air | hugs the terrain, strafes with rocket pods and gun; autorotates down when shot |
| Strategic Bomber | air | high, straight bombing runs on friendly ground and sea units; tail gun |
| Kamikaze Drone | air | cruises in formation, then dives to ram |

Friendly units: Allied Convoy (escort), Allied Frigate (its close-in guns shoot down missiles, plus anti-air and anti-ship fire), Allied AWACS (extends your radar range while it lives), Allied Transport (escort). Civilian units: Airliner, Civilian Freighter, Civilian Truck — they follow their routes and leave the battlefield.

**Wingmen**: your named flight launches with you shortly after every level starts — Raven in chapters 1–2, Raven and Swift from chapter 3 (`WINGMEN`, `src/core/campaign/Wingmen.ts`); continuing from a checkpoint before a boss launches it with the boss briefing. Any further friendly jets (reinforcements, boss-fight support, the Call Wingman pickup, escorts) are ordinary allied fighters; only in Boss mode, where no flight launches, do the first of them fly under Raven's and Swift's callsigns. A wingman's callsign shows on its health bar. With nothing to fight, the wingmen hold formation slots ahead of you, one on each side, clear of the chase camera's line of sight to your jet, and new friendlies join on their own side. Swift reports in over the radio once per campaign, the first time she flies with you; if a wingman is shot down, the other one calls it (or Skydome, if the other is not airborne), and the downed wingman sits out the rest of the level (the flight is back together at the next level, or when you continue from a checkpoint).

**Radar legend**: enemy jet = red dot · enemy ground unit = red square · enemy ship = red diamond · boss = large red dot with ring · friendly jet = gold dot · friendly unit = gold triangle · civilian = grey hollow circle (do not fire) · pickup = green dot · arriving through a portal = amber dot.

### 🚀 Missile System

- **Smart lock-on** — hold the missile key (M or Right Shift) to lock a target
- **Lock progress** — 1.5 s lock time (upgradable); TRACK diamond + arc (`--hud-weapon` `#FFB347`)
- **Lock-range upgrade** — separate upgrade track; at max level the lock circle grows to `2x` base
- **Visual cues** — SEARCH hollow dashed ring / TRACK diamond + arc / LOCK mint `#5CFFB0` / BREAK threat red `#FF4D4D` / DRY `NO MSL`
- **Homing missiles** — track the target; auto-relock nearest enemy after a kill
- **Resource management** — start with 2; auto-resupply (1 per 7.5 s, up to 5, upgradable)
- **Ammo cue** — pressing M with no missiles shows `NO MSL` (not `NO MISSILE`)
- **UI progress bar** — top-right white bar showing progress toward the next missile
- **Damage** — 50 per missile (4× the cannon)
- **Player missile look** — AIM-120-style single-piece lathe body, black radome / roll bands / inscriptions / X-fin layout

### ☄️ Special Weapons & Flares

Special weapons unlock with the story and are fired with **F**; select one with **1–5** or cycle with **Tab / X**. Each weapon has its own ammo, reload, heat or charge, shown in the HUD stores panel. Weapons hit hostile and civilian targets (watch your aim near civilians); friendly units and you are never damaged.

| Key | Weapon | Code | How it fires | Unlocks |
| --- | ------ | ---- | ------------ | ------- |
| 1 | 🚀 Cluster Rockets | `RKT` | press F: a salvo of unguided rockets that burst on impact, by proximity or at max range — splash damage against armoured columns | Chapter 2 |
| 2 | 🔆 Pulse Laser | `LSR` | hold F: a continuous beam that burns the first target on the line; heat builds, and an overheat locks the laser until it has fully cooled | Chapter 4 |
| 3 | 🐝 Swarm Missiles | `SWM` | press F: a volley of micro-missiles auto-assigned to different enemy targets in a forward cone — no lock needed | Chapter 6 |
| 4 | ☄️ Railgun | `RLG` | hold F to charge, release to fire a slug that pierces every target on its line; more charge, more damage; releasing too early cancels without spending ammo | Chapter 7 |
| 5 | 🌀 EMP | `EMP` | press F: a pulse that stuns enemy units and jets, damages missiles and drones in range, and forces cloaked targets to appear | Chapter 9 |

**Flares (G)** throw a fan of burning flares behind the jet. SAM missiles and every boss's missiles steer toward burning flares; charges recharge over time, and the flare-rack upgrade raises capacity from 2 to 6. Weapon stats per upgrade tier live in `src/features/weapons/WeaponTypes.ts`.

### 👁️ First- / Third-Person View

- **V** (desktop) or the **VIEW** button (mobile) toggles between the third-person chase camera and a first-person cockpit, with a smooth blend; the start-menu **Camera** row sets the default and your last choice is remembered
- The cockpit has a glareshield, three MFDs, an up-front control panel, gauges, warning lights and a HUD combiner glass; the jet's exterior is hidden from the cockpit view and the shield bubble fades so it does not block the view
- Camera shake from hits, explosions, weapon recoil and boss hazards; the field of view widens with speed and boost

### Power-ups

| Power-up | Effect | Duration |
| -------- | ------ | -------- |
| ❤️ Repair Kit | an extra life and a full heal | instant |
| 🛡️ Energy Shield | invulnerable | 10 s |
| ⚡ Speed Boost | speed +50% | 15 s |
| 🔥 Damage Boost | damage ×2 | 20 s |
| 🎯 Rapid Fire | triple fire rate with spread shots; missiles fire in threes | 20 s |
| ✈️ Call Wingman | a friendly fighter joins the fight | until shot down |

Names, durations and values live in `POWER_UP_CONFIGS` (`src/features/powerups/PowerUpSystem.ts`); the pickup effects are applied in `GameCoordinator.handlePowerUpEffect`.

### 🛠️ Upgrades & Hangar

Score earns upgrade points (⭐), and later chapters pay more score per kill. Spend points in the hangar (**Refit & Rearm**) that opens between chapters — press **Launch** to fly the next chapter — or mid-mission from the pause pod (**ESC** / **P** → **Upgrades**; on desktop **U** pauses and opens the shop directly). Unspent points carry over.

There are 14 upgrade tracks. Each track has a **cap for the current chapter** that opens up as the campaign advances, so the jet grows with the difficulty:

| Group | Tracks | Tiers | Cap in chapter *n* |
| ----- | ------ | ----: | ------------------ |
| Core | max health, flight speed, fire rate, weapon damage, lock range, missile reload, missile lock | 10 | `min(10, n + 1)` |
| Defense | composite armour, flare rack | 5 / 4 | `min(max, ceil(n / 2) + 1)` |
| Special weapons | rockets, laser, swarm, railgun, EMP | 5 each | locked until the weapon unlocks, then `min(5, n − unlock chapter + 2)` |

| Upgrade | Base | Max | Per tier |
| ------- | ---- | --- | -------- |
| Max health | 200 | 400 | +20 |
| Flight speed | 45 | 85 | +4 |
| Fire rate | 0.30 s | 0.10 s | −0.02 s |
| Weapon damage | 12.5 | 30 | +1.75 |
| Lock range | 1.0x | 2.0x | +0.1x |
| Missile reload | 7.5 s | 2.5 s | −0.5 s |
| Missile lock | 1.5 s | 0.5 s | −0.1 s |
| Composite armour | 0% | 40% damage reduction | +8% |
| Flare rack | 2 flares | 6 flares | +1 |

Tier costs rise with the tier; the current costs live in `UPGRADE_CONFIGS` (`src/features/upgrade/UpgradeSystem.ts`). Starting at a later chapter — in normal or Boss mode — grants a starting budget of upgrade points and opens the hangar first; the chapter caps still apply.

### 💾 Autosave & Continue

- In normal mode the game saves a checkpoint when a chapter starts, after each wave, right before the boss and the moment a boss falls (chapters 1–9; a *hangar* checkpoint for the next chapter, saved again when you press **Launch** so your hangar purchases are kept); an **Autosaved** toast in the HUD confirms each save, and it follows a language switch while it is on screen
- **Continue Campaign** appears on the start menu when a checkpoint exists, labelled like `Ch. 6 · Heart of the Forge · Wave 3` or `Ch. 2 · Sandstorm · Hangar` (`第6关 · 熔炉之心 · 第3波` / `第2关 · 沙漠风暴 · 机库整备` in Chinese); after `MISSION FAILED` the settlement screen offers **Continue from checkpoint**
- A checkpoint restores score, lives, missiles, upgrades, unlocked weapons and their ammo, flare charges, the camera view and the run statistics, and puts you back at the saved wave or the boss — or, for a hangar checkpoint, in the hangar before the next chapter, then its chapter card (weapons and flares are refilled for the new chapter)
- Starting a new normal-mode game clears the old checkpoint; finishing chapter 10 marks the campaign complete and clears it; Boss mode never writes checkpoints
- Saves live in `localStorage` (`air-supreme:campaign-save`; completion, best score and highest level reached in `air-supreme:campaign-progress`)

### Boss Battles

Normal-mode flow:

`chapter card → briefing + radio → waves (autosave after each) → autosave → boss → autosave → debrief → hangar → next chapter`

After chapter 10: debrief → epilogue and credits → `MISSION COMPLETE`.

The start menu also offers **Boss mode** to fight any of the ten bosses directly: no story cards (only the boss's arrival lines), weapons unlocked through that chapter, and a hangar stop between bosses. Bosses arrive ahead of you — if you are flying out of the arena, a *Return to the combat zone · Boss incoming* prompt holds the boss until you turn back, and a boss that appears far off or off your nose is called out with its bearing and distance. Phase changes bring an alarm, radio lines and a lift in the music (bosses 6–10 also flash a HUD warning), and the HUD shows the boss's status and phase pips. After the kill, the debrief waits until every defeat line on the radio has been heard (game time, so pausing does not cut it short), up to a cap worked out from the voiced lines still queued plus 6 s, never more than 75 s (`BOSS_OUTRO_MAX_SECONDS` in `src/core/campaign/CampaignFlowController.ts`). Boss missiles hit harder or softer with the difficulty you pick (45 per hit on Normal for most bosses), and flares decoy the missiles of all ten bosses. Boss HP, damage and fire rates live in `BOSS_CONFIGS` (`src/features/boss/BossTypes.ts`).

| # | Boss | How it fights / weak point |
| -: | ---- | -------------------------- |
| 1 | Heavy Bomber “Thunderhead” | long fuselage / 6 ducted intake fans / turret cluster; the belly bomb bay is the weak point when it opens |
| 2 | Mobile Fortress “Sandwall” | tracked base / sloped armor / twin main guns / rotating radar / war banner; knock out the four corner flak cannons, then focus the core |
| 3 | Octopus Warship “Kraken” | spherical shell / exposed glowing brain core / 8 segmented swaying tentacles with sensor eyes and laser sweeps; blinding the eyes weakens the body |
| 4 | Missile Destroyer “Trident” | Burke-class hull / phased array / VLS cells / CIWS / helipad; the bridge and VLS cells are vital, and its missiles can be shot down |
| 5 | Sky Carrier “Colossus” | angled deck / arresting wires / island rotating radar / elevators / launches fighters; hit the island radar and catapults |
| 6 | Siege Walker “Magma Colossus” | four-legged basalt walker: head cannons, mortar salvos with landing markers, missile volleys, stomp shockwaves; its back vents glow open after a salvo (weak points — destroying one strips armour); phase 2 opens the furnace core, lava columns and a chest-beam sweep; phase 3 is a meltdown, and it staggers when nearly dead |
| 7 | Giant Submarine “Abyssal Leviathan” | invulnerable while submerged; a red ring on the water warns before it breaches through the ice; surfaced, its deck turrets and missile bay fire; conning tower, four ballast tanks and the missile bay are separate targets; phase 2 lays shootable contact mines and launches drones; phase 3 stays surfaced and rams along a red lane |
| 8 | Armored Zeppelin “Tempest” | six glowing gas cells (each one burst lowers and tilts it), Tesla coils that chain lightning between targets — pull away when they glow blue — and a storm shroud that shocks anything inside; phase 2 opens a drone hangar and calls lightning along your path; phase 3 exposes the storm core |
| 9 | Stealth Wing “Phantom” | cloaks (cannot be locked or hit) and ambushes; laser-lance dives along a red danger lane; two wingtip phase emitters; phase 2 projects holographic decoys (cyan exhaust — the real one burns red); phase 3 overdrive; an EMP forces it to decloak |
| 10 | ORACLE PRIME | phase 1: four orbiting crystal shield pylons (prism, arc, seeker, lance) protect an invulnerable core; phase 2: the exposed core with rotating emitter arrays and the Judgement lance; phase 3: overload — gated shockwave rings (fly through the green gap), twin rings, orbital strikes and a final Last Light |

**Boss missiles**: two-stage hybrids (booster / separation ring / cable conduits / armor plates / hazard stripes / string numbers), slowly rolling in flight.

### ✨ Combat Effects

- **Particles**: an instanced particle backend with layered recipes — explosions, hits, impacts per surface (ground, desert, snow, city, lava, ice, rock, cloud, water), muzzle flashes, damage smoke on damaged jets, big ship splashes, EMP bursts, pickup bursts
- **Post-processing**: HDR pipeline with bloom, colour grade and vignette tuned per level (`LevelConfig.postFx`)
- **Screen effects**: damage pulse, low-health vignette with a heartbeat, speed lines while boosting, white flash, and a short electric-blue EMP pulse at the screen edges that leaves the reticle clear (the EMP's shock rings and shell fade near the camera, so the chase view no longer whites out)
- **Wingtip contrails** on the player, enemy jets and wingmen; **hex shield ripple** where shots hit the shield; throttle-driven afterburner
- **Explosions**: multi-stage effects (core flash / shockwave ring / gravity embers / rising smoke); bosses trigger multi-stage detonations
- **Bullets**: tracer glow + trails; boss shells have pulsing cores and arcing sparks
- **Hit feedback**: dispatched by source — player hits / enemy hits / boss hits each have distinct flashes / sparks / debris / smoke
- **Portals**: rebuilt as counter-rotating vortex gates

**Quality presets** (start menu **Graphics**, also in the pause settings): `auto` (performance on mobile, balanced on desktop), `performance` (post-processing off — screen effects use a lightweight overlay), `balanced` and `quality`. The particle budget and special-weapon effect density follow the preset, and so do the vegetation's near / far detail distance and density (read when a level loads).

### 🎵 Music & Sound

- 23 procedural tracks — ten level themes, ten boss themes, menu, story and victory — plus 7 stingers (chapter start, checkpoint, level complete, boss phase change, boss defeated, game over, campaign complete), all synthesized live; music and sound effects load no audio files (the only audio files are the voice packs below)
- The music builds with boss phases and follows chapter cards, debriefs and the ending; the menu music starts after your first click or key press
- New sound effects for the special weapons, flares, SAM lock warnings, unit fire and destruction, boss hazards, the camera switch, autosave, radio, typewriter text and debrief tallies

### 🎙️ Voice Acting

- Every radio line and every narrated story paragraph is voiced, in **English** and in **Mandarin Chinese**; the voice follows the **Language** setting — switching language silences the line being spoken, and the lines after it are voiced in the new language
- Radio voices play through a radio filter shaped per speaker (wider and cleaner for HQ and the AWACS, narrower with more static for the cockpits, the frigate and the civilian channel), with a squelch tail at the end of each line; the story narration (Skydome) plays clean. Every line is loudness-matched, and the music dips under the voice and comes back afterwards
- The on-screen text doubles as subtitles: radio lines stay up until their voice has finished, and the story typewriter is paced to the narration
- **Voice volume** (start menu) / **Voice** (pause settings) sets the level; at 0% the radio and story cards are text only
- Urgent warnings (incoming missile, low health, civilian hit) interrupt radio chatter that is only on screen, but never a line being spoken: the HUD warning and tone still go off, and the low-health call waits until the line ends. The incoming-missile and civilian-hit calls are voiced at most twice per wave or boss fight. A line that is cut off replays from the start, once. Pausing the game pauses the voice, and it resumes where it stopped
- The voice lines are AI-generated (ElevenLabs `eleven_v4`, one take per line) and carry C2PA provenance metadata; files, manifest and per-file provenance live in `public/voice/` — see [`docs/voice-lines.md`](docs/voice-lines.md)

### 🖥️ HUD

- Special-weapon stores panel (ammo, reload, heat, charge, cooldown, slots), flare counter with recharge, autosave toast, camera-mode chip
- Boss status strip with phase pips and hazard warnings; missile warning (`locking` / `incoming`) that combines SAM locks and boss missiles
- Radio panel with a portrait glyph for every speaker and a priority queue (urgent warnings interrupt chatter, but not a voiced line); voiced lines stay up until the voice finishes
- Health bars label jets by type, bosses by name and units by side (hostile / friendly / civilian), in the current language; your wingmen show their callsigns. Boss parts get compact bars, and only the part nearest your reticle shows its name
- The layout respects the screen's safe areas and keeps the top of the screen free of overlaps on phones in portrait and landscape: a status column on the right (wave, lives, missiles, reload, power-up timer), a centre message stack (boss strip, briefing, event objective) with the radio panel below it; pickup and event callouts appear above the lock ring, never on the reticle
- Level and boss briefings and the autosave toast switch language on the spot if you change it while they are showing
- On touch devices the weapon, flare, camera and missile state shows on the touch buttons themselves

### 🛩️ Aircraft Detail

All 6 aircraft (player + 5 enemy types) include:
- Nozzles + afterburner glow
- Cockpit frames
- Pylon missiles (player / Fighter / Ace)
- Heavy ventral bomb racks
- Sniper long barrels
- Antennas / pitot tubes / livery stripes
- Corrected navigation-light offsets (no drift after 2× fuselage scaling)

Wingmen fly the same airframes in an allied livery, and the player's afterburner follows the throttle.

### Tutorial and Event Waves

- **Tutorial**: the start-menu **Tutorial** toggle; the first level teaches basics as you go
- **Event waves**: elite annihilation / timed interception / escort defense
- **Upgrade-point feedback**: HUD prompt on earning points, with guidance to the upgrade menu

### Model Preview

- Openable from the start menu: the player jet, the five enemy jets, all ten bosses (each with its own model), the player missile and the boss missile
- Framing fits the visible geometry to both the width and the height of the view, so big bosses and narrow portrait screens are not cropped
- Assets are prefetched during idle menu time before first open

## ⚙️ Settings & Language

Start-menu settings, top to bottom (each row has − / + buttons):

| Row | Values |
| --- | ------ |
| Continue Campaign | shown only when a checkpoint exists (see *Autosave & Continue*) |
| Language | English · 中文 — menus, HUD, radio, touch buttons and the voice pack switch at once (a story card already on screen finishes in its language) |
| Difficulty | Very Easy · Easy · Normal · Hard · Expert |
| SFX volume · Music volume · Voice volume | 0–100% in 10% steps; Voice volume 0% = subtitles only |
| Graphics | Auto · Performance · Balanced · High |
| Camera | Third-person · First-person |
| Tutorial | On · Off |
| Lives | 1–9 |
| Start level | 1–10, with the chapter title underneath |
| Game mode | Normal · Boss mode |
| Test score | Off or a starting score, for testing |

Below them: **Start Game** (**Boss Challenge** in Boss mode), **Model Preview** and the controls legend. In a mission, **ESC** / **P** → **Settings** offers Sound effects, Music, Voice, Graphics and Language, applied at once.

Settings are saved in `localStorage` (`air-supreme:start-menu-settings`; fields and defaults in `StartFlowSettings` / `DEFAULT_START_FLOW_SETTINGS`, `src/core/SessionSettings.ts`). The game starts in English, Normal difficulty and the third-person view; the language does not follow the browser, and settings saved before the Language option existed load in English. The option names stay in their own language (English / 中文) so you can always find yours.

## 🎯 Controls

### Desktop Browser

| Key | Action |
| --- | ------ |
| W / S (or ↑ / ↓) | pitch (nose up/down) |
| A / D | yaw (nose left/right) |
| Q / E | roll (wing tilt) |
| Space | cannon fire |
| M / Right Shift | missile lock/fire |
| Left Shift / Left Ctrl | boost |
| F | fire the selected special weapon (hold for the laser and to charge the railgun) |
| Tab / X | cycle special weapons |
| 1 – 5 | select rockets / laser / swarm / railgun / EMP (number row or numpad) |
| G | deploy flares |
| V | toggle first-person / third-person view |
| ESC / P | pause pod (Resume / Upgrades / Settings / Main Menu) |
| U | open the upgrade shop after pausing |

### Mobile

Button labels follow the Language setting (Chinese labels in brackets):

- **Left virtual stick**: steer
- **FIRE** (开火): cannon
- **MSL** (导弹): missile lock/fire
- **BOOST** (加速): boost
- **SPEC** (特武): tap to fire the selected special weapon (hold for the laser or to charge the railgun); once a weapon is selected the button shows its code, and its ring shows reload / heat / charge
- **SWAP** (切换): next special weapon
- **FLARE** (热焰): deploy flares; its ring turns amber while a missile is locking and flashes red when one is incoming
- **VIEW** (视角): toggle first-person / third-person
- **PAUSE** (暂停): pause pod (even a very quick tap registers)

## 🚀 Quick Start

Requires Node `^18.0.0 || >=20.0.0` (locked Vite toolchain).

### Install

```bash
npm install
```

### Dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
npm run build     # tsc && vite build
npm run preview   # serve the production build locally
```

### Checks

```bash
npx tsc --noEmit
npm run lint
npm run test:run  # vitest, single run (npm run test = watch mode)
```

## ✅ Engineering Status

- The ten-level campaign (story, levels 6–10, bosses 6–10, units, special weapons, camera rig, autosave, hangar, music and VFX overhaul) is integrated, together with the English-first interface and its Chinese option, the new cast and named wingmen, and English / Mandarin voice acting; see `CHANGELOG.md` → *Unreleased*
- `GameCoordinator`, combat runtime, boss controllers, presentation/UI runtime and the new campaign systems are all on lazy-init paths; voice lines are fetched on demand (the current chapter's lines are prefetched when it starts)
- The fixes from an independent final audit (respawn safety, hangar checkpoint, radio warning budget, both wingmen, HUD layout on phones, boss previews, balance curve, terrain performance) are merged; see `CHANGELOG.md` → *Unreleased* → *终验修复* (audit fixes)
- Tests live in `src/__tests__` (77 `*.test.ts` files; 1,662 tests passing and 2 skipped at the time of writing); run `npm run test:run` for current results
- Known observations: the `vendor-three` chunk-size warning during build

## 📁 Project Structure

```
src/
├── core/                         # core systems
│   ├── GameCoordinator.ts        # main coordinator (v2)
│   ├── BossBattleController.ts   # boss lifecycle; bosses 1-5 logic
│   ├── PresentationRuntimeLoader.ts # lazy presentation-runtime loader
│   ├── PresentationController.ts
│   ├── EventBus.ts               # event bus (v2)
│   ├── CombatContracts.ts        # shared combat types (targets, damage sources, decoys)
│   ├── Difficulty.ts             # difficulty profiles + per-level scaling
│   ├── Faction.ts                # ENEMY / FRIENDLY / NEUTRAL / CIVILIAN
│   ├── SessionSettings.ts        # persisted start-menu settings (incl. language, voice volume)
│   ├── GameLoop.ts               # game loop
│   ├── GameState.ts              # game state
│   ├── campaign/                 # campaign flow, presentation adapter, SFX router, start poses, menu music, Wingmen roster
│   ├── units/                    # UnitController (unit runtime wiring)
│   ├── combat/                   # SpecialWeaponsController (weapons + flares wiring)
│   ├── camera/                   # PlayerViewController (CameraRig wiring)
│   ├── vfx/                      # CombatVfxController, ContrailController
│   ├── boss/                     # bosses 6-10 controller, hit feedback, spawn / hit-volume helpers
│   ├── hud/                      # CombatHudFeed (radar blips, health bars)
│   ├── save/                     # SaveSystem (campaign checkpoints)
│   ├── dev/                      # dev-build-only debug hooks
│   ├── interfaces/               # system interfaces (v2)
│   │   └── IGameSystem.ts
│   ├── systems/                  # subsystems (v2)
│   │   ├── PlayerSystem.ts
│   │   ├── CombatSystem.ts
│   │   ├── EnemySystem.ts
│   │   └── PowerUpSystem.ts
│   ├── Input/                    # input handling
│   ├── Audio/                    # SFX, music system, music/ sequencer + tracks, sfx/ library, VoiceSystem + VoiceDucking
│   └── utils/                    # utilities
│       ├── ConfigLoader.ts       # config loader
│       └── Logger.ts             # logging
│
├── features/                     # game features
│   ├── aircraft/                 # aircraft mesh factory (player, enemy, allied livery)
│   ├── campaign/                 # CampaignData (import point): cast, chapters, radio, story, titles, voice script
│   ├── player/                   # player control
│   ├── enemy/                    # enemy AI
│   │   ├── EnemyAI.ts
│   │   ├── FriendlyAI.ts
│   │   └── EnemyTypes.ts
│   ├── boss/                     # boss system
│   │   ├── BossAI.ts             # level 1 boss (heavy bomber)
│   │   ├── BossContracts.ts      # IBossCore / IAdvancedBoss
│   │   ├── BossMissileSystem.ts
│   │   ├── DesertFortressAI.ts
│   │   ├── OctopusWarshipAI.ts
│   │   ├── MissileDestroyerAI.ts
│   │   ├── SkyCarrierAI.ts
│   │   ├── MagmaColossus*.ts     # level 6
│   │   ├── AbyssalLeviathan*.ts  # level 7
│   │   ├── TempestZeppelin*.ts   # level 8
│   │   ├── PhantomWing*.ts       # level 9
│   │   ├── OraclePrime*.ts       # level 10
│   │   └── BossTypes.ts
│   ├── units/                    # 17 ground/sea/air unit types, behaviours, deployments
│   ├── weapons/                  # special weapons + CountermeasureSystem (flares)
│   ├── combat/                   # combat
│   │   ├── ProjectilePool.ts
│   │   ├── BossProjectilePool.ts
│   │   ├── MissileSystem.ts
│   │   └── HealthSystem.ts
│   ├── camera/                   # CameraRig, cockpit, camera shake
│   ├── terrain/                  # terrain
│   │   ├── TerrainGenerator.ts
│   │   ├── LevelConfig.ts
│   │   ├── environments/         # levels 6-10 environment modules
│   │   └── worldscape/           # procedural scene engine
│   │       ├── noise.ts          # seeded noise (simplex/fbm/ridged)
│   │       ├── heightfield.ts
│   │       ├── biomes.ts         # biome vertex coloring
│   │       ├── water.ts          # wave/Fresnel/shore-foam shaders
│   │       ├── vegetation.ts     # instanced vegetation
│   │       ├── clouds.ts         # instanced dynamic clouds
│   │       └── shadermods.ts     # wind-sway & snow shaders
│   ├── levels/                   # level management
│   ├── powerups/                 # power-ups
│   ├── upgrade/                  # tiered upgrades
│   └── effects/                  # particles (particles/), post-processing (postfx/), contrails, shield ripple
│
├── scenes/                       # scene management
│   └── GameScene.ts
├── ui/                           # UI components
│   ├── HUD.ts
│   ├── StartMenu.ts
│   ├── PauseMenu.ts
│   ├── StoryOverlay.ts           # chapter cards, debrief, ending
│   ├── RadioComms.ts             # radio panel
│   ├── CheckpointResumeButton.ts # "continue from checkpoint" on the settlement screen
│   ├── RadarMinimap.ts
│   ├── LockOnIndicator.ts
│   ├── ModelPreview.ts
│   ├── UpgradeMenu.ts            # pause shop + hangar
│   └── theme/                    # HUD tokens, palette, glyphs, story/radio/HUD styles
│
├── i18n/                         # locale core: LocalizedText, tr(), setLocale (English default, zh-CN)
├── __tests__/                    # test files
│
├── Game.ts                       # back-compat export
├── Game.legacy.ts                # old implementation (@deprecated)
├── main.ts                       # entry
└── config.ts                     # config
```

Voice packs live outside `src/`, in `public/voice/` (`en/` and `zh/` MP3s named by line id, `manifest.json`, `provenance.json`).

## 🛠️ Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — type safety
- **Vite** — build tooling
- **Web Audio API** — synthesized music and sound effects; recorded voice lines played through a radio / narration filter chain

## 📱 Platform Support

| Feature | Desktop | Mobile |
| ------- | ------- | ------ |
| Controls | keyboard | virtual stick + touch buttons |
| Default quality (`auto`) | balanced | performance |
| Post-processing | balanced / quality presets | off by default (performance preset) |
| Camera | first / third person | first / third person |

Per-preset particle budgets, pixel ratio and target FPS live in `GameConfig` (`src/config.ts`). The cap on enemy jets in the air at once is a gameplay rule, not a quality setting: 6 on desktop and 5 on mobile (`GameConfig.getMaxEnemies()`), plus 1 in chapters 4–6 and 2 in chapters 7–10 (`LevelManager.getMaxConcurrentEnemies()`).

## 🎨 Mechanics

### Wave System

- Each level has several normal and event waves; ground, sea and air units deploy alongside the jets
- Enemies spawn in batches, never too many at once
- A wave is cleared when its jets and its hostile units are destroyed
- Power-ups can be collected between waves
- Clearing all waves triggers the level's boss, then the debrief and the hangar

### Collisions

- Player bullets vs enemies, units and boss parts — hits use each target's hit radius, so large ships and boss parts register where you strike
- Enemy bullets vs player and friendly units (friendly fire doesn't hurt the player)
- Player vs power-ups
- Player vs terrain/water: crash when world `Y <=` `getCrashSurfaceY` (`WORLDSCAPE_WATER_Y` = `-48` when no terrain); every level, including the cloud deck of level 9, is sampled
- Each level starts on a heading with a clear corridor ahead. After a crash you respawn back along your own flight path — at least 3 s and 150 m before the crash point, at least 40 m up — on a heading checked clear for 400 m, and for 3 s after respawning, touching the ground or a structure bumps you back up instead of costing another life. The Energy Shield does not protect against terrain

## 📝 Development Notes

### Code Conventions

- Quaternion rotation to avoid gimbal lock
- Object pooling for performance
- Fixed timestep for physics consistency
- Responsive layout across screen sizes
- Automatic device detection and quality scaling

### Performance

- LOD (level of detail) support: vegetation is tiled into near / far cells whose switch distance and density follow the quality preset
- Static props (the city, the lakeside hamlet, desert props, islands) are merged into one mesh per material (`worldscape/staticBatch.ts`); level 5 went from about 1,126 to 225 draw calls at the balanced preset
- Object pooling to reduce GC pressure
- Automatic quality reduction on mobile
- Particle budget per quality preset
- Instanced rendering (vegetation, clouds, particles, bird flocks); hidden clouds are not drawn

Architecture and contracts: [`docs/architecture.md`](docs/architecture.md), [`docs/api.md`](docs/api.md); long-form notes: [`TECHNICAL_DOCUMENTATION.md`](TECHNICAL_DOCUMENTATION.md).

## 🔧 Configuration

### Legacy config (`src/config.ts`)

Edit `src/config.ts` to tune game parameters:

```typescript
// player parameters
PLAYER: {
  PITCH_SPEED: 2.0,    // pitch speed
  YAW_SPEED: 1.5,      // yaw speed
  ROLL_SPEED: 3.0,     // roll speed
  BASE_SPEED: 50,      // base speed
  MAX_SPEED: 100,      // max speed
}
```

### JSON config system

The game supports external JSON configuration without code changes:

**Location**: `public/config/game-config.json`

```json
{
  "player": {
    "maxHealth": 200,
    "speed": 45,
    "fireRate": 0.3,
    "damage": 12.5
  },
  "enemy": {
    "spawnInterval": 2000,
    "maxCount": 10
  },
  "game": {
    "difficulty": "normal"
  }
}
```

**Using ConfigLoader in code**:

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

async function initGame() {
  await configLoader.load();
  const playerConfig = configLoader.getPlayer();
  const enemyConfig = configLoader.getEnemy('FIGHTER');
}
```

## 📊 Logging

```typescript
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MyModule');
log.debug('debug', { data: 123 });
log.info('info');
log.warn('warning');
log.error('error');
```

Development builds log everything from `debug` up; every other build (production, preview, tests) logs warnings and errors only.

## 📄 License

MIT License

---

**Enjoy the game!** 🎮✈️
