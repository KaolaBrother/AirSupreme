import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD, type HudText } from '@/ui/HUD';
import { resetLocale } from './i18nTestUtils';

/**
 * HUD 可本地化文案（HudText = string | LocalizedText | { text, params }，终验修复 F3）：
 * showBriefing / showAutosave 三种写法都接受；显示中的简报横幅 / 存档提示在 setLocale 切换语言时
 * 立即按新语言重绘（暂停中游戏不调用 update 也一样）；纯字符串照旧原样显示。
 * 打磨批次 P：flashWarning / setBossStatus / showPowerUp 同样接受三种写法并在切换语言时重绘。
 */

const LEVEL: HudText = { text: { en: 'Level {level}', zh: '第{level}关' }, params: { level: 3 } };
const TITLE: LocalizedText = { en: 'Ice Storm', zh: '冰雪风暴' };
const PLAIN_LINE = 'Clear the pass · 7 targets';

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function textOf(id: string): string {
  return byId(id)?.textContent ?? '';
}

function isShown(element: HTMLElement | null): boolean {
  return element !== null && element.isConnected && element.style.display !== 'none';
}

describe('HUD localizable banner and toast text', () => {
  let hud: HUD;

  beforeEach(() => {
    document.body.innerHTML = '';
    hud = new HUD();
    hud.init();
  });

  afterEach(() => {
    hud.dispose();
    resetLocale();
    document.body.innerHTML = '';
  });

  describe('showBriefing', () => {
    function showBriefing(): void {
      hud.showBriefing({
        kicker: LEVEL,
        title: TITLE,
        line: PLAIN_LINE,
        tone: 'sys',
        durationMs: 4000,
      });
    }

    it('accepts a plain string, a bilingual text and a { text, params } entry', () => {
      showBriefing();
      const card = textOf('hud-briefing');
      expect(isShown(byId('hud-briefing'))).toBe(true);
      expect(card).toContain('Level 3');
      expect(card).toContain(TITLE.en);
      expect(card).toContain(PLAIN_LINE);
    });

    it('re-renders the visible banner when the language changes, even while paused', () => {
      showBriefing();
      // 暂停：不调用 hud.update()
      setLocale('zh-CN');
      let card = textOf('hud-briefing');
      expect(card).toContain('第3关');
      expect(card).toContain(TITLE.zh);
      expect(card).not.toContain(TITLE.en);
      expect(card, 'plain strings stay as they are').toContain(PLAIN_LINE);

      setLocale('en');
      card = textOf('hud-briefing');
      expect(card).toContain('Level 3');
      expect(card).toContain(TITLE.en);
    });

    it('a { text, params } entry with a plain-string text is formatted too', () => {
      hud.showBriefing({
        kicker: { text: 'Wave {wave}', params: { wave: 2 } },
        title: 'Boss',
        line: PLAIN_LINE,
        tone: 'threat',
        durationMs: 2000,
      });
      expect(textOf('hud-briefing')).toContain('Wave 2');
    });

    it('does not bring back a banner that has already gone', () => {
      showBriefing();
      for (let elapsed = 0; elapsed < 6; elapsed += 0.1) hud.update(0.1);
      expect(textOf('hud-briefing')).not.toContain(TITLE.en);

      setLocale('zh-CN');
      expect(textOf('hud-briefing')).not.toContain(TITLE.zh);
      expect(byId('hud-briefing')?.style.display).toBe('none');
    });
  });

  describe('showAutosave', () => {
    it.each<[string, HudText, string, string]>([
      [
        'a bilingual text',
        { en: 'Level 4 cleared', zh: '第4关完成' },
        'Level 4 cleared',
        '第4关完成',
      ],
      [
        'a { text, params } entry',
        {
          text: { en: 'Level {level} · Wave {wave}', zh: '第{level}关 · 第{wave}波' },
          params: { level: 6, wave: 3 },
        },
        'Level 6 · Wave 3',
        '第6关 · 第3波',
      ],
    ])('shows %s and re-renders it on a language switch while paused', (_label, label, en, zh) => {
      hud.showAutosave(label);
      const toast = byId('hud-autosave');
      expect(isShown(toast)).toBe(true);
      expect(toast?.textContent).toContain(en);

      setLocale('zh-CN');
      expect(toast?.textContent).toContain(zh);
      expect(toast?.textContent).not.toContain(en);

      setLocale('en');
      expect(toast?.textContent).toContain(en);
    });

    it('keeps a plain string label as it is', () => {
      hud.showAutosave('Checkpoint 7');
      setLocale('zh-CN');
      expect(textOf('hud-autosave')).toContain('Checkpoint 7');
    });
  });

  /** 三种写法的同一句话：纯字符串 / 双语对象 / { text, params } */
  const FORMS: ReadonlyArray<[label: string, text: HudText, en: string, zh: string]> = [
    ['a bilingual text', { en: 'Arc charging!', zh: '电弧充能！' }, 'Arc charging!', '电弧充能！'],
    [
      'a { text, params } entry',
      {
        text: { en: 'Civilian hit · -{points} pts', zh: '误伤平民 · 扣除 {points} 分' },
        params: { points: 250 },
      },
      'Civilian hit · -250 pts',
      '误伤平民 · 扣除 250 分',
    ],
  ];

  describe('flashWarning (polish batch P)', () => {
    const flash = (): string => textOf('hud-flash-warning');

    it.each(FORMS)(
      'shows %s and redraws it on a language switch while paused',
      (_l, text, en, zh) => {
        hud.flashWarning(text, 'threat');
        expect(isShown(byId('hud-flash-warning'))).toBe(true);
        expect(flash()).toContain(en);

        setLocale('zh-CN');
        expect(flash()).toContain(zh);
        expect(flash()).not.toContain(en);
        setLocale('en');
        expect(flash()).toContain(en);
      }
    );

    it('keeps a plain string as it is', () => {
      hud.flashWarning('Overheat', 'sys');
      setLocale('zh-CN');
      expect(flash()).toContain('Overheat');
    });

    it('does not bring back a warning that has gone', () => {
      hud.flashWarning(FORMS[0][1], 'threat');
      for (let elapsed = 0; elapsed < 5; elapsed += 0.1) hud.update(0.1);
      expect(isShown(byId('hud-flash-warning'))).toBe(false);
      setLocale('zh-CN');
      expect(isShown(byId('hud-flash-warning'))).toBe(false);
    });
  });

  describe('setBossStatus (polish batch P)', () => {
    const status = (): string => textOf('hud-boss-status');

    it.each(FORMS)(
      'shows %s and redraws it on a language switch while paused',
      (_l, text, en, zh) => {
        hud.setBossStatus(text, { current: 2, total: 3 });
        expect(isShown(byId('hud-boss-status'))).toBe(true);
        expect(status()).toContain(en);

        setLocale('zh-CN');
        expect(status()).toContain(zh);
        expect(status()).not.toContain(en);
        setLocale('en');
        expect(status()).toContain(en);
      }
    );

    it('keeps a plain string label as it is', () => {
      hud.setBossStatus('Core exposed', { current: 1, total: 3 });
      setLocale('zh-CN');
      expect(status()).toContain('Core exposed');
    });

    it('stays hidden after null, whatever the language does', () => {
      hud.setBossStatus(FORMS[0][1], { current: 1, total: 2 });
      hud.setBossStatus(null);
      setLocale('zh-CN');
      expect(isShown(byId('hud-boss-status'))).toBe(false);
      expect(status()).not.toContain(FORMS[0][3]);
    });
  });

  describe('showPowerUp (polish batch P)', () => {
    const timer = (): string => textOf('hud-powerup-timer');

    it.each(FORMS)('shows %s in the countdown and redraws it while paused', (_l, text, en, zh) => {
      hud.showPowerUp(text, '🛡️', 10);
      expect(timer()).toContain(en);
      expect(timer()).toContain('10');

      setLocale('zh-CN');
      expect(timer()).toContain(zh);
      expect(timer()).not.toContain(en);
      expect(timer(), 'the countdown is kept').toContain('10');
      setLocale('en');
      expect(timer()).toContain(en);
    });

    it('keeps a plain string name as it is', () => {
      hud.showPowerUp('Shield', '🛡️', 8);
      setLocale('zh-CN');
      expect(timer()).toContain('Shield');
    });

    it('a power-up that has run out is not brought back by a language switch', () => {
      hud.showPowerUp({ en: 'Damage boost', zh: '火力增强' }, '⚡', 2);
      for (let elapsed = 0; elapsed < 4; elapsed += 0.1) hud.update(0.1);
      setLocale('zh-CN');
      expect(timer()).not.toContain('火力增强');
    });
  });

  describe('showPowerUpBig (polish batch Q)', () => {
    const callout = (): string => textOf('hud-callout');
    const subtitle = (): string =>
      document.querySelector('#hud-callout .hud-callout-sub')?.textContent ?? '';
    const visible = (): boolean => byId('hud-callout')?.style.opacity === '1';

    it.each(FORMS)(
      'shows %s and redraws it on a language switch while paused',
      (_l, text, en, zh) => {
        hud.showPowerUpBig('📡', text, 2);
        expect(visible()).toBe(true);
        expect(callout()).toContain(en);

        setLocale('zh-CN');
        expect(callout()).toContain(zh);
        expect(callout()).not.toContain(en);
        setLocale('en');
        expect(callout()).toContain(en);
      }
    );

    it('keeps a plain string as it is', () => {
      hud.showPowerUpBig('📡', 'Bandits ahead', 2);
      expect(callout()).toContain('Bandits ahead');
      setLocale('zh-CN');
      expect(callout()).toContain('Bandits ahead');
    });

    it('a language switch neither replays nor extends the callout', () => {
      hud.showPowerUpBig('📡', FORMS[0][1], 1);
      hud.update(0.6);
      setLocale('zh-CN');
      expect(visible()).toBe(true);
      expect(callout()).toContain(FORMS[0][3]);
      hud.update(0.5);
      expect(visible(), 'gone on its original schedule').toBe(false);
    });

    it('does not bring back a callout that has gone', () => {
      hud.showPowerUpBig('📡', FORMS[0][1], 1);
      hud.update(1.5);
      expect(visible()).toBe(false);
      setLocale('zh-CN');
      expect(visible()).toBe(false);
    });

    it("relabels a power-up callout's name and its POWER-UP! subtitle", () => {
      hud.showPowerUpBig('🛡️', { en: 'Shield', zh: '护盾' }, 2, false, 'powerup');
      expect(callout()).toContain('Shield');
      expect(subtitle()).toBe('POWER-UP!');

      setLocale('zh-CN');
      expect(callout()).toContain('护盾');
      expect(subtitle()).toBe('获得道具！');
    });

    it('a callout queued behind a briefing shows in the language of the moment it appears', () => {
      hud.showBriefing({ kicker: 'K', title: 'T', line: 'L', tone: 'sys', durationMs: 1000 });
      hud.showPowerUpBig('📡', FORMS[1][1], 2);
      expect(visible(), 'held while the briefing is up').toBe(false);

      setLocale('zh-CN');
      hud.update(1.1);
      expect(visible()).toBe(true);
      expect(callout()).toContain(FORMS[1][3]);
      setLocale('en');
      expect(callout()).toContain(FORMS[1][2]);
    });
  });
});
