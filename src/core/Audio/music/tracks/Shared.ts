/**
 * 曲库共享素材：战役主题动机、反派动机与乐器音色预设。
 *
 * - FALCON：战役主题“猎鹰”（A 小调，8 小节，和声 Am F C G | Am F G E）。
 *   开头“纯五度上行 + 级进下行”的动机贯穿菜单、第一章、胜利与最终 Boss。
 * - ORACLE：反派“神谕”动机（C 小调，含三全音 C–F#，冰冷机械），出现在平流层、城堡与最终战。
 * 曲目通过 `'falcon^3'` 这样的引用把动机移调到自己的调性。
 */
import type { InstrumentParams } from '../MusicTypes';

/** 战役主题（A 小调，8 小节） */
export const FALCON =
  'A4:4 E5:4 C5:4 B4:2 C5:2 | A4:6 F4:2 C5:8 | E5:4 G5:4 E5:2 F5:2 E5:2 C5:2 | D5:6 B4:2 G4:8 |' +
  ' A4:4 E5:4 C5:4 B4:2 C5:2 | A4:4 C5:4 F5:6 E5:2 | D5:4 B4:4 G5:4 F5:2 D5:2 | E5:6 D5:2 B4:4 G#4:4';

/** 主题和声：前 4 小节 / 后 4 小节 */
export const FALCON_CHORDS_A = 'Am:16 F:16 C:16 G:16';
export const FALCON_CHORDS_B = 'Am:16 F:16 G:16 E:16';

/** 主题的大调版本（C 大调，8 小节，和声 C Am F G | C F G C） */
export const FALCON_MAJOR =
  'C5:4 G5:4 E5:4 D5:2 E5:2 | C5:6 A4:2 E5:8 | A5:4 C6:4 A5:2 G5:2 A5:2 F5:2 | G5:6 D5:2 B4:8 |' +
  ' C5:4 G5:4 E5:4 D5:2 E5:2 | C5:4 F5:4 A5:6 G5:2 | G5:4 D5:4 B5:4 A5:2 G5:2 | C6:16';

export const FALCON_MAJOR_CHORDS = 'C:16 Am:16 F:16 G:16 C:16 F:16 G:16 C:16';

/** 神谕动机（C 小调，2 小节，第二小节留白） */
export const ORACLE = 'C5:4 F#4:4 G4:2 Ab4:2 G4:4 | -:16';

/** 乐器音色预设 */
export const P = {
  kickPunch: { pitchStart: 160, pitchEnd: 48, decay: 0.32 },
  kickBig: { pitchStart: 125, pitchEnd: 38, decay: 0.6 },
  kickTight: { pitchStart: 185, pitchEnd: 55, decay: 0.16 },
  kickSoft: { pitchStart: 110, pitchEnd: 42, decay: 0.45, level: 0.7 },
  snareTight: { tone: 210, decay: 0.14, cutoff: 1900 },
  snareFat: { tone: 170, decay: 0.24, cutoff: 1250 },
  snareSoft: { tone: 190, decay: 0.2, cutoff: 2600, level: 0.5 },
  hatClosed: { cutoff: 8200, decay: 0.035 },
  hatSoft: { cutoff: 9500, decay: 0.03, level: 0.4 },
  taikoLow: { pitchStart: 118, pitchEnd: 60, decay: 0.6 },
  taikoHigh: { pitchStart: 250, pitchEnd: 150, decay: 0.24, level: 0.75 },
  dum: { pitchStart: 150, pitchEnd: 78, decay: 0.3 },
  tek: { pitchStart: 520, pitchEnd: 340, decay: 0.07, level: 0.55 },
  timpani: { pitchStart: 98, pitchEnd: 82, decay: 0.9 },
  boom: { pitchStart: 60, pitchEnd: 26, decay: 2.2, cutoff: 900 },
  thunder: { pitchStart: 46, pitchEnd: 22, decay: 3.4, cutoff: 520 },
  crash: { cutoff: 5600, decay: 1.8 },
  ride: { cutoff: 7800, decay: 0.5, level: 0.35 },
  bassSaw: { cutoff: 480, resonance: 2.5, filterEnv: 2.5, decay: 0.16, sustain: 0.6, sub: 0.5 },
  bassSub: {
    wave: 'sine',
    cutoff: 420,
    resonance: 0.7,
    filterEnv: 0.2,
    attack: 0.03,
    decay: 0.3,
    sustain: 0.95,
    release: 0.35,
    sub: 0.3,
  },
  bassDist: {
    wave: 'sawtooth',
    wave2: 'square',
    detuneCents: 14,
    cutoff: 340,
    resonance: 6,
    filterEnv: 3.2,
    decay: 0.2,
    sustain: 0.55,
    sub: 0.6,
  },
  bassPluck: { cutoff: 720, filterEnv: 3, decay: 0.12, sustain: 0.35, release: 0.05, sub: 0.4 },
  leadSaw: { cutoff: 2600, resonance: 2.5 },
  leadSoft: {
    wave: 'triangle',
    wave2: 'sawtooth',
    detuneCents: 6,
    cutoff: 2100,
    resonance: 1.5,
    filterEnv: 0.8,
    attack: 0.03,
    vibratoCents: 12,
  },
  flute: {
    wave: 'triangle',
    wave2: 'sine',
    detuneCents: 4,
    cutoff: 3400,
    resonance: 1,
    filterEnv: 0.3,
    attack: 0.06,
    decay: 0.3,
    sustain: 0.85,
    release: 0.25,
    vibratoHz: 5,
    vibratoCents: 18,
  },
  zurna: {
    wave: 'square',
    wave2: 'sawtooth',
    detuneCents: 7,
    cutoff: 2800,
    resonance: 4,
    filterEnv: 1,
    attack: 0.02,
    vibratoHz: 6.2,
    vibratoCents: 24,
  },
  guitarLead: {
    wave: 'sawtooth',
    wave2: 'sawtooth',
    detuneCents: 14,
    cutoff: 3000,
    resonance: 4.5,
    filterEnv: 0.9,
    attack: 0.008,
    sustain: 0.8,
    vibratoHz: 6,
    vibratoCents: 26,
  },
  pluckBright: { cutoff: 3200, filterEnv: 2.2, decay: 0.22, resonance: 3 },
  pluckSoft: { wave: 'triangle', cutoff: 2000, filterEnv: 1.5, decay: 0.35 },
  oud: { wave: 'sawtooth', cutoff: 1600, filterEnv: 3, decay: 0.28, resonance: 5 },
  strings16: { wave: 'sawtooth', cutoff: 1300, filterEnv: 1.6, decay: 0.16, resonance: 1.5 },
  tremGuitar: {
    wave: 'sawtooth',
    cutoff: 1500,
    filterEnv: 1.2,
    decay: 1.4,
    release: 0.3,
    tremoloHz: 10,
    tremoloDepth: 0.9,
  },
  bell: { decay: 1.6 },
  glass: { filterEnv: 2, decay: 2.2, index: 0.6 },
  epiano: { filterEnv: 1, decay: 2.4, index: 0.45 },
  anvil: { filterEnv: 1.41, decay: 0.5, index: 1.4 },
  sonar: { filterEnv: 1, decay: 2.6, index: 0.08 },
  creepyBell: { filterEnv: 2.76, decay: 1.8, index: 0.9 },
  warmPad: {
    wave: 'sawtooth',
    voices: 2,
    detuneCents: 14,
    cutoff: 1300,
    attack: 0.9,
    release: 1.6,
  },
  glassPad: {
    wave: 'triangle',
    voices: 3,
    detuneCents: 9,
    cutoff: 3000,
    attack: 1.4,
    release: 2.4,
    width: 0.85,
  },
  darkPad: {
    wave: 'sawtooth',
    voices: 2,
    detuneCents: 18,
    cutoff: 650,
    resonance: 2,
    attack: 1.2,
    release: 2,
    center: 52,
  },
  organ: {
    wave: 'square',
    voices: 2,
    detuneCents: 5,
    cutoff: 1100,
    attack: 0.2,
    sustain: 0.95,
    release: 0.8,
    center: 48,
  },
  gatedPad: {
    wave: 'sawtooth',
    voices: 2,
    detuneCents: 16,
    cutoff: 2400,
    attack: 0.01,
    decay: 0.15,
    sustain: 0.7,
    release: 0.08,
  },
  brassStab: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.15 },
  brassSwell: { attack: 0.25, decay: 0.5, sustain: 0.85, release: 0.6, cutoff: 1300 },
  brassLead: { attack: 0.04, decay: 0.3, sustain: 0.8, release: 0.2, cutoff: 1700, center: 64 },
  powerChord: {
    wave: 'sawtooth',
    detuneCents: 12,
    cutoff: 1900,
    resonance: 2.5,
    filterEnv: 1.4,
    attack: 0.004,
    decay: 0.12,
    sustain: 0.55,
    release: 0.07,
    center: 45,
    width: 0.5,
  },
} satisfies Record<string, InstrumentParams>;
