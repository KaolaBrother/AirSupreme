import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameConfig } from '@/config';
import { InputHandler } from '@/core/Input/InputHandler';
import { saveStartFlowSettings } from '@/core/SessionSettings';
import type { Locale, LocalizedText } from '@/i18n';
import { LOCALES, textIn } from './i18nTestUtils';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'index.html');

function readShippedIndexHtml(): string {
  return readFileSync(INDEX_HTML_PATH, 'utf8');
}

function parseShippedDocument(): Document {
  return new DOMParser().parseFromString(readShippedIndexHtml(), 'text/html');
}

function isIconRel(rel: string): boolean {
  return rel
    .trim()
    .split(/\s+/)
    .some((token) => token.toLowerCase() === 'icon');
}

function iconLinksOf(doc: Document): HTMLLinkElement[] {
  return Array.from(doc.querySelectorAll('link')).filter((link) =>
    isIconRel(link.getAttribute('rel') ?? '')
  );
}

function isLocalFileHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }
  if (/^(?:data|javascript|blob|mailto):/i.test(trimmed)) {
    return false;
  }
  return !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed);
}

function hrefPathname(href: string): string {
  return href.trim().split(/[?#]/)[0];
}

function iconFileCandidates(href: string): string[] {
  const pathname = hrefPathname(href);
  const relative = pathname.replace(/^\.\//, '').replace(/^\/+/, '');
  const root = path.resolve(PROJECT_ROOT);
  const fromPublic = path.resolve(PROJECT_ROOT, 'public', relative);
  const fromRoot = path.resolve(PROJECT_ROOT, relative);
  const inRoot = (candidate: string): boolean =>
    candidate === root || candidate.startsWith(`${root}${path.sep}`);
  const ordered = pathname.startsWith('/') ? [fromPublic, fromRoot] : [fromRoot, fromPublic];
  return [...new Set(ordered.filter(inRoot))];
}

/** 页面外壳文案：index.html 写英文默认值，main.ts 按语言设置改写 */
const SHELL_COPY = {
  title: { en: 'Air Supreme - 3D Air Combat', zh: 'Air Supreme - 3D 空战游戏' },
  pause: { en: 'PAUSE', zh: '暂停' },
  pauseLabel: { en: 'Pause', zh: '暂停' },
  fire: { en: 'FIRE', zh: '开火' },
  loadFailed: { en: 'Failed to load', zh: '加载失败' },
} satisfies Record<string, LocalizedText>;

function resolveShippedIconFile(href: string): string | null {
  if (!isLocalFileHref(href)) {
    return null;
  }
  for (const candidate of iconFileCandidates(href)) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

describe('site chrome', () => {
  it('declares a site icon via <link rel="icon"> with a file href', () => {
    const links = iconLinksOf(parseShippedDocument());
    expect(links.length, 'expected <link rel="icon"> in shipped index.html').toBeGreaterThan(0);

    const localHref = links
      .map((link) => (link.getAttribute('href') ?? '').trim())
      .find((href) => isLocalFileHref(href));

    expect(
      localHref,
      'icon link href should point at a shipped file path (not empty, data, or remote)'
    ).toBeTruthy();
  });

  it('ships a non-empty icon file at the href named by the icon link', () => {
    const links = iconLinksOf(parseShippedDocument());
    expect(links.length, 'expected <link rel="icon"> so its href can be resolved').toBeGreaterThan(
      0
    );

    const parsed = links.map((link) => (link.getAttribute('href') ?? '').trim());
    const resolved = parsed
      .map((href) => ({ href, filePath: resolveShippedIconFile(href) }))
      .find((entry) => entry.filePath);

    expect(
      resolved?.filePath,
      `icon href must name an existing file under the project (parsed hrefs: ${parsed.join(', ')})`
    ).toBeTruthy();

    const iconPath = resolved?.filePath ?? '';
    const iconBytes = readFileSync(iconPath);
    expect(statSync(iconPath).isFile(), `${iconPath} should be a file`).toBe(true);
    expect(iconBytes.length, `${iconPath} should be non-empty`).toBeGreaterThan(0);
  });

  it('includes viewport-fit=cover on the viewport meta tag', () => {
    const viewport = Array.from(parseShippedDocument().querySelectorAll('meta')).find(
      (meta) => (meta.getAttribute('name') ?? '').toLowerCase() === 'viewport'
    );

    expect(viewport, 'expected a <meta name="viewport"> in shipped index.html').toBeTruthy();
    const content = viewport?.getAttribute('content') ?? '';
    expect(content, `viewport content should include viewport-fit=cover, got "${content}"`).toMatch(
      /viewport-fit\s*=\s*cover/i
    );
  });

  it('does not decorate the loading-screen title with ✈️', () => {
    const loading = parseShippedDocument().getElementById('loading-screen');
    expect(loading, 'expected #loading-screen in shipped index.html').toBeTruthy();

    const title = loading?.querySelector('h1');
    expect(title, 'expected a loading-screen title').toBeTruthy();
    expect(title?.textContent ?? '', 'loading title should not use ✈️').not.toMatch(/✈️|✈/u);
  });

  it('ships the page in English: <html lang="en"> and a PAUSE mobile pause control', () => {
    const shipped = parseShippedDocument();
    expect(shipped.documentElement.getAttribute('lang')).toBe('en');

    const pause = shipped.getElementById('upgrade-button');
    expect(pause, 'expected #upgrade-button as the mobile pause control').toBeTruthy();
    expect((pause?.textContent ?? '').trim()).toBe(SHELL_COPY.pause.en);
    expect(pause?.getAttribute('aria-label')).toBe(SHELL_COPY.pauseLabel.en);
  });

  it('does not show .mobile-controls through a pointer:coarse CSS branch', () => {
    const html = readShippedIndexHtml();
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
    expect(styles.length, 'expected a shipped <style> block').toBeGreaterThan(0);
    expect(styles.join('\n')).not.toMatch(/(?:any-)?pointer\s*:\s*coarse/i);
  });
});

function seedMobileControls(): HTMLElement {
  const shipped = parseShippedDocument().getElementById('mobile-controls');
  expect(shipped, 'expected #mobile-controls in shipped index.html').toBeTruthy();
  document.body.innerHTML = (shipped as HTMLElement).outerHTML;
  const controls = document.getElementById('mobile-controls');
  expect(controls, 'expected #mobile-controls in the test document').toBeTruthy();
  return controls as HTMLElement;
}

function isDisplayed(element: HTMLElement): boolean {
  if (element.hidden || element.classList.contains('hidden')) {
    return false;
  }
  const inline = element.style.display.trim();
  if (inline) {
    return inline !== 'none';
  }
  const computed = getComputedStyle(element).display;
  return computed !== 'none' && computed !== '';
}

describe('mobile-controls visibility', () => {
  let originalIsMobile: boolean;
  let handler: InputHandler | null;

  beforeEach(() => {
    originalIsMobile = GameConfig.isMobile;
    handler = null;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    handler?.dispose();
    handler = null;
    GameConfig.isMobile = originalIsMobile;
    document.body.innerHTML = '';
  });

  it('shows #mobile-controls when GameConfig.isMobile is true', () => {
    const controls = seedMobileControls();
    controls.style.display = 'none';
    GameConfig.isMobile = true;
    handler = new InputHandler();

    expect(
      isDisplayed(controls),
      'mobile-controls display should follow GameConfig.isMobile=true'
    ).toBe(true);
  });

  it('hides #mobile-controls when GameConfig.isMobile is false', () => {
    const controls = seedMobileControls();
    controls.style.display = 'flex';
    GameConfig.isMobile = false;
    handler = new InputHandler();

    expect(
      isDisplayed(controls),
      'mobile-controls display should follow GameConfig.isMobile=false, not a pointer:coarse CSS branch'
    ).toBe(false);
  });
});

/**
 * main.ts 启动时先按保存的语言设置 setLocale，再改写页面外壳文案（标题、触控按键、加载 / 报错画面），
 * 之后语言切换时实时改写。jsdom 没有 WebGL：入口在 WebGL 检查处报错返回，外壳此时已本地化。
 */
describe('page shell language (main.ts)', () => {
  type I18nModule = typeof import('@/i18n');
  let originalTitle: string;
  let originalLang: string | null;

  beforeEach(() => {
    originalTitle = document.title;
    originalLang = document.documentElement.getAttribute('lang');
    window.localStorage.clear();
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const shipped = parseShippedDocument();
    document.title = shipped.title;
    document.documentElement.setAttribute('lang', shipped.documentElement.lang);
    document.body.innerHTML = shipped.body.innerHTML;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.body.innerHTML = '';
    document.title = originalTitle;
    if (originalLang === null) {
      document.documentElement.removeAttribute('lang');
    } else {
      document.documentElement.setAttribute('lang', originalLang);
    }
  });

  /** 载入入口模块（同步跑到 WebGL 检查），返回它所用的 i18n 实例 */
  async function bootShell(): Promise<I18nModule> {
    await import('@/main');
    return import('@/i18n');
  }

  function expectShellIn(locale: Locale): void {
    expect(document.documentElement.getAttribute('lang')).toBe(locale);
    expect(document.title).toBe(textIn(SHELL_COPY.title, locale));
    const pause = document.getElementById('upgrade-button');
    expect((pause?.textContent ?? '').trim()).toBe(textIn(SHELL_COPY.pause, locale));
    expect(pause?.getAttribute('aria-label')).toBe(textIn(SHELL_COPY.pauseLabel, locale));
    expect((document.getElementById('fire-button')?.textContent ?? '').trim()).toBe(
      textIn(SHELL_COPY.fire, locale)
    );
  }

  it('boots the shell in English when no language was ever saved', async () => {
    const i18n = await bootShell();
    expect(i18n.getLocale()).toBe('en');
    expectShellIn('en');
  });

  it.each(LOCALES)('applies the saved language (%s) before anything renders', async (locale) => {
    saveStartFlowSettings({ language: locale });
    const i18n = await bootShell();
    expect(i18n.getLocale()).toBe(locale);
    expectShellIn(locale);
    // 之后渲染的报错画面也用同一语言（批次 X5：报错画面不再带 ⚠️ 等表情符号）
    const heading = document.querySelector('#loading-screen h1');
    expect(heading?.textContent).toBe(textIn(SHELL_COPY.loadFailed, locale));
    expect(document.getElementById('loading-screen')?.textContent ?? '').not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });

  it('relabels the shell live when the language changes', async () => {
    const i18n = await bootShell();
    expectShellIn('en');

    i18n.setLocale('zh-CN');
    expectShellIn('zh-CN');

    i18n.setLocale('en');
    expectShellIn('en');
  });
});
