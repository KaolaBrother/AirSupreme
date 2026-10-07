/**
 * 刺激音（一次性短乐句），全部以 C 为主音写成；followKey 时移调到当前曲目的调性。
 * duckTo：播放期间主音乐保留的比例；endsMusic：刺激音接管并结束当前曲目。
 */
import { track } from '../Compose';
import type { Composition, StingerDef } from '../MusicTypes';
import { P } from './Shared';

function stinger(
  id: string,
  bpm: number,
  bars: number,
  tracks: Composition['tracks'],
  play: Record<string, string>,
  patterns: Record<string, string>,
  mix = 0.55
): Composition {
  return {
    id,
    bpm,
    key: 0,
    mix,
    defaultIntensity: 1,
    filterFloor: 20000,
    tracks,
    patterns,
    sections: [{ name: 'hit', bars, play }],
  };
}

/** 章节开场：低音铜管“braam” + 定音鼓滚奏 + 猎鹰动机的第一句 */
export const CHAPTER_START_STINGER: StingerDef = {
  composition: stinger(
    'chapter-start',
    96,
    2,
    {
      boom: track('boom', 0.6, { params: P.boom }),
      braam: track('brass', 0.34, { params: { ...P.brassSwell, center: 40 }, reverb: 0.4 }),
      choir: track('choir', 0.26, { reverb: 0.55 }),
      roll: track('tom', 0.42, { params: P.timpani }),
      crash: track('cymbal', 0.2, { params: P.crash }),
      motif: track('bell', 0.26, { params: P.bell, reverb: 0.5 }),
    },
    {
      boom: 'boom',
      braam: 'braam',
      choir: 'choir',
      roll: 'roll',
      crash: 'crash',
      motif: 'motif',
    },
    {
      boom: 'X............... X...............',
      braam: '[C2,G2,C3]:14 -:2 [C2,G2,C3,Eb3]:16',
      choir: 'Cm:32',
      roll: '........xxxxXXXX X...............',
      crash: '................ X...............',
      motif: '-:16 C5:4 G5:4 Eb5:4 D5:2 Eb5:2',
    }
  ),
  duckTo: 0.3,
  tail: 2,
  quantize: 'beat',
  followKey: true,
};

/** Boss 击破：大调凯旋号角 + 定音鼓 + 终止和弦（当前曲目随之结束） */
export const BOSS_DEFEATED_STINGER: StingerDef = {
  composition: stinger(
    'boss-defeated',
    120,
    2,
    {
      boom: track('boom', 0.6, { params: P.boom }),
      crash: track('cymbal', 0.22, { params: P.crash }),
      fanfare: track('brass', 0.36, { params: P.brassLead, reverb: 0.35 }),
      chord: track('brass', 0.3, { params: P.brassSwell, input: 'chords', reverb: 0.4 }),
      choir: track('choir', 0.26, { reverb: 0.5 }),
      timpani: track('tom', 0.42, { params: P.timpani }),
      sparkle: track('bell', 0.16, {
        params: { ...P.glass, center: 84 },
        arp: { rate: 1, mode: 'up', octaves: 2, gate: 1 },
        reverb: 0.5,
      }),
    },
    {
      boom: 'boom',
      crash: 'crash',
      fanfare: 'fanfare',
      chord: 'chord',
      choir: 'choir',
      timpani: 'timpani',
      sparkle: 'sparkle',
    },
    {
      boom: 'X............... X...............',
      crash: 'X............... X...............',
      fanfare: 'C5:2 C5:1 C5:1 G5:4 E5:4 G5:2 C6:2 | C6:16',
      chord: '-:16 [C4,E4,G4,C5]:16',
      choir: '-:16 C:16',
      timpani: 'X...X...X..xX.xx X...............',
      sparkle: '-:16 C:16',
    }
  ),
  duckTo: 0,
  tail: 2.4,
  endsMusic: true,
  quantize: 'none',
  followKey: true,
};

/** 关卡完成：上行琶音 + 明亮的大九和弦 */
export const LEVEL_COMPLETE_STINGER: StingerDef = {
  composition: stinger(
    'level-complete',
    112,
    2,
    {
      run: track('pluck', 0.3, { params: P.pluckBright, reverb: 0.3 }),
      pad: track('pad', 0.3, { params: { ...P.warmPad, attack: 0.05, cutoff: 2400 }, reverb: 0.5 }),
      bell: track('bell', 0.24, { params: P.bell, reverb: 0.5 }),
      kick: track('kick', 0.6, { params: P.kickSoft }),
      crash: track('cymbal', 0.18, { params: P.crash }),
    },
    { run: 'run', pad: 'pad', bell: 'bell', kick: 'kick', crash: 'crash' },
    {
      run: 'C5:1 E5:1 G5:1 C6:1 E5:1 G5:1 C6:1 E6:1 G5:1 C6:1 E6:1 G6:4 -:1',
      pad: '-:16 Cmaj9:16',
      bell: '-:16 C6:8 G6:8',
      kick: '................ X...............',
      crash: '................ X...............',
    }
  ),
  duckTo: 0.15,
  tail: 2,
  endsMusic: true,
  quantize: 'beat',
  followKey: true,
};

/** 游戏结束：沉重的低音、下行旋律与小调变格终止 */
export const GAME_OVER_STINGER: StingerDef = {
  composition: stinger(
    'game-over',
    72,
    2,
    {
      boom: track('boom', 0.6, { params: P.boom }),
      pad: track('pad', 0.32, { params: { ...P.darkPad, cutoff: 900 }, reverb: 0.5 }),
      lead: track('lead', 0.28, { params: P.leadSoft, reverb: 0.45 }),
      choir: track('choir', 0.22, { reverb: 0.6 }),
      toll: track('bell', 0.2, { params: P.epiano, reverb: 0.5 }),
    },
    { boom: 'boom', pad: 'pad', lead: 'lead', choir: 'choir', toll: 'toll' },
    {
      boom: 'X...............................',
      pad: 'Cm:16 Fm:8 Cm:8',
      lead: 'G4:6 F4:2 Eb4:4 D4:4 C4:16',
      choir: 'Cm:16 Fm:8 Cm:8',
      toll: 'C3:16 C3:16',
    }
  ),
  duckTo: 0,
  tail: 3,
  endsMusic: true,
  quantize: 'none',
  followKey: true,
};

/** 战役通关：大调猎鹰主题开头 + 合唱 + 定音鼓，结束在辉煌的 C 大和弦 */
export const CAMPAIGN_COMPLETE_STINGER: StingerDef = {
  composition: stinger(
    'campaign-complete',
    100,
    4,
    {
      boom: track('boom', 0.56, { params: P.boom }),
      crash: track('cymbal', 0.2, { params: P.crash }),
      brass: track('brass', 0.36, { params: P.brassLead, reverb: 0.4 }),
      chords: track('brass', 0.26, { params: P.brassSwell, input: 'chords', reverb: 0.4 }),
      choir: track('choir', 0.28, { reverb: 0.55 }),
      strings: track('pad', 0.26, { params: { ...P.warmPad, voices: 3 }, reverb: 0.5 }),
      timpani: track('tom', 0.42, { params: P.timpani }),
      sparkle: track('bell', 0.16, {
        params: { ...P.glass, center: 84 },
        arp: { rate: 1, mode: 'up', octaves: 2, gate: 1 },
        reverb: 0.5,
      }),
    },
    {
      boom: 'boom',
      crash: 'crash',
      brass: 'brass',
      chords: 'chords',
      choir: 'choir',
      strings: 'choir',
      timpani: 'timpani',
      sparkle: 'sparkle',
    },
    {
      boom: 'X............... ................ ................ X...............',
      crash: 'X............... ................ ................ X...............',
      brass: 'C5:4 G5:4 E5:4 D5:2 E5:2 | C5:6 A4:2 E5:8 | A5:8 B5:8 | C6:16',
      chords: 'C:16 Am:16 F:8 G:8 [C4,E4,G4,C5,E5]:16',
      choir: 'C:16 Am:16 F:8 G:8 C:16',
      timpani: 'X.......X....... X.......X....... X...X...X.xxXXXX X...............',
      sparkle: '-:48 C:16',
    },
    0.5
  ),
  duckTo: 0,
  tail: 3,
  endsMusic: true,
  quantize: 'none',
  followKey: false,
};

/** 检查点：两声柔和的钟音 + 高处的微光 */
export const CHECKPOINT_STINGER: StingerDef = {
  composition: stinger(
    'checkpoint',
    120,
    1,
    {
      bell: track('bell', 0.26, { params: P.glass, reverb: 0.5 }),
      shimmer: track('pluck', 0.12, { params: P.pluckSoft, reverb: 0.5 }),
    },
    { bell: 'bell', shimmer: 'shimmer' },
    {
      bell: 'G5:4 C6:12',
      shimmer: '-:4 E6:1 G6:1 C7:2 -:8',
    },
    0.5
  ),
  duckTo: 0.7,
  tail: 1.6,
  quantize: 'beat',
  followKey: true,
};

/** Boss 换阶段：重击 + 不协和铜管簇 + 上扬的噪声与滚奏，把音乐推入下一阶段 */
export const PHASE_CHANGE_STINGER: StingerDef = {
  composition: stinger(
    'phase-change',
    100,
    1,
    {
      boom: track('boom', 0.6, { params: P.boom }),
      stab: track('brass', 0.32, { params: { ...P.brassStab, center: 48 }, reverb: 0.35 }),
      crash: track('cymbal', 0.2, { params: P.crash }),
      riser: track('riser', 0.3, { input: 'notes' }),
      toms: track('tom', 0.4, { params: P.taikoLow }),
    },
    { boom: 'boom', stab: 'stab', crash: 'crash', riser: 'riser', toms: 'toms' },
    {
      boom: 'X...............',
      stab: '[C3,Db3,G3]:4 -:12',
      crash: 'X...............',
      riser: '-:4 C4:12',
      toms: '............xxXX',
    }
  ),
  duckTo: 0.35,
  tail: 1,
  quantize: 'beat',
  followKey: true,
};
