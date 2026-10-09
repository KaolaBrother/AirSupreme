import type { SpecialWeaponId } from '@/core/CombatContracts';
import { NARRATION_SPEAKER } from './CampaignCast';
import { CAMPAIGN_CHAPTERS } from './CampaignChapters';
import { GENERIC_RADIO, UNIT_FIRST_CONTACT_RADIO } from './CampaignRadio';
import { CAMPAIGN_EPILOGUE, CAMPAIGN_PROLOGUE } from './CampaignStory';
import type {
  CampaignChapter,
  RadioLine,
  RadioTriggerKind,
  VoiceScriptLine,
  VoicedText,
} from './CampaignTypes';

/**
 * 战役剧本：十个章节的完整故事线（对外统一入口）。
 *
 * 只包含数据与纯函数，不依赖渲染 / 音频 / DOM。
 * 呈现（章节卡片、无线电、结算、结局）由表现层读取这里的数据完成；
 * 文案均为 LocalizedText，显示时用 '@/i18n' 的 tr() 取当前语言。
 *
 * 数据分文件存放：类型 CampaignTypes · 角色 CampaignCast · 章节 CampaignChapters ·
 * 首次遭遇 / 通用台词 CampaignRadio · 标题 / 序章 / 尾声 / 字幕 CampaignStory ·
 * 章节标题 ChapterTitles（与 LevelConfig 共用）。
 */

export type {
  CampaignBossBrief,
  CampaignChapter,
  CampaignSpeaker,
  CampaignSpeakerGender,
  CampaignSpeakerId,
  CampaignSpeakerTone,
  GenericRadioKey,
  RadioLine,
  RadioTriggerKind,
  VoiceScriptLine,
  VoicedText,
} from './CampaignTypes';
export { CAMPAIGN_SPEAKERS, NARRATION_SPEAKER } from './CampaignCast';
export { CAMPAIGN_CHAPTERS } from './CampaignChapters';
export { GENERIC_RADIO, UNIT_FIRST_CONTACT_RADIO } from './CampaignRadio';
export {
  CAMPAIGN_CREDITS,
  CAMPAIGN_EPILOGUE,
  CAMPAIGN_PROLOGUE,
  CAMPAIGN_TITLE,
} from './CampaignStory';
export { CHAPTER_TITLES } from './ChapterTitles';

/** 战役总关卡数（与 Difficulty.CAMPAIGN_LEVEL_CAP 保持一致） */
export const TOTAL_LEVELS = 10;

/** 按关卡取章节；越界时钳制到 1..TOTAL_LEVELS */
export function getCampaignChapter(level: number): CampaignChapter {
  const safeLevel = Number.isFinite(level) ? Math.round(level) : 1;
  const index = Math.max(1, Math.min(TOTAL_LEVELS, safeLevel)) - 1;
  return CAMPAIGN_CHAPTERS[index];
}

/** 取某个触发点的台词（保持剧本顺序） */
export function getChapterRadio(
  level: number,
  trigger: RadioTriggerKind,
  index?: number
): RadioLine[] {
  return getCampaignChapter(level).radio.filter(
    (line) =>
      line.trigger === trigger &&
      (line.index === undefined || index === undefined || line.index === index)
  );
}

/** 截至某关（含）已解锁的全部特殊武器，按解锁顺序排列 */
export function getUnlockedWeaponsThrough(level: number): SpecialWeaponId[] {
  const safeLevel = Number.isFinite(level) ? Math.round(level) : 1;
  const unlocked: SpecialWeaponId[] = [];
  for (const chapter of CAMPAIGN_CHAPTERS) {
    if (chapter.level > safeLevel) {
      break;
    }
    for (const weapon of chapter.unlockedWeapons) {
      if (!unlocked.includes(weapon)) {
        unlocked.push(weapon);
      }
    }
  }
  return unlocked;
}

/** 某个特殊武器在第几关解锁；未出现在剧本中返回 null */
export function getWeaponUnlockLevel(weapon: SpecialWeaponId): number | null {
  const chapter = CAMPAIGN_CHAPTERS.find((entry) => entry.unlockedWeapons.includes(weapon));
  return chapter ? chapter.level : null;
}

function narration(lines: readonly VoicedText[]): VoiceScriptLine[] {
  return lines.map((line) => ({
    id: line.id,
    speaker: NARRATION_SPEAKER,
    text: { en: line.en, zh: line.zh },
    kind: 'narration',
  }));
}

function radio(lines: readonly RadioLine[]): VoiceScriptLine[] {
  return lines.map((line) => ({
    id: line.id,
    speaker: line.speaker,
    text: line.text,
    kind: 'radio',
  }));
}

/**
 * 全部需要配音的台词（每次返回新数组），按播放顺序：
 * 序章 → 每章（简报旁白 + 无线电）→ 首次遭遇 → 通用告警 → 尾声。
 * id 全局唯一且可直接作语音文件名；speaker 对应 CAMPAIGN_SPEAKERS 的选角说明。
 * 标题、任务目标、简报一句话、Boss 简报、武器解锁说明、结算总结与字幕只显示不配音。
 */
export function getVoiceScript(): VoiceScriptLine[] {
  const script: VoiceScriptLine[] = narration(CAMPAIGN_PROLOGUE);
  for (const chapter of CAMPAIGN_CHAPTERS) {
    script.push(...narration(chapter.intro), ...radio(chapter.radio));
  }
  script.push(
    ...radio(Object.values(UNIT_FIRST_CONTACT_RADIO)),
    ...radio(Object.values(GENERIC_RADIO)),
    ...narration(CAMPAIGN_EPILOGUE)
  );
  return script;
}
