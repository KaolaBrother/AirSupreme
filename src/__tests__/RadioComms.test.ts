import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  type CampaignSpeakerId,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { setLocale, type LocalizedText } from '@/i18n';
import { RadioComms } from '@/ui/RadioComms';
import { LOCALES, resetLocale, textIn } from './i18nTestUtils';

/**
 * api-spec §9 RadioComms + integration-notes「Story UI + HUD」：
 * 说话人由 CAMPAIGN_SPEAKERS 解析；空闲时立即显示（同步 onLineShown）；普通台词先进先出；
 * 高优先级立即打断，被打断的台词重播；高优先级之间按序排在普通台词前；重复文本忽略；
 * 等待队列上限 6；计时只由 update(dt) 驱动；isBusy / clear / dispose。
 * 台词与呼号按当前界面语言显示（英文默认）。
 */

const SPEAKER_IDS = Object.keys(CAMPAIGN_SPEAKERS) as CampaignSpeakerId[];
let lineCount = 0;

/** 测试台词：两种语言同一文本（队列逻辑与语言无关），或传入独立的中文 */
function line(text: string, speaker: CampaignSpeakerId = 'hq', zh: string = text): RadioLine {
  lineCount += 1;
  const localized: LocalizedText = { en: text, zh };
  return { id: `test-line-${lineCount}`, trigger: 'wave-start', speaker, text: localized };
}

function panel(): HTMLElement | null {
  return document.getElementById('radio-comms');
}

function panelShown(): boolean {
  const root = panel();
  return root !== null && root.isConnected && root.style.display !== 'none';
}

function panelText(): string {
  return panel()?.textContent ?? '';
}

/** 逐帧推进直到空闲（上限 maxSeconds） */
function drain(radio: RadioComms, maxSeconds = 300, dt = 0.1): void {
  for (let elapsed = 0; radio.isBusy() && elapsed < maxSeconds; elapsed += dt) {
    radio.update(dt);
  }
}

describe('RadioComms (§9)', () => {
  let radio: RadioComms;
  let shown: RadioLine[];

  beforeEach(() => {
    document.body.innerHTML = '';
    radio = new RadioComms();
    shown = [];
    radio.onLineShown = (shownLine) => {
      shown.push(shownLine);
    };
  });

  afterEach(() => {
    radio.dispose();
    resetLocale();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a line immediately when idle and reports it synchronously', () => {
    const first = line('Falcon, you are cleared for takeoff.', 'hq', '猎鹰，起飞许可已下达。');
    expect(radio.isBusy()).toBe(false);
    radio.enqueue(first);
    expect(shown).toEqual([first]);
    expect(shown[0]).toBe(first);
    expect(radio.isBusy()).toBe(true);
    expect(panelShown()).toBe(true);
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS.hq.callsign.en);
    expect(panelText()).toContain(first.text.en);
  });

  it.each(LOCALES)('shows the callsign and line in the interface language (%s)', (locale) => {
    setLocale(locale);
    const first = line(
      'Falcon, you are cleared for takeoff.',
      'wingman2',
      '猎鹰，起飞许可已下达。'
    );
    radio.enqueue(first);
    expect(panelText()).toContain(textIn(CAMPAIGN_SPEAKERS.wingman2.callsign, locale));
    expect(panelText()).toContain(textIn(first.text, locale));
    const other = locale === 'en' ? first.text.zh : first.text.en;
    expect(panelText()).not.toContain(other);
  });

  it.each(SPEAKER_IDS)('resolves the %s speaker through CAMPAIGN_SPEAKERS', (speaker) => {
    radio.enqueue(line(`Test line: ${speaker}`, speaker));
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS[speaker].callsign.en);
    radio.clear();
    setLocale('zh-CN');
    radio.enqueue(line(`测试台词：${speaker}`, speaker));
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS[speaker].callsign.zh);
  });

  it('still shows a line from an unknown speaker id', () => {
    const odd = {
      id: 'test-ghost',
      trigger: 'wave-start',
      speaker: 'ghost',
      text: { en: 'Signal on an unknown channel.', zh: '未知频道的信号。' },
    };
    expect(() => radio.enqueue(odd as unknown as RadioLine)).not.toThrow();
    expect(shown).toHaveLength(1);
    expect(panelText()).toContain('Signal on an unknown channel.');
  });

  it('plays normal lines first-in first-out', () => {
    const lines = [line('第一句。'), line('第二句。', 'wingman'), line('第三句。', 'scientist')];
    for (const entry of lines) {
      radio.enqueue(entry);
    }
    expect(shown).toEqual([lines[0]]);
    drain(radio);
    expect(shown).toEqual(lines);
    expect(radio.isBusy()).toBe(false);
    expect(panelShown()).toBe(false);
  });

  it('times lines only from update(dt), never from wall-clock timers', () => {
    vi.useFakeTimers();
    radio.enqueue(line('第一句。'));
    radio.enqueue(line('第二句。'));
    vi.advanceTimersByTime(120_000);
    expect(shown).toHaveLength(1);
    expect(radio.isBusy()).toBe(true);

    for (const dt of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      radio.update(dt);
    }
    expect(shown).toHaveLength(1);

    for (let elapsed = 0; elapsed < 1; elapsed += 0.05) {
      radio.update(0.05);
    }
    expect(shown, 'a line stays up for at least a second').toHaveLength(1);
    drain(radio);
    expect(shown).toHaveLength(2);
  });

  it('drains several lines in order from one long update', () => {
    const lines = [line('甲。'), line('乙。'), line('丙。')];
    lines.forEach((entry) => radio.enqueue(entry));
    radio.update(120);
    expect(shown).toEqual(lines);
    expect(radio.isBusy()).toBe(false);
  });

  it('lets a high-priority line interrupt a normal line, which then replays', () => {
    const normal = line('正在通报第一波目标的分布情况。');
    const urgent = GENERIC_RADIO['missile-warning'];
    radio.enqueue(normal);
    radio.update(0.1);
    radio.enqueue(urgent, { priority: 'high' });
    expect(shown).toEqual([normal, urgent]);
    expect(panelText()).toContain(urgent.text.en);
    drain(radio);
    expect(shown).toEqual([normal, urgent, normal]);
  });

  it('queues high-priority lines in order, ahead of every normal line', () => {
    const first = line('普通一。');
    const high1 = line('紧急一！', 'wingman');
    const normal2 = line('普通二。');
    const high2 = line('紧急二！', 'wingman');
    radio.enqueue(first);
    radio.enqueue(high1, { priority: 'high' });
    radio.enqueue(normal2);
    radio.enqueue(high2, { priority: 'high' });
    expect(shown).toEqual([first, high1]);
    drain(radio);
    expect(shown).toEqual([first, high1, high2, first, normal2]);
  });

  it('ignores duplicates of the current or a queued line but allows a later repeat', () => {
    const a = line('重复测试甲。');
    const b = line('重复测试乙。');
    radio.enqueue(a);
    radio.enqueue(a);
    radio.enqueue({ ...a });
    radio.enqueue(b);
    radio.enqueue(b, { priority: 'normal' });
    drain(radio);
    radio.update(1);
    expect(shown).toEqual([a, b]);

    radio.enqueue(a);
    expect(shown).toEqual([a, b, a]);
  });

  /**
   * integration-notes「idle → line shows immediately (synchronous onLineShown)」：
   * 两句之间的短暂间隔也算忙碌（a1e2424），所以 isBusy() 为 false 时 enqueue 必须同步显示。
   */
  it('shows a line synchronously whenever isBusy() reports idle', () => {
    const first = line('第一句。');
    radio.enqueue(first);
    for (let elapsed = 0; radio.isBusy() && elapsed < 60; elapsed += 0.05) {
      radio.update(0.05);
    }
    expect(radio.isBusy()).toBe(false);

    const next = line('第二句。');
    radio.enqueue(next);
    expect(shown).toEqual([first, next]);
  });

  it('keeps at most six waiting lines, dropping the oldest normal ones', () => {
    const lines = Array.from({ length: 11 }, (_, index) => line(`队列测试第${index}句。`));
    lines.forEach((entry) => radio.enqueue(entry));
    drain(radio);
    expect(shown).toHaveLength(7);
    expect(shown).toEqual([lines[0], ...lines.slice(5)]);
  });

  it('never drops a queued high-priority line to make room for normal ones', () => {
    const current = line('紧急正在播报！');
    const waiting = line('紧急排队中！', 'wingman');
    radio.enqueue(current, { priority: 'high' });
    radio.enqueue(waiting, { priority: 'high' });
    for (let index = 0; index < 10; index += 1) {
      radio.enqueue(line(`填充第${index}句。`));
    }
    drain(radio);
    expect(shown.slice(0, 2)).toEqual([current, waiting]);
    expect(shown.length).toBeLessThanOrEqual(8);
  });

  it('clear() empties the queue, hides the panel and stays quiet', () => {
    radio.enqueue(line('将被清空一。'));
    radio.enqueue(line('将被清空二。'));
    radio.clear();
    expect(radio.isBusy()).toBe(false);
    expect(panelShown()).toBe(false);
    drain(radio);
    radio.update(30);
    expect(shown).toHaveLength(1);

    radio.enqueue(line('清空后的新台词。'));
    expect(shown).toHaveLength(2);
    expect(panelShown()).toBe(true);
  });

  it('dispose() removes the panel and ignores later calls', () => {
    radio.enqueue(line('最后一句。'));
    expect(panel()).not.toBeNull();
    radio.dispose();
    expect(panel()).toBeNull();
    expect(radio.isBusy()).toBe(false);
    expect(() => {
      radio.enqueue(line('销毁之后。'));
      radio.update(1);
      radio.clear();
    }).not.toThrow();
    expect(shown).toHaveLength(1);
    expect(panel()).toBeNull();
  });
});

/**
 * 配音时序（表现层在 onLineShown 里播放配音，开口时 holdForVoice，说完 / 没出声时 releaseVoice）：
 * 台词停留 max(阅读时间, 开口时刻 + 配音时长 + 0.4 秒)；配音没说完前下一句等待
 * （兜底：开口 + 时长 + 0.4 + 2.5 秒）；被打断时配音没说完的台词一定重播（于是再配一次音），
 * 已说完的算已传达；切换语言时当前台词按新语言重写、不重播。
 */
describe('RadioComms voice timing', () => {
  let radio: RadioComms;
  let shown: RadioLine[];
  let clock: number;

  const SHORT = { en: 'Copy that.', zh: '收到。' };
  const NEXT = { en: 'Next line.', zh: '下一句。' };
  const LONG = 'This is a much longer radio line that takes quite a while to read on screen.';

  function advanceTo(target: number, dt = 0.05): void {
    while (clock < target - 1e-9) {
      const step = Math.min(dt, target - clock);
      radio.update(step);
      clock += step;
    }
  }

  /** 面板阶段：reveal 逐字、hold 停留、out 淡出、idle 空闲 */
  function phase(): string | null {
    return panel()?.getAttribute('data-phase') ?? null;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    radio = new RadioComms();
    shown = [];
    clock = 0;
    radio.onLineShown = (shownLine) => {
      shown.push(shownLine);
    };
  });

  afterEach(() => {
    radio.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  it('keeps a short line up until 0.4 s after a longer voice ends; the next line waits', () => {
    const first = line(SHORT.en, 'wingman2', SHORT.zh);
    const next = line(NEXT.en, 'hq', NEXT.zh);
    radio.enqueue(first);
    radio.enqueue(next);
    advanceTo(0.1);
    radio.holdForVoice(first, 8);

    advanceTo(8.05);
    expect(shown, 'reading time is long over, the voice is still speaking').toEqual([first]);
    expect(phase()).toBe('hold');
    // 配音在 0.1 + 8 = 8.1 秒说完：台词停到 8.5 秒
    radio.releaseVoice(first);
    advanceTo(8.45);
    expect(phase()).toBe('hold');
    expect(panelText()).toContain(SHORT.en);
    advanceTo(8.6);
    expect(phase()).not.toBe('hold');
    expect(shown).toEqual([first]);

    advanceTo(9.5);
    expect(shown).toEqual([first, next]);
  });

  it('waits for a voice that runs past its expected length', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const next = line(NEXT.en, 'hq', NEXT.zh);
    radio.enqueue(first);
    radio.enqueue(next);
    radio.holdForVoice(first, 4);

    advanceTo(5.5);
    expect(shown, 'the voice is still speaking at 5.5 s').toEqual([first]);
    expect(phase()).toBe('hold');
    radio.releaseVoice(first);
    advanceTo(5.85);
    expect(phase()).toBe('hold');
    advanceTo(6);
    expect(phase()).not.toBe('hold');
    advanceTo(6.8);
    expect(shown).toEqual([first, next]);
  });

  it('moves on without an end report 2.5 s after the voice should have ended', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const next = line(NEXT.en, 'hq', NEXT.zh);
    radio.enqueue(first);
    radio.enqueue(next);
    radio.holdForVoice(first, 2);

    // 兜底：0 + 2 + 0.4 + 2.5 = 4.9 秒
    advanceTo(4.8);
    expect(phase()).toBe('hold');
    advanceTo(5);
    expect(phase()).not.toBe('hold');
    advanceTo(5.6);
    expect(shown).toEqual([first, next]);
  });

  it('keeps a long line up for its full reading time when the voice is short', () => {
    const long = line(LONG, 'hq', LONG);
    const next = line(NEXT.en, 'hq', NEXT.zh);
    radio.enqueue(long);
    radio.enqueue(next);
    advanceTo(0.1);
    radio.holdForVoice(long, 1);
    advanceTo(1.1);
    radio.releaseVoice(long);

    advanceTo(8);
    expect(shown, 'still reading the long line').toEqual([long]);
    advanceTo(9.2);
    expect(shown).toEqual([long, next]);
  });

  it('ignores voice reports for a line that is no longer on screen', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const next = line(NEXT.en, 'hq', NEXT.zh);
    radio.enqueue(first);
    radio.enqueue(next);
    advanceTo(3.5);
    expect(shown).toEqual([first, next]);

    radio.holdForVoice(first, 30);
    advanceTo(7);
    expect(radio.isBusy()).toBe(false);
    expect(() => radio.releaseVoice(first)).not.toThrow();
  });

  it('replays a line interrupted while its voice is speaking, so it is voiced again', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const urgent = GENERIC_RADIO['missile-warning'];
    radio.enqueue(first);
    advanceTo(0.1);
    radio.holdForVoice(first, 6);
    // 已停留了大半（按纯文字规则算已传达），但配音还有 1 秒才说完
    advanceTo(5);

    radio.enqueue(urgent, { priority: 'high' });
    expect(shown).toEqual([first, urgent]);
    drain(radio);
    expect(shown).toEqual([first, urgent, first]);
  });

  it('does not replay an interrupted line whose voice had finished', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const urgent = GENERIC_RADIO['missile-warning'];
    radio.enqueue(first);
    advanceTo(0.1);
    radio.holdForVoice(first, 0.8);
    advanceTo(0.9);
    radio.releaseVoice(first);
    advanceTo(1);

    radio.enqueue(urgent, { priority: 'high' });
    drain(radio);
    expect(shown).toEqual([first, urgent]);
  });

  it('without a voice an interrupted line is replayed only if it was not yet read', () => {
    const first = line(SHORT.en, 'hq', SHORT.zh);
    const urgent = GENERIC_RADIO['missile-warning'];
    radio.enqueue(first);
    advanceTo(3);
    radio.enqueue(urgent, { priority: 'high' });
    drain(radio);
    expect(shown).toEqual([first, urgent]);
  });

  it('redraws the current line in the new language without replaying it', () => {
    const first = line(
      'Falcon, you are cleared for takeoff.',
      'wingman2',
      '猎鹰，起飞许可已下达。'
    );
    radio.enqueue(first);
    advanceTo(0.2);
    radio.holdForVoice(first, 3);

    setLocale('zh-CN');
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS.wingman2.callsign.zh);
    expect(panelText()).toContain('猎鹰，起飞许可已下达。');
    expect(panelText()).not.toContain('cleared for takeoff');
    expect(shown).toEqual([first]);

    // 切换语言时配音被停下（VoiceSystem）：表现层随即 releaseVoice，台词照常收尾
    radio.releaseVoice(first);
    setLocale('en');
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS.wingman2.callsign.en);
    expect(panelText()).toContain('Falcon, you are cleared for takeoff.');
    drain(radio);
    expect(shown).toEqual([first]);
    expect(radio.isBusy()).toBe(false);
  });
});
