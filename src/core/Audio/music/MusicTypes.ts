/**
 * 音序器数据格式。
 *
 * 一首曲目（Composition）由若干轨道（tracks）、命名的样式（patterns）和段落（sections）组成：
 * - 步长为 16 分音符，每小节 16 步（4/4）。
 * - 段落按顺序播放，`loopFrom` 指定循环回到哪一段；每条轨道在段内按自身长度循环，
 *   因此所有图层天然对齐到段落长度。
 * - 样式字符串有三种写法，由轨道的输入类型决定：
 *   - grid（鼓）：每个字符一步。`.` 休止，`x` 普通，`X` 重音，`g` 幽灵音，`o`/`O` 开镲（变体）。
 *   - notes（旋律）：`E4:2 G4 -:4 [A3,E4]:8!`，`音名:步数`，`-` 休止，`[..]` 显式和弦，
 *     后缀 `!` 重音、`?` 轻音；缺省步数为 1。
 *   - chords（和弦）：`Am:16 F:16 G7:8 Esus4:8`，缺省步数为 16；也接受 `[..]` 显式排列。
 * - 段落里 `play` 的值可以写成 `'melA^12'` 表示整体移调（半音）。
 */

export type InstrumentKind =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hat'
  | 'cymbal'
  | 'boom'
  | 'riser'
  | 'tom'
  | 'bass'
  | 'lead'
  | 'pluck'
  | 'bell'
  | 'pad'
  | 'brass'
  | 'choir';

export type PatternInput = 'grid' | 'notes' | 'chords';

export interface InstrumentParams {
  /** 主振荡器波形 */
  wave?: OscillatorType;
  /** 第二振荡器波形（lead / bass） */
  wave2?: OscillatorType;
  /** 双振荡器 / 合唱失谐（音分） */
  detuneCents?: number;
  /** 每个音符的叠加声部数（pad / brass） */
  voices?: number;
  /** 低通截止频率（Hz），会随强度变化 */
  cutoff?: number;
  /** 滤波器 Q */
  resonance?: number;
  /** 滤波包络：峰值 = cutoff × (1 + filterEnv)；bell 用作 FM 调制比 */
  filterEnv?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  /** 颤音（音高 LFO） */
  vibratoHz?: number;
  vibratoCents?: number;
  /** 震音（音量 LFO），用于西部风格的颤音吉他 */
  tremoloHz?: number;
  tremoloDepth?: number;
  /** 贝斯的低八度正弦加厚 */
  sub?: number;
  /** 打击乐音高包络 */
  pitchStart?: number;
  pitchEnd?: number;
  /** 军鼓音体频率 */
  tone?: number;
  /** 和弦排列中心（MIDI），pad / 琶音使用 */
  center?: number;
  /** 输出音量倍数（instrument 内部配平） */
  level?: number;
  /** pad / brass / choir 的立体声展开（0..1），奇偶声部左右分开 */
  width?: number;
  /** bell 的调制指数倍数（1 为设计值） */
  index?: number;
}

export interface ArpSettings {
  /** 每个琶音音符占几步 */
  rate: number;
  mode: 'up' | 'down' | 'updown' | 'random';
  /** 跨越的八度数 */
  octaves: number;
  /** 音符时值占比（0..1） */
  gate?: number;
}

export interface TrackDef {
  inst: InstrumentKind;
  /** 轨道音量 0..1 */
  gain: number;
  params?: InstrumentParams;
  /** 输入格式；缺省由乐器推断（鼓 → grid，pad / 琶音 → chords，其余 → notes） */
  input?: PatternInput;
  /** 强度低于该值时轨道淡出 */
  minIntensity?: number;
  /** 强度高于该值时轨道淡出（安静专用的层） */
  maxIntensity?: number;
  /** 延迟效果发送量 0..1 */
  send?: number;
  /** 混响发送量 0..1 */
  reverb?: number;
  /** 声像 -1（左）..1（右） */
  pan?: number;
  /** 设置后该轨道读取和弦样式并按琶音器展开 */
  arp?: ArpSettings;
  /** 强度对滤波亮度的影响 0..1（缺省：鼓 0、贝斯 0.5、其余 1） */
  brightnessFollow?: number;
}

export interface SectionDef {
  name: string;
  /** 小节数（整数） */
  bars: number;
  /** trackId → 样式 id（数组表示按顺序串联） */
  play: Readonly<Record<string, string | readonly string[]>>;
  /** 当前强度低于该值时跳过该段（如 Boss 的高潮段） */
  minIntensity?: number;
  /** 当前强度高于该值时跳过该段（如安静的间奏） */
  maxIntensity?: number;
}

export interface DelaySettings {
  /** 延迟时间（拍） */
  beats: number;
  feedback: number;
  wet: number;
  /** 反馈回路低通（Hz） */
  tone?: number;
}

export interface Composition {
  id: string;
  bpm: number;
  /** 主音音级 0..11（C = 0），刺激音据此移调到当前调性 */
  key: number;
  /** 0..0.5，偶数位 16 分音符后移比例（shuffle） */
  swing?: number;
  /** 强度 1 时的速度提升比例（如 0.06 = 快 6%），随强度平滑变化 */
  tempoRamp?: number;
  /** 强度 0 时会话低通的截止频率（Hz）；强度升高时逐渐全开 */
  filterFloor?: number;
  /** 曲目整体电平（会话增益） */
  mix: number;
  /** 开始播放时的强度 */
  defaultIntensity: number;
  delay?: DelaySettings;
  tracks: Readonly<Record<string, TrackDef>>;
  patterns: Readonly<Record<string, string>>;
  sections: readonly SectionDef[];
  /** 循环起点段索引（缺省 0） */
  loopFrom?: number;
}

/** 刺激音：一次性短乐句 + 对主音乐的闪避参数 */
export interface StingerDef {
  /** 以 C 为主音写成；播放时移调到当前曲目的调性 */
  composition: Composition;
  /** 闪避时主音乐保留的比例（0..1） */
  duckTo: number;
  /** 乐句结束后的余音（秒），闪避在此之后恢复 */
  tail: number;
  /** true：刺激音接管，当前曲目随之淡出结束（胜利 / 失败 / 关卡完成） */
  endsMusic?: boolean;
  /** 对齐方式：下一拍 / 下一小节 / 立即 */
  quantize: 'beat' | 'bar' | 'none';
  /** 是否跟随当前曲目移调 */
  followKey: boolean;
}
