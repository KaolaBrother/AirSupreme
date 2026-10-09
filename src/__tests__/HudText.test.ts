import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale, type LocalizedText } from '@/i18n';
import { HUD, type HudText } from '@/ui/HUD';
import { resetLocale } from './i18nTestUtils';

/**
 * HUD 可本地化文案（HudText = string | LocalizedText | { text, params }，终验修复 F3）：
 * showBriefing / showAutosave 三种写法都接受；显示中的简报横幅 / 存档提示在 setLocale 切换语言时
 * 立即按新语言重绘（暂停中游戏不调用 update 也一样）；纯字符串照旧原样显示。
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
});
