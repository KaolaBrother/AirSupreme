import { type QualityPreset } from '@/config';
import { getDifficultyProfile } from '@/core/Difficulty';
import {
  DEFAULT_START_FLOW_SETTINGS,
  type CameraModeSetting,
  type GameMode,
  type StartFlowSettings,
} from '@/core/SessionSettings';
import { getCampaignChapter } from '@/features/campaign/CampaignData';
import { tr, type LocalizedText } from '@/i18n';

/**
 * 主菜单各处共用的取值文案（标题画面的按钮副标题与设置面板显示同一套写法）。
 */

export const QUALITY_PRESETS: readonly QualityPreset[] = [
  'auto',
  'performance',
  'balanced',
  'quality',
];

export const QUALITY_LABELS: Readonly<Record<QualityPreset, LocalizedText>> = {
  auto: { en: 'Auto', zh: '自动' },
  performance: { en: 'Performance', zh: '性能' },
  balanced: { en: 'Balanced', zh: '平衡' },
  quality: { en: 'High', zh: '高质量' },
};

export const SWITCH_ON: LocalizedText = { en: 'On', zh: '开启' };
export const SWITCH_OFF: LocalizedText = { en: 'Off', zh: '关闭' };

export const CAMERA_LABELS: Readonly<Record<CameraModeSetting, LocalizedText>> = {
  'third-person': { en: 'Third-person', zh: '第三人称' },
  'first-person': { en: 'First-person', zh: '第一人称' },
};

export const MODE_LABELS: Readonly<Record<GameMode, LocalizedText>> = {
  normal: { en: 'Normal', zh: '普通模式' },
  boss: { en: 'Boss mode', zh: 'Boss 模式' },
};

/** 难度档名以 Difficulty.ts 的难度档为唯一来源（越界钳到 1..5，非数值按默认档） */
export function difficultyText(level: number): string {
  const safeLevel = Number.isFinite(level) ? level : DEFAULT_START_FLOW_SETTINGS.difficulty;
  return tr(getDifficultyProfile(safeLevel).label);
}

/** 如“第六章 · 熔炉之心” */
export function chapterCaption(level: number): string {
  const chapter = getCampaignChapter(level);
  return `${tr(chapter.chapterLabel)} · ${tr(chapter.title)}`;
}

export function levelText(level: number): string {
  return tr({ en: 'Level {level}', zh: '第{level}关' }, { level });
}

export function qualityText(preset: QualityPreset): string {
  return tr(QUALITY_LABELS[preset] ?? QUALITY_LABELS.auto);
}

export function testScoreText(score: number): string {
  return score === 0 ? tr(SWITCH_OFF) : `${score}`;
}

export function percentText(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** 开新局按钮的主标签：正常模式是“新战役”，Boss 模式是“Boss 挑战” */
export function newGameLabel(settings: Pick<StartFlowSettings, 'gameMode'>): string {
  return settings.gameMode === 'normal'
    ? tr({ en: 'New Campaign', zh: '新战役' })
    : tr({ en: 'Boss Challenge', zh: 'Boss 挑战' });
}

/**
 * 开新局按钮的副标题：从哪一关开始；测试分数不为 0 时一并写出，
 * 高级选项改过的东西在标题画面上看得见。
 */
export function newGameDetail(
  settings: Pick<StartFlowSettings, 'gameMode' | 'startLevel' | 'testScore'>
): string {
  const parts = [chapterCaption(settings.startLevel)];
  if (settings.testScore > 0) {
    parts.push(
      tr({ en: 'Test score {score}', zh: '测试分数 {score}' }, { score: settings.testScore })
    );
  }
  return parts.join(' · ');
}

/** 高级选项是否偏离默认值（起始关卡 / 模式 / 测试分数） */
export function hasAdvancedOverrides(
  settings: Pick<StartFlowSettings, 'gameMode' | 'startLevel' | 'testScore'>
): boolean {
  return (
    settings.gameMode !== DEFAULT_START_FLOW_SETTINGS.gameMode ||
    settings.startLevel !== DEFAULT_START_FLOW_SETTINGS.startLevel ||
    settings.testScore !== DEFAULT_START_FLOW_SETTINGS.testScore
  );
}
