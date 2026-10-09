import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioManager } from '@/core/Audio/AudioManager';
import type { MusicSystem } from '@/core/Audio/MusicSystem';
import type {
  VoiceKind,
  VoiceLineInfo,
  VoicePlayOptions,
  VoiceSilentReason,
} from '@/core/Audio/VoiceSystem';
import {
  DefaultCampaignPresentation,
  type CampaignVoice,
} from '@/core/campaign/CampaignPresentation';
import type { WingmanEvent, WingmanId } from '@/core/campaign/Wingmen';
import {
  CAMPAIGN_PROLOGUE,
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  NARRATION_SPEAKER,
  getCampaignChapter,
  type GenericRadioKey,
} from '@/features/campaign/CampaignData';
import { setLocale } from '@/i18n';
import { RadioComms } from '@/ui/RadioComms';
import { StoryOverlay } from '@/ui/StoryOverlay';
import { resetLocale } from './i18nTestUtils';

/**
 * 战役表现层的配音接线（DefaultCampaignPresentation + 真实 RadioComms / StoryOverlay +
 * 假的 CampaignVoice）：无线电台词出现时按 line.id 播放（radio，说话人 = line.speaker），
 * 开口后台词等配音说完，下一句才出；紧急告警（missile-warning / civilian-hit）在另一句正在配音时
 * 直接跳过（genericRadio 返回 false），低血量等配音说完再报；没在配音的台词仍可被打断，
 * 被打断的台词最多重播一次（并重新配音）；
 * 清空无线电 / 暂停 / 继续 / 失败 / 通关 / 释放时停下或暂停配音；入关预取本章台词；
 * 僚机事件台词：雨燕入列由她自己报到；被击落由另一名僚机（在空中时）或天穹指挥部播报。
 */

interface PlayRequest {
  id: string;
  options: VoicePlayOptions;
  handle: number;
}

/** 假配音：同一时刻一句（新的顶掉旧的，旧的异步收到 onSilent('superseded')） */
class FakeVoice implements CampaignVoice {
  readonly plays: PlayRequest[] = [];
  readonly stops: Array<VoiceKind | undefined> = [];
  readonly prefetches: string[][] = [];
  stopAllCount = 0;
  pauseCount = 0;
  resumeCount = 0;
  private current: PlayRequest | null = null;
  private seq = 0;

  play(lineId: string, options: VoicePlayOptions): number {
    this.cancelCurrent('superseded');
    const request: PlayRequest = { id: lineId, options, handle: ++this.seq };
    this.current = request;
    this.plays.push(request);
    return request.handle;
  }

  stop(kind?: VoiceKind): void {
    this.stops.push(kind);
    if (this.current && (!kind || this.current.options.kind === kind)) {
      this.cancelCurrent('stopped');
    }
  }

  stopAll(): void {
    this.stopAllCount += 1;
    this.cancelCurrent('stopped');
  }

  pause(): void {
    this.pauseCount += 1;
  }

  resume(): void {
    this.resumeCount += 1;
  }

  prefetch(lineIds: readonly string[]): void {
    this.prefetches.push([...lineIds]);
  }

  loadManifest(): Promise<unknown> {
    return Promise.resolve(null);
  }

  /** 清单时长（测试按需填写；没有的句子返回 null） */
  readonly durations = new Map<string, number>();

  getLineDuration(lineId: string): number | null {
    return this.durations.get(lineId) ?? null;
  }

  /** 测试：当前这句开口（时长 seconds） */
  start(seconds: number): void {
    const request = this.requireCurrent();
    request.options.onStart?.(this.info(request, seconds));
  }

  /** 测试：当前这句说完 */
  end(): void {
    const request = this.requireCurrent();
    this.current = null;
    request.options.onEnd?.(this.info(request, 0));
  }

  currentId(): string | null {
    return this.current?.id ?? null;
  }

  private requireCurrent(): PlayRequest {
    expect(this.current, 'expected a voice request').not.toBeNull();
    return this.current as PlayRequest;
  }

  private cancelCurrent(reason: VoiceSilentReason): void {
    const previous = this.current;
    this.current = null;
    if (previous) {
      queueMicrotask(() => previous.options.onSilent?.(reason));
    }
  }

  private info(request: PlayRequest, duration: number): VoiceLineInfo {
    return {
      lineId: request.id,
      kind: request.options.kind,
      speaker: request.options.speaker ?? null,
      locale: 'en',
      language: 'en',
      duration,
      gainDb: 0,
    };
  }
}

/** 任意方法都是 vi.fn() 的替身（音效 / 音乐系统） */
function stub<T>(): T {
  const methods = new Map<PropertyKey, ReturnType<typeof vi.fn>>();
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === 'then') {
          return undefined;
        }
        let method = methods.get(key);
        if (!method) {
          method = vi.fn();
          methods.set(key, method);
        }
        return method;
      },
    }
  ) as T;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

function radioText(): string {
  return document.getElementById('radio-comms')?.textContent ?? '';
}

describe('campaign presentation voice wiring', () => {
  let voice: FakeVoice;
  let flying: Set<WingmanId>;
  let presentation: DefaultCampaignPresentation;
  let bossMode: boolean;

  function step(seconds: number, dt = 0.05): void {
    for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
      presentation.update(Math.min(dt, seconds - elapsed));
    }
  }

  function playedIds(): string[] {
    return voice.plays.map((request) => request.id);
  }

  beforeEach(async () => {
    document.body.innerHTML = '';
    voice = new FakeVoice();
    flying = new Set<WingmanId>();
    bossMode = false;
    presentation = new DefaultCampaignPresentation({
      getHud: () => null,
      getRadar: () => null,
      audio: stub<AudioManager>(),
      music: stub<MusicSystem>(),
      isBossMode: () => bossMode,
      getListenerPosition: () => null,
      loadStoryUi: () => Promise.resolve({ StoryOverlay, RadioComms }),
      wingmen: { isFlying: (id) => flying.has(id) },
      voice,
    });
    await presentation.preloadStoryUi();
  });

  afterEach(() => {
    presentation.dispose();
    resetLocale();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('radio', () => {
    it('voices each radio line by its id, as a radio line with its speaker', () => {
      presentation.genericRadio('checkpoint');
      expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);
      expect(voice.plays[0].options).toMatchObject({
        kind: 'radio',
        speaker: GENERIC_RADIO.checkpoint.speaker,
      });
      expect(radioText()).toContain(GENERIC_RADIO.checkpoint.text.en);
    });

    it('holds a line while its voice speaks; the next line waits for the end', () => {
      presentation.genericRadio('checkpoint');
      presentation.genericRadio('escort-success');
      voice.start(6);

      step(5.9);
      expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);
      expect(radioText()).toContain(GENERIC_RADIO.checkpoint.text.en);

      voice.end();
      step(0.3);
      expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);
      step(1);
      expect(playedIds()).toEqual([
        GENERIC_RADIO.checkpoint.id,
        GENERIC_RADIO['escort-success'].id,
      ]);
      expect(radioText()).toContain(GENERIC_RADIO['escort-success'].text.en);
    });

    it('moves on at the reading pace when a line has no voice', async () => {
      presentation.genericRadio('checkpoint');
      presentation.genericRadio('escort-success');
      // 语音包里没有 / 音量 0 / 加载超时：配音系统回报没出声
      voice.stop();
      await settle();
      step(4);
      expect(playedIds()).toEqual([
        GENERIC_RADIO.checkpoint.id,
        GENERIC_RADIO['escort-success'].id,
      ]);
    });

    it.each(['missile-warning', 'civilian-hit'] as const)(
      'skips an urgent %s line while another line is being voiced (genericRadio → false)',
      async (key) => {
        presentation.genericRadio('checkpoint');
        voice.start(6);
        step(1);

        expect(presentation.genericRadio(key)).toBe(false);
        expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);
        expect(voice.currentId()).toBe(GENERIC_RADIO.checkpoint.id);
        expect(radioText()).toContain(GENERIC_RADIO.checkpoint.text.en);
        expect(radioText()).not.toContain(GENERIC_RADIO[key].text.en);

        // 跳过而不是排队：说完之后也不补播
        step(4.9);
        voice.end();
        await settle();
        step(10);
        expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);
        expect(presentation.isRadioBusy()).toBe(false);
      }
    );

    it('an urgent line still interrupts a line that is not being voiced (returns true)', () => {
      presentation.genericRadio('checkpoint');
      // 配音已请求但还没开口（加载中）：不算“正在配音”
      step(0.5);

      expect(presentation.genericRadio('missile-warning')).toBe(true);
      expect(playedIds()).toEqual([
        GENERIC_RADIO.checkpoint.id,
        GENERIC_RADIO['missile-warning'].id,
      ]);
      expect(radioText()).toContain(GENERIC_RADIO['missile-warning'].text.en);
    });

    it('an interrupted line replays with its voice at most once', async () => {
      const checkpoint = GENERIC_RADIO.checkpoint.id;
      const missile = GENERIC_RADIO['missile-warning'].id;
      const civilian = GENERIC_RADIO['civilian-hit'].id;
      presentation.genericRadio('checkpoint');
      step(0.5);
      expect(presentation.genericRadio('missile-warning')).toBe(true);
      await settle();
      voice.start(2);
      step(2.1);
      voice.end();
      // 告警句按阅读时间收尾，随后被打断的台词回来
      for (let elapsed = 0; playedIds().length < 3 && elapsed < 15; elapsed += 0.05) {
        step(0.05);
      }

      // 第一次被打断：重播，并重新配音
      expect(playedIds()).toEqual([checkpoint, missile, checkpoint]);
      expect(radioText()).toContain(GENERIC_RADIO.checkpoint.text.en);

      // 重播时又被打断（配音还没开口）：不再重播第二次
      step(0.3);
      expect(presentation.genericRadio('civilian-hit')).toBe(true);
      await settle();
      voice.start(2);
      step(2.1);
      voice.end();
      await settle();
      step(15);

      expect(playedIds()).toEqual([checkpoint, missile, checkpoint, civilian]);
      expect(presentation.isRadioBusy()).toBe(false);
    });

    it('low-health waits for the voiced line to end, then goes on the radio', async () => {
      const lowHealth = (seconds: number, dt = 0.05): void => {
        for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
          presentation.updatePlayerHealth(dt, 0.1, true);
          presentation.update(dt);
        }
      };
      presentation.genericRadio('checkpoint');
      voice.start(6);

      lowHealth(5);
      expect(playedIds(), 'not while the line is voiced').toEqual([GENERIC_RADIO.checkpoint.id]);

      voice.end();
      await settle();
      lowHealth(1);
      expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id, GENERIC_RADIO['low-health'].id]);
      expect(radioText()).toContain(GENERIC_RADIO['low-health'].text.en);
    });

    it('after a language switch the line on screen is redrawn and the queue moves on', async () => {
      presentation.genericRadio('checkpoint');
      presentation.genericRadio('escort-success');
      voice.start(3);
      step(1);

      setLocale('zh-CN');
      // VoiceSystem 在切换语言时停下正在说的台词（见 VoiceSystem 测试）
      voice.stop();
      await settle();
      expect(radioText()).toContain(GENERIC_RADIO.checkpoint.text.zh);
      expect(radioText()).not.toContain(GENERIC_RADIO.checkpoint.text.en);
      expect(playedIds()).toEqual([GENERIC_RADIO.checkpoint.id]);

      // 不再等配音：按“开口 + 时长 + 0.4 秒”收尾，下一句随即出现（新语言）
      step(3);
      expect(playedIds()).toEqual([
        GENERIC_RADIO.checkpoint.id,
        GENERIC_RADIO['escort-success'].id,
      ]);
      expect(radioText()).toContain(GENERIC_RADIO['escort-success'].text.zh);
    });

    it('estimates the radio backlog from the voice pack durations (boss outro watchdog)', () => {
      expect(presentation.getRadioBacklogSeconds()).toBe(0);
      voice.durations.set(GENERIC_RADIO.checkpoint.id, 7);
      voice.durations.set(GENERIC_RADIO['escort-success'].id, 9);
      presentation.genericRadio('checkpoint');
      presentation.genericRadio('escort-success');

      expect(presentation.getRadioBacklogSeconds()).toBeGreaterThanOrEqual(7 + 9);

      voice.start(7);
      step(7.2);
      voice.end();
      step(1);
      voice.start(9);
      step(9.2);
      voice.end();
      step(3);
      expect(presentation.isRadioBusy()).toBe(false);
      expect(presentation.getRadioBacklogSeconds()).toBe(0);
    });
  });

  describe('voice follows the game', () => {
    it('clearing the radio stops the radio voice', () => {
      presentation.genericRadio('checkpoint');
      voice.start(4);
      presentation.clearRadio();
      expect(voice.stops).toContain('radio');
      expect(voice.currentId()).toBeNull();
    });

    it('pausing and resuming the game pause and resume the voice', () => {
      presentation.onPause();
      expect(voice.pauseCount).toBe(1);
      presentation.onResume();
      expect(voice.resumeCount).toBe(1);
    });

    it('game over, mission complete and dispose stop every voice', () => {
      presentation.onGameOver();
      expect(voice.stopAllCount).toBe(1);
      presentation.onMissionComplete();
      expect(voice.stopAllCount).toBe(2);
      presentation.dispose();
      expect(voice.stopAllCount).toBe(3);
    });

    it('entering a chapter prefetches its voiced lines, the prologue first when it is shown', () => {
      presentation.showChapterIntro(
        1,
        { includePrologue: true, unlockLine: null },
        () => undefined
      );
      const chapterOne = getCampaignChapter(1);
      const first = voice.prefetches[0] ?? [];
      expect(first.slice(0, CAMPAIGN_PROLOGUE.length)).toEqual(
        CAMPAIGN_PROLOGUE.map((line) => line.id)
      );
      expect(first).toEqual(
        expect.arrayContaining([
          ...chapterOne.intro.map((line) => line.id),
          ...chapterOne.radio.map((line) => line.id),
        ])
      );

      presentation.showChapterIntro(
        4,
        { includePrologue: false, unlockLine: null },
        () => undefined
      );
      const fourth = voice.prefetches[1] ?? [];
      const chapterFour = getCampaignChapter(4);
      expect(fourth).toEqual(
        expect.arrayContaining([
          ...chapterFour.intro.map((line) => line.id),
          ...chapterFour.radio.map((line) => line.id),
        ])
      );
      for (const line of CAMPAIGN_PROLOGUE) {
        expect(fourth).not.toContain(line.id);
      }
    });

    it('narrates story cards through the voice, with Skydome as the narrator', async () => {
      vi.useFakeTimers();
      const onComplete = vi.fn();
      presentation.showChapterIntro(1, { includePrologue: true, unlockLine: null }, onComplete);
      await settle();
      vi.advanceTimersByTime(800);

      expect(playedIds()).toEqual([CAMPAIGN_PROLOGUE[0].id]);
      expect(voice.plays[0].options).toMatchObject({
        kind: 'narration',
        speaker: NARRATION_SPEAKER,
      });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(voice.stops).toContain('narration');
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('wingman events', () => {
    const CASES: ReadonlyArray<
      [id: WingmanId, event: WingmanEvent, airborne: WingmanId[], key: GenericRadioKey]
    > = [
      ['swift', 'joined', [], 'swift-joined'],
      ['raven', 'down', ['swift'], 'raven-down-swift'],
      ['raven', 'down', [], 'raven-down-hq'],
      ['swift', 'down', ['raven'], 'swift-down-raven'],
      ['swift', 'down', [], 'swift-down-hq'],
    ];

    it.each(CASES)('%s %s with %j airborne → %s', (id, event, airborne, key) => {
      airborne.forEach((wingman) => flying.add(wingman));
      presentation.onWingmanEvent(id, event);

      const line = GENERIC_RADIO[key];
      expect(playedIds()).toEqual([line.id]);
      expect(voice.plays[0].options.speaker).toBe(line.speaker);
      expect(radioText()).toContain(line.text.en);
      expect(radioText()).toContain(CAMPAIGN_SPEAKERS[line.speaker].callsign.en);
    });

    it('the wingman-down line is spoken by the other wingman, or Skydome when alone', () => {
      expect(GENERIC_RADIO['raven-down-swift'].speaker).toBe('wingman2');
      expect(GENERIC_RADIO['swift-down-raven'].speaker).toBe('wingman');
      expect(GENERIC_RADIO['raven-down-hq'].speaker).toBe('hq');
      expect(GENERIC_RADIO['swift-down-hq'].speaker).toBe('hq');
      expect(GENERIC_RADIO['swift-joined'].speaker).toBe('wingman2');
    });

    it('Raven has no join line (he flies from chapter 1; only Swift reports in)', () => {
      flying.add('swift');
      presentation.onWingmanEvent('raven', 'joined');
      expect(playedIds()).toEqual([]);
      expect(presentation.isRadioBusy()).toBe(false);
    });
  });
});
