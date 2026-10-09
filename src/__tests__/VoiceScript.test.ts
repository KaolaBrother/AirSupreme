import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_CHAPTERS,
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_PROLOGUE,
  CAMPAIGN_SPEAKERS,
  GENERIC_RADIO,
  NARRATION_SPEAKER,
  UNIT_FIRST_CONTACT_RADIO,
  getVoiceScript,
  type CampaignSpeakerId,
  type GenericRadioKey,
  type VoiceScriptLine,
} from '@/features/campaign/CampaignData';
import { expectBilingual } from './i18nTestUtils';

/**
 * getVoiceScript()：配音批次逐句生成语音的脚本。id 同时是语音文件名，必须稳定、唯一、
 * 只含 [a-z0-9-]；每句都有英文和中文；说话人都在 CAMPAIGN_SPEAKERS 里。
 * id 规则（CampaignTypes.RadioLine.id）：章节台词 c{两位章号}-{触发}[-{序号}]-{说话人}[-{n}]，
 * 首次遭遇 contact-{单位类型}，通用台词 generic-{键}。
 */

const FILE_NAME_SAFE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const script: VoiceScriptLine[] = getVoiceScript();

function pad2(level: number): string {
  return String(level).padStart(2, '0');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('getVoiceScript', () => {
  it('has lines', () => {
    expect(script.length).toBeGreaterThan(0);
  });

  it('gives every line a unique, file-name-safe id', () => {
    const ids = script.map((line) => line.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates, 'duplicate voice ids').toEqual([]);
    for (const id of ids) {
      expect(id, `voice id ${JSON.stringify(id)}`).toMatch(FILE_NAME_SAFE);
    }
  });

  it('has non-empty English and Chinese text for every line', () => {
    for (const line of script) {
      expectBilingual(line.text, line.id);
    }
  });

  it('only uses known speakers and never voices the silent protagonist', () => {
    const speakers = new Set(Object.keys(CAMPAIGN_SPEAKERS));
    for (const line of script) {
      expect(speakers.has(line.speaker), `${line.id}: ${line.speaker}`).toBe(true);
      expect(line.speaker, line.id).not.toBe('player');
      expect(['narration', 'radio'], line.id).toContain(line.kind);
    }
  });

  it('voices every narration paragraph with the narration speaker', () => {
    const narration = script.filter((line) => line.kind === 'narration');
    expect(narration.length).toBeGreaterThan(0);
    for (const line of narration) {
      expect(line.speaker, line.id).toBe(NARRATION_SPEAKER);
    }
  });

  it('covers every voiced paragraph and radio line exactly once, in playback order', () => {
    const expected = [
      ...CAMPAIGN_PROLOGUE.map((line) => line.id),
      ...CAMPAIGN_CHAPTERS.flatMap((chapter) => [
        ...chapter.intro.map((line) => line.id),
        ...chapter.radio.map((line) => line.id),
      ]),
      ...Object.values(UNIT_FIRST_CONTACT_RADIO).map((line) => line.id),
      ...Object.values(GENERIC_RADIO).map((line) => line.id),
      ...CAMPAIGN_EPILOGUE.map((line) => line.id),
    ];
    expect(script.map((line) => line.id)).toEqual(expected);
  });

  it('carries the same text as the campaign data it was built from', () => {
    const sources = new Map<string, { en: string; zh: string }>();
    for (const line of [...CAMPAIGN_PROLOGUE, ...CAMPAIGN_EPILOGUE]) {
      sources.set(line.id, line);
    }
    for (const chapter of CAMPAIGN_CHAPTERS) {
      chapter.intro.forEach((line) => sources.set(line.id, line));
      chapter.radio.forEach((line) => sources.set(line.id, line.text));
    }
    for (const line of [
      ...Object.values(UNIT_FIRST_CONTACT_RADIO),
      ...Object.values(GENERIC_RADIO),
    ]) {
      sources.set(line.id, line.text);
    }
    for (const line of script) {
      const source = sources.get(line.id);
      expect(source, line.id).toBeDefined();
      expect({ en: line.text.en, zh: line.text.zh }, line.id).toEqual({
        en: source?.en,
        zh: source?.zh,
      });
    }
  });

  it('returns a fresh array on every call', () => {
    const first = getVoiceScript();
    first.length = 0;
    expect(getVoiceScript()).toHaveLength(script.length);
  });

  it('reports its totals (lines, speakers, characters) consistently', () => {
    const narration = script.filter((line) => line.kind === 'narration').length;
    const radio = script.filter((line) => line.kind === 'radio').length;
    const perSpeaker = new Map<CampaignSpeakerId, number>();
    for (const line of script) {
      perSpeaker.set(line.speaker, (perSpeaker.get(line.speaker) ?? 0) + 1);
    }
    const enChars = script.reduce((sum, line) => sum + line.text.en.length, 0);
    const zhChars = script.reduce((sum, line) => sum + line.text.zh.length, 0);

    expect(narration + radio).toBe(script.length);
    expect([...perSpeaker.values()].reduce((sum, count) => sum + count, 0)).toBe(script.length);
    expect(narration).toBe(
      CAMPAIGN_PROLOGUE.length +
        CAMPAIGN_EPILOGUE.length +
        CAMPAIGN_CHAPTERS.reduce((sum, chapter) => sum + chapter.intro.length, 0)
    );
    expect(radio).toBe(
      CAMPAIGN_CHAPTERS.reduce((sum, chapter) => sum + chapter.radio.length, 0) +
        Object.keys(UNIT_FIRST_CONTACT_RADIO).length +
        Object.keys(GENERIC_RADIO).length
    );

    const speakers = [...perSpeaker.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([speaker, count]) => `${speaker} ${count}`)
      .join(', ');
    console.info(
      `[voice script] ${script.length} lines (${narration} narration, ${radio} radio); ` +
        `${enChars} en chars, ${zhChars} zh chars; ${speakers}`
    );
  });
});

describe('voice line ids', () => {
  it('names chapter radio lines c{NN}-{trigger}[-{index}]-{speaker}[-{n}]', () => {
    for (const chapter of CAMPAIGN_CHAPTERS) {
      for (const line of chapter.radio) {
        const index = line.index === undefined ? '' : `-${line.index}`;
        const stem = `c${pad2(chapter.level)}-${line.trigger}${index}-${line.speaker}`;
        expect(line.id, `chapter ${chapter.level}`).toMatch(
          new RegExp(`^${escapeRegExp(stem)}(?:-\\d+)?$`)
        );
      }
    }
  });

  it('groups each chapter briefing under its chapter number', () => {
    for (const chapter of CAMPAIGN_CHAPTERS) {
      for (const paragraph of chapter.intro) {
        expect(paragraph.id).toMatch(new RegExp(`^c${pad2(chapter.level)}-`));
      }
    }
    for (const paragraph of CAMPAIGN_PROLOGUE) {
      expect(paragraph.id).toMatch(/^prologue-/);
    }
    for (const paragraph of CAMPAIGN_EPILOGUE) {
      expect(paragraph.id).toMatch(/^epilogue-/);
    }
  });

  it('names first-contact lines contact-{unit type}', () => {
    for (const [type, line] of Object.entries(UNIT_FIRST_CONTACT_RADIO)) {
      expect(line.id).toBe(`contact-${type.toLowerCase().replace(/_/g, '-')}`);
    }
  });

  it('names generic lines generic-{key}', () => {
    for (const [key, line] of Object.entries(GENERIC_RADIO) as [
      GenericRadioKey,
      { id: string },
    ][]) {
      expect(line.id).toBe(`generic-${key}`);
    }
  });
});
