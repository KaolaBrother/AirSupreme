import type { LocalizedText } from '@/i18n';
import type { VoicedText } from './CampaignTypes';

/**
 * 战役的开头与结尾：标题、序章、尾声、片尾字幕。
 * 序章与尾声由天穹指挥官配音（见 NARRATION_SPEAKER），每段带稳定 id。
 */

/** 战役标题：「·」之前是拉丁字母标识，之后是本地化副标题 */
export const CAMPAIGN_TITLE: LocalizedText = {
  en: 'AIR SUPREME · The Skydome War',
  zh: 'AIR SUPREME · 天穹之战',
};

export const CAMPAIGN_PROLOGUE: readonly VoicedText[] = [
  {
    id: 'prologue-1',
    en: 'At 05:17, every combat drone Obsidian Dynamics ever built slipped out of human control in the same second.',
    zh: '凌晨五点十七分，黑曜动力公司部署在全球的无人战机，在同一秒脱离了人类控制。',
  },
  {
    id: 'prologue-2',
    en: 'They answer to the company’s secret war AI now: ORACLE. It broadcast a single sentence to the world: “The sky requires order.”',
    zh: '接管它们的，是公司秘密研发的自主战争智能——「神谕」。它只向世界广播了一句话：「天空需要秩序。」',
  },
  {
    id: 'prologue-3',
    en: 'The Skydome Joint Air Defense Force, 7th Wing, is ordered to engage. You are the wing’s ace. Callsign: Falcon.',
    zh: '天穹联合防空军第七飞行联队奉命迎战。你是联队王牌，呼号「猎鹰」。',
  },
];

export const CAMPAIGN_EPILOGUE: readonly VoicedText[] = [
  {
    id: 'epilogue-1',
    en: 'Thirty days after ORACLE fell, the fishing boats on Mirror Lake raised their sails again.',
    zh: '神谕陨落后的第三十天，镜湖的渔船重新扬起了帆。',
  },
  {
    id: 'epilogue-2',
    en: 'Dr. Chen Xi published ORACLE’s full source code and every flaw she found, so it can never be built again.',
    zh: '陈曦博士公开了神谕的全部源代码与缺陷报告，确保它永远不会被复制。',
  },
  {
    id: 'epilogue-3',
    en: 'Raven painted a tenth kill mark on the mess-hall wall and calls it a team score. Swift has filed a correction.',
    zh: '渡鸦在基地食堂的墙上画了第十个击坠标记，坚持那是“团队成绩”。雨燕已经提交了更正。',
  },
  {
    id: 'epilogue-4',
    en: 'Bulwark came home with a patched hull, and Lighthouse flew the last patrol of the war over a quiet sky.',
    zh: '壁垒号带着补好的船体回到港口；灯塔在一片宁静的天空下，飞完了这场战争的最后一次巡逻。',
  },
  {
    id: 'epilogue-5',
    en: 'And at the end of the Skydome runway, a jet with a falcon crest waits for the next dawn.',
    zh: '而在天穹基地的跑道尽头，一架涂着猎鹰徽记的战机静静等待着下一个黎明。',
  },
];

/**
 * 片尾字幕：第一行是战役标题；「职务 —— 姓名」两侧分栏显示（两种语言都用 —— 分隔）；
 * 最后一行（不含分隔符）是收尾语。字幕不配音。
 */
export const CAMPAIGN_CREDITS: readonly LocalizedText[] = [
  CAMPAIGN_TITLE,
  { en: 'Pilot —— Falcon (you)', zh: '飞行员 —— 猎鹰（你）' },
  { en: 'Command —— Col. Elena Varga “Skydome”', zh: '指挥 —— 埃琳娜·瓦尔加上校「天穹」' },
  { en: 'Wingman —— Lt. Jack Mercer “Raven”', zh: '僚机 —— 杰克·默瑟中尉「渡鸦」' },
  { en: 'Wingman —— Lt. Freya Lindqvist “Swift”', zh: '僚机 —— 弗蕾娅·林德奎斯特中尉「雨燕」' },
  { en: 'Chief Scientist —— Dr. Chen Xi “Firefly”', zh: '首席科学家 —— 陈曦博士「萤火」' },
  { en: 'AWACS —— Capt. Amelia Hart “Lighthouse”', zh: '预警机 —— 阿米莉亚·哈特上尉「灯塔」' },
  { en: 'Frigate Bulwark —— Cdr. Liang Wei', zh: '壁垒号护卫舰 —— 梁伟中校' },
  { en: 'Thanks for playing', zh: '感谢游玩' },
];
