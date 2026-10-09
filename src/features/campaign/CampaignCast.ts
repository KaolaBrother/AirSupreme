import type { CampaignSpeaker, CampaignSpeakerId } from './CampaignTypes';

/**
 * 战役角色表：呼号、姓名、HUD 色调，以及配音选角用的性别与声音说明。
 * 玩家「猎鹰」是沉默的主角，没有台词。
 */
export const CAMPAIGN_SPEAKERS: Readonly<Record<CampaignSpeakerId, CampaignSpeaker>> = {
  hq: {
    id: 'hq',
    callsign: { en: 'Skydome', zh: '天穹' },
    name: { en: 'Col. Elena Varga', zh: '埃琳娜·瓦尔加上校' },
    tone: 'sys',
    gender: 'female',
    voiceDirection: {
      en: 'Female, mid-40s, Hungarian-born commander. Calm, authoritative, measured; faint Central European accent; never rushed, even under fire.',
      zh: '女，四十五岁上下，匈牙利裔指挥官。沉着、权威、字句克制；战况再急也从不慌乱。',
    },
  },
  wingman: {
    id: 'wingman',
    callsign: { en: 'Raven', zh: '渡鸦' },
    name: { en: 'Lt. Jack Mercer', zh: '杰克·默瑟中尉' },
    tone: 'ally',
    gender: 'male',
    voiceDirection: {
      en: 'Male, late 20s, American fighter pilot. Cocky, quick and funny; fiercely loyal underneath the swagger.',
      zh: '男，二十八九岁，美国战斗机飞行员。自信张扬、语速快、爱开玩笑，骨子里极其忠诚。',
    },
  },
  wingman2: {
    id: 'wingman2',
    callsign: { en: 'Swift', zh: '雨燕' },
    name: { en: 'Lt. Freya Lindqvist', zh: '弗蕾娅·林德奎斯特中尉' },
    tone: 'ally',
    gender: 'female',
    voiceDirection: {
      en: 'Female, late 20s, Swedish fighter pilot. Sharp, precise, dry deadpan humour; light Swedish accent.',
      zh: '女，二十八九岁，瑞典战斗机飞行员。干练精准，冷面幽默，语气平淡而锋利。',
    },
  },
  scientist: {
    id: 'scientist',
    callsign: { en: 'Firefly', zh: '萤火' },
    name: { en: 'Dr. Chen Xi', zh: '陈曦博士' },
    tone: 'weapon',
    gender: 'female',
    voiceDirection: {
      en: 'Female, 30s, Chinese AI scientist and ORACLE’s creator. Brilliant and warm, speeds up when excited; light Mandarin accent.',
      zh: '女，三十多岁，中国人工智能科学家，神谕的创造者。聪慧温暖，激动时语速加快。',
    },
  },
  awacs: {
    id: 'awacs',
    callsign: { en: 'Lighthouse', zh: '灯塔' },
    name: { en: 'Capt. Amelia Hart', zh: '阿米莉亚·哈特上尉' },
    tone: 'sys',
    gender: 'female',
    voiceDirection: {
      en: 'Female, 30s, British AWACS controller (southern English). Crisp, clipped radar calls; unflappable, with a hint of warmth.',
      zh: '女，三十多岁，英国预警机指挥员。雷达播报干脆利落，处变不惊，偶尔透出暖意。',
    },
  },
  frigate: {
    id: 'frigate',
    callsign: { en: 'Bulwark', zh: '壁垒' },
    name: { en: 'Cdr. Liang Wei', zh: '梁伟中校' },
    tone: 'ally',
    gender: 'male',
    voiceDirection: {
      en: 'Male, 50s, Chinese frigate captain. Steady, deep and unhurried; a veteran sailor’s gravitas; light Mandarin accent.',
      zh: '男，五十多岁，中国护卫舰舰长。沉稳低沉，不急不缓，老海军的威严。',
    },
  },
  oracle: {
    id: 'oracle',
    callsign: { en: 'ORACLE', zh: '神谕' },
    name: { en: 'ORACLE', zh: 'ORACLE' },
    tone: 'threat',
    gender: 'neutral',
    voiceDirection: {
      en: 'Synthetic, genderless war AI. Cold, flat, precise cadence; no emotion; subtle digital processing.',
      zh: '合成音，无性别的战争智能。冰冷平直，节奏精确，毫无感情，带轻微电子处理。',
    },
  },
  player: {
    id: 'player',
    callsign: { en: 'Falcon', zh: '猎鹰' },
    name: { en: 'Falcon (you)', zh: '猎鹰（你）' },
    tone: 'sys',
    gender: 'neutral',
    voiceDirection: {
      en: 'Silent protagonist: no voice lines.',
      zh: '沉默的主角：没有台词。',
    },
  },
  airliner: {
    id: 'airliner',
    callsign: { en: 'Coastal 702', zh: '海岸702' },
    name: { en: 'Airliner captain', zh: '客机机长' },
    tone: 'muted',
    gender: 'male',
    voiceDirection: {
      en: 'Male, 50s, Australian airline captain. Professional calm straining under fear.',
      zh: '男，五十多岁，澳大利亚籍民航机长。职业化的镇定下压着恐惧。',
    },
  },
  freighter: {
    id: 'freighter',
    callsign: { en: 'Northern Star', zh: '北星号' },
    name: { en: 'Freighter mate', zh: '货轮大副' },
    tone: 'muted',
    gender: 'male',
    voiceDirection: {
      en: 'Male, 40s, Scottish merchant mariner. Gruff and urgent, shouting over wind and engines.',
      zh: '男，四十多岁，苏格兰籍货轮大副。粗犷急切，在风声和引擎声里喊话。',
    },
  },
};

/** 剧情卡片旁白（章节简报、序章、尾声）的配音者：天穹指挥官瓦尔加上校 */
export const NARRATION_SPEAKER: CampaignSpeakerId = 'hq';
