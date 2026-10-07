/**
 * 乐理工具与样式解析：音名 → MIDI、和弦符号 → 音程、紧凑记谱 → 逐步事件表。
 * 纯函数，不依赖 Web Audio，可直接单元测试。
 */
import type { PatternInput } from './MusicTypes';

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;

const NOTE_PITCH_CLASS: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const NOTE_PATTERN = /^([A-G])([#b]?)(-?\d)$/;
const CHORD_PATTERN = /^([A-G])([#b]?)(.*)$/;
const TOKEN_PATTERN = /^(.+?)(?::(\d+))?([!?])?$/;

/** 和弦音程表（相对根音的半音数） */
export const CHORD_QUALITIES: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  pow: [0, 7, 12],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  mb6: [0, 3, 8],
};

export function parseNoteName(name: string): number | null {
  const match = NOTE_PATTERN.exec(name);
  if (!match) {
    return null;
  }
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const octave = Number(match[3]);
  return (octave + 1) * 12 + NOTE_PITCH_CLASS[match[1]] + accidental;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ChordSymbol {
  /** 根音音级 0..11 */
  root: number;
  intervals: readonly number[];
}

export function parseChordSymbol(symbol: string): ChordSymbol | null {
  const match = CHORD_PATTERN.exec(symbol);
  if (!match) {
    return null;
  }
  const intervals = CHORD_QUALITIES[match[3]];
  if (!intervals) {
    return null;
  }
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return { root: (NOTE_PITCH_CLASS[match[1]] + accidental + 12) % 12, intervals };
}

/** 紧凑排列：每个和弦音放进以 center 为中心的一个八度窗口，减少换和弦时的跳进 */
export function voiceChord(chord: ChordSymbol, center: number): number[] {
  const low = center - 6;
  const notes = new Set<number>();
  for (const interval of chord.intervals) {
    const pitchClass = (chord.root + interval) % 12;
    const offset = (((pitchClass - low) % 12) + 12) % 12;
    notes.add(low + offset);
  }
  return Array.from(notes).sort((a, b) => a - b);
}

export interface PatternEvent {
  /** MIDI 音高（鼓为空数组） */
  midi: readonly number[];
  /** 时值（步） */
  length: number;
  velocity: number;
  /** 鼓的变体（开镲等） */
  open: boolean;
}

export interface CompiledPattern {
  /** 总步数 */
  length: number;
  /** 每一步起始的事件 */
  byStep: ReadonlyArray<readonly PatternEvent[] | undefined>;
  /** 和弦样式：每一步正在发声的和弦（供琶音器使用） */
  activeChord: ReadonlyArray<readonly number[] | null>;
}

const VELOCITY_NORMAL = 0.8;
const VELOCITY_ACCENT = 1;
const VELOCITY_SOFT = 0.5;

const GRID_VELOCITY: Readonly<Record<string, { velocity: number; open: boolean }>> = {
  x: { velocity: 0.75, open: false },
  X: { velocity: 1, open: false },
  g: { velocity: 0.35, open: false },
  o: { velocity: 0.75, open: true },
  O: { velocity: 1, open: true },
};

function pushEvent(events: PatternEvent[][], step: number, event: PatternEvent): void {
  if (!events[step]) {
    events[step] = [];
  }
  events[step].push(event);
}

function compileGrid(source: string): CompiledPattern {
  const events: PatternEvent[][] = [];
  let step = 0;
  for (const char of source) {
    if (char === ' ' || char === '|' || char === '\n') {
      continue;
    }
    const hit = GRID_VELOCITY[char];
    if (hit) {
      pushEvent(events, step, { midi: [], length: 1, velocity: hit.velocity, open: hit.open });
    }
    step += 1;
  }
  const length = Math.max(1, step);
  return { length, byStep: events, activeChord: new Array<null>(length).fill(null) };
}

function parsePitchList(body: string, transpose: number): number[] | null {
  const inner = body.slice(1, -1).split(',');
  const notes: number[] = [];
  for (const part of inner) {
    const midi = parseNoteName(part.trim());
    if (midi === null) {
      return null;
    }
    notes.push(midi + transpose);
  }
  return notes;
}

function compileTokens(
  source: string,
  input: 'notes' | 'chords',
  transpose: number,
  center: number
): CompiledPattern {
  const events: PatternEvent[][] = [];
  const chordSpans: Array<{ start: number; length: number; notes: readonly number[] }> = [];
  const defaultLength = input === 'chords' ? STEPS_PER_BAR : 1;
  let step = 0;
  for (const token of source.split(/\s+/)) {
    if (token === '' || token === '|') {
      continue;
    }
    const match = TOKEN_PATTERN.exec(token);
    if (!match) {
      continue;
    }
    const body = match[1];
    const length = match[2] ? Math.max(1, Number(match[2])) : defaultLength;
    const velocity =
      match[3] === '!' ? VELOCITY_ACCENT : match[3] === '?' ? VELOCITY_SOFT : VELOCITY_NORMAL;
    let notes: number[] | null = null;
    if (body === '-') {
      notes = null;
    } else if (body.startsWith('[') && body.endsWith(']')) {
      notes = parsePitchList(body, transpose);
    } else if (input === 'notes') {
      const midi = parseNoteName(body);
      notes = midi === null ? null : [midi + transpose];
    } else {
      const chord = parseChordSymbol(body);
      notes = chord ? voiceChord(chord, center).map((note) => note + transpose) : null;
    }
    if (notes && notes.length > 0) {
      pushEvent(events, step, { midi: notes, length, velocity, open: false });
      chordSpans.push({ start: step, length, notes });
    }
    step += length;
  }
  const length = Math.max(1, step);
  const activeChord: Array<readonly number[] | null> = new Array<null>(length).fill(null);
  for (const span of chordSpans) {
    for (let i = span.start; i < Math.min(length, span.start + span.length); i++) {
      activeChord[i] = span.notes;
    }
  }
  return { length, byStep: events, activeChord };
}

/** 编译一个样式字符串；transpose / center 只影响音高类输入 */
export function compilePattern(
  source: string,
  input: PatternInput,
  transpose = 0,
  center = 60
): CompiledPattern {
  if (input === 'grid') {
    return compileGrid(source);
  }
  return compileTokens(source, input, transpose, center);
}

/** 解析 `'melA^12'` 形式的段落引用 */
export function parsePatternRef(ref: string): { id: string; transpose: number } {
  const caret = ref.indexOf('^');
  if (caret < 0) {
    return { id: ref, transpose: 0 };
  }
  const transpose = Number(ref.slice(caret + 1));
  return { id: ref.slice(0, caret), transpose: Number.isFinite(transpose) ? transpose : 0 };
}

/** 琶音器：从和弦（紧凑排列）展开出第 index 个音 */
export function arpeggiate(
  chord: readonly number[],
  index: number,
  mode: 'up' | 'down' | 'updown' | 'random',
  octaves: number
): number {
  const span = Math.max(1, Math.floor(octaves));
  const ladder: number[] = [];
  for (let octave = 0; octave < span; octave++) {
    for (const note of chord) {
      ladder.push(note + octave * 12);
    }
  }
  const count = ladder.length;
  const safeIndex = Math.max(0, Math.floor(index));
  if (mode === 'down') {
    return ladder[count - 1 - (safeIndex % count)];
  }
  if (mode === 'updown') {
    const cycle = Math.max(1, count * 2 - 2);
    const position = safeIndex % cycle;
    return ladder[position < count ? position : cycle - position];
  }
  if (mode === 'random') {
    // 确定性“随机”：同一位置总是同一个音，循环时听感稳定
    const hash = Math.imul(safeIndex + 17, 2654435761) >>> 0;
    return ladder[hash % count];
  }
  return ladder[safeIndex % count];
}

/** 工具：重复一段样式字符串 */
export function repeat(source: string, times: number): string {
  return Array.from({ length: Math.max(0, Math.floor(times)) }, () => source).join(' ');
}

/** 工具：n 小节的休止（鼓网格） */
export function restBars(bars: number): string {
  return '.'.repeat(Math.max(0, Math.floor(bars)) * STEPS_PER_BAR);
}
