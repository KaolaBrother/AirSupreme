import type { SpecialWeaponId } from '@/core/CombatContracts';
import type { LocalizedText } from '@/i18n';

/**
 * 战役剧本的数据类型（纯类型，无运行时代码）。
 *
 * 所有面向玩家的文案都是 LocalizedText（en 英文 / zh 简体中文），显示时用 tr() 取当前语言。
 * 会配音的文案（无线电台词、章节简报、序章、尾声）带稳定唯一的 id，同时用作语音文件名。
 */

/**
 * 无线电说话人：
 * - hq 天穹指挥部（瓦尔加上校）· wingman 渡鸦（默瑟中尉）· wingman2 雨燕（林德奎斯特中尉，第 3 章起）
 * - scientist 萤火（陈曦博士）· awacs 灯塔预警机（哈特上尉）· frigate 壁垒号护卫舰（梁伟中校）
 * - oracle 神谕 · player 猎鹰（玩家，无台词）· airliner 客机机长 · freighter 货轮大副
 */
export type CampaignSpeakerId =
  | 'hq'
  | 'wingman'
  | 'wingman2'
  | 'scientist'
  | 'awacs'
  | 'frigate'
  | 'oracle'
  | 'player'
  | 'airliner'
  | 'freighter';

/** 说话人色调，对应 HUD token：sys 冰蓝、ally 金色、threat 威胁红、weapon 琥珀、muted 灰 */
export type CampaignSpeakerTone = 'sys' | 'ally' | 'threat' | 'weapon' | 'muted';

/** 配音选角用的性别（neutral：合成音 / 无配音） */
export type CampaignSpeakerGender = 'female' | 'male' | 'neutral';

export interface CampaignSpeaker {
  id: CampaignSpeakerId;
  /** 呼号（HUD 无线电标签） */
  callsign: LocalizedText;
  /** 角色名（军衔 + 姓名） */
  name: LocalizedText;
  tone: CampaignSpeakerTone;
  gender: CampaignSpeakerGender;
  /** 配音选角说明：年龄、口音、语气（en 用于英文配音，zh 用于中文配音） */
  voiceDirection: LocalizedText;
}

/**
 * 无线电触发时机：
 * - level-start：入关（章节卡片之后）按顺序播放
 * - wave-start / wave-complete：index 为波次序号（从 0 开始）
 * - boss-spawn：Boss 登场（Boss 模式只播这一类）
 * - boss-phase：index 为进入的阶段号（2、3…）
 * - boss-low-health：Boss 血量首次低于 25%
 * - boss-defeated：击破后的收尾台词（神谕的遗言先播）
 */
export type RadioTriggerKind =
  | 'level-start'
  | 'wave-start'
  | 'wave-complete'
  | 'boss-spawn'
  | 'boss-phase'
  | 'boss-low-health'
  | 'boss-defeated';

export interface RadioLine {
  /**
   * 稳定唯一 id，同时是语音文件名（小写字母、数字、连字符）。
   * 章节台词：c{两位章号}-{触发}[-{序号}]-{说话人}[-{同组第 n 句}]，如 c03-wave-start-2-wingman2；
   * 首次遭遇：contact-{单位类型}；通用台词：generic-{键}。
   */
  id: string;
  trigger: RadioTriggerKind;
  /** 波次序号或 Boss 阶段号；缺省表示不区分序号 */
  index?: number;
  speaker: CampaignSpeakerId;
  text: LocalizedText;
}

/** 带稳定 id 的配音旁白段落（章节简报 / 序章 / 尾声）；本身就是 LocalizedText，可直接 tr() */
export interface VoicedText extends LocalizedText {
  readonly id: string;
}

export interface CampaignBossBrief {
  /** Boss 名称（与 BossTypes 一一对应；Boss 简报卡片标题、血条） */
  name: LocalizedText;
  /** 英文代号（两种语言下相同） */
  codename: string;
  /** Boss 简报卡片副标题：打法提示 */
  briefingLine: LocalizedText;
  /** 弱点提示（暂停菜单 / 结算展示） */
  weakPointHint: LocalizedText;
}

export interface CampaignChapter {
  /** 关卡号 1..10 */
  level: number;
  /** 如 Chapter 1 / 第一章 */
  chapterLabel: LocalizedText;
  /** 行动代号（英文，两种语言下相同），如 OPERATION FIRST LIGHT */
  codename: string;
  /** 本地化行动名：中文如「破晓行动」；英文界面与 codename 重复，故 en 为空串（卡片只显示代号） */
  operationName: LocalizedText;
  /** 关卡标题（与 LevelConfig.name 是同一个对象，见 ChapterTitles） */
  title: LocalizedText;
  /** 地点 */
  location: LocalizedText;
  /** 章节简报（卡片打字机逐段展示；由天穹指挥官配音） */
  intro: readonly VoicedText[];
  /** 任务目标列表 */
  objectives: readonly LocalizedText[];
  /** 入关简报卡片的一句话 */
  levelBriefingLine: LocalizedText;
  boss: CampaignBossBrief;
  radio: readonly RadioLine[];
  /** 本章新解锁的特殊武器（开局显示解锁说明） */
  unlockedWeapons: readonly SpecialWeaponId[];
  /** 解锁说明（含按键提示，不配音；无解锁时为 null） */
  unlockLine: LocalizedText | null;
  /** 结算页总结 */
  debriefSummary: LocalizedText;
}

/**
 * 通用战场台词（不随章节变化）。新增：
 * - awacs-lost：友军预警机（ALLY_AWACS）被击毁时，代替 ally-unit-destroyed
 * - frigate-lost：友军护卫舰（ALLY_FRIGATE）被击毁时，代替 ally-unit-destroyed
 * - 僚机事件（键名末尾是说话人）：swift-joined 雨燕入列（第 3 章起）；
 *   raven-down-swift / raven-down-hq 渡鸦被击落（雨燕在空中时由她播报，否则天穹指挥部）；
 *   swift-down-raven / swift-down-hq 雨燕被击落（渡鸦在空中时由他播报，否则天穹指挥部）
 */
export type GenericRadioKey =
  | 'civilian-hit'
  | 'civilian-destroyed'
  | 'ally-unit-destroyed'
  | 'awacs-lost'
  | 'frigate-lost'
  | 'escort-success'
  | 'escort-failed'
  | 'missile-warning'
  | 'low-health'
  | 'weapon-overheat'
  | 'checkpoint'
  | 'swift-joined'
  | 'raven-down-swift'
  | 'raven-down-hq'
  | 'swift-down-raven'
  | 'swift-down-hq';

/** 配音脚本条目（getVoiceScript 的返回值，供配音批次逐句生成语音） */
export interface VoiceScriptLine {
  /** 稳定唯一 id = 语音文件名 */
  id: string;
  speaker: CampaignSpeakerId;
  text: LocalizedText;
  /** narration：剧情卡片旁白；radio：无线电台词 */
  kind: 'narration' | 'radio';
}
