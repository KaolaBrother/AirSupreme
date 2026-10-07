/**
 * 作曲辅助：常用鼓型与“根音 + 级数”贝斯写法，让曲目数据保持紧凑。
 */
import { parseNoteName } from './Theory';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const DEGREE_OFFSETS: Readonly<Record<string, number>> = {
  L: -12,
  LF: -5,
  R: 0,
  b2: 1,
  '2': 2,
  b3: 3,
  '3': 4,
  '4': 5,
  b5: 6,
  F: 7,
  b6: 8,
  '6': 9,
  b7: 10,
  '7': 11,
  O: 12,
  O3: 15,
  OF: 19,
};

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  return `${PITCH_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

/**
 * 按根音序列展开贝斯：每个根音套用一遍 rhythm。
 * rhythm 例：`'R:2 R:2 F:2 O:2'`；`-:4` 为休止；后缀 `!` / `?` 透传为力度标记。
 */
export function bassRiff(roots: readonly string[], rhythm: string): string {
  const tokens = rhythm.split(/\s+/).filter((token) => token.length > 0);
  const out: string[] = [];
  for (const root of roots) {
    const rootMidi = parseNoteName(root);
    if (rootMidi === null) {
      continue;
    }
    for (const token of tokens) {
      const match = /^([^:!?]+)(:\d+)?([!?])?$/.exec(token);
      if (!match) {
        continue;
      }
      const length = match[2] ?? '';
      const accent = match[3] ?? '';
      if (match[1] === '-') {
        out.push(`-${length}`);
        continue;
      }
      const offset = DEGREE_OFFSETS[match[1]];
      if (offset === undefined) {
        continue;
      }
      out.push(`${midiToNoteName(rootMidi + offset)}${length}${accent}`);
    }
  }
  return out.join(' ');
}

/** 常用 16 步鼓型 */
export const DRUM = {
  KICK_FOUR: 'X...x...X...x...',
  KICK_HALF: 'X.......x.......',
  KICK_ONE: 'X...............',
  KICK_ROCK: 'X.......X.x.....',
  KICK_DRIVE: 'X..x..x.X..x..x.',
  KICK_GALLOP: 'X.xxX.xxX.xxX.xx',
  KICK_HEART: 'X..x............',
  KICK_STOMP: 'X.......X.......',
  KICK_METAL: 'X.x.X.x.X.x.X.xx',
  SNARE_BACK: '....X.......X...',
  SNARE_HALF: '........X.......',
  SNARE_GHOST: '....X..g.g..X..g',
  SNARE_FILL: '....X...X.x.XxXX',
  SNARE_ROLL: 'x.x.x.x.xxxxXXXX',
  HAT_8: 'x.x.x.x.x.x.x.x.',
  HAT_16: 'Xgxgxgxgxgxgxgxg',
  HAT_OFF: '..x...x...x...x.',
  HAT_OPEN_OFF: '..o...o...o...o.',
  HAT_SPARSE: '......x.......x.',
  CRASH_BAR: 'X...............',
  EMPTY: '................',
} as const;
