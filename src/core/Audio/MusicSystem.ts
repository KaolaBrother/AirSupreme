import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MusicSystem');

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

export class MusicSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private currentMusic: LevelMusic | null = null;
  private scheduledNotes: OscillatorNode[] = [];
  private loopTimeout: number | null = null;
  private musicVolume: number = 0.3;
  private bpm: number = 140;

  constructor() {}

  private initContext(): void {
    if (this.context) return;

    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.musicVolume;
      this.masterGain.connect(this.context.destination);
    } catch (e) {
      log.warn('Web Audio API not supported for music');
    }
  }

  public resume(): void {
    this.initContext();
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  }

  private get beatDuration(): number {
    return 60 / this.bpm;
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

  private playNote(
    frequency: number,
    duration: number,
    waveform: OscillatorType,
    volume: number,
    startTime: number
  ): OscillatorNode | null {
    if (!this.context || !this.masterGain || frequency === NOTE.REST) {
      return null;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = waveform;
    osc.frequency.value = frequency;

    const attackTime = 0.02;
    const releaseTime = 0.05;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
    gain.gain.setValueAtTime(volume, startTime + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    this.scheduledNotes.push(osc);

    return osc;
  }

  private playTrack(track: MusicTrack, startTime: number): void {
    let currentTime = startTime;

    for (const noteEvent of track.notes) {
      const durationInSeconds = noteEvent.duration * this.beatDuration;

      this.playNote(noteEvent.note, durationInSeconds, track.waveform, track.volume, currentTime);

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

  private playMusicLoop(): void {
    if (!this.context || !this.isPlaying || !this.currentMusic) return;

    const now = this.context.currentTime;
    const tracks = this.getTracksForLevel(this.currentMusic);

    const totalBeats =
      tracks.melodyA.notes.reduce((sum, n) => sum + n.duration, 0) +
      tracks.melodyB.notes.reduce((sum, n) => sum + n.duration, 0) +
      (tracks.melodyC?.notes.reduce((sum, n) => sum + n.duration, 0) ?? 0);
    const totalDuration = totalBeats * this.beatDuration;

    this.playTrack(tracks.melodyA, now);

    const aDuration =
      tracks.melodyA.notes.reduce((sum, n) => sum + n.duration, 0) * this.beatDuration;
    this.playTrack(tracks.melodyB, now + aDuration);

    if (tracks.melodyC) {
      const bDuration =
        tracks.melodyB.notes.reduce((sum, n) => sum + n.duration, 0) * this.beatDuration;
      this.playTrack(tracks.melodyC, now + aDuration + bDuration);
    }

    this.playTrack(tracks.bass, now);

    if (tracks.pad) {
      this.playTrack(tracks.pad, now);
    }

    if (this.isPlaying) {
      this.loopTimeout = window.setTimeout(
        () => {
          this.playMusicLoop();
        },
        totalDuration * 1000 - 100
      );
    }
  }

  public playLevelMusic(level: LevelMusic): void {
    this.initContext();

    if (this.context?.state === 'suspended') {
      this.context.resume();
    }

    if (this.isPlaying && this.currentMusic === level) {
      return;
    }

    this.stopMusic();

    this.isPlaying = true;
    this.currentMusic = level;

    this.applyLevelStyle(level);

    this.playMusicLoop();
  }

  private applyLevelStyle(level: LevelMusic): void {
    switch (level) {
      case LevelMusic.LAKE:
        this.bpm = 130;
        this.musicVolume = 0.25;
        break;
      case LevelMusic.DESERT:
        this.bpm = 150;
        this.musicVolume = 0.3;
        break;
      case LevelMusic.SNOW:
        this.bpm = 120;
        this.musicVolume = 0.28;
        break;
      case LevelMusic.OCEAN:
        this.bpm = 125;
        this.musicVolume = 0.22;
        break;
      case LevelMusic.CITY:
        this.bpm = 160;
        this.musicVolume = 0.32;
        break;
      case LevelMusic.BOSS:
        this.bpm = 90;
        this.musicVolume = 0.35;
        break;
      case LevelMusic.DESERT_BOSS:
        this.bpm = 95;
        this.musicVolume = 0.38;
        break;
      case LevelMusic.OCTOPUS_BOSS:
        this.bpm = 100;
        this.musicVolume = 0.35;
        break;
      case LevelMusic.OCEAN_BOSS:
        this.bpm = 105;
        this.musicVolume = 0.35;
        break;
      case LevelMusic.SKY_CARRIER_BOSS:
        this.bpm = 110;
        this.musicVolume = 0.38;
        break;
    }

    if (this.masterGain) {
      this.masterGain.gain.value = this.musicVolume;
    }
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

    if (this.loopTimeout !== null) {
      clearTimeout(this.loopTimeout);
      this.loopTimeout = null;
    }

    this.scheduledNotes.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Already stopped
      }
    });
    this.scheduledNotes = [];
  }

  public pauseMusic(): void {
    this.stopMusic();
  }

  public setVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.musicVolume;
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
    if (this.context) {
      this.context.close();
      this.context = null;
      this.masterGain = null;
    }
  }
}
