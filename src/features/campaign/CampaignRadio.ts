import type { GenericRadioKey, RadioLine } from './CampaignTypes';

/**
 * 不随章节变化的无线电台词：首次遭遇某类单位、通用战场告警。
 *
 * 首次遭遇按“本次游戏会话里第一次出现”触发，可能落在任何一章，
 * 所以说话人只用从该单位最早出场的章节起就在场的角色。
 */

/** 首次遭遇某类单位时的提示台词；键为 UnitType 枚举的字符串值 */
export const UNIT_FIRST_CONTACT_RADIO: Readonly<Record<string, RadioLine>> = {
  TANK: {
    id: 'contact-tank',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Armor on the ground! Make fast passes—don’t loiter low over their guns.',
      zh: '地面装甲！快速掠过攻击，别在它们的炮口上空低速逗留。',
    },
  },
  SAM_LAUNCHER: {
    id: 'contact-sam-launcher',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: {
      en: 'SAM launcher! When you hear the lock tone, pop flares!',
      zh: '地空导弹车！一听到锁定告警就放热焰弹！',
    },
  },
  AA_GUN: {
    id: 'contact-aa-gun',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Flak battery! Don’t fly straight and level through its fire.',
      zh: '高炮阵地！别在它的射界里直线平飞。',
    },
  },
  RADAR_STATION: {
    id: 'contact-radar-station',
    trigger: 'wave-start',
    speaker: 'scientist',
    text: {
      en: 'That radar is aiming their guns. Kill it and they’ll start missing.',
      zh: '那座雷达在为敌人校准火力。打掉它，它们就会打偏。',
    },
  },
  GUNBOAT: {
    id: 'contact-gunboat',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: {
      en: 'Fast gunboats! Lead your shots—they won’t sail straight.',
      zh: '高速炮艇！提前量打足——它们不会走直线。',
    },
  },
  FRIGATE: {
    id: 'contact-frigate',
    trigger: 'wave-start',
    speaker: 'frigate',
    text: {
      en: 'Enemy frigate. Its close-in guns will shred you down low. Attack from a steep dive.',
      zh: '敌方护卫舰。低空会被它的近防炮撕碎——从高角度俯冲攻击。',
    },
  },
  SUBMARINE: {
    id: 'contact-submarine',
    trigger: 'wave-start',
    speaker: 'frigate',
    text: {
      en: 'Sonar contact, submarine. You can only hit it when it surfaces to fire.',
      zh: '声呐发现潜艇。它只有上浮开火时才能被击中。',
    },
  },
  ATTACK_HELICOPTER: {
    id: 'contact-attack-helicopter',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: {
      en: 'Gunships hugging the deck! Drop your nose and run them down!',
      zh: '武装直升机贴地飞行，压低机头去追！',
    },
  },
  BOMBER: {
    id: 'contact-bomber',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Enemy bombers heading for our forces! Intercept them first!',
      zh: '敌方轰炸机正扑向友军，优先拦截！',
    },
  },
  DRONE: {
    id: 'contact-drone',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: { en: 'Kamikaze drones! Don’t let them ram you!', zh: '自杀无人机！别让它们撞上你！' },
  },
  ALLY_CONVOY: {
    id: 'contact-ally-convoy',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Friendly convoy entering the area. Keep them covered.',
      zh: '友军车队进入战区，掩护他们。',
    },
  },
  ALLY_FRIGATE: {
    id: 'contact-ally-frigate',
    trigger: 'wave-start',
    speaker: 'frigate',
    text: {
      en: 'This is Bulwark, Commander Liang Wei. Drag their missiles past me—my guns will clear them.',
      zh: '这里是壁垒号，梁伟中校。把导弹引到我附近——我的近防炮会替你清掉。',
    },
  },
  ALLY_AWACS: {
    id: 'contact-ally-awacs',
    trigger: 'wave-start',
    speaker: 'awacs',
    text: {
      en: 'Lighthouse, on station. Keep me flying and you’ll see everything coming.',
      zh: '灯塔就位。保住我，来袭的一切你都看得见。',
    },
  },
  CIVILIAN_AIRLINER: {
    id: 'contact-civilian-airliner',
    trigger: 'wave-start',
    speaker: 'airliner',
    text: {
      en: 'This is Coastal 702, evacuating the airspace. Please, hold your fire!',
      zh: '这里是海岸702航班，正在撤离空域——请勿开火！',
    },
  },
  CIVILIAN_SHIP: {
    id: 'contact-civilian-ship',
    trigger: 'wave-start',
    speaker: 'freighter',
    text: {
      en: 'Civilian freighter requesting passage! We’re unarmed—don’t shoot!',
      zh: '民用货轮请求通过！我们没有武装——别开火！',
    },
  },
  CIVILIAN_TRUCK: {
    id: 'contact-civilian-truck',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Civilians evacuating on that road. Watch your fire.',
      zh: '公路上是撤离的平民车辆，注意射界。',
    },
  },
};

/** 通用战场台词（不随章节变化）；何时触发见 GenericRadioKey */
export const GENERIC_RADIO: Readonly<Record<GenericRadioKey, RadioLine>> = {
  'civilian-hit': {
    id: 'generic-civilian-hit',
    trigger: 'wave-start',
    speaker: 'hq',
    text: { en: 'Cease fire! That’s a civilian!', zh: '停火！那是平民目标！' },
  },
  'civilian-destroyed': {
    id: 'generic-civilian-destroyed',
    trigger: 'wave-start',
    speaker: 'hq',
    text: {
      en: 'Civilian casualties… Falcon, watch your fire.',
      zh: '平民伤亡……猎鹰，注意你的射界。',
    },
  },
  'ally-unit-destroyed': {
    id: 'generic-ally-unit-destroyed',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: { en: 'We just lost a friendly! Damn it!', zh: '友军被击毁了！该死！' },
  },
  'awacs-lost': {
    id: 'generic-awacs-lost',
    trigger: 'wave-start',
    speaker: 'awacs',
    text: {
      en: 'Lighthouse is hit! Systems failing, breaking off. Radar’s on you now, Falcon.',
      zh: '灯塔中弹！系统故障，正在脱离。雷达就靠你了，猎鹰。',
    },
  },
  'frigate-lost': {
    id: 'generic-frigate-lost',
    trigger: 'wave-start',
    speaker: 'frigate',
    text: {
      en: 'Bulwark is dead in the water. We’re out of the fight. Falcon, finish this.',
      zh: '壁垒号失去动力，我们退出战斗了。猎鹰，把仗打完。',
    },
  },
  'escort-success': {
    id: 'generic-escort-success',
    trigger: 'wave-complete',
    speaker: 'hq',
    text: { en: 'Escort target is safe. Good work.', zh: '护送目标安全，干得好。' },
  },
  'escort-failed': {
    id: 'generic-escort-failed',
    trigger: 'wave-complete',
    speaker: 'hq',
    text: { en: 'We’ve lost the escort… Keep fighting.', zh: '护送目标失守……继续作战。' },
  },
  'missile-warning': {
    id: 'generic-missile-warning',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: { en: 'Missile on you! Flares, now!', zh: '导弹锁定你了！放热焰弹！' },
  },
  'low-health': {
    id: 'generic-low-health',
    trigger: 'wave-start',
    speaker: 'wingman',
    text: { en: 'Falcon, you’re smoking! Pull up!', zh: '猎鹰，你在冒烟！拉起来！' },
  },
  'weapon-overheat': {
    id: 'generic-weapon-overheat',
    trigger: 'wave-start',
    speaker: 'scientist',
    text: { en: 'Weapon’s overheating—let it cool!', zh: '武器过热了，等它冷却！' },
  },
  checkpoint: {
    id: 'generic-checkpoint',
    trigger: 'wave-complete',
    speaker: 'hq',
    text: { en: 'Progress logged.', zh: '战况已记录。' },
  },
};
