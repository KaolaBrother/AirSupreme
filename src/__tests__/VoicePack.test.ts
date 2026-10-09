import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { getVoiceScript } from '@/features/campaign/CampaignData';

/**
 * 语音包（public/voice/manifest.json + public/voice/{en,zh}/<id>.mp3）与配音脚本一致：
 * - 除了五句新的僚机事件台词（尚未录制），getVoiceScript() 的每个 id 在 en 与 zh 包里都有条目；
 * - 清单里的每个 id 都在脚本里（没有孤儿录音）；
 * - 每个条目都有正的时长，对应的 mp3 文件存在且大小与清单一致；包里没有清单外的文件。
 * VoiceSystem 只请求清单里的 id，所以清单缺一句 = 这句纯文字；清单多一句 = 永远不会播放。
 */

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VOICE_DIR = path.join(PROJECT_ROOT, 'public', 'voice');
const LANGUAGES = ['en', 'zh'] as const;
type PackLanguage = (typeof LANGUAGES)[number];

/** 五句新台词：脚本里已有、语音包里还没有录制 */
const UNRECORDED_WINGMAN_LINES: ReadonlySet<string> = new Set([
  'generic-swift-joined',
  'generic-raven-down-swift',
  'generic-raven-down-hq',
  'generic-swift-down-raven',
  'generic-swift-down-hq',
]);

interface ManifestEntry {
  duration?: unknown;
  bytes?: unknown;
}

interface Manifest {
  version?: unknown;
  format?: unknown;
  languages?: Partial<Record<PackLanguage, Record<string, ManifestEntry>>>;
}

const manifest = JSON.parse(
  readFileSync(path.join(VOICE_DIR, 'manifest.json'), 'utf8')
) as Manifest;
const scriptIds = getVoiceScript().map((line) => line.id);

function packEntries(language: PackLanguage): Record<string, ManifestEntry> {
  const entries = manifest.languages?.[language];
  expect(entries, `manifest.languages.${language}`).toBeTruthy();
  return entries ?? {};
}

function packIds(language: PackLanguage): Set<string> {
  return new Set(Object.keys(packEntries(language)));
}

describe('voice pack manifest', () => {
  it('is an mp3 pack with English and Chinese lines', () => {
    expect(manifest.format).toBe('mp3');
    expect(typeof manifest.version).toBe('number');
    for (const language of LANGUAGES) {
      expect(Object.keys(packEntries(language)).length, language).toBeGreaterThan(0);
    }
  });

  it.each(LANGUAGES)(
    'has every voice-script line except the five new wingman lines (%s)',
    (language) => {
      const ids = packIds(language);
      const missing = scriptIds.filter((id) => !ids.has(id));
      expect(
        missing.filter((id) => !UNRECORDED_WINGMAN_LINES.has(id)),
        `${language} pack is missing voiced lines`
      ).toEqual([]);
    }
  );

  it.each(LANGUAGES)('only lists lines that are in the voice script (%s)', (language) => {
    const known = new Set(scriptIds);
    const orphans = Object.keys(packEntries(language)).filter((id) => !known.has(id));
    expect(orphans, `${language} pack has lines the script no longer has`).toEqual([]);
  });

  it('lists the same lines in both languages', () => {
    expect(Object.keys(packEntries('zh')).sort()).toEqual(Object.keys(packEntries('en')).sort());
  });

  it.each(LANGUAGES)(
    'gives every line a positive duration and a matching mp3 file (%s)',
    (language) => {
      const problems: string[] = [];
      for (const [id, entry] of Object.entries(packEntries(language))) {
        const duration = entry.duration;
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
          problems.push(`${id}: duration ${String(duration)}`);
        }
        const file = path.join(VOICE_DIR, language, `${id}.mp3`);
        if (!existsSync(file)) {
          problems.push(`${id}: missing ${language}/${id}.mp3`);
          continue;
        }
        const size = statSync(file).size;
        if (size === 0) {
          problems.push(`${id}: empty file`);
        }
        if (entry.bytes !== undefined && entry.bytes !== size) {
          problems.push(`${id}: manifest bytes ${String(entry.bytes)} ≠ file size ${size}`);
        }
      }
      expect(problems).toEqual([]);
    }
  );

  it.each(LANGUAGES)('ships no audio that the manifest does not list (%s)', (language) => {
    const ids = packIds(language);
    const files = readdirSync(path.join(VOICE_DIR, language));
    const unlisted = files.filter(
      (file) => !file.endsWith('.mp3') || !ids.has(file.slice(0, -'.mp3'.length))
    );
    expect(unlisted).toEqual([]);
  });
});
