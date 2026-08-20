import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '@/core/Audio/AudioManager';

type IncomingWarningApi = AudioManager & {
  playIncomingWarning?: (distance?: number) => void;
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

describe('AudioManager.playIncomingWarning', () => {
  let starts: number;
  let nowMs: number;
  let originalAudioContext: typeof AudioContext | undefined;
  let originalWebkitAudioContext: typeof AudioContext | undefined;
  let audio: IncomingWarningApi;

  beforeEach(() => {
    starts = 0;
    nowMs = 1_000;
    originalAudioContext = window.AudioContext;
    originalWebkitAudioContext = (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

    class FakeNode {
      connect(): this {
        return this;
      }
      disconnect(): this {
        return this;
      }
    }

    class FakeAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      sampleRate = 44100;
      destination = new FakeNode();

      createGain() {
        return Object.assign(new FakeNode(), { gain: createParam(1) });
      }

      createOscillator() {
        return Object.assign(new FakeNode(), {
          type: 'sine' as OscillatorType,
          frequency: createParam(440),
          start: (_when?: number) => {
            starts += 1;
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
        return {
          length,
          sampleRate,
          numberOfChannels: channels,
          getChannelData: () => new Float32Array(length),
        };
      }

      createBufferSource() {
        return Object.assign(new FakeNode(), {
          buffer: null as AudioBuffer | null,
          loop: false,
          start: (_when?: number) => {
            starts += 1;
          },
          stop: (_when?: number) => undefined,
        });
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    (window as Window & { AudioContext: typeof AudioContext }).AudioContext =
      FakeAudioContext as unknown as typeof AudioContext;
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext =
      FakeAudioContext as unknown as typeof AudioContext;

    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    audio = new AudioManager() as IncomingWarningApi;
  });

  afterEach(() => {
    audio.dispose();
    vi.restoreAllMocks();
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext =
      originalWebkitAudioContext;
  });

  it('exists on the shipped AudioManager and does not stack unbounded on two rapid calls', () => {
    expect(typeof audio.playIncomingWarning).toBe('function');

    audio.resume();
    audio.playIncomingWarning?.(80);
    const afterFirst = starts;
    expect(afterFirst, 'first playIncomingWarning should start audio nodes').toBeGreaterThan(0);

    audio.playIncomingWarning?.(80);
    audio.playIncomingWarning?.(40);
    expect(starts, 'rapid follow-up calls must not stack another full warning').toBe(afterFirst);

    nowMs += 1000;
    audio.playIncomingWarning?.(80);
    expect(starts, 'a later call after minInterval should be allowed to play again').toBeGreaterThan(
      afterFirst,
    );
  });
});
