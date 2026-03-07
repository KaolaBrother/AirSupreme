import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MusicSystem');

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const DEFAULT_CROSSFADE_MS = 800;
type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

type MusicDuckListener = (amount: number, durationMs: number) => void;

const duckListeners = new Set<MusicDuckListener>();

export const musicDuckingBridge = {
  subscribe(listener: MusicDuckListener): () => void {
    duckListeners.add(listener);
    return () => {
      duckListeners.delete(listener);
    };
  },
  request(amount: number, durationMs: number): void {
    const normalizedAmount = clamp01(amount);
    const safeDurationMs = Math.max(0, durationMs);
    duckListeners.forEach((listener) => {
      listener(normalizedAmount, safeDurationMs);
    });
  },
};

const NOTE = {
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  G3S: 207.65,
  A3: 220.0,
  A3S: 233.08,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  D4S: 311.13,
  E4: 329.63,
  F4: 349.23,
  F4S: 369.99,
  G4: 392.0,
  G4S: 415.3,
  A4: 440.0,
  A4S: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  D5S: 622.25,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  REST: 0,
};

interface NoteEvent {
  note: number;
  duration: number;
}

interface MusicTrack {
  notes: NoteEvent[];
  waveform: OscillatorType;
  volume: number;
  detune?: number;
}

export enum LevelMusic {
  LAKE = 'LAKE',
  DESERT = 'DESERT',
  SNOW = 'SNOW',
  OCEAN = 'OCEAN',
  CITY = 'CITY',
  BOSS = 'BOSS',
  DESERT_BOSS = 'DESERT_BOSS',
  OCTOPUS_BOSS = 'OCTOPUS_BOSS',
  OCEAN_BOSS = 'OCEAN_BOSS',
  SKY_CARRIER_BOSS = 'SKY_CARRIER_BOSS',
}

export interface MusicCrossfadeOptions {
  durationMs?: number;
}

interface MusicSession {
  id: number;
  level: LevelMusic;
  bpm: number;
  styleVolume: number;
  gain: GainNode;
  loopTimeout: number | null;
  notes: Set<OscillatorNode>;
  disposed: boolean;
}

interface LevelMusicStyle {
  bpm: number;
  volume: number;
}

export class MusicSystem {
  private static readonly MASTER_OUTPUT_GAIN = 1;
  private static readonly USER_MUSIC_GAIN_BOOST = 1.2;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private isDisposed: boolean = false;
  private sessionId = 0;
  private currentSession: MusicSession | null = null;
  private currentMusic: LevelMusic | null = null;
  private musicVolume: number = 1;
  private sessions = new Map<number, MusicSession>();
  private unsubscribeDucking?: () => void;
  private duckingReleaseTime: number = 0;

  constructor() {
    this.unsubscribeDucking = musicDuckingBridge.subscribe((amount, durationMs) => {
      this.applyMusicDuck(amount, durationMs);
    });
  }

  private initContext(): void {
    if (this.context && this.context.state !== 'closed') return;

    try {
      const AudioContextCtor =
        window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
      if (!AudioContextCtor) {
        log.warn('Web Audio API not supported for music');
        return;
      }

      this.context = new AudioContextCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = MusicSystem.MASTER_OUTPUT_GAIN;
      this.masterGain.connect(this.context.destination);
    } catch {
      log.warn('Web Audio API not supported for music');
    }
  }

  private canPlay(): boolean {
    return (
      !this.isDisposed &&
      !!this.context &&
      !!this.masterGain &&
      this.context.state === 'running'
    );
  }

  private isContextReady(): boolean {
    return (
      !this.isDisposed &&
      !!this.context &&
      !!this.masterGain &&
      this.context.state !== 'closed'
    );
  }

  public get isClosed(): boolean {
    return this.isDisposed || !this.context || this.context.state === 'closed';
  }

  public resume(): void {
    if (this.isDisposed) return;
    this.initContext();
    if (this.context?.state === 'suspended') {
      this.context.resume().catch(() => {
        log.warn('Music AudioContext resume blocked by autoplay policy');
      });
    }
  }

  // ==================== 关卡1: 湖畔 - 平和、流畅的A小调 ====================
  private createLakeMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.REST, duration: 0.5 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.REST, duration: 0.5 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.25 };
  }

  private createLakeMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 1.0 },
    ];
    return { notes, waveform: 'triangle', volume: 0.25 };
  }

  private createLakeBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.15 };
  }

  // ==================== 关卡2: 沙漠 - 热烈、中东风格的D小调 ====================
  private createDesertMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.REST, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.REST, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.22 };
  }

  private createDesertMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.D4, duration: 1.0 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.22 };
  }

  private createDesertBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.D3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.12 };
  }

  // ==================== 关卡3: 雪山 - 空灵、神秘的E小调 ====================
  private createSnowMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.75 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.F4S, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.75 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4S, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 1.0 },
      { note: NOTE.REST, duration: 0.5 },
    ];
    return { notes, waveform: 'sine', volume: 0.28 };
  }

  private createSnowMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.E4, duration: 0.75 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 1.0 },
      { note: NOTE.REST, duration: 0.5 },
    ];
    return { notes, waveform: 'sine', volume: 0.28 };
  }

  private createSnowBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.75 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.E3, duration: 1.0 },
    ];
    return { notes, waveform: 'triangle', volume: 0.18 };
  }

  // ==================== 关卡4: 海洋 - 波浪般流动的C大调 ====================
  private createOceanMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.C4, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.24 };
  }

  private createOceanMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.C4, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.24 };
  }

  private createOceanBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.F3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.C3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.B3, duration: 0.5 },
      { note: NOTE.C4, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
      { note: NOTE.G3, duration: 0.5 },
      { note: NOTE.C3, duration: 0.5 },
    ];
    return { notes, waveform: 'sine', volume: 0.2 };
  }

  // ==================== 关卡5: 城市 - 紧张、工业感的F小调 ====================
  private createCityMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.REST, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.5 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.2 };
  }

  private createCityMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.G5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4S, duration: 0.5 },
      { note: NOTE.F4, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.2 };
  }

  private createCityBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.F3, duration: 0.5 },
      { note: NOTE.C4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.15 };
  }

  private createCityPad(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F3, duration: 1.0 },
      { note: NOTE.G3S, duration: 1.0 },
      { note: NOTE.A3S, duration: 1.0 },
      { note: NOTE.C4, duration: 1.0 },
      { note: NOTE.D4S, duration: 1.0 },
      { note: NOTE.C4, duration: 1.0 },
      { note: NOTE.A3S, duration: 1.0 },
      { note: NOTE.F3, duration: 1.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.1 };
  }

  private createBossMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4S, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.75 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.25 };
  }

  private createBossMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4S, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.25 };
  }

  private createBossMelodyC(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.F4S, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 1.0 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 1.0 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.25 };
  }

  private createBossBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.18 };
  }

  private createBossDrone(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E3, duration: 2.0 },
      { note: NOTE.D3, duration: 2.0 },
      { note: NOTE.G3, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.12 };
  }

  private createDesertBossMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.5 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.28 };
  }

  private createDesertBossMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.28 };
  }

  private createDesertBossMelodyC(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.5 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.75 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.28 };
  }

  private createDesertBossBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.5 },
      { note: NOTE.A3, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.2 };
  }

  private createDesertBossDrone(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.D3, duration: 2.0 },
      { note: NOTE.F3, duration: 2.0 },
      { note: NOTE.G3S, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.C4, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.G3S, duration: 2.0 },
      { note: NOTE.F3, duration: 2.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.14 };
  }

  private createOctopusBossMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
    ];
    return { notes, waveform: 'sine', volume: 0.28 };
  }

  private createOctopusBossMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
    ];
    return { notes, waveform: 'sine', volume: 0.28 };
  }

  private createOctopusBossMelodyC(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.75 },
    ];
    return { notes, waveform: 'sine', volume: 0.28 };
  }

  private createOctopusBossBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.5 },
      { note: NOTE.D3, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.2 };
  }

  private createOctopusBossPad(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E3, duration: 2.0 },
      { note: NOTE.G3, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.B3, duration: 2.0 },
      { note: NOTE.C4, duration: 2.0 },
      { note: NOTE.B3, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.G3, duration: 2.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.12 };
  }

  private createOceanBossMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.28 };
  }

  private createOceanBossMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.5 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
    ];
    return { notes, waveform: 'triangle', volume: 0.28 };
  }

  private createOceanBossMelodyC(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.E5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.5 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.E5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.5 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.E4, duration: 0.25 },
      { note: NOTE.G4, duration: 0.25 },
      { note: NOTE.A4, duration: 0.25 },
      { note: NOTE.B4, duration: 0.25 },
      { note: NOTE.C5, duration: 0.75 },
    ];
    return { notes, waveform: 'triangle', volume: 0.28 };
  }

  private createOceanBossBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C3, duration: 0.25 },
      { note: NOTE.C3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.D3, duration: 0.25 },
      { note: NOTE.C3, duration: 0.25 },
      { note: NOTE.C3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.E3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.B3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.A3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.G3, duration: 0.25 },
      { note: NOTE.C3, duration: 0.5 },
      { note: NOTE.E3, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.2 };
  }

  private createOceanBossPad(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C3, duration: 2.0 },
      { note: NOTE.E3, duration: 2.0 },
      { note: NOTE.G3, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.B3, duration: 2.0 },
      { note: NOTE.C4, duration: 2.0 },
      { note: NOTE.A3, duration: 2.0 },
      { note: NOTE.G3, duration: 2.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.12 };
  }

  private createSkyCarrierBossMelodyA(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.5 },
      { note: NOTE.D5S, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.26 };
  }

  private createSkyCarrierBossMelodyB(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.G5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.26 };
  }

  private createSkyCarrierBossMelodyC(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5S, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.5 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.F5, duration: 0.5 },
      { note: NOTE.D5S, duration: 0.25 },
      { note: NOTE.F5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.5 },
      { note: NOTE.D5, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.5 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.D5, duration: 0.5 },
      { note: NOTE.C5, duration: 0.25 },
      { note: NOTE.A4S, duration: 0.25 },
      { note: NOTE.G4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.F4, duration: 0.75 },
    ];
    return { notes, waveform: 'sawtooth', volume: 0.26 };
  }

  private createSkyCarrierBossBass(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.D4S, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.D4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.F3, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.C4, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.A3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.G3S, duration: 0.25 },
      { note: NOTE.F3, duration: 0.5 },
      { note: NOTE.C4, duration: 0.5 },
    ];
    return { notes, waveform: 'square', volume: 0.2 };
  }

  private createSkyCarrierBossPad(): MusicTrack {
    const notes: NoteEvent[] = [
      { note: NOTE.F3, duration: 2.0 },
      { note: NOTE.G3S, duration: 2.0 },
      { note: NOTE.A3S, duration: 2.0 },
      { note: NOTE.C4, duration: 2.0 },
      { note: NOTE.D4S, duration: 2.0 },
      { note: NOTE.C4, duration: 2.0 },
      { note: NOTE.A3S, duration: 2.0 },
      { note: NOTE.G3S, duration: 2.0 },
    ];
    return { notes, waveform: 'sine', volume: 0.12 };
  }

  private createSession(level: LevelMusic, style: LevelMusicStyle): MusicSession {
    if (!this.context || !this.masterGain) {
      throw new Error('Music context not initialized');
    }

    const sessionGain = this.context.createGain();
    const session: MusicSession = {
      id: this.sessionId++,
      level,
      bpm: style.bpm,
      styleVolume: style.volume,
      gain: sessionGain,
      loopTimeout: null,
      notes: new Set(),
      disposed: false,
    };

    sessionGain.gain.value = 0;
    sessionGain.connect(this.masterGain);
    this.sessions.set(session.id, session);
    return session;
  }

  private getSessionGain(session: MusicSession): number {
    return clamp01(this.musicVolume * MusicSystem.USER_MUSIC_GAIN_BOOST * session.styleVolume);
  }

  private disposeSession(session: MusicSession): void {
    if (session.loopTimeout !== null) {
      clearTimeout(session.loopTimeout);
      session.loopTimeout = null;
    }

    for (const osc of session.notes) {
      try {
        osc.stop();
      } catch {
        // 已停止
      }
    }
    session.notes.clear();
    session.disposed = true;

    try {
      session.gain.disconnect();
    } catch {
      // Ignore
    }

    this.sessions.delete(session.id);
    if (this.currentSession?.id === session.id) {
      this.currentSession = null;
    }
    if (this.currentMusic === session.level) {
      this.currentMusic = null;
    }
  }

  private stopSession(session: MusicSession, fadeMs: number): void {
    if (!session || session.disposed) return;

    session.disposed = true;
    if (session.loopTimeout !== null) {
      clearTimeout(session.loopTimeout);
      session.loopTimeout = null;
    }

    if (!this.context || !this.canPlay() || fadeMs <= 0) {
      this.disposeSession(session);
      return;
    }

    const context = this.context;
    if (!context) {
      this.disposeSession(session);
      return;
    }

    const now = context.currentTime;
    const gain = session.gain.gain;
    try {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    } catch {
      // Ignore
    }

    const safeTimeout = window.setTimeout(() => {
      this.disposeSession(session);
    }, fadeMs + 20);

    session.loopTimeout = safeTimeout;
  }

  private getSessionBeatDuration(session: MusicSession): number {
    return 60 / session.bpm;
  }

  private trackDuration(track: MusicTrack, beatDuration: number): number {
    return track.notes.reduce((sum, n) => sum + n.duration * beatDuration, 0);
  }

  private playNote(
    session: MusicSession,
    frequency: number,
    duration: number,
    waveform: OscillatorType,
    volume: number,
    startTime: number
  ): void {
    if (!this.context || this.masterGain === null || frequency === NOTE.REST || duration <= 0) {
      return;
    }

    const finalVolume = clamp01(volume * this.getSessionGain(session));
    if (finalVolume <= 0) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = waveform;
    osc.frequency.value = frequency;

    const attackTime = 0.02;
    const releaseTime = 0.05;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(finalVolume, startTime + attackTime);
    gain.gain.setValueAtTime(finalVolume, startTime + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(session.gain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    session.notes.add(osc);
    osc.addEventListener('ended', () => {
      session.notes.delete(osc);
    });
  }

  private playTrack(
    session: MusicSession,
    track: MusicTrack,
    startTime: number,
    beatDuration: number
  ): void {
    let currentTime = startTime;
    for (const noteEvent of track.notes) {
      const durationInSeconds = noteEvent.duration * beatDuration;
      this.playNote(session, noteEvent.note, durationInSeconds, track.waveform, track.volume, currentTime);
      currentTime += durationInSeconds;
    }
  }

  private getTracksForLevel(level: LevelMusic): {
    melodyA: MusicTrack;
    melodyB: MusicTrack;
    melodyC?: MusicTrack;
    bass: MusicTrack;
    pad?: MusicTrack;
  } {
    switch (level) {
      case LevelMusic.LAKE:
        return {
          melodyA: this.createLakeMelodyA(),
          melodyB: this.createLakeMelodyB(),
          bass: this.createLakeBass(),
        };
      case LevelMusic.DESERT:
        return {
          melodyA: this.createDesertMelodyA(),
          melodyB: this.createDesertMelodyB(),
          bass: this.createDesertBass(),
        };
      case LevelMusic.SNOW:
        return {
          melodyA: this.createSnowMelodyA(),
          melodyB: this.createSnowMelodyB(),
          bass: this.createSnowBass(),
        };
      case LevelMusic.OCEAN:
        return {
          melodyA: this.createOceanMelodyA(),
          melodyB: this.createOceanMelodyB(),
          bass: this.createOceanBass(),
        };
      case LevelMusic.CITY:
        return {
          melodyA: this.createCityMelodyA(),
          melodyB: this.createCityMelodyB(),
          bass: this.createCityBass(),
          pad: this.createCityPad(),
        };
      case LevelMusic.BOSS:
        return {
          melodyA: this.createBossMelodyA(),
          melodyB: this.createBossMelodyB(),
          melodyC: this.createBossMelodyC(),
          bass: this.createBossBass(),
          pad: this.createBossDrone(),
        };
      case LevelMusic.DESERT_BOSS:
        return {
          melodyA: this.createDesertBossMelodyA(),
          melodyB: this.createDesertBossMelodyB(),
          melodyC: this.createDesertBossMelodyC(),
          bass: this.createDesertBossBass(),
          pad: this.createDesertBossDrone(),
        };
      case LevelMusic.OCTOPUS_BOSS:
        return {
          melodyA: this.createOctopusBossMelodyA(),
          melodyB: this.createOctopusBossMelodyB(),
          melodyC: this.createOctopusBossMelodyC(),
          bass: this.createOctopusBossBass(),
          pad: this.createOctopusBossPad(),
        };
      case LevelMusic.OCEAN_BOSS:
        return {
          melodyA: this.createOceanBossMelodyA(),
          melodyB: this.createOceanBossMelodyB(),
          melodyC: this.createOceanBossMelodyC(),
          bass: this.createOceanBossBass(),
          pad: this.createOceanBossPad(),
        };
      case LevelMusic.SKY_CARRIER_BOSS:
        return {
          melodyA: this.createSkyCarrierBossMelodyA(),
          melodyB: this.createSkyCarrierBossMelodyB(),
          melodyC: this.createSkyCarrierBossMelodyC(),
          bass: this.createSkyCarrierBossBass(),
          pad: this.createSkyCarrierBossPad(),
        };
    }
  }

  private playMusicLoop(session: MusicSession): void {
    if (!this.canPlay() || !session || session.disposed || !this.isPlaying || this.currentSession?.id !== session.id) {
      return;
    }

    const context = this.context;
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const tracks = this.getTracksForLevel(session.level);
    const beatDuration = this.getSessionBeatDuration(session);

    const totalDuration =
      this.trackDuration(tracks.melodyA, beatDuration) +
      this.trackDuration(tracks.melodyB, beatDuration) +
      (tracks.melodyC ? this.trackDuration(tracks.melodyC, beatDuration) : 0);

    this.playTrack(session, tracks.melodyA, now, beatDuration);

    const aDuration =
      this.trackDuration(tracks.melodyA, beatDuration);
    this.playTrack(session, tracks.melodyB, now + aDuration, beatDuration);

    if (tracks.melodyC) {
      const bDuration =
        this.trackDuration(tracks.melodyB, beatDuration);
      this.playTrack(session, tracks.melodyC, now + aDuration + bDuration, beatDuration);
    }

    this.playTrack(session, tracks.bass, now, beatDuration);

    if (tracks.pad) {
      this.playTrack(session, tracks.pad, now, beatDuration);
    }

    if (this.isPlaying) {
      session.loopTimeout = window.setTimeout(
        () => {
          this.playMusicLoop(session);
        },
        totalDuration * 1000 - 100
      );
    }
  }

  public crossfadeTo(level: LevelMusic, options: MusicCrossfadeOptions = {}): void {
    this.initContext();
    if (!this.isContextReady()) {
      return;
    }

    if (this.context?.state === 'suspended') {
      this.context
        .resume()
        .then(() => {
          this.crossfadeTo(level, options);
        })
        .catch(() => {
          log.warn('Music AudioContext resume blocked by autoplay policy');
        });
      return;
    }

    if (!this.canPlay()) {
      return;
    }

    if (this.currentSession && !this.currentSession.disposed && this.currentMusic === level) {
      return;
    }

    const style = this.getLevelStyle(level);
    const nextSession = this.createSession(level, style);
    const oldSession = this.currentSession;
    const fadeMs = Math.max(0, options.durationMs ?? DEFAULT_CROSSFADE_MS);

    this.currentMusic = level;
    this.currentSession = nextSession;
    this.isPlaying = true;

    const context = this.context;
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const targetGain = this.getSessionGain(nextSession);
    nextSession.gain.gain.setValueAtTime(0, now);
    nextSession.gain.gain.linearRampToValueAtTime(targetGain, now + fadeMs / 1000);
    this.playMusicLoop(nextSession);

    if (oldSession && oldSession.id !== nextSession.id) {
      this.stopSession(oldSession, fadeMs);
    }
  }

  public playLevelMusic(level: LevelMusic): void {
    this.crossfadeTo(level);
  }

  private getLevelStyle(level: LevelMusic): LevelMusicStyle {
    switch (level) {
      case LevelMusic.LAKE:
        return { bpm: 130, volume: 0.25 };
      case LevelMusic.DESERT:
        return { bpm: 150, volume: 0.3 };
      case LevelMusic.SNOW:
        return { bpm: 120, volume: 0.28 };
      case LevelMusic.OCEAN:
        return { bpm: 125, volume: 0.22 };
      case LevelMusic.CITY:
        return { bpm: 160, volume: 0.32 };
      case LevelMusic.BOSS:
        return { bpm: 90, volume: 0.35 };
      case LevelMusic.DESERT_BOSS:
        return { bpm: 95, volume: 0.38 };
      case LevelMusic.OCTOPUS_BOSS:
        return { bpm: 100, volume: 0.35 };
      case LevelMusic.OCEAN_BOSS:
        return { bpm: 105, volume: 0.35 };
      case LevelMusic.SKY_CARRIER_BOSS:
        return { bpm: 110, volume: 0.38 };
    }
    return { bpm: 130, volume: 0.25 };
  }

  public playBossMusic(level?: number): void {
    if (level === 2) {
      this.playLevelMusic(LevelMusic.DESERT_BOSS);
    } else if (level === 3) {
      this.playLevelMusic(LevelMusic.OCTOPUS_BOSS);
    } else if (level === 4) {
      this.playLevelMusic(LevelMusic.OCEAN_BOSS);
    } else if (level === 5) {
      this.playLevelMusic(LevelMusic.SKY_CARRIER_BOSS);
    } else {
      this.playLevelMusic(LevelMusic.BOSS);
    }
  }

  public stopMusic(): void {
    this.isPlaying = false;
    this.currentMusic = null;
    this.currentSession = null;

    for (const session of this.sessions.values()) {
      this.stopSession(session, 0);
    }
  }

  public pauseMusic(): void {
    this.stopMusic();
  }

  public close(): void {
    this.dispose();
  }

  public setVolume(volume: number): void {
    this.musicVolume = clamp01(volume);
    if (this.masterGain) {
      for (const session of this.sessions.values()) {
        const sessionVolume = this.getSessionGain(session);
        try {
          session.gain.gain.setValueAtTime(sessionVolume, this.context?.currentTime || 0);
        } catch {
          // Ignore
        }
      }
      if (!this.currentSession) {
        this.masterGain.gain.value = MusicSystem.MASTER_OUTPUT_GAIN;
      }
    }
  }

  private applyMusicDuck(amount: number, durationMs: number): void {
    if (!this.context || !this.masterGain || this.context.state === 'closed') {
      return;
    }

    const now = this.context.currentTime;
    const duckGain = 1 - amount;
    const releaseTime = now + durationMs / 1000;
    const effectiveReleaseTime = Math.max(releaseTime, this.duckingReleaseTime);

    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(duckGain, now + 0.02);
      this.masterGain.gain.linearRampToValueAtTime(
        MusicSystem.MASTER_OUTPUT_GAIN,
        effectiveReleaseTime + 0.12
      );
      this.duckingReleaseTime = effectiveReleaseTime;
    } catch {
      // Ignore
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentMusic(): LevelMusic | null {
    return this.currentMusic;
  }

  public dispose(): void {
    this.stopMusic();
    this.unsubscribeDucking?.();
    this.unsubscribeDucking = undefined;
    if (this.context) {
      void this.context.close().catch(() => {
        // Ignore
      });
      this.context = null;
      this.masterGain = null;
      this.currentSession = null;
      this.sessions.clear();
      this.isDisposed = true;
    }
  }
}
