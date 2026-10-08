import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  type CampaignSpeakerId,
  type RadioLine,
} from '@/features/campaign/CampaignData';
import { RadioComms } from '@/ui/RadioComms';

/**
 * api-spec §9 RadioComms + integration-notes「Story UI + HUD」：
 * 说话人由 CAMPAIGN_SPEAKERS 解析；空闲时立即显示（同步 onLineShown）；普通台词先进先出；
 * 高优先级立即打断，被打断的台词重播；高优先级之间按序排在普通台词前；重复文本忽略；
 * 等待队列上限 6；计时只由 update(dt) 驱动；isBusy / clear / dispose。
 */

const SPEAKER_IDS = Object.keys(CAMPAIGN_SPEAKERS) as CampaignSpeakerId[];

function line(text: string, speaker: CampaignSpeakerId = 'hq'): RadioLine {
  return { trigger: 'wave-start', speaker, text };
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
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a line immediately when idle and reports it synchronously', () => {
    const first = line('猎鹰，起飞许可已下达。');
    expect(radio.isBusy()).toBe(false);
    radio.enqueue(first);
    expect(shown).toEqual([first]);
    expect(shown[0]).toBe(first);
    expect(radio.isBusy()).toBe(true);
    expect(panelShown()).toBe(true);
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS.hq.callsign);
    expect(panelText()).toContain(first.text);
  });

  it.each(SPEAKER_IDS)('resolves the %s speaker through CAMPAIGN_SPEAKERS', (speaker) => {
    radio.enqueue(line(`测试台词：${speaker}`, speaker));
    expect(panelText()).toContain(CAMPAIGN_SPEAKERS[speaker].callsign);
  });

  it('still shows a line from an unknown speaker id', () => {
    const odd = { trigger: 'wave-start', speaker: 'ghost', text: '未知频道的信号。' };
    expect(() => radio.enqueue(odd as unknown as RadioLine)).not.toThrow();
    expect(shown).toHaveLength(1);
    expect(panelText()).toContain('未知频道的信号。');
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
    expect(panelText()).toContain(urgent.text);
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
   * 与 integration-notes「idle → line shows immediately (synchronous onLineShown)」不符：
   * 一句播完后的约 0.18 s 间隔里 isBusy() 已经返回 false，但 enqueue 只排队、不同步显示
   * （RadioComms.enqueue 检查 gap，isBusy() 不看 gap）。
   */
  it.fails('shows a line synchronously whenever isBusy() reports idle', () => {
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
