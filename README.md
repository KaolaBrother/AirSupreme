# ✈️ Air Supreme — 3D Air Combat Game

**[English](README.md) | [简体中文](README.zh-CN.md)**

A 3D air-combat game built with Three.js + TypeScript, playable on desktop and mobile browsers. The current version is a ten-chapter story campaign, **AIR SUPREME · The Skydome War**: ten levels in ten environments, ten bosses, ground / sea / air units from three factions, five unlockable special weapons plus flares, a switchable first-person cockpit and third-person chase view, mid-level autosave with Continue, and a hangar between chapters. The game is in English by default, with Simplified Chinese (中文) one setting away, and the radio crew and story narration are voice-acted in both English and Mandarin. Boss mode, the tutorial level, event waves, the pause pod and the model viewer (now the **Hangar** on the main menu) carry over from earlier versions.

## 🎮 Game Features

### Current Content

- **Ten-chapter story campaign** — 10 levels, 10 bosses, chapter cards, radio chatter, debriefs and an ending
- **English by default, 中文 as an option** — switch **Language** in the main menu's **Settings** or in the pause settings; menus, HUD, radio and voices follow at once
- **Voice acting in English and Mandarin** — the radio crew and the story narration are voiced, with on-screen text as subtitles and a separate **Voice volume**
- **Named wingmen** — Raven flies with you from chapter 1, Swift joins in chapter 3; they launch with you at the start of every level and keep out of the chase camera's way
- **Normal mode / Boss mode** — Boss mode lets you fight any of the ten bosses directly
- **First-person cockpit / third-person chase view** — press **V** (or the mobile **VIEW** button) at any time
- **Touch controls for phones and tablets** — a floating analog stick with flight assist, tap-to-fire missiles, a latching **BOOST**, and a larger layout on tablets (see _Controls_)
- **Five special weapons + flares**, unlocked as the story advances
- **Ground, sea and air units** in three factions — hostile, friendly and civilian; hostile units carry on-screen markers, and the radar opens into a level map (**N** or tap the radar)
- **Autosave checkpoints, Save & Exit and Continue** — leave a mission from the pause pod and keep the run; continue from the main menu, or retry from the checkpoint after a failed mission
- **Hangar between chapters** — tiered upgrades whose caps open up chapter by chapter
- **Procedural soundtrack** — 23 tracks and 7 stingers synthesized live with Web Audio, plus a new SFX set
- **Tutorial toggle**
- **Pause pod with in-match settlement**
  - ESC / P opens the pause pod, drawn in the same style as the main menu; on desktop U pauses then opens the upgrade shop
  - **Save & Exit** leaves the mission and keeps the run (see _Autosave, Save & Exit and Continue_)
  - Failure shows `MISSION FAILED`, victory `MISSION COMPLETE` (任务失败 / 任务完成 in Chinese) on a result panel in that same style; play again or return to the main menu — after a failure with a checkpoint, **Retry from checkpoint** takes the place of **Play Again**
- **Site chrome**
  - `index.html`: `<link rel="icon" href="/favicon.svg">` (`public/favicon.svg`); viewport includes `viewport-fit=cover`
  - The page ships as `<html lang="en">` with English loading-screen and touch-button text; `src/main.ts` applies the saved language before any UI renders and keeps `<html lang>` in step
- **Runtime boundaries and lazy loading**
  - Start menu and game runtime are boundary-split
  - Combat UI / presentation runtime are created on demand
  - Camera rig, units, special weapons, contrails, story cards / radio and bosses 6–10 load as separate chunks
  - Deep runtime chunks are pre-warmed while the menu idles
- **Event waves** — elite annihilation, timed interception, escort defense
- **Hangar** — the model viewer on the main menu

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
| **Hostile** | Counts toward clearing the wave — a wave ends only when its jets **and** its hostile units are down. Once the jets are gone, the units still holding the wave are marked as the objective and the HUD says what is left; if you cannot get to them, the wave releases after 60 s without a hit on one. Destroying one scores points. |
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

**Target markers**: every hostile unit you can shoot carries a health bar with its own name (a submerged submarine has none until it surfaces). A unit too far away to make out gets a corner bracket with its range in metres, and one that is off screen gets an edge arrow with its distance; these arrows, and the ones that point at a boss's missiles, keep clear of the radar, the HUD panels, the stick and the touch buttons. When units are the objective (see _Hostile_ above) their brackets and arrows turn bold and pulse.

**Radar**: the dial is heading-up — whatever is ahead of you is at the top, whatever is on your right is on the right. Contacts inside its range are drawn as filled symbols; contacts beyond it sit on the rim as smaller, dimmer, hollow symbols with a short tick pointing outward. Click or tap the radar, or press **N**, to open the **level map**: north-up, the whole battlefield with its boundary circle, 500 m and 1000 m rings around you, your heading arrow, every radar contact, a legend and, where the level has terrain, a land / water backdrop. The game keeps running while the map is open; tap it, press **N** or **Esc** to close it. On touch devices the radar sits in the top-left corner, out of the stick's way.

**Radar legend**: enemy jet = red dot · enemy ground unit = red square · enemy ship = red diamond · boss = large red dot with ring · friendly jet = gold dot · friendly unit = gold triangle · civilian = grey hollow circle (do not fire) · pickup = green dot · arriving through a portal = amber dot.

### 🚀 Missile System

- **Always-on seeker** — while you carry missiles the seeker works by itself, with no key to hold: it tracks the target closest to the centre of the dashed ring, which sits on the nose line. It locks enemy jets, hostile ground / sea / air units, bosses and their parts, and boss missiles, out to 1,200 m
- **Lock progress** — keep the target in the ring for 1.0 s (upgradable down to 0.5 s): corner brackets close on the target and an arc fills (`--hud-weapon` `#FFB347`), then the ring and brackets turn green with a `LOCK` tag and the range
- **Tap to fire** — press **M** / **Right Shift** or tap **MSL** when the ring is green: one missile per press, and the lock stays on for the next one (0.35 s between launches). Press early and keep holding, and the missile leaves the moment the lock completes. Pressing with nothing in the ring, or letting go before the lock completes, shows `NO LOCK`
- **A lock that holds** — a completed lock stays while the target is inside a wider keep ring (1.6× the dashed ring); outside it, behind you or beyond range, it breaks after 0.5 s. Before the lock completes, a target that slips out of the dashed ring only loses progress gradually
- **Lock-range upgrade** — separate upgrade track; at max level the ring grows to `2x` base
- **Visual cues** — SEARCH hollow dashed ring / TRACK brackets + arc / LOCK mint `#5CFFB0` / BREAK threat red `#FF4D4D` / DRY (no missiles) dimmed ring
- **Homing missiles** — leave the left and right wing pylons in turn at your own speed, accelerate to 200 m/s (always at least 80 m/s faster than you were flying), lead a moving target and go off when they pass close to it; auto-relock nearest enemy after a kill
- **Resource management** — start with 3; auto-resupply (1 per 7.5 s, up to 5, upgradable)
- **Ammo cue** — pressing M with no missiles shows `NO MSL` (not `NO MISSILE`)
- **Missile readout** — the status column shows `MSL n/5` with pips and a bar for the next missile; on touch devices the **MSL** button carries the count and a reload ring
- **Damage** — 80 per missile (doubled while Damage Boost is active)
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

- **V** (desktop) or the **VIEW** button (mobile) toggles between the third-person chase camera and a first-person cockpit, with a smooth blend; **Camera** in the main menu's **Settings** sets the default and your last choice is remembered
- The cockpit has a glareshield, three MFDs, an up-front control panel, gauges, warning lights and a HUD combiner glass; the jet's exterior is hidden from the cockpit view and the shield bubble fades so it does not block the view
- The cockpit stays low in the frame — a thin glareshield and slim canopy posts leave the upper half of the screen almost clear, and the HUD glass frames the gun cross and the seeker ring. Your own muzzle flashes, rocket smoke and swarm launches are toned down in first person and fade when they pass close to the camera
- Camera shake from hits, explosions, weapon recoil and boss hazards; the field of view widens with speed and boost; on a screen held in portrait the vertical field of view is raised to keep about 70° of horizontal view

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
| Missile lock | 1.0 s | 0.5 s | −0.05 s |
| Composite armour | 0% | 40% damage reduction | +8% |
| Flare rack | 2 flares | 6 flares | +1 |

Tier costs rise with the tier; the current costs live in `UPGRADE_CONFIGS` (`src/features/upgrade/UpgradeSystem.ts`). Starting at a later chapter — in normal or Boss mode — grants a starting budget of upgrade points and opens the hangar first; the chapter caps still apply.

### 💾 Autosave, Save & Exit and Continue

- In normal mode the game saves a checkpoint when a chapter starts, after each wave, right before the boss and the moment a boss falls (chapters 1–9; a *hangar* checkpoint for the next chapter, saved again when you press **Launch** so your hangar purchases are kept); an **Autosaved** toast in the HUD confirms each save, and it follows a language switch while it is on screen
- **Save & Exit** in the pause pod (**ESC** / **P**) leaves the mission without losing the run. The confirmation names the place it saves at — the wave you are in, the boss fight or the hangar — and the save is read back before you leave; if the browser's storage is unavailable or full, the game says so and offers **Back** or **Exit Anyway**. The save keeps your score, lives, missiles and upgrades as they are at that moment, and **Continue Campaign** starts that wave or boss fight from the beginning. Where nothing can be saved — Boss mode, before the first checkpoint, after the campaign is complete — the button reads **Main Menu** instead and says why before you leave
- **Continue Campaign** is the first button on the main menu when a checkpoint exists, labelled like `Ch. 6 · Heart of the Forge · Wave 3` or `Ch. 2 · Sandstorm · Hangar` (`第6关 · 熔炉之心 · 第3波` / `第2关 · 沙漠风暴 · 机库整备` in Chinese), with the saved score, difficulty and lives and a ten-chapter route strip
- After `MISSION FAILED` in normal mode with a checkpoint, the settlement screen's main button is **Retry from checkpoint** (从检查点重试), with the checkpoint's position on a **Checkpoint** card above it, followed by **Main Menu**. There is no **Play Again** in that state and nothing on that screen deletes the save — to start over, go to **Main Menu** → **New Campaign**. Without a checkpoint, and in Boss mode, the buttons are **Play Again** and **Main Menu** as before. On every settlement screen, failed or complete, the first button is focused when it appears, **Tab** moves between the two buttons, and a button counts once however often it is pressed. If a wave clear or a boss kill lands in the same instant as the death, the checkpoint is left as it was
- A checkpoint restores score, lives, missiles, upgrades, unlocked weapons and their ammo, flare charges, the camera view and the run statistics, and puts you back at the saved wave or the boss — or, for a hangar checkpoint, in the hangar before the next chapter, then its chapter card (weapons and flares are refilled for the new chapter)
- Starting a new normal-mode game clears the old checkpoint — **New Campaign** asks first when one exists, and **Keep my save** is the default answer; finishing chapter 10 marks the campaign complete and clears it; Boss mode never writes checkpoints
- Saves live in `localStorage` (`air-supreme:campaign-save`; completion, best score and highest level reached in `air-supreme:campaign-progress`)

### Boss Battles

Normal-mode flow:

`chapter card → briefing + radio → waves (autosave after each) → autosave → boss → autosave → debrief → hangar → next chapter`

After chapter 10: debrief → epilogue and credits → `MISSION COMPLETE`.

**Boss mode** (main menu → **Settings** → **Advanced** → **Game mode**; the start button then reads **Boss Challenge**) lets you fight any of the ten bosses directly: no story cards (only the boss's arrival lines), weapons unlocked through that chapter, and a hangar stop between bosses. Bosses arrive ahead of you — if you are flying out of the arena, a _Return to the combat zone · Boss incoming_ prompt holds the boss until you turn back, and a boss that appears far off or off your nose is called out with its bearing and distance. Phase changes bring an alarm, radio lines and a lift in the music (bosses 6–10 also flash a HUD warning), and the HUD shows the boss's status and phase pips. After the kill, the debrief waits until every defeat line on the radio has been heard (game time, so pausing does not cut it short), up to a cap worked out from the voiced lines still queued plus 6 s, never more than 75 s (`BOSS_OUTRO_MAX_SECONDS` in `src/core/campaign/CampaignFlowController.ts`). Boss missiles, flak and the Kraken's eye bolts hit harder or softer with the difficulty you pick (on Normal: 45 per missile for most bosses, 15 per flak burst, 20 per eye bolt), and flares decoy the missiles of all ten bosses. Boss HP, damage and fire rates live in `BOSS_CONFIGS` (`src/features/boss/BossTypes.ts`).

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

**Quality presets** (**Graphics** in the main menu's **Settings**, also in the pause settings): `auto` (performance on mobile, balanced on desktop), `performance` (post-processing off — screen effects use a lightweight overlay), `balanced` and `quality`. The particle budget and special-weapon effect density follow the preset, and so do the vegetation's near / far detail distance and density (read when a level loads).

### 🎵 Music & Sound

- 23 procedural tracks — ten level themes, ten boss themes, menu, story and victory — plus 7 stingers (chapter start, checkpoint, level complete, boss phase change, boss defeated, game over, campaign complete), all synthesized live; music and sound effects load no audio files (the only audio files are the voice packs below)
- The music builds with boss phases and follows chapter cards, debriefs and the ending; the menu music starts after your first click or key press
- New sound effects for the special weapons, flares, SAM lock warnings, unit fire and destruction, boss hazards, the camera switch, autosave, radio, typewriter text and debrief tallies

### 🎙️ Voice Acting

- Every radio line and every narrated story paragraph is voiced, in **English** and in **Mandarin Chinese**; the voice follows the **Language** setting — switching language silences the line being spoken, and the lines after it are voiced in the new language
- Radio voices play through a radio filter shaped per speaker (wider and cleaner for HQ and the AWACS, narrower with more static for the cockpits, the frigate and the civilian channel), with a squelch tail at the end of each line; the story narration (Skydome) plays clean. Every line is loudness-matched, and the music dips under the voice and comes back afterwards
- The on-screen text doubles as subtitles: radio lines stay up until their voice has finished, and the story typewriter is paced to the narration
- **Voice volume** (main menu **Settings**) / **Voice** (pause settings) sets the level; at 0% the radio and story cards are text only
- Urgent warnings (incoming missile, low health, civilian hit) interrupt radio chatter that is only on screen, but never a line being spoken: the HUD warning and tone still go off, and the low-health call waits until the line ends. The incoming-missile and civilian-hit calls are voiced at most twice per wave or boss fight. A line that is cut off replays from the start, once. Pausing the game pauses the voice, and it resumes where it stopped
- The voice lines are AI-generated (ElevenLabs `eleven_v4`, one take per line) and carry C2PA provenance metadata; files, manifest and per-file provenance live in `public/voice/` — see [`docs/voice-lines.md`](docs/voice-lines.md)

### 🖥️ HUD

- Special-weapon stores panel (ammo, reload, heat, charge, cooldown, slots), flare counter with recharge, autosave toast, camera-mode chip
- Boss status strip with phase pips and hazard warnings; missile warning (`locking` / `incoming`) that combines SAM locks and boss missiles
- Radio panel with a portrait glyph for every speaker and a priority queue (urgent warnings interrupt chatter, but not a voiced line); voiced lines stay up until the voice finishes
- The gun cross marks where your bullets go — the point 600 m ahead on the nose line — in both views, with the seeker ring around it. A lead marker shows where to aim at the nearest airborne target ahead within 500 m. On touch devices, gun aim assist pulls your fire onto a target within 480 m once you are within a few degrees of it (full pull inside 2.5°, fading out by 5°) and tightens the spread; the cross moves with it. Desktop play is not assisted
- Health bars label jets by type, bosses by name and hostile units by their own names (Main Battle Tank, Fast Gunboat and so on), in the current language; your wingmen show their callsigns. Boss parts get compact bars, and only the part nearest your reticle shows its name
- The layout respects the screen's safe areas and keeps the top of the screen free of overlaps on phones in portrait and landscape: a status column on the right (wave, lives, missiles, reload, power-up timer), a centre message stack (boss strip, briefing, event objective) with the radio panel below it; pickup and event callouts keep clear of the reticle and the missile ring in both camera views
- The enemy counter reads `ENEMIES n · LEFT m` during the waves; in a boss fight (Boss mode or a campaign boss) it shows only the hostiles actually present, `ENEMIES n` (boss-launched jets and drones plus any hostile units), with no wave count
- Level and boss briefings, the autosave toast, flashing warnings (unit warnings included), the boss status strip, power-up timers and the centre callouts (pickups, tutorial hints, wave announcements, special-weapon notices and the rest) switch language on the spot if you change it while they are showing
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

- **Tutorial**: the **Tutorial** toggle in the main menu's **Settings**; the first level teaches basics as you go
- **Event waves**: elite annihilation / timed interception / escort defense
- **Upgrade-point feedback**: HUD prompt on earning points, with guidance to the upgrade menu

### Hangar (Model Viewer)

- **Hangar** on the main menu opens a full-screen stand: the player jet, the five enemy jets, all ten bosses (each with its own model), the player missile and the boss missile. It is not the _Refit & Rearm_ hangar between chapters
- Step through the models with the arrow buttons, the **Left** / **Right** keys or a swipe; drag with the mouse to turn a model, or switch auto-rotate off; **Esc** or **Main Menu** goes back
- Every model is shown at the same size, centred in the area above its name label: its bounding sphere spans about 70% of the stand's shorter side, and shrinks only where that area is too small for it (a name that wraps, a very short screen), so big bosses, long names and narrow portrait screens do not hide part of the model. The name stays on one line when it fits
- The signal-light balls a jet carries in flight are hidden on the stand and on the title screen's jet, where they would hang beside the airframe as large dots
- A model that fails to load says so in its name label (`Could not load: …`) and the other models stay available; if the browser cannot create a WebGL context, the Hangar closes and the title screen comes back
- On a phone held in landscape the header shrinks and the hint line is hidden, so the height goes to the model
- The viewer's code is fetched during idle menu time before first open

## ⚙️ Settings & Language

The main menu is a title screen with a live 3D jet behind five buttons (the arrow keys move between them, **Enter** selects):

| Button            | What it does                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Continue Campaign | shown only when a checkpoint exists, and then it is the highlighted default (see _Autosave, Save & Exit and Continue_)                           |
| New Campaign      | starts a new game — **Boss Challenge** in Boss mode; the line under it names the starting chapter. It asks before erasing an existing checkpoint |
| Hangar            | the model viewer (see _Hangar (Model Viewer)_)                                                                                                   |
| Settings          | the settings sheet below                                                                                                                         |
| How to Play       | the controls, on a **Keyboard** tab and a **Touch** tab; it opens on the one that matches your device                                            |

**Settings** is a sheet in four groups, and every change is saved as you make it:

| Group    | Setting                                  | Values                                                                                                                                        |
| -------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Game     | Difficulty                               | Very Easy · Easy · Normal · Hard · Expert                                                                                                     |
| Game     | Lives                                    | 1–9                                                                                                                                           |
| Game     | Camera                                   | Third-person · First-person                                                                                                                   |
| Game     | Tutorial                                 | On · Off                                                                                                                                      |
| Audio    | SFX volume · Music volume · Voice volume | 0–100% in 10% steps; Voice volume 0% = subtitles only                                                                                         |
| Display  | Graphics                                 | Auto · Performance · Balanced · High                                                                                                          |
| Display  | Language                                 | English · 中文 — menus, HUD, radio, touch buttons and the voice pack switch at once (a story card already on screen finishes in its language) |
| Advanced | Start level                              | 1–10, with the chapter title underneath                                                                                                       |
| Advanced | Game mode                                | Normal · Boss mode                                                                                                                            |
| Advanced | Test score                               | Off or a starting score, for testing                                                                                                          |

**Advanced** is folded away each time the sheet opens, and shows a **Modified** badge while any of its three values differs from the default. In a mission, **ESC** / **P** → **Settings** offers Sound effects, Music, Voice, Graphics and Language, applied at once.

Settings are saved in `localStorage` (`air-supreme:start-menu-settings`; fields and defaults in `StartFlowSettings` / `DEFAULT_START_FLOW_SETTINGS`, `src/core/SessionSettings.ts`). The game starts in English, Normal difficulty and the third-person view; the language does not follow the browser, and settings saved before the Language option existed load in English. The option names stay in their own language (English / 中文) so you can always find yours.

## 🎯 Controls

### Desktop Browser

| Key | Action |
| --- | ------ |
| W / S (or ↑ / ↓) | pitch (nose up/down) |
| A / D | yaw (nose left/right) |
| Q / E | roll (wing tilt) |
| Space | cannon fire |
| M / R Shift | fire a missile (M or right Shift) — one per press, when the seeker ring is green (see *Missile System*) |
| L Shift / L Ctrl | boost (hold left Shift or left Ctrl) |
| F | fire the selected special weapon (hold for the laser and to charge the railgun) |
| Tab / X | cycle special weapons |
| 1 – 5 | select rockets / laser / swarm / railgun / EMP (number row or numpad) |
| G | deploy flares |
| V | toggle first-person / third-person view |
| N | open / close the level map (or click the radar); **Esc** also closes it |
| ESC / P | pause pod (Resume / Upgrades / Settings / Save & Exit — **Main Menu** where nothing can be saved) |
| U | open the upgrade shop (pauses the game) |

A quick tap of **Space** or the missile key is never lost, even when it is shorter than one simulation step; the same goes for the touch **FIRE** and **MSL** buttons.

### Mobile

Button labels follow the Language setting (Chinese labels in brackets):

- **Floating stick**: touch anywhere on the lower-left part of the screen and the stick appears under your thumb; slide up or down to pitch, left or right to turn. It is analog — a small push is a gentle turn — and it keeps following your thumb if you slide outside the area
- **Flight assist**: while you steer with the stick, left / right swings the nose along the horizon and the jet banks into the turn by itself (up to 45°), rolls level when the stick centres, and will not pitch past 75° up or down. The keyboard keeps direct pitch / yaw / roll control
- **FIRE** (开火): cannon; aim assist nudges your fire onto a target close to the cross (see _HUD_)
- **MSL** (导弹): tap when the seeker ring is green — one missile per tap; the button shows the missiles left and a ring for the next one
- **BOOST** (加速): tap to latch boost on, tap again for off
- **SPEC** (特武): tap to fire the selected special weapon (hold for the laser or to charge the railgun); once a weapon is selected the button shows its code, and its ring shows reload / heat / charge
- **SWAP** (切换): next special weapon
- **FLARE** (热焰): deploy flares; its ring turns amber while a missile is locking and flashes red when one is incoming
- **VIEW** (视角): toggle first-person / third-person
- **PAUSE** (暂停): pause pod (even a very quick tap registers)
- **Radar** (top-left): tap it to open the level map
- **Tablets** (shorter screen side of 700 px or more, an iPad for example): the stick and the button cluster are larger and sit higher and further in from the screen edges, the radar is larger, and the simulation runs at 60 Hz at every quality preset
- A keyboard attached to a touch device works together with the touch controls

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
- The fixes from an independent final audit (respawn safety, hangar checkpoint, radio warning budget, both wingmen, HUD layout on phones, boss previews, balance curve, terrain performance) are merged, followed by a polish pass (live relabelling of warnings, timers and centre callouts, flak and eye-bolt damage by difficulty, respawn wall escape, a boss-fight enemy counter, Model Preview framing above the name label, 教程 as the Chinese tutorial label); see `CHANGELOG.md` → *Unreleased* → *终验修复* (audit fixes) and *收尾打磨* (polish)
- The controls and weapons round is merged on top: analog touch flight controls with a tablet layout, markers on hostile units and a level map, the always-on missile seeker with tap-to-fire, a lower cockpit, Save & Exit and the new main menu; see `CHANGELOG.md` → _Unreleased_ → _操控与武器体验_ (controls and weapons)
- Tests live in `src/__tests__`; run `npm run test:run` for the current count and results
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
│   ├── campaign/                 # campaign flow, presentation adapter, SFX router, start poses, menu music, Wingmen roster, RadioBudget
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
│   │   ├── MissileSeeker.ts      # always-on missile seeker (acquire / keep rings, lock progress)
│   │   ├── GunLeadSolver.ts      # gun lead marker + touch aim assist
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
│   ├── StartMenu.ts              # main menu shell
│   ├── menu/                     # title screen, settings and how-to-play sheets, 3D hero, backdrop, menu styles
│   ├── PauseMenu.ts              # pause pod, Save & Exit
│   ├── StoryOverlay.ts           # chapter cards, debrief, ending
│   ├── RadioComms.ts             # radio panel
│   ├── RadarMinimap.ts           # heading-up radar dial
│   ├── RadarLevelMap.ts          # north-up level map opened from the radar
│   ├── radarGlyphs.ts            # symbols shared by the dial and the map
│   ├── EnemyHealthBars.ts        # health bars, target brackets, off-screen arrows
│   ├── ChevronAvoidance.ts       # keeps off-screen arrows clear of the radar, HUD panels and touch controls
│   ├── LockOnIndicator.ts        # gun cross, seeker ring, lock brackets, lead marker
│   ├── ModelPreview.ts           # the main menu's Hangar (model viewer)
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
| Controls | keyboard | floating analog stick + touch buttons, flight assist and gun aim assist (a keyboard also works) |
| Default quality (`auto`) | balanced | performance |
| Post-processing | balanced / quality presets | off by default (performance preset) |
| Camera | first / third person | first / third person |

Tablets — touch devices whose shorter viewport side is at least 700 CSS px (`GameConfig.isTablet`, decided once at startup) — get the larger touch layout, a 60 Hz simulation step at every preset and a higher pixel-ratio cap (1.5) under `auto`.

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
- Each level starts on a heading with a clear corridor ahead. After a crash you respawn back along your own flight path — at least 3 s and 150 m before the crash point, at least 40 m up — on a heading checked clear for 400 m (turned away from the obstacle if you hit the ground again within 8 s of respawning), and for 3 s after respawning, touching the ground bumps you back up and flying into a wall or pylon pushes you out sideways and turns you away, instead of costing another life. The Energy Shield does not protect against terrain

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

### Game config (`src/config.ts`)

Edit `src/config.ts` to tune game parameters:

```typescript
// player parameters
PLAYER: {
  PITCH_SPEED: 2.0,    // pitch speed
  YAW_SPEED: 1.5,      // yaw speed
  ROLL_SPEED: 3.0,     // roll speed
  BASE_SPEED: 45,      // base speed
  MAX_SPEED: 45,       // max speed
}
```

The numbers in play are the constants in the source, such as `GAME_CONSTANTS` in `src/config.ts`; there is no external config file.

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
