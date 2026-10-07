/**
 * 菜单、剧情与胜利曲：都围绕战役主题“猎鹰”展开。
 * - MENU：A 小调，庄严的主题完整呈现，副歌加入合唱与钟琴对位。
 * - STORY：A 小调氛围，电钢琴分解和弦与长笛残片，供章节卡片 / 简报 / 结局叙事使用。
 * - VICTORY：C 大调凯旋进行曲，铜管奏响大调版主题。
 */
import { DRUM, bars, bassRiff, chordRiff, track } from '../Compose';
import type { Composition } from '../MusicTypes';
import {
  FALCON,
  FALCON_CHORDS_A,
  FALCON_CHORDS_B,
  FALCON_MAJOR,
  FALCON_MAJOR_CHORDS,
  P,
} from './Shared';

export const MENU_TRACK: Composition = {
  id: 'MENU',
  dynamicRange: 0,
  bpm: 96,
  key: 9,
  mix: 0.73,
  defaultIntensity: 0.5,
  delay: { beats: 0.75, feedback: 0.3, wet: 0.22, tone: 2600 },
  tracks: {
    pad: track('pad', 0.3, { params: { ...P.warmPad, voices: 3 }, reverb: 0.45 }),
    arp: track('pluck', 0.18, {
      params: { ...P.pluckSoft, center: 64 },
      arp: { rate: 2, mode: 'updown', octaves: 2, gate: 0.85 },
      pan: -0.3,
      send: 0.3,
      reverb: 0.3,
    }),
    bass: track('bass', 0.4, { params: { ...P.bassSaw, cutoff: 380 } }),
    kick: track('kick', 0.62, { params: P.kickSoft, minIntensity: 0.2 }),
    snare: track('snare', 0.32, { params: P.snareSoft, reverb: 0.4, minIntensity: 0.2 }),
    hat: track('hat', 0.12, { params: P.hatSoft, pan: 0.25, minIntensity: 0.4 }),
    lead: track('lead', 0.3, { params: P.leadSoft, reverb: 0.35, send: 0.2 }),
    brass: track('brass', 0.24, { params: { ...P.brassLead, center: 52 }, minIntensity: 0.6 }),
    choir: track('choir', 0.24, { reverb: 0.55, minIntensity: 0.35 }),
    bell: track('bell', 0.18, { params: P.bell, pan: 0.3, reverb: 0.45, send: 0.3 }),
    crash: track('cymbal', 0.14, { params: P.crash, minIntensity: 0.45 }),
  },
  patterns: {
    ch: `${FALCON_CHORDS_A} ${FALCON_CHORDS_B}`,
    chBridge: 'F:16 G:16 Em:16 Am:16 Dm:16 G:16 C:16 E:16',
    bass: bassRiff(['A1', 'F1', 'C2', 'G1', 'A1', 'F1', 'G1', 'E1'], 'R:6 R:2 F:4 O:4'),
    bassBridge: bassRiff(['F1', 'G1', 'E1', 'A1', 'D2', 'G1', 'C2', 'E1'], 'R:6 R:2 F:4 O:4'),
    falcon: FALCON,
    bellBridge: 'C6:8 A5:8 B5:8 D6:8 G5:8 E5:8 E5:8 C5:8 F5:8 A5:8 B5:8 G5:8 E5:8 G5:8 G#5:8 B5:8',
    kick: DRUM.KICK_HALF,
    snare: DRUM.SNARE_HALF,
    hat: DRUM.HAT_8,
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 7),
  },
  sections: [
    { name: 'intro', bars: 4, play: { pad: 'ch', arp: 'ch' } },
    {
      name: 'theme',
      bars: 8,
      play: {
        pad: 'ch',
        arp: 'ch',
        bass: 'bass',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        lead: 'falcon',
        brass: 'falcon^-12',
        crash: 'crash',
      },
    },
    {
      name: 'anthem',
      bars: 8,
      play: {
        pad: 'chBridge',
        arp: 'chBridge',
        bass: 'bassBridge',
        kick: 'kick',
        snare: 'snare',
        hat: 'hat',
        choir: 'chBridge',
        bell: 'bellBridge',
        crash: 'crash',
      },
    },
  ],
  loopFrom: 1,
};

export const STORY_TRACK: Composition = {
  id: 'STORY',
  dynamicRange: 0,
  bpm: 70,
  key: 9,
  filterFloor: 20000,
  mix: 0.592,
  defaultIntensity: 0.5,
  delay: { beats: 1, feedback: 0.35, wet: 0.25, tone: 2200 },
  tracks: {
    pad: track('pad', 0.3, {
      params: { ...P.warmPad, cutoff: 1000, attack: 1.6, width: 0.8 },
      reverb: 0.5,
    }),
    piano: track('bell', 0.22, {
      params: { ...P.epiano, center: 64 },
      arp: { rate: 4, mode: 'up', octaves: 1, gate: 1 },
      pan: -0.15,
      reverb: 0.45,
      send: 0.2,
    }),
    sub: track('bass', 0.3, { params: P.bassSub }),
    flute: track('lead', 0.24, { params: P.flute, pan: 0.15, send: 0.35, reverb: 0.45 }),
    strings: track('pad', 0.16, {
      params: { ...P.warmPad, cutoff: 1800, center: 72, attack: 2 },
      reverb: 0.5,
      minIntensity: 0.6,
    }),
  },
  patterns: {
    ch: 'Am:16 Fmaj7:16 C:16 G:16 Am:16 Fmaj7:16 Dm7:16 Esus4:8 E:8',
    sub: bassRiff(['A1', 'F1', 'C2', 'G1', 'A1', 'F1', 'D2', 'E1'], 'R:16'),
    flute: '-:16 A4:8 E5:8 C5:16 -:16 -:16 A4:8 C5:8 D5:12 C5:4 B4:8 G#4:8',
  },
  sections: [
    { name: 'intro', bars: 2, play: { pad: 'ch', sub: 'sub' } },
    {
      name: 'tale',
      bars: 8,
      play: { pad: 'ch', piano: 'ch', sub: 'sub', flute: 'flute', strings: 'ch' },
    },
  ],
  loopFrom: 1,
};

export const VICTORY_TRACK: Composition = {
  id: 'VICTORY',
  dynamicRange: 0,
  bpm: 104,
  key: 0,
  mix: 0.664,
  defaultIntensity: 0.6,
  tracks: {
    strings: track('pad', 0.26, { params: { ...P.warmPad, cutoff: 1900, voices: 3 }, reverb: 0.4 }),
    brass: track('brass', 0.34, { params: P.brassLead, reverb: 0.35 }),
    stabs: track('brass', 0.2, { params: P.brassStab, input: 'chords', reverb: 0.25 }),
    bell: track('bell', 0.16, { params: P.bell, pan: 0.3, reverb: 0.45, minIntensity: 0.5 }),
    sparkle: track('bell', 0.12, {
      params: { ...P.glass, center: 84 },
      arp: { rate: 2, mode: 'up', octaves: 1, gate: 1 },
      pan: -0.3,
      reverb: 0.5,
    }),
    choir: track('choir', 0.22, { reverb: 0.5, minIntensity: 0.4 }),
    bass: track('bass', 0.4, { params: P.bassSaw }),
    timpani: track('tom', 0.5, { params: P.timpani }),
    snare: track('snare', 0.32, { params: P.snareTight, reverb: 0.25, minIntensity: 0.35 }),
    crash: track('cymbal', 0.16, { params: P.crash }),
    lead: track('lead', 0.24, { params: P.leadSoft, reverb: 0.35 }),
  },
  patterns: {
    ch: FALCON_MAJOR_CHORDS,
    chB: 'F:16 G:16 Em:16 Am:16 F:16 G:16 C:16 C:16',
    theme: FALCON_MAJOR,
    counter: 'A5:8 C6:8 B5:8 D6:8 G5:8 B5:8 C6:8 E6:8 A5:8 F5:8 D6:8 B5:8 C6:8 G5:8 C6:16',
    stabsB: chordRiff(['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'], 'R:2 R:2 -:4 R:2 R:2 -:4'),
    bass: bassRiff(['C2', 'A1', 'F1', 'G1', 'C2', 'F1', 'G1', 'C2'], 'R:4 F:4 R:4 F:4'),
    bassB: bassRiff(['F1', 'G1', 'E2', 'A1', 'F1', 'G1', 'C2', 'C2'], 'R:4 F:4 R:4 F:4'),
    timpani: bars(DRUM.KICK_STOMP, 7) + 'X.......X.xxXXXX',
    snare: 'X.xxX...X.xxX.x.',
    crash: DRUM.CRASH_BAR + bars(DRUM.EMPTY, 3),
    intro: '[C4,E4,G4,C5]:32',
    rollIn: '........xxxxXXXX X...............',
  },
  sections: [
    { name: 'fanfare-in', bars: 2, play: { stabs: 'intro', timpani: 'rollIn', strings: 'ch' } },
    {
      name: 'triumph',
      bars: 8,
      play: {
        strings: 'ch',
        brass: 'theme',
        bell: 'theme',
        sparkle: 'ch',
        choir: 'ch',
        bass: 'bass',
        timpani: 'timpani',
        snare: 'snare',
        crash: 'crash',
      },
    },
    {
      name: 'parade',
      bars: 8,
      play: {
        strings: 'chB',
        stabs: 'stabsB',
        sparkle: 'chB',
        choir: 'chB',
        bass: 'bassB',
        timpani: 'timpani',
        snare: 'snare',
        crash: 'crash',
        lead: 'counter',
      },
    },
  ],
  loopFrom: 1,
};
