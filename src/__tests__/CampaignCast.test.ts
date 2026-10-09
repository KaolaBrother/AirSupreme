import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SPEAKERS,
  NARRATION_SPEAKER,
  type CampaignSpeaker,
  type CampaignSpeakerId,
} from '@/features/campaign/CampaignData';
import { expectBilingual } from './i18nTestUtils';

/**
 * 战役角色表（mission-list「Cast rewrite」）：国际化的友军阵容，只有一两个中文名；
 * 为配音多样性安排女性友军角色——天穹指挥官、第二僚机、科学家、预警机指挥员；
 * 每个说话人都有配音用的性别与声音说明。
 */

const SPEAKERS: CampaignSpeaker[] = Object.values(CAMPAIGN_SPEAKERS);
const GENDERS = ['female', 'male', 'neutral'];

/** 有军衔 + 姓名的角色（呼号之外有真名的人） */
const RANKED_NAME = /^(?:Col|Lt|Dr|Capt|Cdr)\.\s+\S+/;
const NAMED_PEOPLE = SPEAKERS.filter((speaker) => RANKED_NAME.test(speaker.name.en));

/** mission-list 给出的友军呼号与英文姓名 */
const FRIENDLY_CAST: ReadonlyArray<[CampaignSpeakerId, string, string]> = [
  ['hq', 'Skydome', 'Col. Elena Varga'],
  ['wingman', 'Raven', 'Lt. Jack Mercer'],
  ['wingman2', 'Swift', 'Lt. Freya Lindqvist'],
  ['scientist', 'Firefly', 'Dr. Chen Xi'],
  ['awacs', 'Lighthouse', 'Capt. Amelia Hart'],
  ['frigate', 'Bulwark', 'Cdr. Liang Wei'],
];

describe('campaign cast', () => {
  it('keys every speaker by its own id', () => {
    for (const [id, speaker] of Object.entries(CAMPAIGN_SPEAKERS)) {
      expect(speaker.id).toBe(id);
    }
  });

  it('gives every speaker a gender and a bilingual callsign, name and voice direction', () => {
    for (const speaker of SPEAKERS) {
      expect(GENDERS, `${speaker.id} gender`).toContain(speaker.gender);
      expectBilingual(speaker.callsign, `${speaker.id} callsign`);
      expectBilingual(speaker.name, `${speaker.id} name`);
      expectBilingual(speaker.voiceDirection, `${speaker.id} voice direction`);
    }
  });

  it.each(FRIENDLY_CAST)('casts %s as %s (%s)', (id, callsign, name) => {
    const speaker = CAMPAIGN_SPEAKERS[id];
    expect(speaker.callsign.en).toBe(callsign);
    expect(speaker.name.en).toBe(name);
    expect(speaker.tone, `${id} is friendly`).not.toBe('threat');
  });

  it.each(['hq', 'wingman2', 'scientist', 'awacs'] as const)(
    'voices the friendly %s character with a woman',
    (id) => {
      expect(CAMPAIGN_SPEAKERS[id].gender).toBe('female');
      expect(CAMPAIGN_SPEAKERS[id].tone).not.toBe('threat');
    }
  );

  it('keeps the named cast international with only one or two Chinese names', () => {
    expect(NAMED_PEOPLE.length, 'named characters').toBeGreaterThanOrEqual(FRIENDLY_CAST.length);
    // 中文里外国人名按惯例用「·」连接名与姓；中文姓名没有「·」
    const chineseNamed = NAMED_PEOPLE.filter((speaker) => !speaker.name.zh.includes('·'));
    expect(chineseNamed.length).toBeGreaterThanOrEqual(1);
    expect(chineseNamed.length).toBeLessThanOrEqual(2);
  });

  it('narrates the story with an existing, friendly speaker', () => {
    const narrator = CAMPAIGN_SPEAKERS[NARRATION_SPEAKER];
    expect(narrator).toBeDefined();
    expect(narrator.tone).not.toBe('threat');
    expect(narrator.gender).not.toBe('neutral');
  });
});
