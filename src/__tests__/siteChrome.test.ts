import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

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
});
