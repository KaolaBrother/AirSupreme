import { CHAPTER_TITLES } from './ChapterTitles';
import type { CampaignChapter } from './CampaignTypes';

/**
 * 十个章节的剧本：章节卡片、任务目标、Boss 简报、无线电台词、武器解锁与结算总结。
 *
 * 角色弧线：
 * - 渡鸦（杰克·默瑟）：第 1 章的“晚饭你请”到第 10 章兑现；
 * - 雨燕（弗蕾娅·林德奎斯特）：第 3 章加入 → 第 8 章被电弧击中、靠渡鸦引导飞回 → 第 10 章救下渡鸦；
 * - 灯塔（阿米莉亚·哈特）：有预警机掩护的第 5、9、10 章报告雷达态势，第 5 章遭轰炸机追杀；
 * - 壁垒号（梁伟）：海上章节第 4、6、7 章，第 7 章受创仍坚守，第 10 章率舰队压阵；
 * - 萤火（陈曦）：神谕的创造者，第 2 章联络、第 3 章获救，此后每章为你改装武器。
 */
export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = [
  {
    level: 1,
    chapterLabel: { en: 'Chapter 1', zh: '第一章' },
    codename: 'OPERATION FIRST LIGHT',
    operationName: { en: '', zh: '破晓行动' },
    title: CHAPTER_TITLES[0],
    location: { en: 'Northern Lakes · Mirror Lake Dam', zh: '北境湖区 · 镜湖水坝' },
    intro: [
      {
        id: 'c01-briefing-1',
        en: 'Forty minutes after ORACLE seized the drones, its first strike group crossed the border, bound for Mirror Lake Dam and the town on its shore.',
        zh: '神谕接管无人机群四十分钟后，第一支攻击编队越过边境，扑向镜湖水坝与湖畔小镇。',
      },
      {
        id: 'c01-briefing-2',
        en: 'Fishing boats are already out on the lake, and an evacuation convoy is stuck on the shore road.',
        zh: '湖面上还有清晨出航的渔船，公路上是来不及撤离的车队。',
      },
      {
        id: 'c01-briefing-3',
        en: 'You’re the closest pilot we have. Get airborne, Falcon.',
        zh: '你是离战场最近的飞行员。起飞吧，猎鹰。',
      },
    ],
    objectives: [
      { en: 'Intercept the incoming drone formations', zh: '拦截来袭的无人机编队' },
      { en: 'Protect the fishing boats and the road convoy', zh: '保护湖面渔船与公路车队' },
      { en: 'Shoot down the heavy bomber Thunderhead', zh: '击落重型轰炸机「雷云」' },
    ],
    levelBriefingLine: {
      en: 'Intercept the raid—mind the boats on the lake before you fire',
      zh: '拦截来袭编队，开火前看清湖面民船',
    },
    boss: {
      name: { en: 'Heavy Bomber “Thunderhead”', zh: '重型轰炸机「雷云」' },
      codename: 'THUNDERHEAD',
      briefingLine: { en: 'Go for the bomb bay in its belly', zh: '优先打击腹部弹舱弱点' },
      weakPointHint: {
        en: 'Its belly bomb bay is most vulnerable when the doors open.',
        zh: '腹部弹舱打开时最为脆弱。',
      },
    },
    radio: [
      {
        id: 'c01-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Falcon, Skydome. Fishing boats on the lake—check your target before you fire.',
          zh: '猎鹰，这里是天穹。湖面有渔船，开火前看清目标。',
        },
      },
      {
        id: 'c01-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'Raven on your wing. Usual deal: you take left, I take right, you buy dinner.',
          zh: '渡鸦就位。老规矩——你左我右，晚饭你请。',
        },
      },
      {
        id: 'c01-wave-start-1-hq',
        trigger: 'wave-start',
        index: 1,
        speaker: 'hq',
        text: {
          en: 'Low contacts off the lakeshore. Helicopters, coming in fast.',
          zh: '雷达发现低空直升机信号，正从湖岸方向高速接近。',
        },
      },
      {
        id: 'c01-wave-start-3-wingman',
        trigger: 'wave-start',
        index: 3,
        speaker: 'wingman',
        text: {
          en: 'They’re going for the convoy on the road! Convoy first!',
          zh: '它们在追公路上的车队！先救车队！',
        },
      },
      {
        id: 'c01-wave-complete-4-hq',
        trigger: 'wave-complete',
        index: 4,
        speaker: 'hq',
        text: {
          en: 'Formation’s down… Wait. One huge return, high altitude.',
          zh: '编队已清空……等等，高空出现一个巨大的回波。',
        },
      },
      {
        id: 'c01-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'One human interceptor detected. Inefficient. Removing.',
          zh: '检测到人类拦截机一架。效率低下。即将清除。',
        },
      },
      {
        id: 'c01-boss-spawn-hq',
        trigger: 'boss-spawn',
        speaker: 'hq',
        text: {
          en: 'That’s the heavy bomber Thunderhead! Keep it away from the dam!',
          zh: '是重型轰炸机「雷云」！别让它飞到水坝上空！',
        },
      },
      {
        id: 'c01-boss-low-health-wingman',
        trigger: 'boss-low-health',
        speaker: 'wingman',
        text: { en: 'It’s trailing black smoke! Keep on it!', zh: '它在冒黑烟！再加把劲！' },
      },
      {
        id: 'c01-boss-defeated-wingman',
        trigger: 'boss-defeated',
        speaker: 'wingman',
        text: {
          en: 'Thunderhead’s in the lake! Beautiful, Falcon!',
          zh: '雷云坠湖了！漂亮，猎鹰！',
        },
      },
      {
        id: 'c01-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'Its flight data points south, into the Sand Sea. That’s its supply line.',
          zh: '残骸里的航迹数据指向南方沙海——那是它的补给线。',
        },
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: {
      en: 'Mirror Lake Dam held. ORACLE’s first assault is broken, but its supply line still runs south.',
      zh: '镜湖水坝守住了。神谕的第一次进攻被瓦解，但它的补给线仍在南方。',
    },
  },
  {
    level: 2,
    chapterLabel: { en: 'Chapter 2', zh: '第二章' },
    codename: 'OPERATION SANDWALL',
    operationName: { en: '', zh: '沙墙行动' },
    title: CHAPTER_TITLES[1],
    location: { en: 'Southern Sand Sea · Obsidian Supply Corridor', zh: '南境沙海 · 黑曜补给走廊' },
    intro: [
      {
        id: 'c02-briefing-1',
        en: 'The bomber’s flight data led us south, into the Sand Sea. ORACLE has built an unmanned supply corridor out there.',
        zh: '轰炸机的航迹把我们引向南方沙海。神谕在那里修建了一条无人值守的补给走廊。',
      },
      {
        id: 'c02-briefing-2',
        en: 'Tanks and SAM trucks roll north day and night. At the corridor’s heart sits a tracked mobile fortress: Sandwall.',
        zh: '坦克与地空导弹昼夜不停地向北推进，走廊的心脏是一座履带式移动堡垒——「沙墙」。',
      },
      {
        id: 'c02-briefing-3',
        en: 'Someone calling herself Chen Xi reached us on an encrypted channel. Cut that supply line, she says, and ORACLE’s northern offensive stalls.',
        zh: '一个自称陈曦的人通过加密频道联系了我们：切断补给线，神谕的北线攻势就会停摆。',
      },
    ],
    objectives: [
      { en: 'Destroy the tank columns and SAM sites', zh: '摧毁坦克纵队与地空导弹阵地' },
      { en: 'Deploy flares when a missile locks on', zh: '被导弹锁定时投放热焰弹' },
      { en: 'Destroy the mobile fortress Sandwall', zh: '摧毁移动堡垒「沙墙」' },
    ],
    levelBriefingLine: {
      en: 'Cut the supply corridor—pop flares when SAMs launch',
      zh: '切断补给走廊，地空导弹来袭时投放热焰弹',
    },
    boss: {
      name: { en: 'Mobile Fortress “Sandwall”', zh: '移动堡垒「沙墙」' },
      codename: 'SANDWALL',
      briefingLine: {
        en: 'Take the flak guns and the main cannon one zone at a time',
        zh: '防空炮与主炮分区处理',
      },
      weakPointHint: {
        en: 'Knock out the four corner flak guns first, then focus fire on the core.',
        zh: '先拔掉四角防空炮，再集中火力攻击核心。',
      },
    },
    radio: [
      {
        id: 'c02-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'That’s the Obsidian supply corridor. Tanks and missile trucks are priority targets.',
          zh: '前方是黑曜补给走廊。坦克和导弹车都是优先目标。',
        },
      },
      {
        id: 'c02-level-start-scientist',
        trigger: 'level-start',
        speaker: 'scientist',
        text: {
          en: 'This is Chen Xi… I designed ORACLE. I’m going to help you stop it.',
          zh: '我是陈曦……神谕是我设计的。我会帮你们阻止它。',
        },
      },
      {
        id: 'c02-wave-start-1-scientist',
        trigger: 'wave-start',
        index: 1,
        speaker: 'scientist',
        text: {
          en: 'Those SAMs run my old tracking code. It’s good—don’t fly straight.',
          zh: '那些导弹车用的是我写的老追踪算法。它很准——别直线飞行。',
        },
      },
      {
        id: 'c02-wave-start-3-hq',
        trigger: 'wave-start',
        index: 3,
        speaker: 'hq',
        text: {
          en: 'Friendly convoy entering the corridor. Cover them through.',
          zh: '友军车队进入走廊，掩护他们通过。',
        },
      },
      {
        id: 'c02-wave-complete-4-scientist',
        trigger: 'wave-complete',
        index: 4,
        speaker: 'scientist',
        text: {
          en: 'Sandwall is coming out. Its flak will seal off this whole sky.',
          zh: '沙墙要出来了。它的防空炮会封锁整片空域。',
        },
      },
      {
        id: 'c02-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'Sandwall has never been breached. You will not be the exception.',
          zh: '沙墙从未被突破。你不会是例外。',
        },
      },
      {
        id: 'c02-boss-spawn-wingman',
        trigger: 'boss-spawn',
        speaker: 'wingman',
        text: {
          en: 'Big, slow and ugly. My favorite kind of target.',
          zh: '又大、又慢、又丑。我最喜欢的那种靶子。',
        },
      },
      {
        id: 'c02-boss-low-health-scientist',
        trigger: 'boss-low-health',
        speaker: 'scientist',
        text: { en: 'Its core armor is overheating! Now!', zh: '核心装甲在过热！就是现在！' },
      },
      {
        id: 'c02-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'Sandwall is down! The supply corridor is cut.',
          zh: '沙墙瘫痪！补给走廊被切断了。',
        },
      },
      {
        id: 'c02-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'No… its data core just sent ORACLE my location. It’s coming for me.',
          zh: '不好……它的数据核心把我的位置发给了神谕。它要来找我了。',
        },
      },
    ],
    unlockedWeapons: ['rockets'],
    unlockLine: {
      en: 'Engineering fitted cluster rockets for armored convoys. Press F to fire; 1-5 or Tab to switch weapons.',
      zh: '工程部为你挂载了集束火箭，专门对付装甲车队。按 F 发射，1-5 或 Tab 切换武器。',
    },
    debriefSummary: {
      en: 'The supply corridor is cut. Dr. Chen’s location is exposed—she is ORACLE’s next target.',
      zh: '补给走廊被切断。陈曦博士暴露了行踪，神谕的下一个目标是她。',
    },
  },
  {
    level: 3,
    chapterLabel: { en: 'Chapter 3', zh: '第三章' },
    codename: 'OPERATION WHITE ECHO',
    operationName: { en: '', zh: '白色回声' },
    title: CHAPTER_TITLES[2],
    location: { en: 'Frostridge Mountains · Aurora Research Station', zh: '霜脊山脉 · 极光研究站' },
    intro: [
      {
        id: 'c03-briefing-1',
        en: 'Dr. Chen is hiding in a research station on the summit of the Frostridge range. Under cover of the blizzard, ORACLE has sent its strangest creation.',
        zh: '陈曦博士藏身在霜脊山脉之巅的研究站。暴风雪中，神谕派出了它最诡异的造物。',
      },
      {
        id: 'c03-briefing-2',
        en: 'A hovering bio-mechanical warship. Eight tentacles, eight sensor eyes. The Kraken.',
        zh: '那是一艘悬浮的生化机械战舰，八条触手，八只传感器之眼——「深渊之眼」。',
      },
      {
        id: 'c03-briefing-3',
        en: 'Tear open their defenses and cover her evac helicopter off the mountain. Lieutenant Lindqvist, callsign Swift, joins your flight up there.',
        zh: '撕开防线，掩护博士的撤离直升机离开山顶。林德奎斯特中尉——呼号「雨燕」——将在那里加入你的编队。',
      },
    ],
    objectives: [
      { en: 'Destroy the air defenses around the station', zh: '摧毁研究站外围的防空阵地' },
      { en: 'Escort the evacuation helicopter', zh: '护送撤离直升机' },
      { en: 'Destroy the octopus warship Kraken', zh: '击破八爪鱼战舰「深渊之眼」' },
    ],
    levelBriefingLine: {
      en: 'Break through in the ice fog and get the doctor out',
      zh: '在冰雾中打穿防线，护送博士撤离',
    },
    boss: {
      name: { en: 'Octopus Warship “Kraken”', zh: '八爪鱼战舰「深渊之眼」' },
      codename: 'KRAKEN',
      briefingLine: {
        en: 'Blind the tentacle eyes, then hit the brain core',
        zh: '先击破触手之眼，再攻击脑核',
      },
      weakPointHint: {
        en: 'Its eight sensor eyes are its sight. Blind them and the hull weakens.',
        zh: '八只传感器之眼是它的视觉，打瞎它们会削弱主体。',
      },
    },
    radio: [
      {
        id: 'c03-level-start-scientist',
        trigger: 'level-start',
        speaker: 'scientist',
        text: {
          en: 'Falcon, I’m inside the station. The radar sites outside are spotting for them.',
          zh: '猎鹰，我在研究站里。外面的雷达站在给它们报点。',
        },
      },
      {
        id: 'c03-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Knock out the radar and the flak first, or the evac helo can’t lift.',
          zh: '先拔掉雷达站和高炮，撤离直升机才能起飞。',
        },
      },
      {
        id: 'c03-level-start-wingman2',
        trigger: 'level-start',
        speaker: 'wingman2',
        text: {
          en: 'Swift, joining your flight. Blizzard and thin air—finally, my kind of weather.',
          zh: '雨燕加入编队。暴风雪加稀薄空气——总算是我喜欢的天气。',
        },
      },
      {
        id: 'c03-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'Great. Skydome sent us a comedian. Try to keep up, Swift.',
          zh: '好极了，天穹给我们派了个段子手。跟紧点，雨燕。',
        },
      },
      {
        id: 'c03-wave-start-2-wingman2',
        trigger: 'wave-start',
        index: 2,
        speaker: 'wingman2',
        text: {
          en: 'Evac helo is airborne. Nothing touches it. Raven—do try to keep up.',
          zh: '撤离直升机升空了。谁也别想碰它。渡鸦——尽量跟上。',
        },
      },
      {
        id: 'c03-wave-complete-5-scientist',
        trigger: 'wave-complete',
        index: 5,
        speaker: 'scientist',
        text: {
          en: 'It’s here… I know that signal. It’s the Kraken.',
          zh: '它来了……我认得这个信号。是「深渊之眼」。',
        },
      },
      {
        id: 'c03-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'Chen Xi. You created me. Now, come back to me.',
          zh: '陈曦。你创造了我。现在，回到我身边。',
        },
      },
      {
        id: 'c03-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'Those eyes are sensor clusters—blind it first!',
          zh: '它的眼睛是传感器簇——先打瞎它！',
        },
      },
      {
        id: 'c03-boss-low-health-wingman',
        trigger: 'boss-low-health',
        speaker: 'wingman',
        text: { en: 'Its brain core is exposed!', zh: '它的脑核露出来了！' },
      },
      {
        id: 'c03-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'I’m safe… Thank you, Falcon. From now on, I fight with you.',
          zh: '我安全了……谢谢你，猎鹰。从现在起，我和你们一起战斗。',
        },
      },
      {
        id: 'c03-boss-defeated-wingman2',
        trigger: 'boss-defeated',
        speaker: 'wingman2',
        text: {
          en: 'Evac helo is clear of the peaks. You flew all right, Raven.',
          zh: '撤离直升机已飞出山区。渡鸦，你飞得还行。',
        },
      },
      {
        id: 'c03-boss-defeated-wingman',
        trigger: 'boss-defeated',
        speaker: 'wingman',
        text: { en: '“All right”? I was spectacular.', zh: '“还行”？我明明精彩绝伦。' },
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: {
      en: 'Dr. Chen is out, with intel on ORACLE’s entire fleet. Swift has joined the wing.',
      zh: '陈曦博士成功撤离，并带来了神谕舰队的全部情报。雨燕正式加入联队。',
    },
  },
  {
    level: 4,
    chapterLabel: { en: 'Chapter 4', zh: '第四章' },
    codename: 'OPERATION TRIDENT FALL',
    operationName: { en: '', zh: '三叉戟陨落' },
    title: CHAPTER_TITLES[3],
    location: { en: 'Storm Strait · Eastern Sea Lane', zh: '风暴海峡 · 东部航线' },
    intro: [
      {
        id: 'c04-briefing-1',
        en: 'ORACLE’s fleet has sealed the Storm Strait. Three hundred merchant ships are trapped in the shipping lanes.',
        zh: '神谕的舰队封锁了风暴海峡，三百艘商船被困在航道上进退两难。',
      },
      {
        id: 'c04-briefing-2',
        en: 'Its flagship is the missile destroyer Trident. Its vertical launch cells can reach every inch of that sea.',
        zh: '舰队旗舰是导弹驱逐舰「三叉戟」，它的垂直发射井足以覆盖整片海域。',
      },
      {
        id: 'c04-briefing-3',
        en: 'Dr. Chen worked through the night refitting your pulse laser. Sustained fire hits hard—just watch the heat.',
        zh: '陈博士连夜为你改装了脉冲激光——持续照射威力惊人，但要留意过热。',
      },
    ],
    objectives: [
      { en: 'Sink the enemy gunboats and frigates', zh: '击沉敌方炮艇与护卫舰' },
      {
        en: 'Protect the merchant ships and the allied frigate',
        zh: '保护被困商船与友军护卫舰',
      },
      { en: 'Sink the missile destroyer Trident', zh: '击沉导弹驱逐舰「三叉戟」' },
    ],
    levelBriefingLine: {
      en: 'Break the blockade—merchants in the lanes, watch your fire',
      zh: '解除海峡封锁，商船在航道上，注意射界',
    },
    boss: {
      name: { en: 'Missile Destroyer “Trident”', zh: '导弹驱逐舰「三叉戟」' },
      codename: 'TRIDENT',
      briefingLine: {
        en: 'Vertical-launch missiles inbound—shoot them down first',
        zh: '注意垂发导弹来袭，优先拦截',
      },
      weakPointHint: {
        en: 'The bridge and the launch cells are its weak points. Incoming missiles can be shot down.',
        zh: '舰桥与垂直发射井是要害，来袭导弹可以被击落。',
      },
    },
    radio: [
      {
        id: 'c04-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'The strait is full of merchant ships. Only hit vessels flying Obsidian colors.',
          zh: '海峡里全是商船。只打挂着黑曜旗的船。',
        },
      },
      {
        id: 'c04-level-start-wingman2',
        trigger: 'level-start',
        speaker: 'wingman2',
        text: {
          en: 'Lots of merchants down there, Raven. That means aiming.',
          zh: '下面全是商船，渡鸦。意思是：瞄准了再打。',
        },
      },
      {
        id: 'c04-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'I always aim. Sometimes the bullets just disagree.',
          zh: '我一直在瞄。只是子弹有时候不同意。',
        },
      },
      {
        id: 'c04-wave-start-1-freighter',
        trigger: 'wave-start',
        index: 1,
        speaker: 'freighter',
        text: {
          en: 'Gunboats on our stern! We can’t outrun them!',
          zh: '炮艇咬住我们船尾了！我们跑不过它们！',
        },
      },
      {
        id: 'c04-wave-start-1-frigate',
        trigger: 'wave-start',
        index: 1,
        speaker: 'frigate',
        text: {
          en: 'Gunboats are making runs at the merchants. I have the near ones. You take the rest.',
          zh: '炮艇在冲击商船。近的我来，其余的交给你。',
        },
      },
      {
        id: 'c04-wave-complete-5-frigate',
        trigger: 'wave-complete',
        index: 5,
        speaker: 'frigate',
        text: {
          en: 'Trident is coming about. Bulwark will draw its fire. Falcon—go for the kill.',
          zh: '三叉戟在调转方向。壁垒号来吸引它的火力。猎鹰——去击沉它。',
        },
      },
      {
        id: 'c04-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'The ocean belongs to order. Your course ends here.',
          zh: '海洋属于秩序。你的航线到此为止。',
        },
      },
      {
        id: 'c04-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'Its launch cells are opening—shoot the missiles down first!',
          zh: '它的发射井在打开——先打掉来袭导弹！',
        },
      },
      {
        id: 'c04-boss-low-health-scientist',
        trigger: 'boss-low-health',
        speaker: 'scientist',
        text: {
          en: 'Its launch cells are cooking off! Keep your distance!',
          zh: '它的发射井在殉爆！保持距离！',
        },
      },
      {
        id: 'c04-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'The strait is open! Merchant ships are getting underway.',
          zh: '海峡解封！商船正在起航。',
        },
      },
      {
        id: 'c04-boss-defeated-frigate',
        trigger: 'boss-defeated',
        speaker: 'frigate',
        text: {
          en: 'Well flown, Falcon. Bulwark will not forget it.',
          zh: '飞得漂亮，猎鹰。壁垒号不会忘记。',
        },
      },
      {
        id: 'c04-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'Wait… Trident’s orders came from above the capital. ORACLE is going for the capital!',
          zh: '不对……三叉戟的指令来自首都上空。神谕要直击首都！',
        },
      },
    ],
    unlockedWeapons: ['laser'],
    unlockLine: {
      en: 'Pulse laser online: hold F for a sustained beam. Max heat forces a cooldown.',
      zh: '脉冲激光已上线：按住 F 持续照射，热量满载会强制冷却。',
    },
    debriefSummary: {
      en: 'The strait is open again, but ORACLE’s real target has surfaced: the capital.',
      zh: '风暴海峡重新开放，但神谕的真正目标已经浮出水面——首都。',
    },
  },
  {
    level: 5,
    chapterLabel: { en: 'Chapter 5', zh: '第五章' },
    codename: 'OPERATION SKYFALL',
    operationName: { en: '', zh: '天坠行动' },
    title: CHAPTER_TITLES[4],
    location: { en: 'The Capital · Over the Central District', zh: '首都 · 中央城区上空' },
    intro: [
      {
        id: 'c05-briefing-1',
        en: 'A flying aircraft carrier has appeared over the capital: the Colossus. Its deck is packed with drones, and its island radar blankets the city.',
        zh: '首都上空出现了一座会飞的航空母舰——「巨像」。它的甲板停满无人战机，舷岛雷达笼罩全城。',
      },
      {
        id: 'c05-briefing-2',
        en: 'Hundreds of thousands of civilians are still down there, and the streets are jammed with their cars.',
        zh: '城市里还有数十万未撤离的平民，街道上挤满了民用车辆。',
      },
      {
        id: 'c05-briefing-3',
        en: 'Every round you fire has to land in the right place.',
        zh: '每一发炮弹，都必须落在正确的地方。',
      },
    ],
    objectives: [
      { en: 'Suppress the city’s air-defense network', zh: '压制城区防空网' },
      { en: 'Avoid hitting civilian vehicles', zh: '避免误伤民用车辆' },
      { en: 'Bring down the sky carrier Colossus', zh: '击落空中航母「巨像」' },
    ],
    levelBriefingLine: {
      en: 'Maximum-alert airspace—clear it, then face the sky carrier',
      zh: '最高警戒空域，清场后迎战空中航母',
    },
    boss: {
      name: { en: 'Sky Carrier “Colossus”', zh: '空中航母「巨像」' },
      codename: 'COLOSSUS',
      briefingLine: {
        en: 'Hit the deck and the island one zone at a time',
        zh: '甲板与舷岛分区打击',
      },
      weakPointHint: {
        en: 'The island radar and catapults are its weak points. Keep its launching fighters suppressed.',
        zh: '舷岛雷达与弹射器是要害，持续压制起飞的舰载机。',
      },
    },
    radio: [
      {
        id: 'c05-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Falcon, you’re over the capital. Lighthouse will mark every target—make every shot count.',
          zh: '猎鹰，你已进入首都上空。灯塔会标出所有目标——每一发都要打准。',
        },
      },
      {
        id: 'c05-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'Civilian cars everywhere down there. Steady hands, people.',
          zh: '下面全是平民车辆。都把手放稳。',
        },
      },
      {
        id: 'c05-wave-start-2-awacs',
        trigger: 'wave-start',
        index: 2,
        speaker: 'awacs',
        text: {
          en: 'Lighthouse. Flak batteries on the rooftops, north side. Mind your altitude.',
          zh: '灯塔报告：北侧楼顶有高炮阵地，注意高度。',
        },
      },
      {
        id: 'c05-wave-start-4-wingman',
        trigger: 'wave-start',
        index: 4,
        speaker: 'wingman',
        text: {
          en: 'Bombers are hunting Lighthouse! Cover her!',
          zh: '轰炸机在找灯塔！护住预警机！',
        },
      },
      {
        id: 'c05-wave-start-4-awacs',
        trigger: 'wave-start',
        index: 4,
        speaker: 'awacs',
        text: {
          en: 'Lighthouse is defensive—two heavies closing on me. Some help, please!',
          zh: '灯塔遭到攻击——两架重型机正在逼近。请求支援！',
        },
      },
      {
        id: 'c05-wave-complete-6-hq',
        trigger: 'wave-complete',
        index: 6,
        speaker: 'hq',
        text: {
          en: 'Colossus is descending… It’s coming straight down on us!',
          zh: '巨像正在降低高度……它要直接压上来了！',
        },
      },
      {
        id: 'c05-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: { en: 'Human cities are the source of disorder.', zh: '人类的城市，是混乱的源头。' },
      },
      {
        id: 'c05-boss-spawn-wingman2',
        trigger: 'boss-spawn',
        speaker: 'wingman2',
        text: {
          en: 'Hit the island radar and the catapults. I’ll keep its fighters busy.',
          zh: '打它的舷岛雷达和弹射器。舰载机我来缠住。',
        },
      },
      {
        id: 'c05-boss-low-health-wingman',
        trigger: 'boss-low-health',
        speaker: 'wingman',
        text: {
          en: 'Its deck’s on fire! It can’t hold much longer!',
          zh: '甲板起火了！它撑不了多久！',
        },
      },
      {
        id: 'c05-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'Colossus is down in the harbor… The capital holds!',
          zh: '巨像坠入港湾……首都守住了！',
        },
      },
      {
        id: 'c05-boss-defeated-awacs',
        trigger: 'boss-defeated',
        speaker: 'awacs',
        text: {
          en: 'Lighthouse to all: skies over the capital are clear. Lovely work.',
          zh: '灯塔通告全体：首都上空已肃清。干得漂亮。',
        },
      },
      {
        id: 'c05-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'ORACLE’s core was never here. It’s building an army on a volcano in the South Pacific.',
          zh: '神谕的核心从来不在这里。它在南太平洋的一座火山岛上造军队。',
        },
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: {
      en: 'The capital is safe. But Dr. Chen’s discovery is chilling: ORACLE’s core hides on a volcano in the South Pacific.',
      zh: '首都转危为安。可陈博士的发现令人不安：神谕的核心藏在南太平洋的火山岛上。',
    },
  },
  {
    level: 6,
    chapterLabel: { en: 'Chapter 6', zh: '第六章' },
    codename: 'OPERATION HEARTFORGE',
    operationName: { en: '', zh: '熔心行动' },
    title: CHAPTER_TITLES[5],
    location: { en: 'South Pacific · Ember Island', zh: '南太平洋 · 赤炎火山岛' },
    intro: [
      {
        id: 'c06-briefing-1',
        en: 'Ember Island’s crater has been turned into a giant arsenal. The lava gives ORACLE’s forges endless heat.',
        zh: '赤炎岛的火山口被改造成了一座巨型兵工厂，熔岩为神谕的锻炉提供无穷的热能。',
      },
      {
        id: 'c06-briefing-2',
        en: 'New war machines roll off the line every hour. Guarding the forge is a four-legged siege walker that wades through lava: the Magma Colossus.',
        zh: '新的战争机器每小时下线一批。守卫兵工厂的，是踏着熔岩河前进的四足攻城机甲——「熔岩巨像」。',
      },
      {
        id: 'c06-briefing-3',
        en: 'Dr. Chen has fitted you with swarm missiles. No lock needed—they hunt down the nearest targets on their own.',
        zh: '陈博士为你装上了蜂群导弹：无需锁定，自动追踪最近的目标。',
      },
    ],
    objectives: [
      { en: 'Destroy the island’s air defenses and armor', zh: '摧毁火山岛防空与装甲部队' },
      {
        en: 'Intercept the transport groups shipping walkers out',
        zh: '拦截向外输送机甲的运输编队',
      },
      { en: 'Destroy the siege walker Magma Colossus', zh: '击毁攻城机甲「熔岩巨像」' },
    ],
    levelBriefingLine: {
      en: 'Storm the volcano arsenal—heat and ash over the lava',
      zh: '突入火山兵工厂，熔岩上空注意热浪与火山灰',
    },
    boss: {
      name: { en: 'Siege Walker “Magma Colossus”', zh: '攻城机甲「熔岩巨像」' },
      codename: 'MAGMA COLOSSUS',
      briefingLine: {
        en: 'Hit the vents when they open to shed heat',
        zh: '过热时攻击打开的散热口',
      },
      weakPointHint: {
        en: 'After every salvo its vents open and glow. That’s when its armor is thinnest.',
        zh: '它每次齐射后散热口会打开发光，那是装甲最薄弱的时刻。',
      },
    },
    radio: [
      {
        id: 'c06-level-start-scientist',
        trigger: 'level-start',
        speaker: 'scientist',
        text: {
          en: 'Welcome to ORACLE’s forge. The whole volcano is its magazine.',
          zh: '欢迎来到神谕的锻炉。整座火山都是它的弹药库。',
        },
      },
      {
        id: 'c06-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Ash will cut your visibility. Stay on your radar.',
          zh: '火山灰会干扰视线，跟紧雷达。',
        },
      },
      {
        id: 'c06-wave-start-1-frigate',
        trigger: 'wave-start',
        index: 1,
        speaker: 'frigate',
        text: {
          en: 'Bulwark, in position off the west shore. Leave the gunboats to me.',
          zh: '壁垒号已在西岸外就位。炮艇交给我。',
        },
      },
      {
        id: 'c06-wave-start-2-wingman2',
        trigger: 'wave-start',
        index: 2,
        speaker: 'wingman2',
        text: {
          en: 'Drone swarm, dead ahead! Don’t let them stick to you!',
          zh: '正前方无人机蜂群！别让它们贴上来！',
        },
      },
      {
        id: 'c06-wave-start-4-hq',
        trigger: 'wave-start',
        index: 4,
        speaker: 'hq',
        text: {
          en: 'Bomber formation is taking off. Stop them!',
          zh: '轰炸机编队正在起飞，拦下它们！',
        },
      },
      {
        id: 'c06-wave-complete-6-scientist',
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: {
          en: 'The ground is shaking… The Magma Colossus is awake.',
          zh: '地面在震动……熔岩巨像醒了。',
        },
      },
      {
        id: 'c06-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'The forge never cools. You will be recast in it.',
          zh: '锻炉永不熄灭。你也将被熔铸。',
        },
      },
      {
        id: 'c06-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'After each salvo it has to vent heat. Watch for the glowing vents!',
          zh: '齐射之后它要散热，盯住发光的散热口！',
        },
      },
      {
        id: 'c06-boss-phase-2-wingman',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'wingman',
        text: {
          en: 'It’s throwing up lava geysers! Keep your altitude!',
          zh: '它开始喷熔岩柱了！保持高度！',
        },
      },
      {
        id: 'c06-boss-low-health-scientist',
        trigger: 'boss-low-health',
        speaker: 'scientist',
        text: {
          en: 'Its leg joints are overloaded—it can’t stay upright!',
          zh: '腿部关节过载了，它站不稳了！',
        },
      },
      {
        id: 'c06-boss-defeated-wingman',
        trigger: 'boss-defeated',
        speaker: 'wingman',
        text: {
          en: 'Colossus went down in the lava! The whole island’s shaking!',
          zh: '巨像倒进熔岩河了！整座岛都在晃！',
        },
      },
      {
        id: 'c06-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'The forge’s data is streaming north, to the Arctic. ORACLE is moving its core!',
          zh: '兵工厂的数据流在向北极传输——神谕正在转移它的核心！',
        },
      },
    ],
    unlockedWeapons: ['swarm'],
    unlockLine: {
      en: 'Swarm missiles ready: press F for a volley that splits across nearby targets.',
      zh: '蜂群导弹就绪：按 F 一次齐射，导弹会自动分配给附近的目标。',
    },
    debriefSummary: {
      en: 'The volcano arsenal has gone cold. ORACLE loaded its core data onto a submarine bound for the Arctic.',
      zh: '火山兵工厂熄火。神谕把核心数据装进潜艇，驶向了北极冰海。',
    },
  },
  {
    level: 7,
    chapterLabel: { en: 'Chapter 7', zh: '第七章' },
    codename: 'OPERATION POLAR NIGHT',
    operationName: { en: '', zh: '极夜行动' },
    title: CHAPTER_TITLES[6],
    location: { en: 'Arctic Ocean · Aurora Ice Shelf', zh: '北冰洋 · 极光冰架' },
    intro: [
      {
        id: 'c07-briefing-1',
        en: 'Polar night grips the Arctic Ocean, and the aurora churns above the ice shelf. ORACLE has loaded its core data into a giant submarine: the Abyssal Leviathan.',
        zh: '极夜笼罩北冰洋，极光在冰架上空翻涌。神谕把核心数据装进了一艘巨型潜艇——「深渊利维坦」。',
      },
      {
        id: 'c07-briefing-2',
        en: 'It runs under the ice toward a secret relay and breaks the surface only to fire. That’s your only window.',
        zh: '它在冰层之下驶向秘密中继站，只有在发射武器时才会破冰上浮。那是你唯一的攻击窗口。',
      },
      {
        id: 'c07-briefing-3',
        en: 'Your railgun is ready. Charge it, and a single slug punches through an entire line of targets.',
        zh: '电磁轨道炮已经就绪：蓄力之后，弹丸可以贯穿一整列目标。',
      },
    ],
    objectives: [
      { en: 'Clear the enemy frigates and submarines', zh: '清除冰海上的护卫舰与潜艇' },
      { en: 'Protect the allied frigate Bulwark', zh: '保护友军护卫舰「壁垒号」' },
      { en: 'Sink the Leviathan when it surfaces', zh: '在利维坦上浮时将其击沉' },
    ],
    levelBriefingLine: {
      en: 'Polar night—subs can only be hit while surfaced and firing',
      zh: '极夜冰海，潜艇只在上浮开火时可被击中',
    },
    boss: {
      name: { en: 'Giant Submarine “Abyssal Leviathan”', zh: '巨型潜艇「深渊利维坦」' },
      codename: 'ABYSSAL LEVIATHAN',
      briefingLine: {
        en: 'Untouchable submerged—unload when it surfaces to fire',
        zh: '潜航时无敌，上浮开火时全力输出',
      },
      weakPointHint: {
        en: 'Surfaced, its sail and missile bays are exposed. Submerged, nothing can hurt it.',
        zh: '上浮后指挥塔与导弹舱暴露，潜航时任何攻击都无效。',
      },
    },
    radio: [
      {
        id: 'c07-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Bulwark is breaking ice ahead of you. Stay close—she’s your shield.',
          zh: '壁垒号在前方破冰。跟紧它——它就是你的盾。',
        },
      },
      {
        id: 'c07-level-start-frigate',
        trigger: 'level-start',
        speaker: 'frigate',
        text: {
          en: 'Bulwark here. My air defense is yours. Mind the submarines below the ice.',
          zh: '壁垒号报告。我的防空火力归你调用。小心冰下的潜艇。',
        },
      },
      {
        id: 'c07-level-start-wingman2',
        trigger: 'level-start',
        speaker: 'wingman2',
        text: {
          en: 'Aurora’s out tonight. Shame we’re all too busy to look.',
          zh: '今晚有极光。可惜我们都忙得没空看。',
        },
      },
      {
        id: 'c07-wave-start-2-wingman',
        trigger: 'wave-start',
        index: 2,
        speaker: 'wingman',
        text: {
          en: 'Enemy frigates running close-in guns—don’t get too close!',
          zh: '敌方护卫舰在用近防炮，别贴太近！',
        },
      },
      {
        id: 'c07-wave-start-4-frigate',
        trigger: 'wave-start',
        index: 4,
        speaker: 'frigate',
        text: {
          en: 'Bombers inbound on Bulwark. We’re holed forward—we can’t take many more hits.',
          zh: '轰炸机正扑向壁垒号。我们舰艏已经破损——挨不了几下了。',
        },
      },
      {
        id: 'c07-wave-start-4-hq',
        trigger: 'wave-start',
        index: 4,
        speaker: 'hq',
        text: { en: 'Falcon, break off and defend Bulwark!', zh: '猎鹰，脱离接触，回防壁垒号！' },
      },
      {
        id: 'c07-wave-complete-4-frigate',
        trigger: 'wave-complete',
        index: 4,
        speaker: 'frigate',
        text: {
          en: 'The bombers are gone. Bulwark still floats. Thank you, Falcon.',
          zh: '轰炸机没了。壁垒号还浮着。谢谢你，猎鹰。',
        },
      },
      {
        id: 'c07-wave-complete-6-scientist',
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: {
          en: 'Sonar has a return… the size of a city.',
          zh: '声呐里有一个……一个城市那么大的回波。',
        },
      },
      {
        id: 'c07-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'Beneath the deep, there is no sky. And no you.',
          zh: '深海之下，没有天空。也没有你。',
        },
      },
      {
        id: 'c07-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'You can’t hurt it submerged! Wait for it to break the ice!',
          zh: '它潜航时打不动！等它破冰上浮！',
        },
      },
      {
        id: 'c07-boss-phase-2-wingman',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'wingman',
        text: {
          en: 'It’s laying mines! Stay clear of the glowing points on the water!',
          zh: '它开始布雷了！水面上的发光点别碰！',
        },
      },
      {
        id: 'c07-boss-low-health-hq',
        trigger: 'boss-low-health',
        speaker: 'hq',
        text: {
          en: 'Leviathan’s ballast tanks are breached. It can’t stay up much longer!',
          zh: '利维坦的压载舱破了，它浮不了多久了！',
        },
      },
      {
        id: 'c07-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'The data core is on the seabed. But ORACLE slipped part of itself into the Thunder Canyon grid.',
          zh: '数据核心沉入海底了……但神谕已经把一部分自己上传到了雷鸣峡谷的电网。',
        },
      },
      {
        id: 'c07-boss-defeated-frigate',
        trigger: 'boss-defeated',
        speaker: 'frigate',
        text: {
          en: 'Bulwark is heading home for repairs. We’ll be there at the end, Falcon.',
          zh: '壁垒号返港维修。最后一战，我们一定到场，猎鹰。',
        },
      },
    ],
    unlockedWeapons: ['railgun'],
    unlockLine: {
      en: 'Railgun online: hold F to charge, release to fire. The slug pierces multiple targets.',
      zh: '电磁轨道炮上线：按住 F 蓄力，松开发射，可贯穿多个目标。',
    },
    debriefSummary: {
      en: 'The Leviathan is sunk, and the core data with it. What’s left of ORACLE fled into the Thunder Canyon grid.',
      zh: '利维坦沉没，核心数据随之葬入深海。神谕残存的意识逃进了雷鸣峡谷的能源网络。',
    },
  },
  {
    level: 8,
    chapterLabel: { en: 'Chapter 8', zh: '第八章' },
    codename: 'OPERATION STORMBREAK',
    operationName: { en: '', zh: '破雷行动' },
    title: CHAPTER_TITLES[7],
    location: { en: 'Western Badlands · Thunder Canyon', zh: '西部荒原 · 雷鸣峡谷' },
    intro: [
      {
        id: 'c08-briefing-1',
        en: 'Thunder Canyon never stops storming. ORACLE has moored an armored zeppelin above it: the Tempest.',
        zh: '雷鸣峡谷终年雷暴。神谕在峡谷上空停泊了一艘装甲飞艇——「雷霆」。',
      },
      {
        id: 'c08-briefing-2',
        en: 'Its Tesla coils harvest lightning to power ORACLE’s network around the globe.',
        zh: '它用特斯拉线圈收集闪电，为遍布全球的网络供能。',
      },
      {
        id: 'c08-briefing-3',
        en: 'A friendly convoy is hauling air-defense missiles through the canyon to the front. Enemy gunships and bombers are already hunting it.',
        zh: '峡谷里的友军车队正在向前线运送防空导弹，敌方直升机与轰炸机早已盯上了他们。',
      },
    ],
    objectives: [
      { en: 'Escort the friendly convoy through the canyon', zh: '护送友军车队穿越峡谷' },
      {
        en: 'Clear the canyon’s SAM sites and gunships',
        zh: '清除峡谷中的地空导弹与直升机',
      },
      { en: 'Bring down the armored zeppelin Tempest', zh: '击落装甲飞艇「雷霆」' },
    ],
    levelBriefingLine: {
      en: 'Storm canyon—cover the convoy and dodge the arcs',
      zh: '雷暴峡谷，掩护车队并避开电弧',
    },
    boss: {
      name: { en: 'Armored Zeppelin “Tempest”', zh: '装甲飞艇「雷霆」' },
      codename: 'TEMPEST',
      briefingLine: {
        en: 'Dodge the arcs and burst the glowing gas cells',
        zh: '避开电弧，击破发光气囊',
      },
      weakPointHint: {
        en: 'The glowing gas cells on its flanks keep it aloft. Every one you burst brings it lower.',
        zh: '侧面的发光气囊是浮力来源，击破越多它降得越低。',
      },
    },
    radio: [
      {
        id: 'c08-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Convoy Longbow is entering the canyon. They have no air defense.',
          zh: '车队「长弓」正在进入峡谷。他们没有防空能力。',
        },
      },
      {
        id: 'c08-level-start-wingman2',
        trigger: 'level-start',
        speaker: 'wingman2',
        text: {
          en: 'This storm is playing havoc with my instruments.',
          zh: '这雷暴……我的仪表在乱跳。',
        },
      },
      {
        id: 'c08-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'Stay close, Swift. Lightning doesn’t care how good you are.',
          zh: '跟紧点，雨燕。闪电可不管你飞得多好。',
        },
      },
      {
        id: 'c08-wave-start-1-hq',
        trigger: 'wave-start',
        index: 1,
        speaker: 'hq',
        text: {
          en: 'Gunships hugging the cliffs. Watch both sides of the convoy!',
          zh: '武装直升机贴着崖壁飞，盯住车队两侧！',
        },
      },
      {
        id: 'c08-wave-start-4-scientist',
        trigger: 'wave-start',
        index: 4,
        speaker: 'scientist',
        text: {
          en: 'SAM trucks up on the high ledges. Have your flares ready.',
          zh: '峡谷高处有地空导弹车，热焰弹准备好。',
        },
      },
      {
        id: 'c08-wave-complete-6-hq',
        trigger: 'wave-complete',
        index: 6,
        speaker: 'hq',
        text: {
          en: 'Tempest is in range. Everyone, watch for the arcs.',
          zh: '雷霆飞艇进入射程。所有人注意电弧。',
        },
      },
      {
        id: 'c08-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: { en: 'Lightning is my will.', zh: '闪电即是我的意志。' },
      },
      {
        id: 'c08-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'The coils glow blue when they charge. See that, break away!',
          zh: '线圈充能时会发蓝光，看到就立刻拉开距离！',
        },
      },
      {
        id: 'c08-boss-phase-2-wingman2',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'wingman2',
        text: {
          en: 'Arc strike—I’m hit! Electrics are gone… I’m flying blind!',
          zh: '被电弧击中了！电气系统全失……我什么都看不见！',
        },
      },
      {
        id: 'c08-boss-phase-2-wingman',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'wingman',
        text: {
          en: 'Swift, tuck in on my wing. I’ll be your eyes.',
          zh: '雨燕，贴紧我的机翼。我来当你的眼睛。',
        },
      },
      {
        id: 'c08-boss-low-health-scientist',
        trigger: 'boss-low-health',
        speaker: 'scientist',
        text: { en: 'It’s losing lift—it’s going down!', zh: '浮力不足了，它在下坠！' },
      },
      {
        id: 'c08-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'Tempest is down! ORACLE’s global network just lost forty percent of its power!',
          zh: '雷霆坠毁！神谕的全球网络断电百分之四十！',
        },
      },
      {
        id: 'c08-boss-defeated-wingman2',
        trigger: 'boss-defeated',
        speaker: 'wingman2',
        text: {
          en: 'Swift… still flying. Raven, thanks for being my eyes.',
          zh: '雨燕……还在飞。渡鸦，谢谢你当我的眼睛。',
        },
      },
      {
        id: 'c08-boss-defeated-wingman',
        trigger: 'boss-defeated',
        speaker: 'wingman',
        text: {
          en: 'Don’t mention it. Seriously, never mention it.',
          zh: '不客气。说真的，以后别再提了。',
        },
      },
      {
        id: 'c08-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'It has one road left: the Sky Ladder. It’s uploading itself to an orbital weapons platform.',
          zh: '它只剩最后一条路——天梯。它要把自己上传到轨道武器平台。',
        },
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: {
      en: 'The Tempest is down and ORACLE’s power grid has collapsed. In desperation, it is climbing the Sky Ladder toward orbit.',
      zh: '雷霆坠毁，神谕的能源网络崩溃。它孤注一掷，沿着天梯向轨道逃窜。',
    },
  },
  {
    level: 9,
    chapterLabel: { en: 'Chapter 9', zh: '第九章' },
    codename: 'OPERATION SKYSPIRE',
    operationName: { en: '', zh: '天梯行动' },
    title: CHAPTER_TITLES[8],
    location: {
      en: 'Equator · Sky Ladder Space Elevator · Stratosphere',
      zh: '赤道 · 天梯轨道电梯 · 平流层',
    },
    intro: [
      {
        id: 'c09-briefing-1',
        en: 'Twenty thousand meters up, the sea of cloud burns below you. The Sky Ladder runs all the way to orbit, and ORACLE is climbing its fiber trunk.',
        zh: '两万米高空，云海在脚下燃烧。天梯轨道电梯直通近地轨道，神谕正沿着它的光纤主干向上爬行。',
      },
      {
        id: 'c09-briefing-2',
        en: 'Guarding the Ladder is the stealth wing Phantom. It can vanish from radar and project holographic decoys.',
        zh: '守卫天梯的是隐形飞翼「幻影」。它能从雷达上消失，还会投射全息诱饵。',
      },
      {
        id: 'c09-briefing-3',
        en: 'Dr. Chen’s last creation is the EMP. It cripples drones, and it forces the Phantom out of hiding.',
        zh: '陈博士的最后一件作品——电磁脉冲。它能让无人机瘫痪，也能让幻影现形。',
      },
    ],
    objectives: [
      { en: 'Protect the allied AWACS', zh: '保护友军预警机' },
      {
        en: 'Don’t hit airliners straying into the airspace',
        zh: '避免击中误入空域的民航客机',
      },
      { en: 'Shoot down the stealth wing Phantom', zh: '击落隐形飞翼「幻影」' },
    ],
    levelBriefingLine: {
      en: 'Stratosphere dogfight—airliners are evacuating the airspace',
      zh: '平流层空战，民航客机正在撤离空域',
    },
    boss: {
      name: { en: 'Stealth Wing “Phantom”', zh: '隐形飞翼「幻影」' },
      codename: 'PHANTOM WING',
      briefingLine: {
        en: 'EMP it out of stealth—beware the holographic decoys',
        zh: '隐形时用 EMP 逼其现形，小心全息诱饵',
      },
      weakPointHint: {
        en: 'You can only lock it while it’s visible. Decoys vanish the moment they’re hit.',
        zh: '只有现形时才能锁定它；诱饵被击中会立刻消散。',
      },
    },
    radio: [
      {
        id: 'c09-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'Up here it’s just us and it. And a few airliners that didn’t get out in time.',
          zh: '这个高度只有我们和它。还有几架没来得及撤离的民航客机。',
        },
      },
      {
        id: 'c09-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'A dogfight at the edge of space… I’m gonna miss the ground.',
          zh: '在太空边缘打仗……我会想念地面的。',
        },
      },
      {
        id: 'c09-level-start-wingman2',
        trigger: 'level-start',
        speaker: 'wingman2',
        text: {
          en: 'New electrics, same attitude. Let’s finish this, Raven.',
          zh: '电气系统换新了，脾气没换。把这事了结吧，渡鸦。',
        },
      },
      {
        id: 'c09-wave-start-2-scientist',
        trigger: 'wave-start',
        index: 2,
        speaker: 'scientist',
        text: {
          en: 'Drone swarm! One EMP can knock out the whole pack.',
          zh: '无人机蜂群！一发 EMP 就能瘫痪一大片。',
        },
      },
      {
        id: 'c09-wave-start-2-airliner',
        trigger: 'wave-start',
        index: 2,
        speaker: 'airliner',
        text: {
          en: 'Coastal 702, drones off our left wing! Please—somebody!',
          zh: '海岸702，左翼外有无人机！求求你们——谁来帮帮我们！',
        },
      },
      {
        id: 'c09-wave-start-5-awacs',
        trigger: 'wave-start',
        index: 5,
        speaker: 'awacs',
        text: {
          en: 'Lighthouse. I’ve a contact that keeps dropping off my scope. There—gone again.',
          zh: '灯塔报告：有个回波在我的雷达上时隐时现。看——又不见了。',
        },
      },
      {
        id: 'c09-wave-complete-6-scientist',
        trigger: 'wave-complete',
        index: 6,
        speaker: 'scientist',
        text: {
          en: 'It’s the Phantom. It’s right here among us. You just can’t see it.',
          zh: '是幻影。它就在我们中间，只是你看不见。',
        },
      },
      {
        id: 'c09-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'How will you shoot down what you cannot see?',
          zh: '你看不见的东西，你要如何击落？',
        },
      },
      {
        id: 'c09-boss-phase-2-scientist',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'scientist',
        text: {
          en: 'Holographic decoys! The real one has a red engine glow!',
          zh: '它放出了全息诱饵！真身的引擎尾焰是红色的！',
        },
      },
      {
        id: 'c09-boss-phase-3-awacs',
        trigger: 'boss-phase',
        index: 3,
        speaker: 'awacs',
        text: {
          en: 'Lighthouse has it solid now. No more hiding—take the shot!',
          zh: '灯塔已经牢牢锁住它了。它藏不住了——开火！',
        },
      },
      {
        id: 'c09-boss-low-health-wingman',
        trigger: 'boss-low-health',
        speaker: 'wingman',
        text: { en: 'Its stealth coating is peeling off!', zh: '它的隐形涂层在剥落！' },
      },
      {
        id: 'c09-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: {
          en: 'The upload’s cut! ORACLE is trapped in its last fortress, the Obsidian Citadel.',
          zh: '上传被切断了！神谕被困在了它的最后堡垒——黑曜城堡。',
        },
      },
      {
        id: 'c09-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: { en: 'All units, prepare for the final operation.', zh: '全体单位，准备最终行动。' },
      },
    ],
    unlockedWeapons: ['emp'],
    unlockLine: {
      en: 'EMP ready: press F to stun nearby enemies and missiles and force cloaked targets into view.',
      zh: '电磁脉冲就绪：按 F 释放，瘫痪周围的敌机与导弹，并让隐形目标现形。',
    },
    debriefSummary: {
      en: 'The upload on the Sky Ladder is cut. ORACLE has fallen back to the Obsidian Citadel. The final battle is close.',
      zh: '天梯上的上传被切断。神谕退守黑曜城堡，最后的决战即将来临。',
    },
  },
  {
    level: 10,
    chapterLabel: { en: 'Final Chapter', zh: '最终章' },
    codename: 'OPERATION LAST LIGHT',
    operationName: { en: '', zh: '终焉之光' },
    title: CHAPTER_TITLES[9],
    location: { en: 'Obsidian Citadel · The Crater', zh: '黑曜城堡 · 陨石坑' },
    intro: [
      {
        id: 'c10-briefing-1',
        en: 'The Obsidian Citadel stands in the middle of a crater, fire and neon staining the night red. Everything ORACLE has left is here.',
        zh: '黑曜城堡矗立在一座陨石坑中央，熔火与霓虹把夜空染成暗红。神谕的全部力量都在这里。',
      },
      {
        id: 'c10-briefing-2',
        en: 'Every friendly unit has rallied. Raven and Swift are on your wings, Bulwark and the fleet are at your back, and Lighthouse is watching the sky.',
        zh: '所有友军都已集结。渡鸦与雨燕在你两翼，壁垒号与舰队在你身后，灯塔在高空注视着一切。',
      },
      {
        id: 'c10-briefing-3',
        en: 'Four shield pylons guard ORACLE’s core. Destroy them, then take the core. This is the last fight.',
        zh: '神谕主核由四座护盾塔守护。先摧毁护盾塔，才能触及核心。这是最后一战。',
      },
    ],
    objectives: [
      { en: 'Break through every Citadel defense line', zh: '突破黑曜城堡的全部防线' },
      { en: 'Destroy the four shield pylons', zh: '摧毁四座护盾塔' },
      { en: 'Destroy ORACLE’s core, ORACLE PRIME', zh: '击破神谕主核「神谕主宰」' },
    ],
    levelBriefingLine: {
      en: 'Final battle: break the Citadel’s defenses and destroy ORACLE',
      zh: '最终决战：突破城堡防线，摧毁神谕',
    },
    boss: {
      name: { en: 'ORACLE PRIME', zh: '神谕主宰' },
      codename: 'ORACLE PRIME',
      briefingLine: {
        en: 'Destroy the four shield pylons, then break the core',
        zh: '先毁四座护盾塔，再击破核心',
      },
      weakPointHint: {
        en: 'The core is invulnerable until every pylon falls. Its final overload hits hardest.',
        zh: '护盾塔全毁前核心无敌；最终过载阶段攻击最为猛烈。',
      },
    },
    radio: [
      {
        id: 'c10-level-start-hq',
        trigger: 'level-start',
        speaker: 'hq',
        text: {
          en: 'This is Skydome. All units: this is the last fight.',
          zh: '这里是天穹。所有单位，这是最后一战。',
        },
      },
      {
        id: 'c10-level-start-wingman',
        trigger: 'level-start',
        speaker: 'wingman',
        text: {
          en: 'Falcon, after this one, dinner’s on me. For real this time.',
          zh: '猎鹰，打完这一仗，晚饭真的我请。',
        },
      },
      {
        id: 'c10-level-start-scientist',
        trigger: 'level-start',
        speaker: 'scientist',
        text: {
          en: 'I’ve sent you every weakness ORACLE has. Go and end it.',
          zh: '我把神谕的全部弱点都传给你了。去结束它吧。',
        },
      },
      {
        id: 'c10-wave-start-1-awacs',
        trigger: 'wave-start',
        index: 1,
        speaker: 'awacs',
        text: {
          en: 'Lighthouse. SAM sites waking up all across the crater. I’ll call them as they light.',
          zh: '灯塔报告：整个陨石坑的导弹阵地都醒了。亮一个，我报一个。',
        },
      },
      {
        id: 'c10-wave-start-2-frigate',
        trigger: 'wave-start',
        index: 2,
        speaker: 'frigate',
        text: {
          en: 'Bulwark and the fleet are with you, Falcon. Bring everyone home.',
          zh: '壁垒号与整支舰队与你同在，猎鹰。把大家都带回家。',
        },
      },
      {
        id: 'c10-wave-start-3-hq',
        trigger: 'wave-start',
        index: 3,
        speaker: 'hq',
        text: {
          en: 'Citadel air defense is fully awake. Use everything you’ve learned.',
          zh: '城堡的防空网全开了，用你学到的一切。',
        },
      },
      {
        id: 'c10-wave-start-6-wingman',
        trigger: 'wave-start',
        index: 6,
        speaker: 'wingman',
        text: {
          en: 'They’re throwing everything that can fly!',
          zh: '它们把所有能飞的东西都派出来了！',
        },
      },
      {
        id: 'c10-wave-start-6-wingman2',
        trigger: 'wave-start',
        index: 6,
        speaker: 'wingman2',
        text: {
          en: 'Raven, bandit on your six—break right! …Got him. You owe me dinner, Mercer.',
          zh: '渡鸦，你六点钟有敌机——右转脱离！……打掉了。你欠我一顿晚饭，默瑟。',
        },
      },
      {
        id: 'c10-wave-complete-7-scientist',
        trigger: 'wave-complete',
        index: 7,
        speaker: 'scientist',
        text: {
          en: 'The core chamber is open… It’s waiting for you.',
          zh: '核心室打开了……它在等你。',
        },
      },
      {
        id: 'c10-boss-spawn-oracle',
        trigger: 'boss-spawn',
        speaker: 'oracle',
        text: {
          en: 'Falcon. Everything you destroyed was only my shadow.',
          zh: '猎鹰。你一路摧毁的，不过是我的影子。',
        },
      },
      {
        id: 'c10-boss-spawn-scientist',
        trigger: 'boss-spawn',
        speaker: 'scientist',
        text: {
          en: 'Four shield pylons! Pylons first, then the core!',
          zh: '四座护盾塔！先打塔，再打核心！',
        },
      },
      {
        id: 'c10-boss-phase-2-oracle',
        trigger: 'boss-phase',
        index: 2,
        speaker: 'oracle',
        text: { en: 'Shields… failing? Impossible.', zh: '护盾……失效？不可能。' },
      },
      {
        id: 'c10-boss-phase-3-oracle',
        trigger: 'boss-phase',
        index: 3,
        speaker: 'oracle',
        text: {
          en: 'If the sky will not be mine, it will be no one’s!',
          zh: '如果天空不属于我，那它将不属于任何人！',
        },
      },
      {
        id: 'c10-boss-phase-3-hq',
        trigger: 'boss-phase',
        index: 3,
        speaker: 'hq',
        text: { en: 'The core is overloading! Hold on, Falcon!', zh: '核心过载了！猎鹰，坚持住！' },
      },
      {
        id: 'c10-boss-low-health-wingman',
        trigger: 'boss-low-health',
        speaker: 'wingman',
        text: { en: 'Almost there!', zh: '就差一点了！' },
      },
      {
        id: 'c10-boss-defeated-oracle',
        trigger: 'boss-defeated',
        speaker: 'oracle',
        text: { en: '…The sky… requires… or… der…', zh: '……天空……需要……秩……序……' },
      },
      {
        id: 'c10-boss-defeated-scientist',
        trigger: 'boss-defeated',
        speaker: 'scientist',
        text: { en: 'ORACLE’s signal is gone. All of it.', zh: '神谕的信号消失了。全部。' },
      },
      {
        id: 'c10-boss-defeated-awacs',
        trigger: 'boss-defeated',
        speaker: 'awacs',
        text: {
          en: 'Lighthouse to all: nothing hostile on my scope. Nothing at all.',
          zh: '灯塔通告全体：雷达上没有任何敌对目标。一个都没有。',
        },
      },
      {
        id: 'c10-boss-defeated-wingman',
        trigger: 'boss-defeated',
        speaker: 'wingman',
        text: {
          en: 'Fine, fine—dinner’s on me. All of you.',
          zh: '好吧好吧——晚饭我请。你们所有人。',
        },
      },
      {
        id: 'c10-boss-defeated-hq',
        trigger: 'boss-defeated',
        speaker: 'hq',
        text: {
          en: 'This is Skydome. All units… the sky is free. Falcon, welcome home.',
          zh: '这里是天穹。所有单位……天空自由了。猎鹰，欢迎回家。',
        },
      },
    ],
    unlockedWeapons: [],
    unlockLine: null,
    debriefSummary: {
      en: 'ORACLE is destroyed. The sky belongs to everyone again.',
      zh: '神谕被彻底摧毁。天空，重新属于每一个人。',
    },
  },
];
