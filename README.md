# ✈️ Air Supreme — 3D Air Combat Game

**[English](README.md) | [简体中文](README.zh-CN.md)**

A 3D air-combat game built with Three.js + TypeScript, playable on desktop and mobile browsers. The current version is a ten-chapter story campaign, **AIR SUPREME · 天穹之战**: ten levels in ten environments, ten bosses, ground / sea / air units from three factions, five unlockable special weapons plus flares, a switchable first-person cockpit and third-person chase view, mid-level autosave with Continue, and a hangar between chapters. Boss mode, the trial level, event waves, the pause pod and the model preview carry over from earlier versions.

## 🎮 Game Features

### Current Content

- **Ten-chapter story campaign** — 10 levels, 10 bosses, chapter cards, radio chatter, debriefs and an ending
- **Normal mode / Boss mode** — Boss mode lets you fight any of the ten bosses directly
- **First-person cockpit / third-person chase view** — press **V** (or the mobile 视角 button) at any time
- **Five special weapons + flares**, unlocked as the story advances
- **Ground, sea and air units** in three factions — hostile, friendly and civilian
- **Autosave checkpoints + Continue** — from the start menu and from the game-over screen
- **Hangar between chapters** — tiered upgrades whose caps open up chapter by chapter
- **Procedural soundtrack** — 23 tracks and 7 stingers synthesized live with Web Audio, plus a new SFX set
- **Trial-level toggle**
- **Pause pod with in-match settlement**
  - ESC / P opens the pause pod; on desktop U pauses then opens the upgrade shop
  - Failure shows `MISSION FAILED`, victory `MISSION COMPLETE`; replay or return to menu
- **Site chrome**
  - `index.html`: `<link rel="icon" href="/favicon.svg">` (`public/favicon.svg`); viewport includes `viewport-fit=cover`
- **Runtime boundaries and lazy loading**
  - Start menu and game runtime are boundary-split
  - Combat UI / presentation runtime are created on demand
  - Camera rig, units, special weapons, contrails, story cards / radio and bosses 6–10 load as separate chunks
  - Deep runtime chunks are pre-warmed while the menu idles
- **Event waves** — elite annihilation, timed interception, escort defense
- **Model preview**

### 📖 Story

At 05:17, every combat drone that Obsidian Dynamics (黑曜动力) had deployed around the world slipped out of human control in the same second. The machine that took them was the company's secret autonomous war intelligence — **ORACLE (神谕)** — and it broadcast a single sentence: *"The sky needs order."* The 7th Flight Wing of the Skydome Joint Air Defense Force (天穹联合防空军) is ordered to intercept. You are the wing's ace, callsign **Falcon (猎鹰)**.

Voices you will hear on the radio:

| Callsign | Who |
| -------- | --- |
| 天穹 (Skydome) | Colonel Lin Lan (林岚上校), command |
| 渡鸦 (Raven) | your wingman Qin Ye (秦野) |
| 萤火 (Firefly) | Dr. Chen Xi (陈曦博士), chief scientist |
| 神谕 (ORACLE) | the enemy |
| 民用频道 (civilian channel) | civilians caught in the fighting |

Each chapter opens with a typewriter story card (the prologue plays before chapter 1 of a new game; chapters that unlock a weapon add an unlock line). Click / tap / Space / Enter reveals the text, then turns the page; **Esc** or **跳过** skips the whole sequence. After each boss a debrief card tallies the chapter's score, kills, civilians lost, allies lost and your total score; chapter 10 ends with an epilogue and credits, then `MISSION COMPLETE`.

### 🗺️ Ten Levels

| # | Chapter · Operation | Level | Setting | Environment · weather | Boss |
| -: | ------------------- | ----- | ------- | --------------------- | ---- |
| 1 | 第一章 · OPERATION FIRST LIGHT | 湖畔晨曦 (Lakeside Dawn) | 北境湖区 · 镜湖水坝 | `LAKE` · clear | 重型轰炸机「雷云」 THUNDERHEAD |
| 2 | 第二章 · OPERATION SANDWALL | 沙漠风暴 (Desert Storm) | 南境沙海 · 黑曜补给走廊 | `DESERT` · sandstorm | 移动堡垒「沙墙」 SANDWALL |
| 3 | 第三章 · OPERATION WHITE ECHO | 雪山之巅 (Snowy Summit) | 霜脊山脉 · 极光研究站 | `MOUNTAINS` · snow | 八爪鱼战舰「深渊之眼」 KRAKEN |
| 4 | 第四章 · OPERATION TRIDENT FALL | 深海决战 (Deep-Sea Decisive Battle) | 风暴海峡 · 东部航线 | `OCEAN` · cloudy | 导弹驱逐舰「三叉戟」 TRIDENT |
| 5 | 第五章 · OPERATION SKYFALL | 城市废墟 (Urban Ruins) | 首都 · 中央城区上空 | `CITY` · smog | 空中航母「巨像」 COLOSSUS |
| 6 | 第六章 · OPERATION HEARTFORGE | 熔炉之心 (Heart of the Forge) | 南太平洋 · 赤炎火山岛 | `VOLCANO` · ash | 攻城机甲「熔岩巨像」 MAGMA COLOSSUS |
| 7 | 第七章 · OPERATION POLAR NIGHT | 极光冰海 (Aurora Ice Sea) | 北冰洋 · 极光冰架 | `ARCTIC` · aurora | 巨型潜艇「深渊利维坦」 ABYSSAL LEVIATHAN |
| 8 | 第八章 · OPERATION STORMBREAK | 雷霆峡谷 (Thunder Canyon) | 西部荒原 · 雷鸣峡谷 | `CANYON` · storm | 装甲飞艇「雷霆」 TEMPEST |
| 9 | 第九章 · OPERATION SKYSPIRE | 天梯之巅 (Sky Ladder Summit) | 赤道 · 天梯轨道电梯 · 平流层 | `STRATOSPHERE` · clear | 隐形飞翼「幻影」 PHANTOM WING |
| 10 | 最终章 · OPERATION LAST LIGHT | 神谕核心 (Oracle Core) | 黑曜城堡 · 陨石坑 | `CITADEL` · ash | 神谕主宰 ORACLE PRIME |

Chapter text, radio lines and boss briefings live in `src/features/campaign/CampaignData.ts`; level tables (waves, enemy mix, weather, lighting, post-processing grade) live in `src/features/terrain/LevelConfig.ts`.

### 🌍 Environments (Worldscape + environment modules)

Levels 1–5 are generated by the procedural Worldscape engine (seeded noise heightfields + biome vertex coloring + instanced vegetation); levels 6–10 add dedicated environment modules under `src/features/terrain/environments/`:

1. **Lakeside Dawn** — lake valley: piers, village, water lilies, 24,000 wind-swaying grass blades, pine and broadleaf forest, merged sphere-cluster instanced clouds
2. **Desert Storm** — dune heightfield, warm rocks, dry grass accents, cactus clusters
3. **Snowy Summit** — snowline ridges, glacial-blue tarns, raised valley, drifting mist
4. **Deep-Sea Decisive Battle** — open-ocean fair day (ambient fully brightened), Fresnel/shore-foam shader water, scattered islets
5. **Urban Ruins (New York-ish)** — Central-Park meadow + Empire-State-style spire / Chrysler-style crown / twin glass towers, Brooklyn-style suspension bridge, double-deck elevated expressways, elevated loop trains (animated traffic and lit windows), street lights + billboards + nearly doubled window-light density
6. **Heart of the Forge** — a volcanic island arsenal: the main volcano with a crater lava lake and ash column, three lava rivers steaming into the sea, glowing cracks in cooled basalt, Oracle's foundry (cooling towers, blast furnaces, flare stacks); falling ash and rising embers. The sea around the island is navigable water.
7. **Aurora Ice Sea** — the polar-night Arctic Ocean: dark open water between ice shelves and tabular / pinnacle icebergs, drifting floes, sea smoke, an iced-in outpost with radar domes and searchlights, aurora curtains and light snow.
8. **Thunder Canyon** — three winding sandstone canyons with stepped walls and mesas, a flooded red-mud river (navigable), the convoy's dirt road, storm-rain waterfalls and Oracle's Tesla collector towers; storm weather whose lightning strikes the real ground.
9. **Sky Ladder Summit** — 20 km up above a sunset cloud deck: the orbital elevator's fibre trunk, lift cars, a ring platform on six pylons and anchor towers. The cloud sea is a crash surface — fly into it and you go down.
10. **Oracle Core** — the obsidian citadel in a meteor crater: terraced crater walls, four lava rifts and four cyan data conduits converging on the fortress, energy obelisks feeding the core beam; the final battle is fought above the core well.

**Weather**: presets `clear`, `cloudy`, `mist`, `windy`, `sandstorm`, `snow`, `storm`, `smog`, plus the new `ash` (falling ash and rising embers) and `aurora` (aurora bands and light snow); `storm` (rain and lightning) now drives the canyon. **Dynamic clouds** drift with the wind, wrap around, bob vertically and are tinted by weather; under dark weather they render smoother.

**Worldscape stack** (`src/features/terrain/worldscape/`): seeded simplex/fbm/ridged noise heightfields; biome vertex coloring; wave/Fresnel/shore-foam shader water; instanced pines/broadleaf trees/rocks/24k swaying grass; merged sphere-cluster clouds; wind-sway and snow-accumulation shader injections.

### Varied Enemy AI

- **Scout** — fast but fragile, high evasion
- **Fighter** — balanced, standard combat unit
- **Heavy** — slow, high HP, high damage
- **Sniper** — long-range precision attacks
- **Ace** — hard, smart AI with advanced tactics

Enemy jets look ahead and climb around tall terrain (canyon walls, the volcano, the sky-ladder pylons, the citadel), never dive into the ground, and drift helplessly while stunned by an EMP. Their strength rises from chapter to chapter (`getLevelScaling` in `src/core/Difficulty.ts`, multiplied by the difficulty you pick).

### 🚛 Ground, Sea and Air Units

Seventeen unit types fight alongside the enemy jets. They spawn wave by wave (`src/features/units/UnitDeployments.ts`), each with its own behaviour, and announce themselves over the radio the first time you meet them.

| Faction | What it means for you |
| ------- | --------------------- |
| **Hostile** | Counts toward clearing the wave — a wave ends only when its jets **and** its hostile units are down (if only stragglers remain, the wave releases after a time limit). Destroying one scores points. |
| **Friendly** | Fights on your side. Escorts (convoys, transports) earn a bonus when they arrive safely; if you destroy a friendly unit yourself you lose score, and every ally lost is counted in the debrief. |
| **Civilian** (neutral) | Never hostile to anyone, but can be caught in the crossfire. Your first hit on one draws a cease-fire call on the radio; destroying one yourself costs score, and every civilian lost is counted in the debrief. |

Hostile units:

| Unit | Domain | Behaviour |
| ---- | ------ | --------- |
| Main battle tank (主战坦克) | ground | tracks you and fires its cannon |
| SAM launcher (地空导弹车) | ground | locks on, then launches — the HUD warns while it is locking; answer with flares |
| Twin AA gun (双联高炮) | ground | leads its flak barrages; with you out of reach it turns on friendly jets |
| Radar station (雷达站) | ground | spotter: while one stands, enemy jets shoot more accurately |
| Fast gunboat (高速炮艇) | sea | zig-zags at high speed while firing its gun |
| Missile frigate (导弹护卫舰) | sea | vertical-launch missiles and close-in defense guns |
| Attack submarine (攻击潜艇) | sea | surfaces to lock on and launch missiles, then dives; it can only be hit while surfaced (a sonar contact on radar while submerged) |
| Attack helicopter (武装直升机) | air | hugs the terrain, strafes with rocket pods and gun; autorotates down when shot |
| Strategic bomber (战略轰炸机) | air | high, straight bombing runs on friendly ground and sea units; tail gun |
| Kamikaze drone (自杀无人机) | air | cruises in formation, then dives to ram |

Friendly units: allied convoy (友军车队, escort), allied frigate (友军护卫舰 — its close-in guns shoot down missiles, plus anti-air and anti-ship fire), allied AWACS (友军预警机 — extends your radar range while it lives), allied transport (友军运输机, escort). Civilian units: airliner (民航客机), cargo ship (民用货轮), truck (民用卡车) — they follow their routes and leave the battlefield.

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
| 1 | 🚀 Cluster rockets (集束火箭) | `RKT` | press F: a salvo of unguided rockets that burst on impact, by proximity or at max range — splash damage against armoured columns | Chapter 2 |
| 2 | 🔆 Pulse laser (脉冲激光) | `LSR` | hold F: a continuous beam that burns the first target on the line; heat builds, and an overheat locks the laser until it has fully cooled | Chapter 4 |
| 3 | 🐝 Swarm missiles (蜂群导弹) | `SWM` | press F: a volley of micro-missiles auto-assigned to different enemy targets in a forward cone — no lock needed | Chapter 6 |
| 4 | ☄️ Railgun (电磁轨道炮) | `RLG` | hold F to charge, release to fire a slug that pierces every target on its line; more charge, more damage; releasing too early cancels without spending ammo | Chapter 7 |
| 5 | 🌀 EMP (电磁脉冲) | `EMP` | press F: a pulse that stuns enemy units and jets, damages missiles and drones in range, and forces cloaked targets to appear | Chapter 9 |

**Flares (G)** throw a fan of burning flares behind the jet. SAM missiles and the missiles of bosses 6–10 steer toward burning flares; charges recharge over time, and the flare-rack upgrade raises capacity from 2 to 6. Weapon stats per upgrade tier live in `src/features/weapons/WeaponTypes.ts`.

### 👁️ First- / Third-Person View

- **V** (desktop) or the **视角** button (mobile) toggles between the third-person chase camera and a first-person cockpit, with a smooth blend; the start-menu **视角** row sets the default and your last choice is remembered
- The cockpit has a glareshield, three MFDs, an up-front control panel, gauges, warning lights and a HUD combiner glass; the jet's exterior is hidden from the cockpit view and the shield bubble fades so it does not block the view
- Camera shake from hits, explosions, weapon recoil and boss hazards; the field of view widens with speed and boost

### Power-ups

| Power-up | Effect | Duration |
| -------- | ------ | -------- |
| ❤️ Health restore | +30 HP | instant |
| 🛡️ Energy shield | invulnerable | 10 s |
| ⚡ Speed boost | speed +50% | 15 s |
| 🔥 Damage boost | damage ×2 | 20 s |
| 🎯 Multishot | 3 bullets at once | 20 s |
| ✈️ Call allies | friendly aircraft join the fight | until defeated |
| 🚀 Missile resupply | +1 missile | instant |

### 🛠️ Upgrades & Hangar

Score earns upgrade points (⭐), and later chapters pay more score per kill. Spend points in the **hangar** (机库整备) that opens between chapters — press **出击** to launch the next chapter — or mid-mission from the pause pod (**ESC** / **P** → **Upgrade**; on desktop **U** pauses and opens the shop directly). Unspent points carry over.

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

- In normal mode the game saves a checkpoint when a chapter starts, after each wave and right before the boss; a toast in the HUD confirms each save
- **继续战役 (Continue campaign)** appears on the start menu when a checkpoint exists, labelled like `第6关 · 熔炉之心 · 第3波`; after `MISSION FAILED` the settlement screen offers **从检查点继续 (Continue from checkpoint)**
- A checkpoint restores score, lives, missiles, upgrades, unlocked weapons and their ammo, flare charges, the camera view and the run statistics, and puts you back at the saved wave or the boss
- Starting a new normal-mode game clears the old checkpoint; finishing chapter 10 marks the campaign complete and clears it; Boss mode never writes checkpoints
- Saves live in `localStorage` (`air-supreme:campaign-save`; completion, best score and highest level reached in `air-supreme:campaign-progress`)

### Boss Battles

Normal-mode flow:

`chapter card → briefing + radio → waves (autosave after each) → autosave → boss → debrief → hangar → next chapter`

After chapter 10: debrief → epilogue and credits → `MISSION COMPLETE`.

The start menu also offers **Boss mode** to fight any of the ten bosses directly: no story cards (only the boss's arrival lines), weapons unlocked through that chapter, and a hangar stop between bosses. Bosses arrive ahead of you; phase changes bring an alarm, radio lines and a lift in the music (bosses 6–10 also flash a HUD warning), and the HUD shows the boss's status and phase pips. Boss HP, damage and fire rates live in `BOSS_CONFIGS` (`src/features/boss/BossTypes.ts`).

| # | Boss | How it fights / weak point |
| -: | ---- | -------------------------- |
| 1 | 重型轰炸机「雷云」 THUNDERHEAD | long fuselage / 6 ducted intake fans / turret cluster; the belly bomb bay is the weak point when it opens |
| 2 | 移动堡垒「沙墙」 SANDWALL | tracked base / sloped armor / twin main guns / rotating radar / war banner; knock out the four corner flak cannons, then focus the core |
| 3 | 八爪鱼战舰「深渊之眼」 KRAKEN | spherical shell / exposed glowing brain core / 8 segmented swaying tentacles with sensor eyes and laser sweeps; blinding the eyes weakens the body |
| 4 | 导弹驱逐舰「三叉戟」 TRIDENT | Burke-class hull / phased array / VLS cells / CIWS / helipad; the bridge and VLS cells are vital, and its missiles can be shot down |
| 5 | 空中航母「巨像」 COLOSSUS | angled deck / arresting wires / island rotating radar / elevators / launches fighters; hit the island radar and catapults |
| 6 | 攻城机甲「熔岩巨像」 MAGMA COLOSSUS | four-legged basalt walker: head cannons, mortar salvos with landing markers, missile volleys, stomp shockwaves; its back vents glow open after a salvo (weak points — destroying one strips armour); phase 2 opens the furnace core, lava columns and a chest-beam sweep; phase 3 is a meltdown, and it staggers when nearly dead |
| 7 | 巨型潜艇「深渊利维坦」 ABYSSAL LEVIATHAN | invulnerable while submerged; a red ring on the water warns before it breaches through the ice; surfaced, its deck turrets and missile bay fire; conning tower, four ballast tanks and the missile bay are separate targets; phase 2 lays shootable contact mines and launches drones; phase 3 stays surfaced and rams along a red lane |
| 8 | 装甲飞艇「雷霆」 TEMPEST | six glowing gas cells (each one burst lowers and tilts it), Tesla coils that chain lightning between targets — pull away when they glow blue — and a storm shroud that shocks anything inside; phase 2 opens a drone hangar and calls lightning along your path; phase 3 exposes the storm core |
| 9 | 隐形飞翼「幻影」 PHANTOM WING | cloaks (cannot be locked or hit) and ambushes; laser-lance dives along a red danger lane; two wingtip phase emitters; phase 2 projects holographic decoys (cyan exhaust — the real one burns red); phase 3 overdrive; an EMP forces it to decloak |
| 10 | 神谕主宰 ORACLE PRIME | phase 1: four orbiting crystal shield pylons (prism, arc, seeker, lance) protect an invulnerable core; phase 2: the exposed core with rotating emitter arrays and the Judgement lance; phase 3: overload — gated shockwave rings (fly through the green gap), twin rings, orbital strikes and a final Last Light |

**Boss missiles**: two-stage hybrids (booster / separation ring / cable conduits / armor plates / hazard stripes / string numbers), slowly rolling in flight.

### ✨ Combat Effects

- **Particles**: an instanced particle backend with layered recipes — explosions, hits, impacts per surface (ground, desert, snow, city, lava, ice, rock, cloud, water), muzzle flashes, damage smoke on damaged jets, big ship splashes, EMP bursts, pickup bursts
- **Post-processing**: HDR pipeline with bloom, colour grade and vignette tuned per level (`LevelConfig.postFx`)
- **Screen effects**: damage pulse, low-health vignette with a heartbeat, speed lines while boosting, white flash and EMP flash
- **Wingtip contrails** on the player, enemy jets and wingmen; **hex shield ripple** where shots hit the shield; throttle-driven afterburner
- **Explosions**: multi-stage effects (core flash / shockwave ring / gravity embers / rising smoke); bosses trigger multi-stage detonations
- **Bullets**: tracer glow + trails; boss shells have pulsing cores and arcing sparks
- **Hit feedback**: dispatched by source — player hits / enemy hits / boss hits each have distinct flashes / sparks / debris / smoke
- **Portals**: rebuilt as counter-rotating vortex gates

**Quality presets** (start menu 画质, also in the pause settings): `auto` (performance on mobile, balanced on desktop), `performance` (post-processing off — screen effects use a lightweight overlay), `balanced` and `quality`. The particle budget and special-weapon effect density follow the preset.

### 🎵 Music & Sound

- 23 procedural tracks — ten level themes, ten boss themes, menu, story and victory — plus 7 stingers (chapter start, checkpoint, level complete, boss phase change, boss defeated, game over, campaign complete), all synthesized live; no audio files are loaded
- The music builds with boss phases and follows chapter cards, debriefs and the ending; the menu music starts after your first click or key press
- New sound effects for the special weapons, flares, SAM lock warnings, unit fire and destruction, boss hazards, the camera switch, autosave, radio, typewriter text and debrief tallies

### 🖥️ HUD

- Special-weapon stores panel (ammo, reload, heat, charge, cooldown, slots), flare counter with recharge, autosave toast, camera-mode chip
- Boss status strip with phase pips and hazard warnings; missile warning (`locking` / `incoming`) that combines SAM locks and boss missiles
- Radio panel with speaker portraits and a priority queue (urgent warnings interrupt chatter)
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

### Trial Level and Event Waves

- **Trial level**: toggle in the start menu; the first level teaches basics as you go
- **Event waves**: elite annihilation / timed interception / escort defense
- **Upgrade-point feedback**: HUD prompt on earning points, with guidance to the upgrade menu

### Model Preview

- Openable from the start menu: the player jet, the five enemy jets, the boss roster, the player missile and the boss missile
- Bounding-box-adaptive framing fixes boss close-ups and octopus scaling
- Assets are prefetched during idle menu time before first open

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
| ESC / P | pause pod (resume / upgrade / settings / back to menu) |
| U | open the upgrade shop after pausing |

### Mobile

- **Left virtual stick**: steer
- **开火 (Fire)**: cannon
- **导弹 (Missile)**: missile lock/fire
- **加速 (Boost)**: boost
- **特武 (Special)**: tap to fire the selected special weapon (hold for the laser or to charge the railgun); its ring shows reload / heat / charge
- **切换 (Cycle)**: next special weapon
- **热焰 (Flares)**: deploy flares; its ring turns amber while a missile is locking and flashes red when one is incoming
- **视角 (View)**: toggle first-person / third-person
- **暂停 (Pause)**: pause pod

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

- The ten-level campaign (story, levels 6–10, bosses 6–10, units, special weapons, camera rig, autosave, hangar, music and VFX overhaul) is integrated; see `CHANGELOG.md` → *Unreleased*
- `GameCoordinator`, combat runtime, boss controllers, presentation/UI runtime and the new campaign systems are all on lazy-init paths
- Tests live in `src/__tests__` (55 `*.test.ts` files at the time of writing, 15 of them added for the campaign); run `npm run test:run` for current results
- Known observations: the `vendor-three` chunk-size warning during build; in the model preview, bosses 6–10 do not have dedicated preview meshes yet and fall back to the heavy-bomber model

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
│   ├── SessionSettings.ts        # persisted start-menu settings
│   ├── GameLoop.ts               # game loop
│   ├── GameState.ts              # game state
│   ├── campaign/                 # campaign flow, presentation adapter, SFX router, start poses, menu music
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
│   ├── Audio/                    # SFX, music system, music/ sequencer + tracks, sfx/ library
│   └── utils/                    # utilities
│       ├── ConfigLoader.ts       # config loader
│       └── Logger.ts             # logging
│
├── features/                     # game features
│   ├── aircraft/                 # aircraft mesh factory (player, enemy, allied livery)
│   ├── campaign/                 # CampaignData: chapters, radio, unlocks
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
├── __tests__/                    # test files
│
├── Game.ts                       # back-compat export
├── Game.legacy.ts                # old implementation (@deprecated)
├── main.ts                       # entry
└── config.ts                     # config
```

## 🛠️ Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — type safety
- **Vite** — build tooling
- **Web Audio API** — generated sound and music (no external audio files)

## 📱 Platform Support

| Feature | Desktop | Mobile |
| ------- | ------- | ------ |
| Controls | keyboard | virtual stick + touch buttons |
| Default quality (`auto`) | balanced | performance |
| Post-processing | balanced / quality presets | off by default (performance preset) |
| Camera | first / third person | first / third person |

Per-preset particle budgets, enemy caps, pixel ratio and target FPS live in `GameConfig` (`src/config.ts`).

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
- Each level starts on a heading with a clear corridor ahead, and after a crash you respawn above the terrain, turned away from rising ground

## 📝 Development Notes

### Code Conventions

- Quaternion rotation to avoid gimbal lock
- Object pooling for performance
- Fixed timestep for physics consistency
- Responsive layout across screen sizes
- Automatic device detection and quality scaling

### Performance

- LOD (level of detail) support
- Object pooling to reduce GC pressure
- Automatic quality reduction on mobile
- Particle budget per quality preset
- Instanced rendering (vegetation, clouds, particles)

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

## 📄 License

MIT License

---

**Enjoy the game!** 🎮✈️
