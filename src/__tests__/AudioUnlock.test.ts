import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '@/core/Audio/AudioManager';
import {
  getSharedAudioContext,
  resetSharedAudioContextForTests,
  unlockAudioFromUserGesture,
} from '@/core/Audio/AudioContextHost';
import { MusicSystem } from '@/core/Audio/MusicSystem';
import { StartMenu } from '@/ui/StartMenu';

type WebkitAudioWindow = Window & {
  AudioContext: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

type OwnedAudioContext = { context: AudioContext | null };

type FakeAudioContextFields = {
  resumeCalls: number;
};

type AudioHarness = {
  constructed: number;
  oscillatorStarts: number;
  resumeCalls: number;
  nextInitialState: AudioContextState;
};

type FakeAudioParam = {
  value: number;
  setValueAtTime: () => FakeAudioParam;
  linearRampToValueAtTime: () => FakeAudioParam;
  exponentialRampToValueAtTime: () => FakeAudioParam;
  setTargetAtTime: () => FakeAudioParam;
  cancelScheduledValues: () => FakeAudioParam;
};

function createParam(value = 0): FakeAudioParam {
  const param: FakeAudioParam = {
    value,
    setValueAtTime() {
      return param;
    },
    linearRampToValueAtTime() {
      return param;
    },
    exponentialRampToValueAtTime() {
      return param;
    },
    setTargetAtTime() {
      return param;
    },
    cancelScheduledValues() {
      return param;
    },
  };
  return param;
}

function getOwnedContext(subject: object): AudioContext | null {
  return (subject as unknown as OwnedAudioContext).context;
}

function getResumeCalls(context: AudioContext | null): number {
  if (!context) {
    return 0;
  }
  return (context as unknown as FakeAudioContextFields).resumeCalls ?? 0;
}

function installFakeAudioContext(harness: AudioHarness): void {
  class FakeNode {
    connect(): this {
      return this;
    }
    disconnect(): this {
      return this;
    }
  }

  class FakeAudioContext {
    state: AudioContextState;
    resumeCalls = 0;
    currentTime = 0;
    sampleRate = 44100;
    destination = new FakeNode();

    constructor(_options?: unknown) {
      this.state = harness.nextInitialState;
      harness.constructed += 1;
    }

    resume() {
      this.resumeCalls += 1;
      harness.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    close() {
      this.state = 'closed';
      return Promise.resolve();
    }

    createGain() {
      return Object.assign(new FakeNode(), { gain: createParam(1) });
    }

    createOscillator() {
      return Object.assign(new FakeNode(), {
        type: 'sine' as OscillatorType,
        frequency: createParam(440),
        detune: createParam(0),
        start: (_when?: number) => {
          harness.oscillatorStarts += 1;
        },
        stop: (_when?: number) => undefined,
      });
    }

    createBiquadFilter() {
      return Object.assign(new FakeNode(), {
        type: 'lowpass' as BiquadFilterType,
        frequency: createParam(800),
        Q: createParam(1),
      });
    }

    createBuffer(channels: number, length: number, sampleRate: number) {
      const frames = Math.max(1, Math.floor(length));
      return {
        length: frames,
        sampleRate,
        numberOfChannels: channels,
        getChannelData: () => new Float32Array(frames),
      };
    }

    createBufferSource() {
      return Object.assign(new FakeNode(), {
        buffer: null as AudioBuffer | null,
        loop: false,
        start: (_when?: number) => undefined,
        stop: (_when?: number) => undefined,
      });
    }
  }

  const audioWindow = window as WebkitAudioWindow;
  audioWindow.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  audioWindow.webkitAudioContext = FakeAudioContext as unknown as typeof AudioContext;
}

describe('audio unlock', () => {
  let harness: AudioHarness;
  let originalAudioContext: typeof AudioContext | undefined;
  let originalWebkitAudioContext: typeof AudioContext | undefined;
  let audio: AudioManager | null;
  let music: MusicSystem | null;
  let menu: StartMenu | null;

  beforeEach(() => {
    audio = null;
    music = null;
    menu = null;
    harness = {
      constructed: 0,
      oscillatorStarts: 0,
      resumeCalls: 0,
      nextInitialState: 'suspended',
    };

    const audioWindow = window as WebkitAudioWindow;
    originalAudioContext = audioWindow.AudioContext;
    originalWebkitAudioContext = audioWindow.webkitAudioContext;
    installFakeAudioContext(harness);
    resetSharedAudioContextForTests();

    document.body.innerHTML = '';
    window.localStorage.clear();
    vi.stubGlobal('requestIdleCallback', () => 1);
  });

  afterEach(() => {
    audio?.dispose();
    music?.dispose();
    menu?.dispose();
    audio = null;
    music = null;
    menu = null;
    resetSharedAudioContextForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    const audioWindow = window as WebkitAudioWindow;
    if (originalAudioContext) {
      audioWindow.AudioContext = originalAudioContext;
    }
    audioWindow.webkitAudioContext = originalWebkitAudioContext;

    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('shared AudioContext', () => {
    it('uses the same AudioContext after AudioManager.resume and MusicSystem.resume', () => {
      audio = new AudioManager();
      music = new MusicSystem();
      audio.resume();
      music.resume();

      const managerContext = getOwnedContext(audio);
      const musicContext = getOwnedContext(music);

      expect(managerContext, 'AudioManager.resume should create an AudioContext').not.toBeNull();
      expect(musicContext, 'MusicSystem.resume should create an AudioContext').not.toBeNull();
      expect(managerContext).toBe(musicContext);
      expect(getSharedAudioContext()).toBe(managerContext);
    });
  });

  describe('AudioContextHost', () => {
    it('returns null from getSharedAudioContext when none has been created', () => {
      expect(getSharedAudioContext()).toBeNull();
    });

    it('constructs an AudioContext and calls resume from unlockAudioFromUserGesture', () => {
      expect(harness.constructed).toBe(0);

      unlockAudioFromUserGesture();

      const shared = getSharedAudioContext();
      expect(shared, 'unlock should expose the constructed context').not.toBeNull();
      expect(harness.constructed).toBe(1);
      expect(getResumeCalls(shared)).toBeGreaterThanOrEqual(1);
      expect(harness.resumeCalls).toBeGreaterThanOrEqual(1);
    });

    it('reuses the unlocked AudioContext when AudioManager.resume runs later', () => {
      unlockAudioFromUserGesture();
      const shared = getSharedAudioContext();
      expect(shared).not.toBeNull();
      expect(harness.constructed).toBe(1);

      audio = new AudioManager();
      audio.resume();

      expect(getOwnedContext(audio)).toBe(shared);
      expect(harness.constructed, 'AudioManager must not construct a second AudioContext').toBe(1);
    });

    it('does not construct a second context when unlock is called twice', () => {
      unlockAudioFromUserGesture();
      const first = getSharedAudioContext();
      unlockAudioFromUserGesture();

      expect(getSharedAudioContext()).toBe(first);
      expect(harness.constructed).toBe(1);
    });

    it('drops the shared instance from resetSharedAudioContextForTests', () => {
      unlockAudioFromUserGesture();
      expect(getSharedAudioContext()).not.toBeNull();

      resetSharedAudioContextForTests();

      expect(getSharedAudioContext()).toBeNull();
    });

    it('returns null from getSharedAudioContext after the shared context is closed', async () => {
      unlockAudioFromUserGesture();
      const shared = getSharedAudioContext();
      expect(shared).not.toBeNull();

      await (shared as AudioContext).close();

      expect(getSharedAudioContext()).toBeNull();
    });
  });

  describe('SFX play path', () => {
    it('playShoot resumes a suspended context and starts an oscillator without a prior resume()', () => {
      audio = new AudioManager();

      audio.playShoot('player');

      expect(
        harness.resumeCalls,
        'playShoot should call context.resume() when the context is suspended',
      ).toBeGreaterThanOrEqual(1);
      expect(
        harness.oscillatorStarts,
        'playShoot should start at least one oscillator after resume',
      ).toBeGreaterThan(0);
    });

    it('playHit resumes a suspended context and starts an oscillator without a prior resume()', () => {
      audio = new AudioManager();

      audio.playHit();

      expect(
        harness.resumeCalls,
        'playHit should call context.resume() when the context is suspended',
      ).toBeGreaterThanOrEqual(1);
      expect(
        harness.oscillatorStarts,
        'playHit should start at least one oscillator after resume',
      ).toBeGreaterThan(0);
    });

    it('playExplosion resumes a suspended context and starts an oscillator without a prior resume()', () => {
      audio = new AudioManager();

      audio.playExplosion('enemy', 1);

      expect(
        harness.resumeCalls,
        'playExplosion should call context.resume() when the context is suspended',
      ).toBeGreaterThanOrEqual(1);
      expect(
        harness.oscillatorStarts,
        'playExplosion should start at least one oscillator after resume',
      ).toBeGreaterThan(0);
    });

    it('playShoot resumes an interrupted AudioContext', () => {
      // Safari can report 'interrupted' after a route change; play paths must
      // resume there too, not only when state === 'suspended'.
      harness.nextInitialState = 'interrupted' as AudioContextState;
      audio = new AudioManager();

      audio.playShoot('player');

      expect(
        harness.resumeCalls,
        'playShoot should call context.resume() when the context is interrupted',
      ).toBeGreaterThanOrEqual(1);
      expect(
        harness.oscillatorStarts,
        'playShoot should start an oscillator after resuming an interrupted context',
      ).toBeGreaterThan(0);
    });
  });

  describe('StartMenu start button', () => {
    it('unlocks audio on the click stack before onStart runs', () => {
      menu = new StartMenu();

      const captured: Array<{
        context: AudioContext | null;
        state: AudioContextState | undefined;
        resumeCalls: number;
      }> = [];

      menu.setOnStart(async () => {
        const shared = getSharedAudioContext();
        captured.push({
          context: shared,
          state: shared?.state,
          resumeCalls: Math.max(getResumeCalls(shared), harness.resumeCalls),
        });
      });

      const startBtn = document.getElementById('start-btn');
      expect(startBtn, 'expected #start-btn').toBeTruthy();
      (startBtn as HTMLButtonElement).click();

      expect(
        captured.length,
        'onStart must run on the click stack, not after an await / dynamic import',
      ).toBe(1);

      const unlockSnapshot = captured[0];
      expect(
        unlockSnapshot.context,
        `shared context must exist before onStart (state=${String(unlockSnapshot.state)})`,
      ).not.toBeNull();
      expect(
        unlockSnapshot.resumeCalls,
        'unlock must call resume() on the click stack before onStart',
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
