/**
 * 十个关卡的关卡曲（非 Boss）。每首：前奏 → 主段 → 加强段（按强度）→ 间奏，循环回主段。
 * 强度分层：0.2+ 鼓组进入，0.35+ 旋律，0.6+ 十六分镲 / 对位，0.75+ 铜管与镲片强调。
 */
import { DRUM, bars, bassRiff, chordRiff, track } from '../Compose';
import type { Composition } from '../MusicTypes';
import { FALCON, FALCON_CHORDS_A, FALCON_CHORDS_B, ORACLE, P } from './Shared';

/** 第一章 湖畔晨曦：A 小调，破晓的希望，首次完整呈现“猎鹰”主题 */
export const LAKE_TRACK: Composition = {
  id: 'LAKE',
  bpm: 112,
  key: 9,
  tempoRamp: 0.05,
  mix: 0.45,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.3, wet: 0.25, tone: 2400 },
  tracks: {
    pad: track('pad', 0.28, { params: P.warmPad, reverb: 0.35 }),
    arp: track('pluck', 0.2, {
      params: { ...P.pluckSoft, center: 64 },
      arp: { rate: 2, mode: 'up', octaves: 2, gate: 0.8 },
      pan: -0.3,
      send: 0.25,
      reverb: 0.2,
    }),
    arp16: track('pluck', 0.13, {
      params: { ...P.pluckBright, center: 69 },
      arp: { rate: 1, mode: 'updown', octaves: 2, gate: 0.6 },
      pan: 0.35,
      send: 0.2,
      minIntensity: 0.6,
    }),
    bass: track('bass', 0.46, { params: P.bassSaw }),
    kick: track('kick', 0.8, { params: P.kickPunch, minIntensity: 0.2 }),
    snare: track('snare', 0.42, { params: P.snareTight, reverb: 0.15, minIntensity: 0.2 }),
    hat: track('hat', 0.2, {
      params: P.hatClosed,
      pan: 0.25,
      minIntensity: 0.3,
      maxIntensity: 0.6,
    }),
    hat16: track('hat', 0.18, { params: P.hatClosed, pan: 0.25, minIntensity: 0.6 }),
    crash: track('cymbal', 0.18, { params: P.crash, minIntensity: 0.45 }),
    lead: track('lead', 0.3, { params: P.leadSoft, reverb: 0.25, send: 0.2, minIntensity: 0.3 }),
    bell: track('bell', 0.2, {
      params: P.bell,
      pan: 0.3,
      reverb: 0.4,
      send: 0.3,
      minIntensity: 0.4,
    }),
    brass: track('brass', 0.24, {
      params: P.brassStab,
      input: 'chords',
      reverb: 0.2,
      minIntensity: 0.75,
    }),
    riser: track('riser', 0.22, { input: 'notes', minIntensity: 0.3 }),
  },
  patterns: {
    ch: `${FALCON_CHORDS_A} ${FALCON_CHORDS_B}`,
    chBridge: 'Dm:16 F:16 C:16 G:16 Dm:16 F:16 Esus4:8 E:8 E:16',
    bass: bassRiff(
      ['A1', 'F1', 'C2', 'G1', 'A1', 'F1', 'G1', 'E1'],
      'R:2 R:2 O:2 R:2 F:2 R:2 O:2 R:2'
    ),
    bassBridge: bassRiff(
      ['D2', 'F1', 'C2', 'G1', 'D2', 'F1', 'E1', 'E1'],
      'R:2 R:2 O:2 R:2 F:2 R:2 O:2 R:2'
    ),
    falcon: FALCON,
    bellBridge: 'F5:8 A5:8 A5:8 C6:8 G5:8 E5:8 D5:8 B4:8 F5:8 A5:8 C6:8 A5:8 A5:8 G#5:8 E5:16',
    kick: bars(DRUM.KICK_POP, 7) + 'X.....x.X...X.X.',
    snare: bars(DRUM.SNARE_BACK, 7) + DRUM.SNARE_FILL,
    hat: DRUM.HAT_8,
    hat16: DRUM.HAT_16,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 7),
    brass: chordRiff(['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], 'R:3 R:3 R:2 -:8'),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', arp: 'ch' } },
    {
      name: 'theme',
      bars: 8,
      play: {
        pad: 'ch',
        arp: 'ch',
        arp16: 'ch',
        bass: 'bass',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        hat16: 'hat16',
        crash: 'crash',
        lead: 'falcon',
      },
    },
    {
      name: 'bridge',
      bars: 8,
      play: {
        pad: 'chBridge',
        arp: 'chBridge',
        arp16: 'chBridge',
        bass: 'bassBridge',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        hat16: 'hat16',
        crash: 'crash',
        bell: 'bellBridge',
      },
    },
    {
      name: 'reprise',
      bars: 8,
      minIntensity: 0.4,
      play: {
        pad: 'ch',
        arp: 'ch',
        arp16: 'ch',
        bass: 'bass',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        hat16: 'hat16',
        crash: 'crash',
        lead: 'falcon',
        bell: 'falcon^12',
        brass: 'brass',
      },
    },
    {
      name: 'breakdown',
      bars: 4,
      maxIntensity: 0.7,
      play: { pad: 'ch', arp: 'ch', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第二章 沙漠风暴：D 弗里几亚属调式，手鼓 maqsum 节奏、乌德琴、唢呐式主旋律 */
export const DESERT_TRACK: Composition = {
  id: 'DESERT',
  bpm: 124,
  key: 2,
  swing: 0.06,
  tempoRamp: 0.05,
  mix: 0.387,
  defaultIntensity: 0.5,
  delay: { beats: 0.5, feedback: 0.25, wet: 0.2, tone: 2000 },
  tracks: {
    drone: track('pad', 0.22, { params: { ...P.darkPad, cutoff: 900 }, reverb: 0.3 }),
    oud: track('pluck', 0.26, { params: P.oud, pan: -0.25, reverb: 0.2 }),
    bass: track('bass', 0.44, { params: P.bassPluck }),
    dum: track('tom', 0.5, { params: P.dum }),
    tek: track('tom', 0.3, { params: P.tek, pan: 0.2, minIntensity: 0.25 }),
    tek16: track('tom', 0.18, { params: P.tek, pan: -0.2, minIntensity: 0.6 }),
    clap: track('clap', 0.28, { reverb: 0.2, minIntensity: 0.35 }),
    kick: track('kick', 0.6, { params: P.kickPunch, minIntensity: 0.45 }),
    lead: track('lead', 0.28, { params: P.zurna, reverb: 0.25, send: 0.2, minIntensity: 0.3 }),
    brass: track('brass', 0.22, { params: P.brassStab, input: 'chords', minIntensity: 0.7 }),
    crash: track('cymbal', 0.16, { params: P.crash, minIntensity: 0.55 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.4 }),
  },
  patterns: {
    drone: '[D3,A3]:32',
    oud:
      'D4:2 D4:1 Eb4:1 F#4:2 G4:2 A4:2 G4:1 F#4:1 Eb4:2 D4:2 | ' +
      'Eb4:2 Eb4:1 G4:1 Bb4:2 A4:2 G4:2 F#4:1 G4:1 Eb4:2 D4:2 | ' +
      'D4:2 D4:1 Eb4:1 F#4:2 G4:2 A4:2 G4:1 F#4:1 Eb4:2 D4:2 | ' +
      'C4:2 Eb4:2 G4:2 Eb4:2 Eb4:2 G4:2 Bb4:2 G4:2 | ' +
      'G3:2 Bb3:2 D4:2 G4:2 F#4:2 G4:2 D4:2 Bb3:2 | ' +
      'C4:2 Eb4:2 G4:2 C5:2 Bb4:2 G4:2 Eb4:2 C4:2 | ' +
      'Eb4:2 G4:2 Bb4:2 G4:2 D4:2 F#4:2 A4:2 F#4:2 | ' +
      'D4:2 Eb4:2 F#4:2 G4:2 A4:4 D4:4',
    bass:
      'D2:3 D2:1 D2:2 D3:2 D2:2 A2:2 Eb2:2 D2:2 | Eb2:3 Eb2:1 Eb2:2 Eb3:2 Eb2:2 Bb2:2 D2:2 Eb2:2 | ' +
      'D2:3 D2:1 D2:2 D3:2 D2:2 A2:2 Eb2:2 D2:2 | C2:3 C2:1 C2:2 C3:2 Eb2:3 Eb2:1 Eb2:2 Eb3:2 | ' +
      'G1:3 G1:1 G1:2 G2:2 G1:2 D2:2 F#1:2 G1:2 | C2:3 C2:1 C2:2 C3:2 C2:2 G2:2 Bb1:2 C2:2 | ' +
      'Eb2:3 Eb2:1 Eb2:2 Eb3:2 D2:3 D2:1 D2:2 D3:2 | D2:3 D2:1 D2:2 D3:2 D2:2 A2:2 Eb2:2 D2:2',
    lead:
      'D5:2 Eb5:2 F#5:4 A5:4 G5:2 F#5:2 | G5:4 F#5:2 G5:2 Bb5:4 A5:2 G5:2 | ' +
      'A5:6 G5:2 F#5:2 G5:2 F#5:2 Eb5:2 | Eb5:4 C5:4 Eb5:2 F#5:2 G5:4 | ' +
      'D5:4 G5:4 Bb5:2 A5:2 G5:4 | C6:4 Bb5:2 A5:2 G5:4 Eb5:4 | ' +
      'G5:2 F#5:2 Eb5:2 F#5:2 A5:4 F#5:4 | D5:12 -:4',
    brass: chordRiff(['D', 'Eb', 'D', 'Cm', 'Gm', 'Cm', 'Eb', 'D'], 'R:2 -:2 R:2 -:6 R:2 -:2'),
    dum: DRUM.KICK_STOMP,
    tek: '..x...x.....x...',
    tek16: '.g.g.g.gxg.g.g.g',
    clap: DRUM.SNARE_BACK,
    kick: 'X.......X..x....',
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 7),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { drone: 'drone', oud: 'oud', dum: 'dum' } },
    {
      name: 'main',
      bars: 8,
      play: {
        drone: 'drone',
        oud: 'oud',
        bass: 'bass',
        dum: 'dum',
        tek: 'tek',
        tek16: 'tek16',
        clap: 'clap',
        kick: 'kick',
        lead: 'lead',
        crash: 'crash',
      },
    },
    {
      name: 'surge',
      bars: 8,
      minIntensity: 0.55,
      play: {
        drone: 'drone',
        oud: 'lead^-12',
        bass: 'bass',
        dum: 'dum',
        tek: 'tek',
        tek16: 'tek16',
        clap: 'clap',
        kick: 'kick',
        lead: 'lead',
        brass: 'brass',
        crash: 'crash',
      },
    },
    {
      name: 'break',
      bars: 4,
      maxIntensity: 0.7,
      play: { drone: 'drone', oud: 'oud', dum: 'dum', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第三章 雪山之巅：E 小调，冰晶钟琴琶音、合唱垫、回声长笛（WHITE ECHO） */
export const SNOW_TRACK: Composition = {
  id: 'SNOW',
  bpm: 92,
  key: 4,
  tempoRamp: 0.04,
  mix: 0.394,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.4, wet: 0.3, tone: 3000 },
  tracks: {
    pad: track('pad', 0.3, { params: P.glassPad, reverb: 0.45 }),
    choir: track('choir', 0.24, { params: { center: 64 }, reverb: 0.5, minIntensity: 0.5 }),
    bells: track('bell', 0.18, {
      params: { ...P.glass, center: 76 },
      arp: { rate: 2, mode: 'updown', octaves: 2, gate: 1 },
      pan: 0.3,
      send: 0.35,
      reverb: 0.45,
    }),
    sub: track('bass', 0.4, { params: P.bassSub }),
    pulse: track('bass', 0.3, { params: { ...P.bassPluck, cutoff: 600 }, minIntensity: 0.6 }),
    kick: track('kick', 0.7, { params: P.kickSoft, minIntensity: 0.25 }),
    snare: track('snare', 0.36, { params: P.snareSoft, reverb: 0.35, minIntensity: 0.3 }),
    hat: track('hat', 0.16, { params: P.hatSoft, pan: -0.2, minIntensity: 0.35 }),
    hat8: track('hat', 0.14, { params: P.hatSoft, pan: 0.2, minIntensity: 0.6 }),
    flute: track('lead', 0.3, { params: P.flute, send: 0.4, reverb: 0.35, minIntensity: 0.3 }),
    riser: track('riser', 0.18, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'Em:16 Cmaj7:16 G:16 D:16 Em:16 Bm:16 C:16 D:16',
    chBridge: 'Am:16 Em:16 C:16 Bsus4:8 B:8',
    sub: bassRiff(['E1', 'C2', 'G1', 'D2', 'E1', 'B1', 'C2', 'D2'], 'R:16'),
    subBridge: bassRiff(['A1', 'E1', 'C2', 'B1'], 'R:16'),
    pulse: bassRiff(
      ['E2', 'C2', 'G1', 'D2', 'E2', 'B1', 'C2', 'D2'],
      'R:2 R:2 R:2 O:2 R:2 R:2 O:2 R:2'
    ),
    flute:
      'B4:6 E5:2 D5:4 B4:4 | C5:4 E5:4 G5:6 F#5:2 | G5:8 D5:4 B4:4 | A4:4 D5:4 F#5:6 E5:2 | ' +
      'G5:6 F#5:2 E5:4 B4:4 | D5:4 F#5:4 B5:6 A5:2 | G5:4 E5:4 C5:4 E5:4 | F#5:6 E5:2 D5:8',
    fluteBridge: 'C5:8 E5:8 B4:8 G4:8 E5:8 G5:8 F#5:8 D#5:8',
    kick: 'X.........x.....',
    snare: DRUM.SNARE_HALF,
    hat: DRUM.HAT_OFF,
    hat8: DRUM.HAT_8,
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', bells: 'ch', sub: 'sub' } },
    {
      name: 'theme',
      bars: 8,
      play: {
        pad: 'ch',
        choir: 'ch',
        bells: 'ch',
        sub: 'sub',
        pulse: 'pulse',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        hat8: 'hat8',
        flute: 'flute',
      },
    },
    {
      name: 'aurora',
      bars: 4,
      play: {
        pad: 'chBridge',
        choir: 'chBridge',
        bells: 'chBridge',
        sub: 'subBridge',
        kick: 'kick',
        hat: 'hat',
        flute: 'fluteBridge',
        riser: 'riser',
      },
    },
    {
      name: 'reprise',
      bars: 8,
      minIntensity: 0.45,
      play: {
        pad: 'ch',
        choir: 'ch',
        bells: 'ch',
        sub: 'sub',
        pulse: 'pulse',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        hat8: 'hat8',
        flute: 'flute^12',
      },
    },
  ],
  loopFrom: 1,
};

/** 第四章 深海决战：C 小调，弦乐固定音型、战鼓与英雄式铜管 */
export const OCEAN_TRACK: Composition = {
  id: 'OCEAN',
  bpm: 118,
  key: 0,
  tempoRamp: 0.05,
  mix: 0.488,
  defaultIntensity: 0.5,
  tracks: {
    strings: track('pluck', 0.22, {
      params: { ...P.strings16, center: 55 },
      arp: { rate: 1, mode: 'updown', octaves: 1, gate: 0.55 },
      pan: -0.2,
      reverb: 0.2,
    }),
    pad: track('pad', 0.26, { params: P.darkPad, reverb: 0.3 }),
    bass: track('bass', 0.44, { params: P.bassSaw }),
    taiko: track('tom', 0.5, { params: P.taikoLow, minIntensity: 0.2 }),
    taikoHi: track('tom', 0.26, { params: P.taikoHigh, pan: 0.25, minIntensity: 0.6 }),
    snare: track('snare', 0.36, { params: P.snareFat, reverb: 0.2, minIntensity: 0.4 }),
    boom: track('boom', 0.5, { params: P.boom, minIntensity: 0.55 }),
    brass: track('brass', 0.3, { params: P.brassLead, reverb: 0.3, minIntensity: 0.3 }),
    crash: track('cymbal', 0.16, { params: P.crash, minIntensity: 0.7 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'Cm:16 Ab:16 Eb:16 Bb:16 Ab:16 Fm:16 Gsus4:8 G:8 G:16',
    bass: bassRiff(
      ['C2', 'Ab1', 'Eb2', 'Bb1', 'Ab1', 'F1', 'G1', 'G1'],
      'R:2 R:1 R:1 R:2 R:1 R:1 R:2 R:1 R:1 R:2 R:1 R:1'
    ),
    brass:
      'G4:6 C5:2 Eb5:4 D5:2 C5:2 | C5:6 Eb5:2 Ab5:8 | G5:4 F5:2 Eb5:2 Bb4:4 Eb5:4 | ' +
      'D5:6 C5:2 Bb4:8 | C5:4 Eb5:4 Ab5:4 G5:2 F5:2 | F5:6 G5:2 Ab5:4 C6:4 | ' +
      'C6:4 Bb5:2 C6:2 B5:4 D6:4 | G5:8 F5:4 D5:4',
    taiko: 'X..x..X.X..x..x.',
    taikoHi: '....x.x.....xxxx',
    snare: '....X.......X.g.',
    boom: DRUM.CRASH_BAR + DRUM.EMPTY,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { strings: 'ch', pad: 'ch', bass: 'bass' } },
    {
      name: 'theme',
      bars: 8,
      play: { strings: 'ch', pad: 'ch', bass: 'bass', taiko: 'taiko', brass: 'brass' },
    },
    {
      name: 'battle',
      bars: 8,
      minIntensity: 0.45,
      play: {
        strings: 'ch',
        pad: 'ch',
        bass: 'bass',
        taiko: 'taiko',
        taikoHi: 'taikoHi',
        snare: 'snare',
        boom: 'boom',
        brass: 'brass',
        crash: 'crash',
      },
    },
    {
      name: 'swell',
      bars: 4,
      maxIntensity: 0.65,
      play: { strings: 'ch', pad: 'ch', taiko: 'taiko', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第五章 城市废墟：升 F 小调，四拍底鼓、门控和弦、十六分琶音的赛博摇滚 */
export const CITY_TRACK: Composition = {
  id: 'CITY',
  bpm: 132,
  key: 6,
  tempoRamp: 0.05,
  mix: 0.474,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.35, wet: 0.25, tone: 3200 },
  tracks: {
    kick: track('kick', 0.82, { params: P.kickPunch }),
    clap: track('clap', 0.34, { reverb: 0.2, minIntensity: 0.25 }),
    hat: track('hat', 0.2, { params: P.hatClosed, pan: 0.25, minIntensity: 0.3 }),
    hat16: track('hat', 0.13, { params: P.hatClosed, pan: -0.25, minIntensity: 0.65 }),
    crash: track('cymbal', 0.16, { params: P.crash, minIntensity: 0.5 }),
    bass: track('bass', 0.46, { params: P.bassPluck }),
    arp: track('pluck', 0.18, {
      params: { ...P.pluckBright, center: 66 },
      arp: { rate: 1, mode: 'up', octaves: 2, gate: 0.55 },
      pan: -0.25,
      send: 0.3,
    }),
    stabs: track('pad', 0.22, { params: P.gatedPad, reverb: 0.15 }),
    lead: track('lead', 0.28, { params: P.leadSaw, reverb: 0.2, send: 0.2, minIntensity: 0.35 }),
    brass: track('brass', 0.2, { params: P.brassStab, input: 'chords', minIntensity: 0.8 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'F#m:16 D:16 A:16 E:16 Bm:16 D:16 F#m:16 C#:16',
    stabs: chordRiff(
      ['F#m', 'D', 'A', 'E', 'Bm', 'D', 'F#m', 'C#'],
      'R:2 -:2 R:2 -:1 R:1 -:2 R:2 -:2 R:2'
    ),
    bass: bassRiff(
      ['F#1', 'D2', 'A1', 'E2', 'B1', 'D2', 'F#1', 'C#2'],
      '-:2 R:2 -:2 R:2 -:2 O:2 -:2 R:2'
    ),
    lead:
      'C#5:4 F#5:4 E5:2 C#5:2 A4:4 | D5:6 F#5:2 A5:8 | E5:4 C#5:4 A4:4 C#5:4 | B4:6 G#4:2 E5:8 | ' +
      'D5:4 F#5:4 B5:6 A5:2 | A5:4 F#5:4 D5:4 F#5:4 | C#6:6 B5:2 A5:4 F#5:4 | G#5:4 F5:4 C#5:8',
    brass: chordRiff(['F#m', 'D', 'A', 'E', 'Bm', 'D', 'F#m', 'C#'], 'R:3 R:3 R:2 -:8'),
    kick: DRUM.KICK_FOUR,
    clap: DRUM.SNARE_BACK,
    hat: DRUM.HAT_OFF,
    hat16: DRUM.HAT_16,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { kick: 'kick', stabs: 'stabs', arp: 'ch' } },
    {
      name: 'drive',
      bars: 8,
      play: {
        kick: 'kick',
        clap: 'clap',
        hat: 'hat',
        hat16: 'hat16',
        crash: 'crash',
        bass: 'bass',
        arp: 'ch',
        stabs: 'stabs',
        lead: 'lead',
      },
    },
    {
      name: 'overdrive',
      bars: 8,
      minIntensity: 0.55,
      play: {
        kick: 'kick',
        clap: 'clap',
        hat: 'hat',
        hat16: 'hat16',
        crash: 'crash',
        bass: 'bass',
        arp: 'ch',
        stabs: 'stabs',
        lead: 'lead^12',
        brass: 'brass',
      },
    },
    {
      name: 'ruins',
      bars: 4,
      maxIntensity: 0.7,
      play: { arp: 'ch', stabs: 'stabs', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第六章 熔炉之心：升 C 弗里几亚，太鼓战鼓、铁砧敲击、失真低音与低音铜管 */
export const VOLCANO_TRACK: Composition = {
  id: 'VOLCANO',
  bpm: 100,
  key: 1,
  tempoRamp: 0.06,
  mix: 0.322,
  defaultIntensity: 0.5,
  tracks: {
    pad: track('pad', 0.24, { params: P.darkPad, reverb: 0.3 }),
    taiko: track('tom', 0.56, { params: P.taikoLow }),
    taikoHi: track('tom', 0.28, { params: P.taikoHigh, pan: -0.25, minIntensity: 0.5 }),
    boom: track('boom', 0.5, { params: P.boom, minIntensity: 0.3 }),
    anvil: track('bell', 0.16, { params: P.anvil, pan: 0.3, reverb: 0.3, minIntensity: 0.35 }),
    bass: track('bass', 0.42, { params: P.bassDist }),
    brass: track('brass', 0.3, { params: { ...P.brassLead, center: 52 }, minIntensity: 0.4 }),
    choir: track('choir', 0.24, { params: { center: 58 }, reverb: 0.45, minIntensity: 0.6 }),
    snare: track('snare', 0.3, { params: P.snareFat, minIntensity: 0.55 }),
    crash: track('cymbal', 0.16, { params: P.crash, minIntensity: 0.6 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'C#m:16 D:16 C#m:16 B:16 A:16 B:16 G#:16 G#:16',
    bass:
      'C#2:4 C#2:2 C#3:2 C#2:4 D3:2 C#3:2 | D2:4 D2:2 D3:2 D2:4 E3:2 D3:2 | ' +
      'C#2:4 C#2:2 C#3:2 C#2:4 D3:2 C#3:2 | B1:4 B1:2 B2:2 B1:4 C#3:2 B2:2 | ' +
      'A1:4 A1:2 A2:2 A1:4 B2:2 A2:2 | B1:4 B1:2 B2:2 B1:4 C#3:2 B2:2 | ' +
      'G#1:4 G#1:2 G#2:2 G#1:4 A2:2 G#2:2 | G#1:4 G#1:2 G#2:2 G#1:2 C2:2 D#2:2 G#2:2',
    brass:
      'C#4:8 E4:4 G#4:4 | A4:8 F#4:4 D4:4 | G#4:6 F#4:2 E4:4 C#4:4 | D#4:8 F#4:4 B3:4 | ' +
      'E4:4 A4:4 C#5:8 | D#5:4 F#5:4 B4:8 | C5:8 D#5:4 G#4:4 | G#4:16',
    anvil: '-:4 C#6:2 -:6 C#6:2 -:2',
    taiko: 'X..x..x.X...x.x.',
    taikoHi: '..x.x..x..x.xx.x',
    boom: DRUM.CRASH_BAR + DRUM.EMPTY,
    snare: DRUM.SNARE_HALF,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', taiko: 'taiko', boom: 'boom', anvil: 'anvil' } },
    {
      name: 'forge',
      bars: 8,
      play: {
        pad: 'ch',
        taiko: 'taiko',
        taikoHi: 'taikoHi',
        boom: 'boom',
        anvil: 'anvil',
        bass: 'bass',
        brass: 'brass',
        snare: 'snare',
      },
    },
    {
      name: 'eruption',
      bars: 8,
      minIntensity: 0.5,
      play: {
        pad: 'ch',
        choir: 'ch',
        taiko: 'taiko',
        taikoHi: 'taikoHi',
        boom: 'boom',
        anvil: 'anvil',
        bass: 'bass',
        brass: 'brass^12',
        snare: 'snare',
        crash: 'crash',
      },
    },
    {
      name: 'magma',
      bars: 4,
      maxIntensity: 0.7,
      play: { pad: 'ch', taiko: 'taiko', anvil: 'anvil', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第七章 极光冰海：B 小调，冰下潜航的紧张，声呐回响、心跳底鼓、玻璃质感长音 */
export const ARCTIC_TRACK: Composition = {
  id: 'ARCTIC',
  bpm: 84,
  key: 11,
  tempoRamp: 0.05,
  mix: 0.399,
  defaultIntensity: 0.5,
  delay: { beats: 1.5, feedback: 0.45, wet: 0.35, tone: 1800 },
  tracks: {
    pad: track('pad', 0.3, { params: { ...P.glassPad, center: 62 }, reverb: 0.5 }),
    sonar: track('bell', 0.2, { params: P.sonar, pan: -0.3, send: 0.5, reverb: 0.5 }),
    heart: track('kick', 0.62, { params: P.kickSoft, minIntensity: 0.2 }),
    sub: track('bass', 0.42, { params: P.bassSub }),
    pulse: track('bass', 0.28, { params: { ...P.bassPluck, cutoff: 520 }, minIntensity: 0.55 }),
    toms: track('tom', 0.26, { params: P.taikoHigh, pan: 0.2, minIntensity: 0.6 }),
    snare: track('snare', 0.3, { params: P.snareSoft, reverb: 0.4, minIntensity: 0.65 }),
    hat: track('hat', 0.13, { params: P.hatSoft, pan: 0.3, minIntensity: 0.7 }),
    lead: track('lead', 0.26, {
      params: { ...P.leadSoft, attack: 0.12, vibratoHz: 4.5, vibratoCents: 20 },
      send: 0.35,
      reverb: 0.4,
      minIntensity: 0.35,
    }),
    choir: track('choir', 0.22, { params: { center: 60 }, reverb: 0.55, minIntensity: 0.7 }),
    riser: track('riser', 0.18, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'Bm:16 Gmaj7:16 Em:16 F#sus4:8 F#:8 Bm:16 D:16 Em:16 F#:16',
    sub: bassRiff(['B1', 'G1', 'E2', 'F#1', 'B1', 'D2', 'E2', 'F#1'], 'R:16'),
    pulse: bassRiff(
      ['B1', 'G1', 'E2', 'F#1', 'B1', 'D2', 'E2', 'F#1'],
      'R:2 R:2 R:2 R:2 R:2 R:2 R:2 R:2'
    ),
    sonar: 'B5:4 -:28',
    lead:
      'F#5:8 D5:4 B4:4 | B4:6 D5:2 F#5:8 | G5:6 F#5:2 E5:8 | B4:4 C#5:4 A#4:8 | ' +
      'D5:4 F#5:4 B5:8 | A5:6 F#5:2 D5:8 | E5:4 G5:4 B5:6 A5:2 | A#5:8 C#6:4 F#5:4',
    heart: DRUM.KICK_HEART,
    toms: '..........x.x.xx',
    snare: DRUM.SNARE_HALF,
    hat: DRUM.HAT_8,
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', sonar: 'sonar', sub: 'sub' } },
    {
      name: 'dive',
      bars: 8,
      play: { pad: 'ch', sonar: 'sonar', heart: 'heart', sub: 'sub', pulse: 'pulse', lead: 'lead' },
    },
    {
      name: 'pursuit',
      bars: 8,
      minIntensity: 0.5,
      play: {
        pad: 'ch',
        sonar: 'sonar',
        heart: 'heart',
        sub: 'sub',
        pulse: 'pulse',
        toms: 'toms',
        snare: 'snare',
        hat: 'hat',
        lead: 'lead',
        choir: 'ch',
      },
    },
    {
      name: 'silence',
      bars: 4,
      maxIntensity: 0.65,
      play: { pad: 'ch', sonar: 'sonar', sub: 'sub', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第八章 雷霆峡谷：E 小调硬摇滚，强力和弦、奔马贝斯、颤音吉他与雷声 */
export const CANYON_TRACK: Composition = {
  id: 'CANYON',
  bpm: 150,
  key: 4,
  tempoRamp: 0.05,
  mix: 0.386,
  defaultIntensity: 0.5,
  tracks: {
    gtr: track('brass', 0.22, { params: P.powerChord, input: 'chords' }),
    trem: track('pluck', 0.2, { params: P.tremGuitar, pan: -0.3, reverb: 0.3 }),
    bass: track('bass', 0.44, { params: P.bassSaw }),
    kick: track('kick', 0.8, { params: P.kickPunch, minIntensity: 0.2 }),
    kick2: track('kick', 0.5, { params: P.kickTight, minIntensity: 0.75 }),
    snare: track('snare', 0.44, { params: P.snareFat, reverb: 0.15, minIntensity: 0.2 }),
    hat: track('hat', 0.18, { params: P.hatClosed, pan: 0.25, minIntensity: 0.3 }),
    crash: track('cymbal', 0.18, { params: P.crash, minIntensity: 0.4 }),
    thunder: track('boom', 0.44, { params: P.thunder, reverb: 0.3, minIntensity: 0.45 }),
    lead: track('lead', 0.27, { params: P.guitarLead, reverb: 0.25, minIntensity: 0.35 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    gtr: chordRiff(
      ['Epow', 'Cpow', 'Dpow', 'Epow', 'Gpow', 'Dpow', 'Cpow', 'Bpow'],
      'R:2! R:2 R:2 R:2 R:2! R:2 R:2 R:2'
    ),
    trem: 'E4:16 C4:16 D4:16 E4:16',
    bass: bassRiff(
      ['E2', 'C2', 'D2', 'E2', 'G1', 'D2', 'C2', 'B1'],
      'R:2 R:1 R:1 R:2 R:1 R:1 R:2 R:1 R:1 R:2 R:1 R:1'
    ),
    lead:
      'E5:2 G5:2 B5:4 A5:2 G5:2 E5:4 | C5:4 E5:4 G5:6 F#5:2 | F#5:4 A5:4 D6:6 C6:2 | B5:8 G5:4 E5:4 | ' +
      'D6:4 B5:4 G5:8 | A5:4 F#5:4 D5:8 | E5:4 G5:4 C6:4 B5:2 A5:2 | B5:8 D#6:4 F#5:4',
    kick: bars('X.x...x.X.x...x.', 7) + 'X.x...x.X.X.X.X.',
    kick2: DRUM.KICK_GALLOP,
    snare: bars(DRUM.SNARE_BACK, 7) + DRUM.SNARE_FILL,
    hat: DRUM.HAT_8,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    thunder: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { trem: 'trem', thunder: 'thunder', bass: 'bass' } },
    {
      name: 'ride',
      bars: 8,
      play: {
        gtr: 'gtr',
        bass: 'bass',
        kick: 'kick',
        kick2: 'kick2',
        snare: 'snare',
        hat: 'hat',
        crash: 'crash',
        thunder: 'thunder',
        lead: 'lead',
      },
    },
    {
      name: 'storm',
      bars: 8,
      minIntensity: 0.55,
      play: {
        gtr: 'gtr',
        trem: 'trem',
        bass: 'bass',
        kick: 'kick',
        kick2: 'kick2',
        snare: 'snare',
        hat: 'hat',
        crash: 'crash',
        thunder: 'thunder',
        lead: 'lead^12',
      },
    },
    {
      name: 'gulch',
      bars: 4,
      maxIntensity: 0.7,
      play: { trem: 'trem', bass: 'bass', thunder: 'thunder', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 第九章 天梯之巅：D 利底亚，高空琶音、闪烁长音、轻盈四拍；神谕动机在高强度时隐现 */
export const STRATOSPHERE_TRACK: Composition = {
  id: 'STRATOSPHERE',
  bpm: 128,
  key: 2,
  tempoRamp: 0.04,
  mix: 0.654,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.4, wet: 0.3, tone: 3600 },
  tracks: {
    pad: track('pad', 0.26, {
      params: { ...P.warmPad, cutoff: 2600, voices: 3, width: 0.9 },
      reverb: 0.5,
    }),
    arp: track('pluck', 0.18, {
      params: { ...P.pluckBright, center: 69 },
      arp: { rate: 1, mode: 'up', octaves: 2, gate: 0.5 },
      pan: -0.3,
      send: 0.35,
    }),
    sparkle: track('bell', 0.12, {
      params: { ...P.glass, center: 81 },
      arp: { rate: 2, mode: 'down', octaves: 2, gate: 1 },
      pan: 0.35,
      reverb: 0.5,
      minIntensity: 0.45,
    }),
    bass: track('bass', 0.42, { params: P.bassPluck, minIntensity: 0.2 }),
    kick: track('kick', 0.74, { params: P.kickPunch, minIntensity: 0.3 }),
    clap: track('clap', 0.3, { reverb: 0.25, minIntensity: 0.4 }),
    hat: track('hat', 0.16, { params: P.hatClosed, pan: 0.2, minIntensity: 0.6 }),
    hat16: track('hat', 0.1, { params: P.hatSoft, pan: -0.2, minIntensity: 0.75 }),
    lead: track('lead', 0.26, { params: { ...P.leadSaw, cutoff: 3200 }, send: 0.3, reverb: 0.3 }),
    oracle: track('bell', 0.16, {
      params: P.creepyBell,
      pan: -0.3,
      send: 0.4,
      reverb: 0.4,
      minIntensity: 0.8,
    }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'Dmaj7:16 E:16 Bm:16 A:16 Gmaj7:16 A:16 F#m:16 Bm:16',
    bass: bassRiff(
      ['D2', 'E2', 'B1', 'A1', 'G1', 'A1', 'F#1', 'B1'],
      '-:2 R:2 -:2 R:2 -:2 R:2 -:2 O:2'
    ),
    lead:
      'A5:8 F#5:4 C#6:4 | B5:6 G#5:2 E5:8 | D6:6 C#6:2 B5:8 | C#6:4 E6:4 A5:8 | ' +
      'B5:8 G5:4 D6:4 | C#6:6 A5:2 E5:8 | F#5:4 A5:4 C#6:8 | D6:4 C#6:4 B5:8',
    oracle: ORACLE,
    kick: DRUM.KICK_FOUR,
    clap: DRUM.SNARE_BACK,
    hat: DRUM.HAT_OPEN_OFF,
    hat16: DRUM.HAT_16,
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', arp: 'ch' } },
    {
      name: 'ascent',
      bars: 8,
      play: {
        pad: 'ch',
        arp: 'ch',
        sparkle: 'ch',
        bass: 'bass',
        kick: 'kick',
        clap: 'clap',
        hat: 'hat',
        hat16: 'hat16',
        oracle: 'oracle^2',
      },
    },
    {
      name: 'skyspire',
      bars: 8,
      minIntensity: 0.4,
      play: {
        pad: 'ch',
        arp: 'ch',
        sparkle: 'ch',
        bass: 'bass',
        kick: 'kick',
        clap: 'clap',
        hat: 'hat',
        hat16: 'hat16',
        lead: 'lead',
        oracle: 'oracle^2',
      },
    },
    {
      name: 'cloudsea',
      bars: 4,
      maxIntensity: 0.75,
      play: { pad: 'ch', arp: 'ch', sparkle: 'ch', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};

/** 最终章 神谕核心：C 小调，阴森的合成合唱与管风琴，神谕动机冷冷回荡，高强度时猎鹰主题反击 */
export const CITADEL_TRACK: Composition = {
  id: 'CITADEL',
  bpm: 100,
  key: 0,
  tempoRamp: 0.06,
  mix: 0.529,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.4, wet: 0.3, tone: 2200 },
  tracks: {
    choir: track('choir', 0.3, { params: { center: 60, width: 0.7 }, reverb: 0.6 }),
    organ: track('pad', 0.2, { params: P.organ, reverb: 0.35 }),
    bass: track('bass', 0.38, { params: { ...P.bassSaw, cutoff: 600 }, minIntensity: 0.2 }),
    kick: track('kick', 0.76, { params: P.kickBig, minIntensity: 0.2 }),
    snare: track('snare', 0.4, { params: P.snareFat, reverb: 0.3, minIntensity: 0.3 }),
    boom: track('boom', 0.46, { params: P.boom }),
    toms: track('tom', 0.3, { params: P.taikoLow, pan: -0.2, minIntensity: 0.6 }),
    hat: track('hat', 0.12, { params: P.hatClosed, pan: 0.3, minIntensity: 0.5 }),
    oracle: track('bell', 0.2, { params: P.creepyBell, pan: 0.3, send: 0.4, reverb: 0.5 }),
    lead: track('lead', 0.28, { params: P.leadSaw, reverb: 0.3, minIntensity: 0.7 }),
    brass: track('brass', 0.24, { params: P.brassSwell, input: 'chords', minIntensity: 0.8 }),
    riser: track('riser', 0.2, { input: 'notes', minIntensity: 0.35 }),
  },
  patterns: {
    ch: 'Cm:16 Ab:16 Db:16 Gsus4:8 G:8 Fm:16 Db:16 Ab:16 G:16',
    bass: bassRiff(
      ['C2', 'Ab1', 'Db2', 'G1', 'F1', 'Db2', 'Ab1', 'G1'],
      'R:1! R:1 O:1 R:1 R:1 R:1 O:1 R:1 R:1! R:1 O:1 R:1 R:1 R:1 O:1 R:1'
    ),
    lead:
      'C5:4 G5:4 Eb5:4 D5:2 Eb5:2 | C5:6 Ab4:2 Eb5:8 | F5:4 Ab5:4 Db6:6 C6:2 | C6:4 Bb5:2 C6:2 B5:4 D6:4 | ' +
      'F5:4 Ab5:4 C6:8 | Db6:6 C6:2 Ab5:8 | Eb5:4 Ab5:4 C6:4 Bb5:2 Ab5:2 | G5:8 B5:4 D6:4',
    oracle: ORACLE,
    kick: 'X.........X.....',
    snare: DRUM.SNARE_HALF,
    boom: DRUM.CRASH_BAR + DRUM.EMPTY,
    toms: '........x.x.XxXx',
    hat: DRUM.HAT_16,
    riser: '-:48 C4:16',
  },
  sections: [
    { name: 'intro', bars: 4, play: { choir: 'ch', organ: 'ch', boom: 'boom', oracle: 'oracle' } },
    {
      name: 'gate',
      bars: 8,
      play: {
        choir: 'ch',
        organ: 'ch',
        bass: 'bass',
        kick: 'kick',
        snare: 'snare',
        boom: 'boom',
        hat: 'hat',
        oracle: 'oracle',
      },
    },
    {
      name: 'assault',
      bars: 8,
      minIntensity: 0.55,
      play: {
        choir: 'ch',
        organ: 'ch',
        bass: 'bass',
        kick: 'kick',
        snare: 'snare',
        boom: 'boom',
        toms: 'toms',
        hat: 'hat',
        oracle: 'oracle',
        lead: 'lead',
        brass: 'ch',
      },
    },
    {
      name: 'void',
      bars: 4,
      maxIntensity: 0.7,
      play: { choir: 'ch', oracle: 'oracle', riser: 'riser' },
    },
  ],
  loopFrom: 1,
};
