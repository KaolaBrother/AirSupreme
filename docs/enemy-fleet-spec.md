# Enemy fleet redesign — spec (round `workflow/enemy-fleet`)

Owner's request: "redesign the entire enemy fleet", more creative and varied attacks from the
early levels on, a somewhat harder end game, enemies that look different from friendlies and
from the player, "a little bit challenging and fun to play". Player missile damage stays 80.

This file is the behaviour contract. Implementers build to it; test authors test against it
(not against the implementation). Numbers marked *(start)* are starting values that the waves /
balance batch may tune; everything else is a rule. If the code makes a rule impossible or
unsafe, stop and report instead of quietly doing something else.

## 0. Today (surveyed at `601def1`)

- Five jet types (`EnemyType` in `src/features/enemy/EnemyTypes.ts`) that differ only by
  numbers. One type-agnostic AI (`EnemyAI.ts`): a random pick between chase / fixed direction /
  circle. One weapon: a single straight bullet whenever the player is inside a 35–60° cone
  within 420 m.
- Nothing reacts to the player's lock or missiles; no squads; no leash; levels 6–10 add nothing
  new.
- Enemy jets are light grey like the player's jet; wingmen are the same enemy airframes in blue
  and gold; every jet has a white trail and an orange engine glow; every mesh is scale 2.0 with
  a 5 m hit radius. Hostile ground / sea / air *units* already use dark gunmetal with red
  accents (`UnitMeshKit.ts`).
- Wingmen (`FriendlyAI`) wrap `EnemyAI` and fly a random enemy airframe, so they inherit any
  enemy change.

## 1. Fleet identity (visuals)

The fiction calls the enemy aircraft drones. Three factions must read at a glance, in play and
in the Hangar:

| | Hull | Accent / glow | Engine glow | Trail | Other |
|---|---|---|---|---|---|
| Player | light grey / white (unchanged) | unchanged | orange (unchanged) | white | canopy |
| Wingmen | steel blue (as today) | gold (as today) | orange-gold | pale blue `0x7fd4ff` | canopy, gold strobe |
| Enemy drones | dark gunmetal / charcoal, same family as hostile units | red emissive | red | red-orange `0xff5a3c` | no canopy glass: a red sensor "eye" / visor instead; no red-green navigation lights |

- No gold or yellow on any enemy (gold means "friendly" everywhere else in the game). The Ace's
  elite marking is bright crimson / white-hot trim.
- Size is real now. Mesh scale and hit radius per type (`hitRadius = 2.5 × scale`, so 2.0 keeps
  today's 5 m): SCOUT 1.5, FIGHTER 2.0, HEAVY 3.0, SNIPER 2.1, ACE 2.2, JAMMER 2.2,
  STRIKER 2.4, WRAITH 2.0; wingman 2.0. The factory sets `userData.hitRadius` on the root of
  every enemy and friendly mesh; combat code reads it (missing ⇒ 5).
- Silhouettes stay distinct per type (existing five builders keep their shapes; they get the
  new livery). New airframes: JAMMER — flying wing with an antenna / dish array and a pulsing
  violet ECM ring (violet is the only non-red enemy accent, reserved for jamming); STRIKER —
  twin-boom missile carrier with visible missile racks; WRAITH — angular matte-black flying
  wing with thin red edge lines.
- Wingmen get their own allied airframe from the player's family (canopy, blue / gold livery),
  no longer a random enemy airframe. `createFriendlyMesh(config)` keeps its signature and
  returns that airframe with `mesh.name = 'FIGHTER'` (the label code shows "Allied Fighter" /
  the wingman's callsign from it).
- `mesh.name` of an enemy stays its `EnemyType` string.
- Enemy contrail ribbons and particle trails take the faction colours above.

## 2. Common rules for every enemy jet

1. **Attack tokens.** A director in `EnemySystem` (so wave jets and boss minions both get it)
   limits how many jets may be on an attack run against the player at once. Jets without a
   token reposition, flank or hold; they do not fire at the player. Tokens *(start)*: levels
   1–2: 2, levels 3–5: 3, levels 6–8: 4, levels 9–10: 5; Very Easy / Easy −1 (minimum 1),
   Hard / Expert +1. A token is released when the run ends, the jet dies or is stunned.
2. **Spread out.** The director gives simultaneous attackers approach bearings at least 60°
   apart as seen from the player whenever two or more hold tokens.
3. **Telegraph.** Every signature attack either has a tell of at least 0.7 s (beam, lock
   warning, charge glow, decloak) or is a projectile slow enough to dodge. No instant,
   unannounced damage.
4. **Leash.** A jet more than 900 m from the player flies straight back toward the fight.
5. **Reaction to the player.** Each type has a stated reaction to (a) the player's seeker
   holding LOCK on it and (b) a player missile in flight toward it. Enemy jets never drop
   flares or otherwise defeat the player's missiles — evasion is manoeuvre only.
6. **Throttle.** Doctrines may fly between 0.6× and 1.3× of the type's base speed.
7. **Unchanged contracts.** Terrain avoidance and the hard floor, EMP stun (`applyStun`: a
   stunned jet does not steer or fire, loses its token, cancels any charge and decloaks),
   `ENEMY_DEATH` payload, score values, NaN / Infinity guards on positions, no per-frame
   allocations on the hot path, and mobile limits (shared bullet pool as small as 80; 5–7 jets
   alive).
8. **Wingmen do not inherit this.** `FriendlyAI` keeps today's three-state behaviour and a
   fixed wingman stat block (Fighter-like), never the new doctrines, weapons or types.
9. **Boss fights.** Minion jets use their doctrines and tokens (fixed 2), but never launch
   missiles and never cloak during a boss fight.

## 3. The roster

Existing enum keys are kept (wave tables, boss minion kinds and tests reference them). HP,
speed, score *(start)* unless noted. Damage numbers are base values before the existing
difficulty and level multipliers.

### SCOUT — harasser (levels 1+)
HP 60 (pinned: one player missile kills it at base), small, fast-turning.
- **Slash attack:** runs in from about 350 m toward where the player will be, fires 3-round
  bursts (0.12 s between rounds, about 1.6 s between bursts), breaks away at about 120 m with a
  turn of 60–90° and a height change, extends to 300–400 m, comes back. It never sits in a
  tail chase.
- **Pairs:** two Scouts with tokens attack from opposite sides.
- **Reaction:** weaves (jinks) while the player's nose is within about 6° of it inside 500 m;
  under LOCK or a missile it jinks harder and dives or climbs.

### FIGHTER — dogfighter (levels 1+)
HP 100.
- **Pursuit:** works toward the player's rear hemisphere (150–250 m behind) and holds there;
  fires 4-round bursts only when the player is inside a tight cone (about 12°, not today's
  45°). If the player turns into it, it takes a head-on pass with one burst and extends.
- **Reaction:** hard break turn (perpendicular, with a dive or climb) on LOCK or missile.

### HEAVY — gunship (levels 2–3+)
HP 300, big, slow, does not dodge.
- **Flak fan:** every 2.6 s *(start)* a fan of 3 slow heavy shells (about 60 m/s, large glowing
  red-orange orbs, ±8° spread) aimed at the player's predicted position; 5 shells from level 6.
  The shells are meant to be dodged.
- **Tail gun:** single aimed shots at a player sitting directly astern within 250 m. Attacking
  from the side or from below is the safe approach.
- **Reaction:** none to lock (it cannot evade); it keeps firing.

### SNIPER — lancer (levels 2+)
HP 80.
- **Standoff:** orbits 380–520 m out.
- **Charged shot:** a thin red aiming beam is visible for 1.3 s; it tracks the player for the
  first 0.9 s, then freezes for 0.4 s, then a fast lance (about 320 m/s, high damage, base 20)
  goes down the frozen line. Changing direction after the freeze dodges it. About 4.5 s
  between shots. A charge sound plays.
- **Flees:** if the player closes inside 220 m it aborts the charge and runs at 1.3× speed to
  reopen the distance.
- **Reaction:** aborts the charge and breaks on LOCK or missile.

### ACE — duelist (levels 3–4+)
HP 160, the fastest jet.
- Fighter pursuit with better numbers, plus a reversal ("scissors") when the player is on its
  tail, and a speed boost in its break.
- **Seeking missile:** between 250 and 600 m, roughly facing the player, it locks for 2.0 s
  (the HUD shows the existing "locking" warning), then launches one seeking missile through the
  existing unit-missile system, so the "incoming" warning, flares, EMP and CIWS all work on
  it. At most one launch per Ace every 14 s *(start)*.
- **Missile tokens (fleet-wide, all missile-carrying jets):** at most 1 jet missile in flight
  toward the player on levels 1–5, 2 on levels 6–10.

### STRIKER — missile carrier (new; levels 4–5+)
HP 140, no gun.
- Stays 450–700 m out. Locks for 2.4 s, launches a pair of missiles 0.4 s apart (subject to the
  missile tokens: if only one token is free it launches one), then turns away to reload for
  about 10 s, slow and vulnerable.
- **Reaction:** none beyond turning away; it is a priority target that rewards closing in.

### JAMMER — electronic warfare (new; levels 5–6+)
HP 120, unarmed, slow.
- Keeps 300–500 m behind its own group, with the group between itself and the player.
- **Jamming:** while at least one Jammer is alive within 800 m of the player, the player's
  missile lock takes 2.0× as long (not stacking). The lock ring shows a "JAMMED" / "受干扰" tag
  while this applies. Nothing else about the seeker changes; the gun is unaffected.
- When the last Jammer in range dies, the effect ends immediately.

### WRAITH — stalker (new; levels 7–8+)
HP 110.
- **Cloak cycle:** visible → 0.6 s fade → cloaked for up to 5 s → 0.7 s decloak tell (fade in
  with a red eye flare and a sound) → may fire → stays visible at least 4 s → repeats.
- While cloaked it cannot be locked, has no radar blip, no health bar, no target marker and no
  gun lead marker; it stays faintly visible (about 12–18 % opacity) and keeps a faint trail. It
  still takes damage, and any hit decloaks it at once and staggers it for 1 s.
- **Attack:** it decloaks in the player's rear quarter inside about 200 m and fires a 5-round
  burst, never before the tell has finished.
- A lock held on it is lost when it cloaks.

## 3a. Clarifications (added after the first test pass; these are rules)

- **Player not targetable** (respawning, story hold, dead): no enemy weapon of any kind fires —
  token-free weapons such as the Heavy's tail gun included — and no lock or charge starts.
- **Non-finite time step:** a jet's position is finite whenever `update` returns, also for
  `NaN` / `Infinity` time steps; the jet is not moved to the origin to repair it.
- **Scout, "never sits in a tail chase":** a Scout is not inside a 30° cone behind the player
  within 250 m for more than 4 s at a time.
- **Scout pairs:** when two Scouts hold tokens together, the second one's attack run starts
  from a bearing more than 90° away from the first one's, as seen from the player; it
  repositions to its assigned bearing before it turns in.
- **Sniper standoff:** while it is neither fleeing nor charging nor outside the leash, a Sniper
  is inside 380–520 m for at least 60 % of the time against a player flying straight at cruise
  speed or turning gently. It may use the full throttle range to keep station.
- **Gun cones** are checked when a burst starts (its first round); later rounds of the same
  burst may leave the cone. Fighter: about 12°. Ace: at most 15°.
- **Fighter station:** 150–250 m behind is a target band, not a guarantee; sitting at its low
  edge is fine.
- **Jamming ends "immediately":** within one simulation step of the last Jammer in range dying
  or leaving 800 m (the seeker reads the previous step's review; a one-step lag is accepted).
- **A stunned Jammer does not jam.** While EMP stun lasts, that Jammer does not count toward
  the lock slowdown and the "JAMMED" tag; jamming resumes when the stun ends.

## 4. Waves and end game (waves / balance batch)

- Wave composition becomes authored: each wave lists exactly which jets arrive (guaranteed mix)
  and how — one group as today, a pincer (two groups 90–150° apart) or a trail (staggered).
  `totalWaves` per level and the length of `enemiesPerWave` do not change (they are tied to
  unit deployments, voiced radio lines and checkpoints).
- Introductions *(start)*: level 1 Scouts then Fighters; level 2 adds Snipers and a late Heavy;
  level 3 adds a single Ace as a mini-elite; level 4 Striker; level 5 Jammer; level 6
  combinations (Jammer + Strikers, Sniper pairs); level 7 Wraith; level 8 Wraith pairs and an
  Ace wing; level 9 elite squadrons; level 10 a gauntlet using everything, with per-wave counts
  no lower than level 9's. Every level from 2 to 8 introduces a new type or a new combination.
- The first wave in which a new type appears shows a one-line, text-only hint about how to beat
  it (both languages; no new voiced radio lines).
- "Elite hunt" objectives count STRIKER, JAMMER and WRAITH along with HEAVY, ACE and SNIPER.
- Level curve: with aimed, telegraphed attacks the old damage multipliers (up to ×4.6 at level
  10) are probably too steep; retune so that, measured with the existing balance harness,
  pressure on the player rises level by level and level 10 is the hardest (today it sits below
  levels 8–9).
- Feel target on Normal: levels 1–3 are usually cleared without losing a life; levels 8–10
  usually cost one or two. Very Easy must stay comfortable.

## 4a. Wave line-ups (milestone 3)

Abbreviations: Sc SCOUT, Fi FIGHTER, He HEAVY, Sn SNIPER, Ac ACE, St STRIKER, Ja JAMMER,
Wr WRAITH. Arrival: **G** one group, **P** pincer (two groups 90–150° apart as seen from the
player), **T** trail (same bearing, staggered so they arrive one after another). The wave's
event (from the level's existing `eventTemplates`, unchanged) is shown in brackets: I intercept,
E elite hunt, D escort defence.

### Rules (fixed — tests are written against these)

1. `totalWaves` and the length of `enemiesPerWave` are unchanged for every level. The values of
   `enemiesPerWave` are unchanged for levels 1–9. Level 10 becomes `[4, 5, 5, 5, 6, 6, 6, 6]`
   *(start)*; whatever the tuned values, each of level 10's first seven is no lower than level
   9's value for the same wave, and its last wave is no lower than level 9's last.
2. Each wave has an authored line-up whose size equals `enemiesPerWave[wave]`. The same wave of
   the same level always brings the same jets (no random type picking). The wave event no
   longer rewrites the line-up; it keeps its objective and spawn cadence.
3. No type appears before its introduction: SCOUT 1, FIGHTER 1, SNIPER 2, HEAVY 2, ACE 3,
   STRIKER 4, JAMMER 5, WRAITH 7 (level numbers). Level 1 contains only Scouts and Fighters,
   and its first wave is exactly two Scouts.
4. Per-wave caps: at most 1 Jammer (the effect does not stack), 2 Strikers, 2 Wraiths,
   2 Heavies, 2 Snipers, 2 Aces. A Jammer never arrives without at least two armed jets in the
   same wave.
5. An elite-hunt wave's line-up contains at least as many elite-list jets (HEAVY, ACE, SNIPER,
   STRIKER, JAMMER, WRAITH) as its objective asks the player to destroy.
6. Every level from 2 to 8 has at least one wave whose line-up (as a set of types) does not
   occur anywhere in the earlier levels.
7. The number of jets alive at once still respects the existing mobile limit; line-ups larger
   than the limit arrive as the limit allows (existing behaviour).
8. First-contact hint: at the start of the first wave of the campaign in which FIGHTER, SNIPER,
   HEAVY, ACE, STRIKER, JAMMER or WRAITH appears (the introduction wave below), one line of
   text is shown, in the current language, without voice. It shows again if that same wave is
   replayed from a checkpoint, and never in other waves. SCOUT has no hint (level 1 wave 1
   belongs to the existing onboarding).

### Hint lines

| Type | English | 中文 |
|---|---|---|
| FIGHTER | Fighters go for your tail. Turn into them to shake them off. | 战斗机会咬你的尾巴，朝它转过去就能甩开。 |
| SNIPER | Red beam: a sniper is charging. When the beam freezes, change direction. | 红色光束是狙击机在蓄力，光束定住的瞬间立刻转向。 |
| HEAVY | Gunships fire slow shell fans. Attack from the side or below, not from behind. | 炮艇机打出慢速弹幕，从侧面或下方进攻，别跟在正后方。 |
| ACE | Aces fire seeking missiles. On a missile warning, drop a flare and break. | 王牌机会发射追踪导弹，出现导弹警告就放干扰弹并急转。 |
| STRIKER | Strikers launch missile pairs from far out. Close in while they reload. | 打击机在远处成对发射导弹，趁它装填时贴上去。 |
| JAMMER | A Jammer slows your missile lock. Shoot it down first — guns still work. | 干扰机会拖慢导弹锁定，先把它打掉——机炮不受影响。 |
| WRAITH | Wraiths cloak and strike from behind. Watch for the red flash, then turn. | 幽灵机隐身后从背后偷袭，看到红色闪光就立刻转向。 |

### Starting line-ups *(start — the implementer may swap a type or change the arrival pattern
where the balance harness or a live check shows a problem, within the rules above, and reports
every change)*

**Level 1** `[2,3,3,4,4]` — W1 2 Sc (G) · W2 3 Sc (P 2+1) [I] · W3 2 Sc + 1 Fi (G) [I] ·
W4 2 Sc + 2 Fi (P) [I] · W5 2 Fi + 2 Sc (T) [I]

**Level 2** `[3,4,5,5,5]` — W1 2 Sc + 1 Fi (G) · W2 2 Fi + 1 Sc + 1 Sn (G, Sniper last) [I] ·
W3 2 Sn + 2 Fi + 1 Sc (P) [E] · W4 1 He + 2 Fi + 2 Sc (G) [D] · W5 1 He + 1 Sn + 2 Fi + 1 Sc (P) [I]

**Level 3** `[3,4,4,4,5,5]` — W1 2 Fi + 1 Sc (G) · W2 1 He + 1 Sn + 2 Fi (G) [E] ·
W3 4 Sc as two pairs (P) [I] · W4 1 Ac + 2 Fi + 1 Sc (G) [D] · W5 1 Ac + 1 He + 1 Sn + 2 Fi (P) [E] ·
W6 1 Ac + 2 Fi + 2 Sc (P) [I]

**Level 4** `[4,4,5,5,5,5]` — W1 2 Fi + 2 Sc (P) · W2 1 St + 2 Fi + 1 Sc (G, Striker behind) [I] ·
W3 1 St + 1 He + 1 Sn + 2 Fi (G) [E] · W4 2 He + 2 Fi + 1 Sc (T) [D] ·
W5 2 St + 2 Sc + 1 Fi (P: Strikers one side, the rest the other) [I] · W6 1 Ac + 1 St + 1 Sn + 2 Fi (P) [E]

**Level 5** `[4,4,4,5,5,5,5]` — W1 2 Fi + 2 Sc (G) · W2 1 Ja + 1 He + 2 Fi (G) [E] ·
W3 3 Sc + 1 Sn (P) [I] · W4 1 Ja + 1 St + 2 Fi + 1 Sc (G) [D] · W5 1 Ac + 1 Ja + 1 Sn + 2 Fi (P) [E] ·
W6 2 St + 1 Ja + 2 Sc (P) [I] · W7 1 Ac + 1 He + 1 Ja + 2 Fi (T) [D]

**Level 6** `[5,5,5,5,6,6,6]` — W1 3 Fi + 2 Sc (P) · W2 2 Sn + 2 Fi + 1 Sc (G) [I] ·
W3 1 Ja + 2 St + 2 Fi (G) [E] · W4 2 Sn + 3 Sc (P) [I] · W5 2 He + 1 Ja + 2 Fi + 1 Sc (T) [D] ·
W6 1 Ac + 2 Sn + 2 Fi + 1 Sc (P) [I] · W7 1 Ac + 1 Ja + 2 St + 1 He + 1 Fi (P) [E]

**Level 7** `[4,4,5,5,5,5,6]` — W1 2 Fi + 2 Sc (G) · W2 1 Wr + 2 Fi + 1 Sc (G) [D] ·
W3 1 Wr + 2 Sc + 1 Sn + 1 Fi (P) [I] · W4 1 Wr + 1 Ac + 1 He + 2 Fi (G) [E] ·
W5 1 Ja + 1 St + 1 Wr + 2 Fi (P) [D] · W6 2 Sn + 1 Wr + 2 Sc (P) [I] ·
W7 1 Ac + 1 Wr + 1 St + 1 Ja + 2 Fi (P) [E]

**Level 8** `[4,5,5,5,5,6,6]` — W1 2 Wr + 2 Fi (G) · W2 2 Ac + 2 Fi + 1 Sc (P) [D] ·
W3 2 Wr + 1 He + 1 Sn + 1 Ja (G) [E] · W4 2 St + 1 Ja + 2 Fi (P) [D] · W5 2 Ac + 3 Sc (P) [I] ·
W6 2 Wr + 2 Sn + 2 Fi (P) [D] · W7 2 Ac + 2 Wr + 1 St + 1 Ja (P) [E]

**Level 9** `[4,5,5,5,6,6,6]` — W1 2 Ac + 2 Fi (P) · W2 2 Sn + 1 Wr + 2 Sc (P) [I] ·
W3 2 St + 1 Ja + 1 He + 1 Fi (G) [D] · W4 2 Ac + 2 Wr + 1 Ja (P) [E] · W5 3 Sc + 2 Sn + 1 Wr (P) [I] ·
W6 2 He + 2 St + 1 Ja + 1 Ac (T) [D] · W7 2 Ac + 2 Wr + 1 St + 1 Sn (P) [E]

**Level 10** `[4,5,5,5,6,6,6,6]` — W1 2 Ac + 2 Fi (P) · W2 2 Wr + 1 Ja + 1 He + 1 Sn (G) [E] ·
W3 3 Sc + 2 Sn (P) [I] · W4 2 St + 1 Ja + 2 Fi (P) [D] · W5 2 Ac + 2 Wr + 1 He + 1 Ja (P) [E] ·
W6 2 He + 2 St + 1 Sn + 1 Ja (T) [E] · W7 2 Sn + 2 Wr + 2 Sc (P) [I] ·
W8 2 Ac + 2 Wr + 1 St + 1 Ja (P) [D]

(Events follow the existing rule: wave 1 has none; wave *w* ≥ 2 takes
`eventTemplates[(w − 2) mod length]`.)

### Level curve

- Measured with the balance harness on Very Easy, Normal and Expert: the pressure figure
  (expected damage taken per minute by the harness's reference pilot, or the harness's nearest
  equivalent) does not fall from one level to the next, and level 10's is the highest.
- Feel targets (§4) decide ties: levels 1–3 on Normal are usually cleared without losing a
  life; levels 8–10 usually cost one or two; Very Easy stays comfortable throughout.
- Player missile damage stays 80; a base Scout still dies to one missile on every level's
  health multiplier only if that is already true today — report the levels where it is not,
  do not change player weapons.

## 5. Developer hooks (dev builds only, `window.__AIR_SUPREME_DEV__`)

- `spawnEnemy(type, opts?)` with `opts = { distance?, bearingDeg?, count? }` — spawns that type
  around the player through the normal spawn path.
- `listJets()` — one entry per alive enemy jet: `{ type, health, position, distance, phase,
  hasAttackToken, cloaked }` (`phase` is a short doctrine state name).
- `clearJets()` — removes all enemy jets without scoring.
- `holdWaves(on)` — stops / resumes regular wave spawning, so one type can be studied alone.
