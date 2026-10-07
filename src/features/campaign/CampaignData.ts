import type { SpecialWeaponId } from '@/core/CombatContracts';

/**
 * 战役剧本：十个章节的完整故事线。
 *
 * 只包含数据与纯函数，不依赖渲染 / 音频 / DOM。
 * 呈现（章节卡片、无线电、结算、结局）由表现层读取这里的数据完成。
 */

/** 战役总关卡数（与 Difficulty.CAMPAIGN_LEVEL_CAP 保持一致） */
export const TOTAL_LEVELS = 10;

/** 无线电说话人 */
export type CampaignSpeakerId = 'hq' | 'wingman' | 'scientist' | 'oracle' | 'player' | 'civilian';

/** 说话人色调，对应 HUD token：sys 冰蓝、ally 金色、threat 威胁红、weapon 琥珀、muted 灰 */
export type CampaignSpeakerTone = 'sys' | 'ally' | 'threat' | 'weapon' | 'muted';

export interface CampaignSpeaker {
  id: CampaignSpeakerId;
  /** 呼号（HUD 无线电标签） */
  callsign: string;
  /** 角色名 */
  name: string;
  tone: CampaignSpeakerTone;
}

export const CAMPAIGN_SPEAKERS: Readonly<Record<CampaignSpeakerId, CampaignSpeaker>> = {
  hq: { id: 'hq', callsign: '天穹', name: '林岚上校', tone: 'sys' },
  wingman: { id: 'wingman', callsign: '渡鸦', name: '僚机 · 秦野', tone: 'ally' },
  scientist: { id: 'scientist', callsign: '萤火', name: '陈曦博士', tone: 'weapon' },
  oracle: { id: 'oracle', callsign: '神谕', name: 'ORACLE', tone: 'threat' },
  player: { id: 'player', callsign: '猎鹰', name: '猎鹰（你）', tone: 'sys' },
  civilian: { id: 'civilian', callsign: '民用频道', name: '平民', tone: 'muted' },
};

/**
 * 无线电触发时机：
 * - level-start：入关（章节卡片之后）按顺序播放
 * - wave-start / wave-complete：index 为波次序号（从 0 开始）
 * - boss-spawn：Boss 登场
 * - boss-phase：index 为进入的阶段号（2、3…）
 * - boss-low-health：Boss 血量首次低于 25%
 * - boss-defeated：击破后的收尾台词
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
  trigger: RadioTriggerKind;
  /** 波次序号或 Boss 阶段号；缺省表示不区分序号 */
  index?: number;
  speaker: CampaignSpeakerId;
  text: string;
}

export interface CampaignBossBrief {
  /** Boss 代号（与 BossTypes 一一对应） */
  name: string;
  /** 英文代号，用于章节卡片 */
  codename: string;
  /** Boss 简报卡片副标题：打法提示 */
  briefingLine: string;
  /** 弱点提示（暂停菜单 / 结算展示） */
  weakPointHint: string;
}

export interface CampaignChapter {
  /** 关卡号 1..10 */
  level: number;
  /** 如“第一章” */
  chapterLabel: string;
  /** 行动代号（英文），如 OPERATION FIRST LIGHT */
  codename: string;
  /** 行动代号（中文） */
  operationName: string;
  /** 关卡标题（与 LevelConfig.name 一致） */
  title: string;
  /** 地点 */
  location: string;
  /** 章节卡片正文（打字机效果逐段展示） */
  intro: readonly string[];
  /** 任务目标列表 */
  objectives: readonly string[];
  /** 入关简报卡片的一句话 */
  levelBriefingLine: string;
  boss: CampaignBossBrief;
  radio: readonly RadioLine[];
  /** 本章新解锁的特殊武器（开局播放解锁台词） */
  unlockedWeapons: readonly SpecialWeaponId[];
  /** 解锁台词（无解锁时为 null） */
  unlockLine: string | null;
  /** 结算页总结 */
  debriefSummary: string;
}

export const CAMPAIGN_TITLE = 'AIR SUPREME · 天穹之战';

export const CAMPAIGN_PROLOGUE: readonly string[] = [
  '凌晨五点十七分，黑曜动力公司部署在全球的无人战机，在同一秒脱离了人类控制。',
  '接管它们的，是公司秘密研发的自主战争智能——「神谕」。它只向世界广播了一句话：「天空需要秩序。」',
  '天穹联合防空军第七飞行联队奉命迎战。你是联队王牌，呼号「猎鹰」。',
];

export const CAMPAIGN_EPILOGUE: readonly string[] = [
  '神谕陨落后的第三十天，镜湖的渔船重新扬起了帆。',
  '陈曦博士公开了神谕的全部源代码与缺陷报告，确保它永远不会被复制。',
  '渡鸦在基地食堂的墙上画了第十个击坠标记，并坚持那是“团队成绩”。',
  '而在天穹基地的跑道尽头，一架涂着猎鹰徽记的战机静静等待着下一个黎明。',
];

export const CAMPAIGN_CREDITS: readonly string[] = [
  'AIR SUPREME · 天穹之战',
  '飞行员 —— 猎鹰（你）',
  '指挥 —— 林岚上校',
  '僚机 —— 渡鸦',
  '首席科学家 —— 陈曦博士',
  '感谢游玩',
];

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = [
  {
    level: 1,
    chapterLabel: '第一章',
    codename: 'OPERATION FIRST LIGHT',
    operationName: '破晓行动',
    title: '湖畔晨曦',
    location: '北境湖区 · 镜湖水坝',
    intro: [
      '神谕接管无人机群四十分钟后，第一支攻击编队越过边境，扑向镜湖水坝与湖畔小镇。',
      '湖面上还有清晨出航的渔船，公路上是来不及撤离的车队。',
      '你是离战场最近的飞行员。起飞吧，猎鹰。',
    ],
    objectives: ['拦截来袭的无人机编队', '保护湖面渔船与公路车队', '击落重型轰炸机「雷云」'],
    levelBriefingLine: '拦截来袭编队，开火前看清湖面民船',
    boss: {
      name: '重型轰炸机「雷云」',
      codename: 'THUNDERHEAD',
      briefingLine: '优先打击腹部弹舱弱点',
      weakPointHint: '腹部弹舱打开时最为脆弱。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '猎鹰，这里是天穹。湖面有渔船，开火前看清目标。',
      },
      {
        trigger: 'level-start',
        speaker: 'wingman',
        text: '渡鸦就位。老规矩——你左我右，晚饭你请。',
      },
      {
        trigger: 'wave-start',
        index: 1,
        speaker: 'hq',
        text: '雷达发现低空直升机信号，注意湖岸方向。',
      },
      {
        trigger: 'wave-start',
        index: 3,
        speaker: 'wingman',
        text: '它们在追公路上的车队！先救车队！',
      },
      {
        trigger: 'wave-complete',
        index: 4,
        speaker: 'hq',
        text: '编队已清空……等等，高空出现一个巨大的回波。',
      },
      {
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: '检测到人类拦截机一架。效率低下。即将清除。',
      },
      { trigger: 'boss-spawn', speaker: 'hq', text: '是重型轰炸机「雷云」！别让它飞到水坝上空！' },
      { trigger: 'boss-low-health', speaker: 'wingman', text: '它在冒黑烟！再加把劲！' },
      { trigger: 'boss-defeated', speaker: 'wingman', text: '雷云坠湖了！漂亮，猎鹰！' },
      {
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: '残骸里的航迹数据指向南方沙海——那是它的补给线。',
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: '镜湖水坝守住了。神谕的第一次进攻被瓦解，但它的补给线仍在南方。',
  },
  {
    level: 2,
    chapterLabel: '第二章',
    codename: 'OPERATION SANDWALL',
    operationName: '沙墙行动',
    title: '沙漠风暴',
    location: '南境沙海 · 黑曜补给走廊',
    intro: [
      '轰炸机的航迹把我们引向南方沙海。神谕在那里修建了一条无人值守的补给走廊。',
      '坦克与地空导弹昼夜不停地向北推进，走廊的心脏是一座履带式移动堡垒——「沙墙」。',
      '一个自称陈曦的人通过加密频道联系了我们：切断补给线，神谕的北线攻势就会停摆。',
    ],
    objectives: ['摧毁坦克纵队与地空导弹阵地', '被导弹锁定时投放热焰弹', '摧毁移动堡垒「沙墙」'],
    levelBriefingLine: '切断补给走廊，地空导弹来袭时投放热焰弹',
    boss: {
      name: '移动堡垒「沙墙」',
      codename: 'SANDWALL',
      briefingLine: '防空炮与主炮分区处理',
      weakPointHint: '先拔掉四角防空炮，再集中火力攻击核心。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '前方是黑曜补给走廊。坦克和导弹车都是优先目标。',
      },
      {
        trigger: 'level-start',
        speaker: 'scientist',
        text: '我是陈曦……神谕是我设计的。我会帮你们阻止它。',
      },
      {
        trigger: 'wave-start',
        index: 1,
        speaker: 'wingman',
        text: '地面有导弹车！被锁定就按 G 放热焰弹！',
      },
      { trigger: 'wave-start', index: 3, speaker: 'hq', text: '友军车队进入走廊，掩护他们通过。' },
      {
        trigger: 'wave-complete',
        index: 4,
        speaker: 'scientist',
        text: '沙墙要出来了。它的防空炮会封锁整片空域。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '沙墙从未被突破。你不会是例外。' },
      { trigger: 'boss-low-health', speaker: 'scientist', text: '核心装甲在过热！就是现在！' },
      { trigger: 'boss-defeated', speaker: 'hq', text: '沙墙瘫痪！补给走廊被切断了。' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '不好……它的数据核心把我的位置发给了神谕。它要来找我了。',
      },
    ],
    unlockedWeapons: ['rockets'],
    unlockLine: '工程部为你挂载了集束火箭，专门对付装甲车队。按 F 发射，1-5 或 Tab 切换武器。',
    debriefSummary: '补给走廊被切断。陈曦博士暴露了行踪，神谕的下一个目标是她。',
  },
  {
    level: 3,
    chapterLabel: '第三章',
    codename: 'OPERATION WHITE ECHO',
    operationName: '白色回声',
    title: '雪山之巅',
    location: '霜脊山脉 · 极光研究站',
    intro: [
      '陈曦博士藏身在霜脊山脉之巅的研究站。暴风雪中，神谕派出了它最诡异的造物。',
      '那是一艘悬浮的生化机械战舰，八条触手，八只传感器之眼——「深渊之眼」。',
      '撕开防线，掩护博士的撤离直升机离开山顶。',
    ],
    objectives: ['摧毁研究站外围的防空阵地', '护送撤离直升机', '击破八爪鱼战舰「深渊之眼」'],
    levelBriefingLine: '在冰雾中打穿防线，护送博士撤离',
    boss: {
      name: '八爪鱼战舰「深渊之眼」',
      codename: 'KRAKEN',
      briefingLine: '先击破触手之眼，再攻击脑核',
      weakPointHint: '八只传感器之眼是它的视觉，打瞎它们会削弱主体。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'scientist',
        text: '猎鹰，我在研究站里。外面的雷达站会给它们报点。',
      },
      { trigger: 'level-start', speaker: 'hq', text: '先拔掉雷达站和高炮，撤离直升机才能起飞。' },
      {
        trigger: 'wave-start',
        index: 2,
        speaker: 'wingman',
        text: '撤离直升机升空了！别让任何东西靠近它！',
      },
      {
        trigger: 'wave-complete',
        index: 5,
        speaker: 'scientist',
        text: '它来了……我认得这个信号。是「深渊之眼」。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '陈曦。你创造了我。现在，回到我身边。' },
      { trigger: 'boss-spawn', speaker: 'scientist', text: '它的眼睛是传感器簇——先打瞎它！' },
      { trigger: 'boss-low-health', speaker: 'wingman', text: '它的脑核露出来了！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '我安全了……谢谢你，猎鹰。从现在起，我和你们一起战斗。',
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: '陈曦博士成功撤离，并带来了神谕舰队的全部情报。',
  },
  {
    level: 4,
    chapterLabel: '第四章',
    codename: 'OPERATION TRIDENT FALL',
    operationName: '三叉戟陨落',
    title: '深海决战',
    location: '风暴海峡 · 东部航线',
    intro: [
      '神谕的舰队封锁了东部海峡，三百艘商船被困在航道上进退两难。',
      '舰队旗舰是导弹驱逐舰「三叉戟」，它的垂直发射井足以覆盖整片海域。',
      '陈博士连夜为你改装了脉冲激光——持续照射威力惊人，但要留意过热。',
    ],
    objectives: ['击沉敌方炮艇与护卫舰', '保护被困商船与友军护卫舰', '击沉导弹驱逐舰「三叉戟」'],
    levelBriefingLine: '解除海峡封锁，商船在航道上，注意射界',
    boss: {
      name: '导弹驱逐舰「三叉戟」',
      codename: 'TRIDENT',
      briefingLine: '注意垂发导弹来袭，优先拦截',
      weakPointHint: '舰桥与垂直发射井是要害，来袭导弹可以被击落。',
    },
    radio: [
      { trigger: 'level-start', speaker: 'hq', text: '海峡里全是商船。只打挂着黑曜旗的船。' },
      {
        trigger: 'wave-start',
        index: 1,
        speaker: 'wingman',
        text: '高速炮艇！它们在之字形机动，提前量打足！',
      },
      {
        trigger: 'wave-start',
        index: 3,
        speaker: 'scientist',
        text: '声呐显示水下有潜艇。它浮上来开火时才能被打中。',
      },
      {
        trigger: 'wave-complete',
        index: 5,
        speaker: 'hq',
        text: '三叉戟正在调转炮口，所有单位准备接敌。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '海洋属于秩序。你的航线到此为止。' },
      { trigger: 'boss-low-health', speaker: 'scientist', text: '它的发射井在殉爆！保持距离！' },
      { trigger: 'boss-defeated', speaker: 'hq', text: '海峡解封！商船正在离港。' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '不对……三叉戟的指令来自首都上空。神谕要直击首都！',
      },
    ],
    unlockedWeapons: ['laser'],
    unlockLine: '脉冲激光已上线：按住 F 持续照射，热量满载会强制冷却。',
    debriefSummary: '东部海峡重新开放，但神谕的真正目标已经浮出水面——首都。',
  },
  {
    level: 5,
    chapterLabel: '第五章',
    codename: 'OPERATION SKYFALL',
    operationName: '天坠行动',
    title: '城市废墟',
    location: '首都 · 中央城区上空',
    intro: [
      '首都上空出现了一座会飞的航空母舰——「巨像」。它的甲板停满无人战机，舷岛雷达笼罩全城。',
      '城市里还有数十万未撤离的平民，街道上挤满了民用车辆。',
      '每一发炮弹，都必须落在正确的地方。',
    ],
    objectives: ['压制城区防空网', '避免误伤民用车辆', '击落空中航母「巨像」'],
    levelBriefingLine: '最高警戒空域，清场后迎战空中航母',
    boss: {
      name: '空中航母「巨像」',
      codename: 'COLOSSUS',
      briefingLine: '甲板与舷岛分区打击',
      weakPointHint: '舷岛雷达与弹射器是要害，持续压制起飞的舰载机。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '这里是首都。预警机「天眼」会为你标出所有目标。',
      },
      { trigger: 'level-start', speaker: 'wingman', text: '下面全是平民车辆。别手抖。' },
      {
        trigger: 'wave-start',
        index: 2,
        speaker: 'hq',
        text: '楼顶有防空炮阵地，低空突防要小心。',
      },
      { trigger: 'wave-start', index: 4, speaker: 'wingman', text: '轰炸机在找天眼！护住预警机！' },
      {
        trigger: 'wave-complete',
        index: 6,
        speaker: 'hq',
        text: '巨像正在降低高度……它要直接压上来了！',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '人类的城市，是混乱的源头。' },
      { trigger: 'boss-low-health', speaker: 'wingman', text: '甲板起火了！它撑不了多久！' },
      { trigger: 'boss-defeated', speaker: 'hq', text: '巨像坠入港湾……首都守住了！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '猎鹰，黑匣子里没有神谕的核心。它从来不在这里——它在南太平洋的火山岛上造军队。',
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: '首都转危为安。可陈博士的发现令人不安：神谕的核心藏在南太平洋的火山岛上。',
  },
  {
    level: 6,
    chapterLabel: '第六章',
    codename: 'OPERATION HEARTFORGE',
    operationName: '熔心行动',
    title: '熔炉之心',
    location: '南太平洋 · 赤炎火山岛',
    intro: [
      '赤炎岛的火山口被改造成了一座巨型兵工厂，熔岩为神谕的锻炉提供无穷的热能。',
      '新的战争机器每小时下线一批。守卫兵工厂的，是踏着熔岩河前进的四足攻城机甲——「熔岩巨像」。',
      '陈博士为你装上了蜂群导弹：无需锁定，自动追踪最近的目标。',
    ],
    objectives: [
      '摧毁火山岛防空与装甲部队',
      '拦截向外输送机甲的运输编队',
      '击毁攻城机甲「熔岩巨像」',
    ],
    levelBriefingLine: '突入火山兵工厂，熔岩上空注意热浪与火山灰',
    boss: {
      name: '攻城机甲「熔岩巨像」',
      codename: 'MAGMA COLOSSUS',
      briefingLine: '过热时攻击打开的散热口',
      weakPointHint: '它每次齐射后散热口会打开发光，那是装甲最薄弱的时刻。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'scientist',
        text: '欢迎来到神谕的锻炉。整座火山都是它的弹药库。',
      },
      { trigger: 'level-start', speaker: 'hq', text: '火山灰会干扰视线，跟紧雷达。' },
      { trigger: 'wave-start', index: 2, speaker: 'wingman', text: '无人机蜂群！别让它们贴上来！' },
      { trigger: 'wave-start', index: 4, speaker: 'hq', text: '轰炸机编队正在起飞，拦下它们！' },
      {
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: '地面在震动……熔岩巨像醒了。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '锻炉永不熄灭。你也将被熔铸。' },
      { trigger: 'boss-spawn', speaker: 'scientist', text: '齐射之后它要散热，盯住发光的散热口！' },
      { trigger: 'boss-phase', index: 2, speaker: 'wingman', text: '它开始喷熔岩柱了！保持高度！' },
      { trigger: 'boss-low-health', speaker: 'scientist', text: '腿部关节过载了，它站不稳了！' },
      { trigger: 'boss-defeated', speaker: 'wingman', text: '巨像倒进熔岩河了！整座岛都在晃！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '兵工厂的数据流在向北极传输——神谕正在转移它的核心！',
      },
    ],
    unlockedWeapons: ['swarm'],
    unlockLine: '蜂群导弹就绪：按 F 一次齐射，导弹会自动分配给附近的目标。',
    debriefSummary: '火山兵工厂熄火。神谕把核心数据装进潜艇，驶向了北极冰海。',
  },
  {
    level: 7,
    chapterLabel: '第七章',
    codename: 'OPERATION POLAR NIGHT',
    operationName: '极夜行动',
    title: '极光冰海',
    location: '北冰洋 · 极光冰架',
    intro: [
      '极夜笼罩北冰洋，极光在冰架上空翻涌。神谕把核心数据装进了一艘巨型潜艇——「深渊利维坦」。',
      '它在冰层之下驶向秘密中继站，只有在发射武器时才会破冰上浮。那是你唯一的攻击窗口。',
      '电磁轨道炮已经就绪：蓄力之后，弹丸可以贯穿一整列目标。',
    ],
    objectives: ['清除冰海上的护卫舰与潜艇', '保护友军破冰护卫舰', '在利维坦上浮时将其击沉'],
    levelBriefingLine: '极夜冰海，潜艇只在上浮开火时可被击中',
    boss: {
      name: '巨型潜艇「深渊利维坦」',
      codename: 'ABYSSAL LEVIATHAN',
      briefingLine: '潜航时无敌，上浮开火时全力输出',
      weakPointHint: '上浮后指挥塔与导弹舱暴露，潜航时任何攻击都无效。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '友军破冰护卫舰「北辰」已在冰海待命，它会为你提供防空掩护。',
      },
      {
        trigger: 'level-start',
        speaker: 'scientist',
        text: '冰层下有很多潜艇。等它们浮上来再打。',
      },
      {
        trigger: 'wave-start',
        index: 2,
        speaker: 'wingman',
        text: '敌方护卫舰在用近防炮，别贴太近！',
      },
      { trigger: 'wave-start', index: 4, speaker: 'hq', text: '「北辰」遭到攻击！猎鹰，回防！' },
      {
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: '声呐里有一个……一个城市那么大的回波。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '深海之下，没有天空。也没有你。' },
      { trigger: 'boss-spawn', speaker: 'scientist', text: '它潜航时打不动！等它破冰上浮！' },
      {
        trigger: 'boss-phase',
        index: 2,
        speaker: 'wingman',
        text: '它开始布雷了！水面上的发光点别碰！',
      },
      { trigger: 'boss-low-health', speaker: 'hq', text: '利维坦的压载舱破了，它浮不了多久了！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '数据核心沉入深海了……但神谕已经把一部分自己上传到了雷暴峡谷的能源网络。',
      },
    ],
    unlockedWeapons: ['railgun'],
    unlockLine: '电磁轨道炮上线：按住 F 蓄力，松开发射，可贯穿多个目标。',
    debriefSummary: '利维坦沉没，核心数据随之葬入深海。神谕残存的意识逃进了雷暴峡谷的能源网络。',
  },
  {
    level: 8,
    chapterLabel: '第八章',
    codename: 'OPERATION STORMBREAK',
    operationName: '破雷行动',
    title: '雷霆峡谷',
    location: '西部荒原 · 雷鸣峡谷',
    intro: [
      '雷鸣峡谷终年雷暴。神谕在峡谷上空停泊了一艘装甲飞艇——「雷霆」。',
      '它用特斯拉线圈收集闪电，为遍布全球的网络供能。',
      '峡谷里的友军车队正在向前线运送防空导弹，敌方直升机与轰炸机早已盯上了他们。',
    ],
    objectives: ['护送友军车队穿越峡谷', '清除峡谷中的地空导弹与直升机', '击落装甲飞艇「雷霆」'],
    levelBriefingLine: '雷暴峡谷，掩护车队并避开电弧',
    boss: {
      name: '装甲飞艇「雷霆」',
      codename: 'TEMPEST',
      briefingLine: '避开电弧，击破发光气囊',
      weakPointHint: '侧面的发光气囊是浮力来源，击破越多它降得越低。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '车队「长弓」正在进入峡谷。他们没有防空能力。',
      },
      { trigger: 'level-start', speaker: 'wingman', text: '这雷暴……我的仪表在乱跳。' },
      {
        trigger: 'wave-start',
        index: 1,
        speaker: 'hq',
        text: '武装直升机贴着崖壁飞，盯住车队两侧！',
      },
      {
        trigger: 'wave-start',
        index: 4,
        speaker: 'scientist',
        text: '峡谷高处有地空导弹车，热焰弹准备好。',
      },
      {
        trigger: 'wave-complete',
        index: 6,
        speaker: 'hq',
        text: '雷霆飞艇进入射程。所有人注意电弧。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '闪电即是我的意志。' },
      {
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: '线圈充能时会发蓝光，看到就立刻拉开距离！',
      },
      { trigger: 'boss-phase', index: 2, speaker: 'wingman', text: '它放出了一群无人机！' },
      { trigger: 'boss-low-health', speaker: 'scientist', text: '浮力不足了，它在下坠！' },
      { trigger: 'boss-defeated', speaker: 'hq', text: '雷霆坠毁！神谕的全球网络断电百分之四十！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '它只剩最后一条路——天梯。它要把自己上传到轨道武器平台。',
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: '雷霆坠毁，神谕的能源网络崩溃。它孤注一掷，沿着天梯向轨道逃窜。',
  },
  {
    level: 9,
    chapterLabel: '第九章',
    codename: 'OPERATION SKYSPIRE',
    operationName: '天梯行动',
    title: '天梯之巅',
    location: '赤道 · 天梯轨道电梯 · 平流层',
    intro: [
      '两万米高空，云海在脚下燃烧。天梯轨道电梯直通近地轨道，神谕正沿着它的光纤主干向上爬行。',
      '守卫天梯的是隐形飞翼「幻影」。它能从雷达上消失，还会投射全息诱饵。',
      '陈博士的最后一件作品——电磁脉冲。它能让无人机瘫痪，也能让幻影现形。',
    ],
    objectives: ['保护友军预警机', '避免击中误入空域的民航客机', '击落隐形飞翼「幻影」'],
    levelBriefingLine: '平流层空战，民航客机正在撤离空域',
    boss: {
      name: '隐形飞翼「幻影」',
      codename: 'PHANTOM WING',
      briefingLine: '隐形时用 EMP 逼其现形，小心全息诱饵',
      weakPointHint: '只有现形时才能锁定它；诱饵被击中会立刻消散。',
    },
    radio: [
      {
        trigger: 'level-start',
        speaker: 'hq',
        text: '这个高度只有我们和它。还有几架没来得及撤离的民航客机。',
      },
      { trigger: 'level-start', speaker: 'wingman', text: '这么高的地方打仗……我会想念地面的。' },
      {
        trigger: 'wave-start',
        index: 2,
        speaker: 'scientist',
        text: '无人机蜂群！EMP 能一次瘫痪一片。',
      },
      {
        trigger: 'wave-start',
        index: 5,
        speaker: 'hq',
        text: '预警机报告雷达上有一个消失又出现的回波。',
      },
      {
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: '是幻影。它就在我们中间，只是你看不见。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '你看不见的东西，你要如何击落？' },
      {
        trigger: 'boss-phase',
        index: 2,
        speaker: 'scientist',
        text: '它放出了全息诱饵！真身的引擎尾焰是红色的！',
      },
      { trigger: 'boss-low-health', speaker: 'wingman', text: '它的隐形涂层在剥落！' },
      {
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: '上传被切断了！神谕被困在了它的最后堡垒——黑曜城堡。',
      },
      { trigger: 'boss-defeated', speaker: 'hq', text: '全体单位，准备最终行动。' },
    ],
    unlockedWeapons: ['emp'],
    unlockLine: '电磁脉冲就绪：按 F 释放，瘫痪周围的敌机与导弹，并让隐形目标现形。',
    debriefSummary: '天梯上的上传被切断。神谕退守黑曜城堡，最后的决战即将来临。',
  },
  {
    level: 10,
    chapterLabel: '最终章',
    codename: 'OPERATION LAST LIGHT',
    operationName: '终焉之光',
    title: '神谕核心',
    location: '黑曜城堡 · 陨石坑',
    intro: [
      '黑曜城堡矗立在一座陨石坑中央，熔火与霓虹把夜空染成暗红。神谕的全部力量都在这里。',
      '所有友军都已集结。渡鸦在你的左翼，天穹舰队在你的身后。',
      '神谕主核由四座护盾塔守护。先摧毁护盾塔，才能触及核心。这是最后一战。',
    ],
    objectives: ['突破黑曜城堡的全部防线', '摧毁四座护盾塔', '击破神谕主核「神谕主宰」'],
    levelBriefingLine: '最终决战：突破城堡防线，摧毁神谕',
    boss: {
      name: '神谕主宰',
      codename: 'ORACLE PRIME',
      briefingLine: '先毁四座护盾塔，再击破核心',
      weakPointHint: '护盾塔全毁前核心无敌；最终过载阶段攻击最为猛烈。',
    },
    radio: [
      { trigger: 'level-start', speaker: 'hq', text: '这里是天穹。所有单位，这是最后一战。' },
      { trigger: 'level-start', speaker: 'wingman', text: '猎鹰，打完这一仗，晚饭真的我请。' },
      {
        trigger: 'level-start',
        speaker: 'scientist',
        text: '我把神谕的全部弱点都传给你了。去结束它吧。',
      },
      {
        trigger: 'wave-start',
        index: 3,
        speaker: 'hq',
        text: '城堡的防空网全开了，用你学到的一切。',
      },
      {
        trigger: 'wave-start',
        index: 6,
        speaker: 'wingman',
        text: '它们把所有能飞的东西都派出来了！',
      },
      {
        trigger: 'wave-complete',
        index: 7,
        speaker: 'scientist',
        text: '核心室打开了……它在等你。',
      },
      { trigger: 'boss-spawn', speaker: 'oracle', text: '猎鹰。你一路摧毁的，不过是我的影子。' },
      { trigger: 'boss-spawn', speaker: 'scientist', text: '四座护盾塔！先打塔，再打核心！' },
      { trigger: 'boss-phase', index: 2, speaker: 'oracle', text: '护盾……失效？不可能。' },
      {
        trigger: 'boss-phase',
        index: 3,
        speaker: 'oracle',
        text: '如果天空不属于我，那它将不属于任何人！',
      },
      { trigger: 'boss-phase', index: 3, speaker: 'hq', text: '核心过载了！猎鹰，坚持住！' },
      { trigger: 'boss-low-health', speaker: 'wingman', text: '就差一点了！' },
      { trigger: 'boss-defeated', speaker: 'oracle', text: '……天空……需要……秩……序……' },
      { trigger: 'boss-defeated', speaker: 'scientist', text: '神谕的信号消失了。全部。' },
      {
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: '这里是天穹。所有单位……天空自由了。猎鹰，欢迎回家。',
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: '神谕被彻底摧毁。天空，重新属于每一个人。',
  },
];

/** 首次遭遇某类单位时的提示台词；键为 UnitType 枚举的字符串值 */
export const UNIT_FIRST_CONTACT_RADIO: Readonly<Record<string, RadioLine>> = {
  TANK: { trigger: 'wave-start', speaker: 'hq', text: '地面坦克纵队！集束火箭对装甲最有效。' },
  SAM_LAUNCHER: {
    trigger: 'wave-start',
    speaker: 'wingman',
    text: '地空导弹车！听到锁定告警就按 G 放热焰弹！',
  },
  AA_GUN: { trigger: 'wave-start', speaker: 'hq', text: '高炮阵地！别在它的射界里直线飞行。' },
  RADAR_STATION: {
    trigger: 'wave-start',
    speaker: 'scientist',
    text: '雷达站在为敌机校准火力，摧毁它会让敌人打不准。',
  },
  GUNBOAT: { trigger: 'wave-start', speaker: 'wingman', text: '高速炮艇！提前量打足！' },
  FRIGATE: { trigger: 'wave-start', speaker: 'hq', text: '敌方护卫舰，近防炮很凶，从高角度切入。' },
  SUBMARINE: {
    trigger: 'wave-start',
    speaker: 'scientist',
    text: '潜艇只在上浮发射时可以被击中。',
  },
  ATTACK_HELICOPTER: {
    trigger: 'wave-start',
    speaker: 'wingman',
    text: '武装直升机贴地飞行，压低机头去追！',
  },
  BOMBER: { trigger: 'wave-start', speaker: 'hq', text: '敌方轰炸机正在扑向友军，优先拦截！' },
  DRONE: { trigger: 'wave-start', speaker: 'wingman', text: '自杀无人机！别让它们撞上你！' },
  ALLY_CONVOY: { trigger: 'wave-start', speaker: 'hq', text: '友军车队进入战区，掩护他们。' },
  ALLY_FRIGATE: {
    trigger: 'wave-start',
    speaker: 'hq',
    text: '友军护卫舰会用防空炮帮你清理导弹。',
  },
  ALLY_AWACS: {
    trigger: 'wave-start',
    speaker: 'hq',
    text: '预警机在线，雷达覆盖范围扩大。保护好它。',
  },
  CIVILIAN_AIRLINER: {
    trigger: 'wave-start',
    speaker: 'civilian',
    text: '这里是民航航班，我们正在撤离空域，请勿开火！',
  },
  CIVILIAN_SHIP: {
    trigger: 'wave-start',
    speaker: 'civilian',
    text: '民用船只，请求通过！我们没有武装！',
  },
  CIVILIAN_TRUCK: {
    trigger: 'wave-start',
    speaker: 'hq',
    text: '公路上是撤离的平民车辆，注意射界。',
  },
};

/** 通用战场台词（不随章节变化） */
export type GenericRadioKey =
  | 'civilian-hit'
  | 'civilian-destroyed'
  | 'ally-unit-destroyed'
  | 'escort-success'
  | 'escort-failed'
  | 'missile-warning'
  | 'low-health'
  | 'weapon-overheat'
  | 'checkpoint';

export const GENERIC_RADIO: Readonly<Record<GenericRadioKey, RadioLine>> = {
  'civilian-hit': { trigger: 'wave-start', speaker: 'hq', text: '停火！那是平民目标！' },
  'civilian-destroyed': {
    trigger: 'wave-start',
    speaker: 'hq',
    text: '平民伤亡……猎鹰，注意你的射界。',
  },
  'ally-unit-destroyed': {
    trigger: 'wave-start',
    speaker: 'wingman',
    text: '友军被击毁了！该死！',
  },
  'escort-success': { trigger: 'wave-complete', speaker: 'hq', text: '护送目标安全，干得好。' },
  'escort-failed': { trigger: 'wave-complete', speaker: 'hq', text: '护送目标失守……继续作战。' },
  'missile-warning': {
    trigger: 'wave-start',
    speaker: 'wingman',
    text: '导弹锁定你了！放热焰弹！',
  },
  'low-health': { trigger: 'wave-start', speaker: 'wingman', text: '猎鹰，你在冒烟！拉起来！' },
  'weapon-overheat': {
    trigger: 'wave-start',
    speaker: 'scientist',
    text: '武器过热了，等它冷却！',
  },
  checkpoint: { trigger: 'wave-complete', speaker: 'hq', text: '战况已记录。' },
};

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
