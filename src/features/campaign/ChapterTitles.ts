import type { LocalizedText } from '@/i18n';

/**
 * 十个章节的标题，按关卡 1..10 排列。
 *
 * CampaignData 的章节 title 与 LevelConfig 的关卡 name 引用这里的同一个对象，
 * 保证两边永远一致（api-spec §1：关卡名必须等于章节标题）。
 */
export const CHAPTER_TITLES: readonly LocalizedText[] = [
  { en: 'Dawn at the Lake', zh: '湖畔晨曦' },
  { en: 'Sandstorm', zh: '沙漠风暴' },
  { en: 'Snowbound Summit', zh: '雪山之巅' },
  { en: 'Battle of the Deep', zh: '深海决战' },
  { en: 'City in Ruins', zh: '城市废墟' },
  { en: 'Heart of the Forge', zh: '熔炉之心' },
  { en: 'Aurora Sea', zh: '极光冰海' },
  { en: 'Thunder Canyon', zh: '雷霆峡谷' },
  { en: 'Atop the Sky Ladder', zh: '天梯之巅' },
  { en: 'The Oracle Core', zh: '神谕核心' },
];
