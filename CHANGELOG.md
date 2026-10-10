# AirSupreme 更新日志

## Unreleased

- Initialized Kaola-Workflow documentation structure.
- 移除没有任何代码读取的 JSON 配置：`public/config/game-config.json`、`src/core/utils/ConfigLoader.ts` 与启动时的那次读取一并删除；数值一直以源码里的常量为准（`src/config.ts` 等），玩法不变，启动时少一次网络请求

### 操控与武器体验（`workflow/ipad-controls-weapons`）

#### 操控

- 触屏摇杆改为浮动的模拟摇杆：手指落在屏幕左下区域的任意位置，摇杆就出现在拇指下面；推得轻转得缓、推到底转得快（带死区与指数曲线，`TOUCH_STICK_TUNING`）。手指滑出这片区域摇杆也不脱手，第二根手指抢不走它
- 触屏辅助飞行：用摇杆操纵时，左右推杆让机头沿地平线转向，飞机自己压坡度入弯（最多 45°），摇杆回中后自动改平，俯仰不超过上下 75°。键盘操纵不变，仍是直接控制俯仰 / 偏航 / 翻滚
- 「加速」（BOOST）键改为点一下锁住、再点一下关闭
- 快速点按不再丢失：按下不到一个模拟步的开火 / 导弹也算一次，键盘（空格、M / 右 Shift）与触屏按键都一样；被系统取消的触摸不算一次按下
- 平板布局（屏幕短边不小于 700 像素，例如 iPad）：摇杆与按键簇放大，整体抬高并向屏幕内收；平板上所有画质档的模拟都以 60 Hz 运行，`auto` 画质的像素比上限提高到 1.5
- 触屏设备接上键盘后，键盘与触屏操作可以同时使用
- 窗口失焦或页面切到后台时，按住的按键与摇杆自动松开

#### 目标与雷达

- 敌方地面 / 海上 / 空中单位现在都有屏幕标记：血条上显示各自的名称（如「主战坦克」）；远到看不清的单位套上角框并标出距离；屏幕外的单位在屏幕边缘有带距离的箭头。潜航中的潜艇没有标记
- 敌机清空后，仍拖住波次的单位换成加粗、闪动的「当前目标」标记，HUD 提示一次还剩什么（地面目标 / 舰艇 / 空中目标，或潜艇已下潜）
- 残留单位的放行时限从 150 秒缩短到 60 秒，并且每次打中敌方单位都会重新计时：正在进攻不会被打断，够不着目标时一分钟后放行
- 雷达盘航向朝上：前方在上、右侧在右。量程外的目标贴在盘边，画成更小、更暗的空心符号并带一截朝外的短线，不再和量程内的目标混在一起
- 点击 / 点按雷达或按 **N** 打开关卡地图：北朝上，显示整个战场与边界圈、500 米 / 1000 米距离环、航向箭头、雷达上的全部目标、图例与陆地 / 水面底图。地图打开时游戏不暂停；点地图、按 N 或 Esc 关闭
- 触屏布局下雷达移到左上角（手机 84 像素、平板 132 像素），不再被左手摇杆区压住；屏幕外的目标箭头与 Boss 导弹箭头会避开雷达、HUD 面板、摇杆与触控按键，距离标签始终水平、不压在箭头上

#### 武器

- 导弹导引头常开：不用再按住导弹键锁定。只要还有导弹，导引头就跟踪准星圆环内离环心最近的目标；目标在环内保持 1 秒（可升级到 0.5 秒）完成锁定，圆环与目标角标变绿
- 点按发射：圆环变绿后按 M / 右 Shift 或点「导弹」（MSL）键，按一下发射一枚，锁定保留给下一枚；提前按住则在锁定完成的那一刻发射。没有目标或没锁完就松手提示「未锁定」（NO LOCK），没有导弹提示「无导弹」（NO MSL）
- 锁定更稳：完成的锁定在更大的保持环（圆环的 1.6 倍）内一直保持，目标出了保持环、转到身后或超出 1200 米后还有 0.5 秒宽限；锁定完成之前目标滑出圆环，进度只是回落而不是清零
- 导弹更快、更准：从左右翼下挂点轮流发射，离架时带着载机的速度，随后加速到 200 米/秒（原 80 米/秒）；对移动目标算提前量，贴近目标时近炸。伤害 50 → 80，初始携带 2 → 3 枚（上限仍为 5 枚）
- 「导弹锁定速度」升级线随之调整：1.0 秒起、每级 −0.05 秒（原 1.5 秒起、每级 −0.1 秒），满级仍为 0.5 秒
- 机炮十字在第一 / 第三人称下都画在子弹实际的去向上（机头轴线前方 600 米处）；前方 500 米内最近的空中目标显示提前量标记
- 触屏机炮辅助瞄准：对到目标几度之内时，弹道被拉向 480 米内的目标并收窄散布，十字跟着移动；桌面端不启用
- 状态列的导弹读数带标签与余量（「导弹 n/5」），补给进度条并入读数；触屏「导弹」键显示余量与补给进度环，锁定完成时变成醒目的「可以发射」状态
- 中央播报与告警按当前视角避开准星和圆环

#### 座舱

- 第一人称座舱压低：遮光罩改成一道薄檐，风挡立柱变细，上半屏几乎没有遮挡；HUD 组合玻璃正好框住机炮十字与导引头圆环
- 第一人称下，自机特殊武器的口焰、火箭尾烟与轨道炮闪光减弱，蜂群导弹改从翼下外侧弹出，贴近镜头的粒子淡出，不再糊住画面
- 竖屏时抬高竖直视场角，保住约 70° 的水平视场（竖直视场角上限 95°）

#### 菜单与存档

- 全新主菜单：标题画面背后是实时渲染的玩家战机，五个按钮——继续战役（有存档时是默认项，显示存档位置、分数、难度、生命数与十章航线）、新战役、机库、设置、操作说明
- 设置移入独立面板并分为游戏 / 音频 / 显示 / 高级四组，改动立即保存；起始关卡、游戏模式与测试分数收进默认折叠的「高级」，改过时显示「已修改」标记
- 新增「操作说明」面板，分键盘与触屏两页，打开时停在与设备相符的一页；键盘页的键帽写明左右（加速 `L Shift` / `L Ctrl`，导弹 `M` / `R Shift`）
- 已有存档时开新战役会先确认，默认选项是「保留存档」
- 「模型预览」改名为「机库」并重做为全屏展台：箭头按钮、键盘左右键或滑动切换模型，鼠标拖动旋转，可关闭自动旋转
- 机库里所有模型以同样的大小显示（包围球约占展台短边的 70%，放不下时才缩小）；对局里的信号灯小球在机库和标题画面的战机上不再显示。某个模型加载失败时写明「无法加载」，其余模型照常可用；浏览器无法创建 WebGL 上下文时，机库关闭并回到标题画面
- 进入战斗的加载画面改成与主菜单一致的风格，点下开始后有一段约 0.3 秒的出击过渡
- 暂停舱新增「保存并退出」（Save & Exit）：在当前位置（本波 / Boss 战 / 机库）存档后回到主菜单。确认界面写明存在哪里，存完会读回核对；浏览器存储不可用或已满时如实提示，可以返回或仍然退出。之后「继续战役」从这一波或 Boss 战的开头重新开始，分数、生命、导弹与升级都是退出那一刻的状态
- 无法存档时（Boss 模式、第一个检查点之前、战役通关之后）该按钮仍是「返回菜单」，退出前说明原因
- 暂停舱换成与主菜单一致的外观，操作不变：「离开」确认界面把存档位置显示成一张卡片；「保存并退出」是冰蓝色的主按钮，琥珀色只出现在会丢进度的退出和保存失败的界面上
- 任务失败后保留检查点：普通模式下有检查点时，`MISSION FAILED` 结算界面的主按钮是「从检查点重试」（Retry from checkpoint），按钮上方的「检查点」卡片写明检查点的位置，后面是「返回菜单」；这时没有「再来一局」，结算界面上也没有任何操作会删除存档——想从头开始，回主菜单选「新战役」（会先确认）。没有检查点或在 Boss 模式下，仍是「再来一局」与「返回菜单」
- 任务失败 / 任务完成的结算界面换成与主菜单、暂停舱一致的外观：标题上方是「战后简报」（Debrief）小标签，失败用克制的红色点缀，通关是冰蓝色。界面一出现第一个按钮就有焦点，Tab / Shift+Tab 在两个按钮之间切换，每个按钮在一次结算里只生效一次

#### 修复

- 第 1 关有一波打不下去：剩下的坦克在屏幕上没有任何标记，雷达又把左右画反了（右侧的目标画在左侧），玩家找不到它，波次迟迟不结束。现在敌方单位有屏幕标记和「当前目标」提示，雷达左右方向已修正，放行时限也缩短到 60 秒
- 任务失败后点「再来一局」会从头开一局并清掉检查点。现在有检查点时结算界面不再提供「再来一局」，原先浮在结算面板下方的「从检查点继续」按钮并入面板，成为主按钮「从检查点重试」
- 结算界面的重试按钮连点两下，或上一次启动还在加载时再点一次，不再同时启动两局游戏
- 阵亡的同一瞬间清波、清关或击破 Boss 时，检查点不再被改写或清除，也不会记成通关——结算界面上写的检查点位置与存档保持一致；晚到的清关也不会在结算界面底下开始 Boss 战
- 触屏设备上地空导弹来袭的告警改为指向屏幕上的按键：`导弹来袭 · 点「热焰」键`（英文 `Missile inbound · Tap FLARE`），不再提示按 G 键；桌面端不变
- 屏幕外的目标箭头与 Boss 导弹箭头不再被 HUD 面板（得分、速度、状态、生命条与顶部消息）挡住

### 十关故事战役（`workflow/ten-level-campaign`）

#### 战役与剧情

- 十章故事战役「AIR SUPREME · 天穹之战」（英文界面为「AIR SUPREME · The Skydome War」；剧本经 `src/features/campaign/CampaignData.ts` 导入）：序章、每章章节卡片（章节 · 行动代号、地点、打字机正文、任务目标）、新武器解锁台词、任务结算（本关得分 / 击落 / 平民损失 / 友军损失 / 总分）、第 10 章之后的尾声与片尾字幕，最后 `MISSION COMPLETE`（`src/ui/StoryOverlay.ts`）
- 剧情卡片：点击 / 轻触 / 空格 / 回车先显示全文再翻页，Esc 或「跳过」结束整段；卡片显示时隐藏 HUD / 雷达 / 无线电 / 移动端按键；卡片、结算与机库期间冻结模拟
- 无线电通讯（`src/ui/RadioComms.ts`）：天穹指挥部、僚机渡鸦与雨燕、萤火、灯塔预警机、壁垒号护卫舰、神谕与民用频道（角色见下文「角色阵容与僚机」）；章节台词按入关、波次开始 / 结束、Boss 登场 / 阶段 / 低血量 / 击破触发；首次遭遇每类单位有提示；平民误伤、导弹告警、低血量为高优先级，打断普通台词
- 普通模式流程：章节卡片 → 简报 + 无线电 → 波次 → Boss → 任务结算 → 机库 → 下一章（`CampaignFlowController`）
- Boss 模式扩展到第 1-10 关：没有剧情卡片，只播 Boss 登场台词与高优先级告警；武器解锁到所选关卡，Boss 之间进入机库

#### 界面语言：英文默认，简体中文可选

- 英文成为默认界面语言，简体中文可在开始菜单与暂停菜单的「Language / 语言」一行实时切换；选项名用各自的语言书写（English / 中文）。语言随开始流程设置持久化（`StartFlowSettings.language`，缺省 `'en'`，不跟随浏览器语言；加入该字段之前的存档与无法识别的值一律按英文读取）
- 轻量本地化核心 `src/i18n/index.ts`：双语文案 `LocalizedText { en, zh }`、`tr()` / `localize()` / `format()`（`{name}` 占位符）、`getLocale` / `setLocale` / `onLocaleChange`、`normalizeLocale`、`DEFAULT_LOCALE`；`setLocale` 同步 `<html lang>`。文案就地双语，不用键值字符串表（见 `docs/decisions/0002-bilingual-text-and-voice-packs.md`）
- `index.html` 以 `lang="en"` 与英文默认文案发布（加载画面、移动端按键 FIRE / MSL / SPEC / FLARE / BOOST / SWAP / VIEW / PAUSE）；`main.ts` 在任何界面渲染之前应用已保存的语言，切换后实时改写页面标题、加载画面与按键文字（含读屏标签）；控制台日志改为英文
- 数据层双语：章节、无线电、序章 / 尾声 / 片尾字幕全部为 `LocalizedText`；单位、Boss、敌机、特殊武器、升级、道具的名称与说明，关卡名（与章节标题共用 `CHAPTER_TITLES` 同一对象）与难度档名（英文 Very Easy / Easy / Normal / Hard / Expert，中文逐档对应为 非常简单 / 简单 / 普通 / 困难 / 专家）也改为双语；检查点描述英文为 `Ch. 6 · Heart of the Forge · Wave 3`
- 界面实时切换：开始 / 暂停 / 升级菜单原位重绘（开始菜单保留键盘焦点），HUD 重写自身文字，血条、模型预览与当前无线电台词立即换语言；剧情卡片从下一张起换语言；协调器提示与目标、Boss 状态 / 阶段 / 特殊攻击告警、单位与武器告警、存档提示在发出时按当前语言取文案；逐帧路径把双语对象提升为模块常量，不产生逐帧分配
- 英文排版：大字公告与简报标题自动换行、英文剧情标题字号更小、叙事衬线字体拉丁优先（中文经 `:lang(zh)` 回到 CJK 衬线）；打字机停顿按 Unicode 标点类别同时处理中英文句读；设置数值等宽对齐，手机上收紧留白与字号

#### 角色阵容与僚机

- 剧本以英文重写并附忠实的简体中文版；国际化角色表 `CAMPAIGN_SPEAKERS`（`src/features/campaign/CampaignCast.ts`），友方机组中有四名女性：天穹 Skydome（埃琳娜·瓦尔加上校，指挥部，兼剧情旁白）、渡鸦 Raven（杰克·默瑟中尉，僚机）、雨燕 Swift（弗蕾娅·林德奎斯特中尉，第二僚机，第 3 章起随队）、萤火 Firefly（陈曦博士，首席科学家）、灯塔 Lighthouse（阿米莉亚·哈特上尉，预警机指挥员）、壁垒 Bulwark（梁伟中校，友军护卫舰舰长）；另有神谕 ORACLE、客机机长「海岸702」、货轮大副「北星号」；每个角色带配音选角用的性别与声音说明
- 剧本数据拆分为 `CampaignTypes` / `CampaignCast` / `CampaignChapters` / `CampaignRadio` / `CampaignStory` / `ChapterTitles`，`CampaignData` 仍是唯一导入入口；每句配音台词带稳定唯一 id（同时是语音文件名），`getVoiceScript()` 列出全部配音台词
- 具名僚机（`src/core/campaign/Wingmen.ts`）：每关开场整个僚机编队一起升空——第 1-2 关渡鸦，第 3 关起渡鸦与雨燕，血条显示呼号；被击落的僚机本关不再出现，换关 / 读档 / Boss 击破后归队；其余友机为普通友军（不派编队的 Boss 模式里，最先到场的友机领取空出的僚机呼号）；坠毁提示点名僚机
- 僚机无线电：雨燕每局战役第一次随编队升空时报到一次；僚机被击落时由另一名僚机（在空中时）或天穹指挥部播报（`WINGMAN_EVENT_RADIO`，新增通用台词 `swift-joined`、`raven-down-swift`、`raven-down-hq`、`swift-down-raven`、`swift-down-hq`）
- 友军损失无线电：友军预警机与护卫舰被击毁时由各自的机组 / 舰员播报（`awacs-lost` / `frigate-lost`），其余友军单位仍为 `ally-unit-destroyed`；扣分提示按当前语言点名单位
- 无线电头像：雨燕（雨燕剪影，叉尾，与渡鸦的战机图标区分）、灯塔（带雷达罩的预警机）、壁垒（护卫舰）、海岸702（宽体客机）、北星号（货轮）各有专属图标，每个说话人都有自己的头像

#### 角色配音（英文 / 普通话）

- 英文与普通话两套语音包覆盖全部配音台词（撰写时每种语言 200 句：38 段旁白 + 162 句无线电）：`public/voice/{en,zh}/<台词 id>.mp3`（ElevenLabs `eleven_v4`，每句一次生成，128 kbps 单声道，保留 C2PA 来源凭证）、`public/voice/manifest.json`（每句时长与字节数）、`public/voice/provenance.json`（模型、声音 id、生成 id 与每个文件的 sha256）；五句僚机台词为后续补录
- `VoiceSystem`（`src/core/Audio/VoiceSystem.ts`）：按界面语言选包，只请求清单里有的台词（缺失即纯文字，不产生 404），经共享 AudioContext 获取并解码，编码 / 解码两级 LRU 缓存，入关预取本章台词、Boss 战预取 Boss 台词；同一时刻只有一句配音；`play()` 从不抛错，结果异步回调
- 无线电链路：按说话人带通 + 底噪 → 共用电台带通、存在感峰值、软饱和与压缩，句尾静噪尾音；旁白走干净链路（高通 + 轻压缩）；每句按门限 RMS 归一化响度
- 音乐闪避：配音说话时经 `voiceDuckBridge`（`VoiceDucking.ts`）压低 `MusicSystem` 整条音乐总线（含刺激音与混响），说完延迟片刻再平滑恢复，连续几句之间音乐不忽大忽小
- 无线电与剧情卡片按配音计时：有配音的台词停留到配音说完，下一句等待（有兜底上限）；被高优先级打断的台词连同配音从头重播（每句至多一次；紧急告警不打断正在配音的台词，见下文「终验修复」）；剧情卡片由天穹指挥官逐段朗读，打字机按配音时长调速，在配音结束前约 0.35 秒打完（中英文分别校准），整张卡听完后只留看任务目标的时间再自动翻页
- 暂停 / 继续从断点续播；清空无线电、失败、通关与释放时停下；结算卡片让正在说的那句说完；切换语言时停下当前台词并按新语言重新预取；实时看门狗保证丢失 `onended` 时无线电队列与打字机不会卡住
- 语音音量：`StartFlowSettings.voiceVolume`（0..1，缺省 0.9，旧存档取缺省值），开始菜单「Voice volume / 语音音量」与暂停菜单「Voice / 语音」一行（10% 步进，实时生效并持久化）；0% 为纯文字字幕，不加载语音
- Boss 击破后的收尾等有配音的收尾台词说完再出结算卡片（等待规则见下文「终验修复」；超出上限时结算卡片出现，正在说的那句说完）
- 开发构建调试钩子 `window.__AIR_SUPREME_DEV__.voice`（状态、人声 / 音乐电平采样、按 id 播放、通用台词、僚机事件）

#### 关卡与环境

- 新增第 6-10 关：熔炉之心（`VOLCANO`，火山岛兵工厂）、极光冰海（`ARCTIC`，极夜冰海）、雷霆峡谷（`CANYON`，雷暴峡谷）、天梯之巅（`STRATOSPHERE`，平流层云海与天梯）、神谕核心（`CITADEL`，陨石坑黑曜城堡），各有专属环境模块（`src/features/terrain/environments/`）
- 新天气预设 `ash`（火山灰 + 余烬）、`aurora`（极光带 + 轻雪）；峡谷使用 `storm`，闪电劈向真实地表；阴暗天气下云层更柔和
- 第 1-10 关都配置后处理调色 `postFx`（曝光 / 对比度 / 饱和度 / 泛光 / 暗角）
- 地表采样 `TerrainGenerator.sampleSurface` / `getSurfaceKind`（经 `LevelManager.getSurfaceSample` / `getSurfaceKind`）：地面单位、舰船、Boss 落脚、命中特效与音效按真实地表高度、水面与材质选型；第 9 关云海为坠毁面
- 开始菜单「起始关卡」扩展到第 1-10 关，下方显示章节标题

#### Boss

- 新增第 6-10 关 Boss（`IAdvancedBoss`，`src/features/boss/BossContracts.ts`）：攻城机甲「熔岩巨像」MAGMA COLOSSUS、巨型潜艇「深渊利维坦」ABYSSAL LEVIATHAN、装甲飞艇「雷霆」TEMPEST、隐形飞翼「幻影」PHANTOM WING、三阶段最终 Boss「神谕主宰」ORACLE PRIME；各有阶段、无敌窗口、弱点倍率、可独立摧毁的子目标、特殊攻击预警与死亡演出
- 熔岩巨像：四足步行、迫击炮齐射与落点准星、践踏冲击环、齐射后散热口打开（弱点）、熔岩柱与胸口光束；深渊利维坦：潜航无敌、红圈预警后破冰上浮、压载舱 / 指挥塔 / 导弹舱子目标、可击毁水雷、冲撞；雷霆飞艇：6 个气囊、特斯拉连锁电弧、雷暴云、无人机舱与召雷；幻影之翼：隐形伏击、激光长矛危险航道、全息诱饵，EMP 迫使现形，隐形时不可锁定、雷达不显示；神谕主宰：四座护盾塔 → 暴露核心与审判之矛 → 过载冲击环、天罚光柱与「终焉之光」，阶段联动城堡核心光柱
- Boss 战 HUD 显示 Boss 状态与阶段菱形（第 1-5 关按血量三段划分）；阶段切换播放台词、警报、`phase-change` 刺激音与音乐升级
- 第 6-10 关 Boss 召唤的无人机由单位系统的自杀无人机担任，其余小兵映射到敌机

#### 地面 / 海上 / 空中单位

- 17 种单位（`src/features/units/UnitTypes.ts`）分属三阵营，新增 `Faction.CIVILIAN`（不与任何阵营敌对）：
  - 敌方：主战坦克、地空导弹车、双联高炮、雷达站、高速炮艇、导弹护卫舰、攻击潜艇、武装直升机、战略轰炸机、自杀无人机
  - 友军：友军车队、友军护卫舰、友军预警机、友军运输机
  - 平民：民航客机、民用货轮、民用卡车
- 每种单位独立行为：导弹车锁定 → 发射（可被热焰弹诱骗）、高炮提前量弹幕、潜艇潜航 / 上浮（只有上浮时可被击中）、炮艇蛇形机动、护卫舰垂发 + 近防、直升机贴地扫射、轰炸机轰炸友军地面 / 海上单位、无人机俯冲撞击、友军护卫舰拦截导弹、护送目标与平民沿航线行进后离场
- 每关每波部署表（`src/features/units/UnitDeployments.ts`），与敌机波次并行：本波敌机与敌方单位全部清空才算过波（残留单位有时限兜底）；峡谷与城堡的地面车队沿环境提供的道路行进
- 得分规则：击毁敌方单位得分（乘关卡得分倍率）；亲手击毁平民 / 友军单位扣分并告警；所有平民 / 友军损失计入结算；护送目标安全抵达有奖励分
- 友军预警机在线时雷达量程扩大；敌方雷达站存活时敌机命中率提高
- 雷达新增图例：敌方地面单位（红色方块）、敌方舰艇（红色菱形）、友军单位（金色三角）、平民（灰色空心圆）

#### 特殊武器与热焰弹

- 5 种特殊武器（`src/features/weapons/`）：集束火箭（第 2 章解锁）、脉冲激光（第 4 章）、蜂群导弹（第 6 章）、电磁轨道炮（第 7 章）、电磁脉冲（第 9 章）
- 按键：F 发射（激光按住照射、轨道炮按住蓄力松开发射），Tab / X 切换，1-5 直接选择；移动端「特武」「切换」按钮
- 火箭齐射近炸溅射；激光持续照射、过热后冷却到底才能再用；蜂群导弹自动分配给前方锥形范围内的不同敌方目标；轨道炮贯穿弹道上所有目标、过早松开取消且不耗弹；EMP 瘫痪敌方单位与敌机、摧毁范围内的单位导弹与 Boss 导弹、迫使幻影之翼现形
- 特殊武器只伤敌方与平民目标，友军与玩家永不受伤；新解锁的武器满弹，复活时补给
- 热焰弹（G / 移动端「热焰」，`CountermeasureSystem`）：从机尾抛出一扇热焰弹，诱骗地空导弹与第 1-10 关 Boss 导弹；充能制，「热焰弹挂架」升级扩容 2 → 6 发

#### 视角

- `CameraRig`（`src/features/camera/`）：第三人称追尾 / 第一人称座舱，V 键或移动端「视角」按钮平滑切换；开始菜单新增「视角」设置，最后一次的选择会持久化
- 第一人称座舱：遮光罩、三块多功能显示器、前上方控制面板、圆表、告警灯与 HUD 组合玻璃；隐藏机体外壳，护盾球随视角淡化
- 创伤式镜头震动（受击、爆炸、武器后坐、Boss 特殊攻击）；视场角随速度与加力放大
- 友军僚机改用盟军涂装（同机体、同命中半径）；玩家加力尾焰随油门变化

#### 成长、机库与存档

- 14 条升级线（`src/features/upgrade/UpgradeSystem.ts`）：7 条核心属性扩展到 10 级（终值与原 5 级满级一致，步长减半），新增复合装甲（满级减伤 40%）、热焰弹挂架（2 → 6 发）与 5 条特殊武器强化（各 5 级，武器解锁前锁定）
- 层级上限随章节开放：核心 `min(10, 关卡 + 1)`，装甲 / 热焰弹 `min(满级, ceil(关卡 / 2) + 1)`，武器 `min(5, 关卡 - 解锁关卡 + 2)`；每档花费随层级上升
- 章节之间的机库整备（`UpgradeMenu` 的 `hangar` 模式，「出击」进入下一章；英文界面为 Refit & Rearm / Launch）；从后续章节开局（普通或 Boss 模式）补发起步升级点并先进入机库
- 中途自动存档（`src/core/save/SaveSystem.ts`）：入关、每波结束、Boss 战前与击破 Boss 时（机库检查点，第 1-9 关）写入检查点，HUD 弹出提示并播放存档音效
- 开始菜单「继续战役」按钮（显示如 `第6关 · 熔炉之心 · 第3波`，英文界面为 `Ch. 6 · Heart of the Forge · Wave 3`；机库检查点为 `第2关 · 沙漠风暴 · 机库整备` / `Ch. 2 · Sandstorm · Hangar`）；`MISSION FAILED` 结算提供「从检查点继续」；检查点还原分数、生命、导弹、升级、武器解锁与弹药、热焰弹、视角与本局统计
- 普通模式新开一局清除旧检查点；Boss 模式不写检查点；打完第 10 章标记战役完成（`air-supreme:campaign-progress`）并清除检查点；损坏的存档读取时被清除

#### 音乐与音效

- 新音乐系统（`src/core/Audio/MusicSystem.ts` + `src/core/Audio/music/`）：前瞻式音序器、合成乐器、混响与限幅总线；23 首曲目（10 首关卡曲、10 首 Boss 曲、菜单 / 剧情 / 胜利曲）与 7 个刺激音，全部实时合成
- `setIntensity`：Boss 阶段推进时音乐图层、速度与滤波升级，神谕主宰逐帧驱动强度；刺激音对齐下一拍并移调到当前调性，Boss 击破 / 关卡完成 / 游戏结束 / 战役通关刺激音接管并结束当前曲目
- 开始菜单音乐（第一次用户手势后播放，进入战斗淡出、回到菜单恢复）；暂停时音乐淡出并停止持续音效，继续时恢复
- 新音效（`src/core/Audio/sfx/`）：特殊武器各阶段、热焰弹、地空导弹锁定 / 发射、炸弹、坦克炮、直升机、汽笛、声呐、视角切换、自动存档、无线电、打字机、武器切换 / 解锁、平民告警、章节重音、雷击、熔岩喷发、护盾受击、Boss 阶段警报、结算计数、按作战域区分的单位被毁；地面冲击新增熔岩 / 冰面 / 岩石 / 云层；音效总线压缩器
- 远处单位事件按距离静音并限流（`CampaignSfxRouter`）

#### 特效与 HUD

- 粒子系统改为实例化后端 + 分层配方，粒子预算随画质预设变化；新增枪口焰、受损冒烟、拾取爆闪、EMP 电环、舰船级大水花与熔岩 / 冰面 / 岩石 / 云层冲击
- HDR 后处理（`PostFxPipeline`：场景 → 泛光 → 调色 / 屏幕效果），按关卡 `postFx` 调色；`performance` 画质关闭后处理，屏幕效果改用轻量叠加层
- 屏幕效果：受击脉冲、低血量心跳暗角、加力速度线、闪白、EMP 电磁闪
- 翼尖凝结尾迹（玩家、敌机与僚机）、护盾受击六边形涟漪、玩家与残血敌机受损冒烟
- HUD 新面板：特殊武器挂架（弹药 / 装填 / 热量 / 蓄力 / 冷却 / 槽位）、热焰弹计数、自动存档提示、视角标签、Boss 状态条与阶段菱形、导弹告警（`locking` / `incoming`，合并地空导弹与 Boss 导弹）、闪烁告警；雷达量程倍率
- 移动端拇指弧触控布局，新增「特武」「热焰」「切换」「视角」按钮（英文界面为 SPEC / FLARE / SWAP / VIEW），按钮外圈显示装填 / 热量 / 蓄力进度与导弹告警

#### 平衡（实测难度曲线）

- 逐关强度集中到一张 `LEVEL_CURVE` 表（`src/core/Difficulty.ts`，第 1 关为基准 1.0）：敌机火力（伤害 ÷ 冷却）到第 10 关约为第 1 关的 9.8 倍（第 6 关起上一个台阶，见下文「终验修复」），血量涨幅压低；五档难度重新居中，默认的「普通」（英文 Normal）对应称职的普通玩家（基础数值按「专家」手感编写）
- 敌机超出 420 米不再开火；瞄准散布同时作用于偏航与俯仰
- 同时在场的敌机上限改为玩法规则（桌面 6 / 移动端 5，第 4-6 关 +1、第 7-10 关 +2），不再随画质档或运行时自动降档变化（`GameConfig.getMaxEnemies` + `LevelManager.getMaxConcurrentEnemies`）
- 第 1 关更温和：敌机逐波缓升、第 3 波起才有战斗机，教学关不部署高炮与地空导弹车（从第 2 关开始），每波至多 1 辆坦克；第 10 关波次减轻；中后期密集的单位组合减量
- Boss 血量按实测击杀时间重新设定（`BOSS_CONFIGS`）
- 开发构建专用的脚本飞行员平衡测量工具（`src/core/dev/ScriptedPilot.ts`、`BalanceHarness.ts`，`window.__AIR_SUPREME_DEV__.balance`）：按普通玩家水平飞行、自动机库采购，记录每波清场时间、伤害来源、阵亡（含最后 10 秒的主要伤害来源）、Boss 击杀时间、得分与升级点

#### 修复

- 后处理隔帧丢深度（VFX 升级中引入、合并前已修复）：调色 ShaderPass 沿用默认 `needsSwap = true`，EffectComposer 隔帧把场景画进无深度缓冲的 writeBuffer，`quality` / `balanced` 画质下玩家机身消失、其他飞机半透明；末尾 Pass 改为不交换，闲置 writeBuffer 缩回 1×1（`0db18f2`，由 `PostFxPipeline.test.ts` 固定）
- 第 1-5 关 Boss 原先固定在 +Z 200 米出生（玩家朝 -Z 时在身后），现在出生在玩家前方；子弹按部件形状的命中体积判定；敌机子弹不再误伤 Boss
- 第 1-10 关 Boss 统一出场定位（`AdvancedBossSupport`）：候选点限定在机头 ±60° 内、0.7-1 倍设计距离（陆地 / 海上 Boss 最远 1.8 倍），位于 1150 米圆形战场内且落在合适的地表；玩家在战场边缘朝外飞、前方放不下 Boss 时提示「Return to the combat zone · Boss incoming / 返回作战区域 · Boss 即将现身」，机头转回后（最多 9 秒）才出场；远处或偏离机头的 Boss（神谕主宰总是如此）每 3.2 秒报一次方位与距离，至多 4 次，隐形 Boss 不报
- 第 6-10 关 Boss 在模块加载完成之后才按玩家当前姿态定位（加载慢时不再出现在玩家身后）；空中航母与重型轰炸机按高度差推远出生距离，登场时出现在画面内、不被 Boss 状态条遮挡
- 每关出生姿态按地形采样挑选航向，校验前方左右各 150 米、直到 1.5 公里边界的航道净空（10 米网格，前 600 米留 70 米、之后 60 米），细高的尖塔与支柱也能发现（第 6 关不再正对火山，第 9、10 关不再冲向天梯支柱 / 城墙，第 3 关避开山脊）
- 坠毁复活：离地至少 40 米、机翼水平，航向避开前方的上升地形（复活点与航向的规则在终验修复中重写，见下文）
- 敌机前瞻避让高耸地形，不再穿过火山、峡谷崖壁与坑缘
- 玩家子弹 / 导弹对大型舰船、雷达站与 Boss 部件按命中半径判定；命中特效与音效按采样地表选型（不再用硬编码的湖区半径与固定平面）
- 敌机血条不再显示「NaNm」；Boss 导弹在 NaN / Infinity 输入下保持有限状态（单帧 NaN 不再让在途导弹永久失效）
- 血条为每个 Boss、Boss 部件（触手之眼、散热口、指挥塔、压载舱、导弹舱、气囊、无人机舱、相位发射器、护盾塔）与单位标注名称（第 6-10 关 Boss 原先都显示为「Enemy」），现随界面语言显示
- 熔岩巨像与深渊利维坦的骨架继承根节点声明的命中半径
- 音量：非有限值（NaN / ±Infinity）被忽略，不再写入增益节点
- 无线电：两句之间的短暂间隔也算忙碌，「空闲」即可立即显示下一句
- 语言相关修复：结算面板标题与按钮按当前语言写入并随切换重写（中文为「任务失败」/「任务完成」），开始菜单选的语言不再让结算按钮停留在旧语言；血条名称在切换语言后立即重写（暂停中也生效）；暂停升级菜单的标题在中文下为「⚙️ 升级」；无线电当前台词、呼号与读屏文本随切换重写
- 剧情旁白的打字节奏只计字符之间的停顿、调速上限放宽到 ×6，中英文文字都在配音结束前约 0.35 秒打完（原先中文段落最多提前 2 秒打完）

#### 终验修复（独立终验之后的两波修复，`2e9941d..0cd1735`）

- **复活**：坠毁后不再原地再撞——复活点沿航迹退回到坠毁前至少 3 秒、水平至少 150 米处（航迹太短时由最远的航迹点外推到 150 米），离地至少 40 米；航向取 8 个候选方向中第一个前方 0-400 米无遮挡的（探测宽度在「收尾打磨」中加宽），全部受阻时爬升越过障碍最低的一条航线，仍不行则取首个障碍最远的方向；复活后 3 秒坠毁宽限：触地或撞上结构时抬到表面上方 3 米并拉起机头（约 12°），不再连丢几条命。能量护盾道具仍不防撞地
- **移动端暂停**：「暂停」键的轻触改为锁存，帧率再低、轻触再短也不会丢
- **僚机出击**：每关开场整个僚机编队一起升空（第 1-2 关渡鸦，第 3 关起渡鸦与雨燕；读档回到 Boss 战前时随 Boss 简报升空）；雨燕的入列台词每局战役只播一次（Boss 模式不播），并记入检查点（新增可选存档字段 `swiftJoined`，没有该字段的旧存档在第 3 关之后视为已播）；增援、Boss 战友军支援、「召唤友军」道具与护送友机不再播入列台词（原先雨燕从第 3 关到第 10 关每关都重新报到）
- **僚机队形**：空闲僚机保持左右交替的编队位（机翼线前 38 米、横向 40 米、高 6 米，之后各排更靠外、靠后），不再挡在追尾相机与座机之间，换边时从相机后方或座机前方绕行；新友机在自己编队位一侧入场、机头朝玩家航向（原先在玩家周围随机 ±50 米入场，可能落在镜头后方）
- **机库检查点**：普通模式第 1-9 关击破 Boss 即写入机库检查点（击破后的分数、统计与升级点，下一关的升级上限与武器解锁），HUD 提示「第N关完成」（英文 `Level N cleared`）；机库点「出击」时静默重写一次，章节卡片期间退出也不丢机库里的购买；从它继续时 机库 → 本章开场卡片 → 战斗，弹药与热焰弹在章节开始时补满（原先在收尾、结算、机库或章节卡片期间退出，会回到 Boss 战前并丢掉击破后的分数与机库购买）
- **紧急告警**：地空导弹来袭的配音每波（每场 Boss 战）最多 2 次（冷却 20 秒、之后 45 秒），误伤平民的配音同样最多 2 次（15 秒 / 30 秒），HUD 闪烁告警与告警音每次照发；导弹来袭、低血量、误伤平民不再打断正在配音的台词（此时跳过，低血量等那句说完再报），被打断的台词最多重播一次（原先导弹告警每 9 秒就可再响，剧情台词被反复从头念起）
- **Boss 收尾**：按游戏时间（暂停不计）等无线电把全部收尾台词说完——至少 1.6 秒，上限 = 开始收尾时的无线电积压估计（按当前语言的配音时长）+ 6 秒，最多 75 秒（原先最多 16 秒，较长的收尾台词会被结算卡片截断，第 10 章的最后一句从未播出）
- **界面语言**：入关 / Boss 简报横幅、存档提示（含「继续：…」）与事件波次 / 教学的完成提示在显示期间切换语言会立即按新语言重绘；中文难度名与英文逐档对齐为 非常简单 / 简单 / 普通 / 困难 / 专家（原先错位一档，英文 Easy 显示为「普通」），开始菜单的难度名直接取自难度档
- **HUD 布局**：适配安全区，手机竖屏 / 横屏与桌面下顶部信息互不重叠——右侧状态列（波次、生命、导弹、装填、道具计时）、中央消息栈（Boss 条、简报、事件目标、竖屏下的存档提示），无线电面板跟随消息栈底部；竖屏下生命与导弹并排，消息栈拥挤时存档提示稍后完整显示；中央大字提示改为锁定圈上方的横幅，不再挡住准星；ENEMIES / LEFT 计数器加深色底
- **Boss 部件血条**：改为紧凑小血条，只有离准星最近的部件显示名称（带滞回，不来回跳），八只触手之眼 / 六个气囊不再叠出一排名字；部件不再各自产生屏外箭头
- **EMP 画面**：屏幕脉冲改为短促（约 0.5 秒）的电光蓝边缘与一道从准星外扫向屏幕边缘的环，中心不再提亮泛白；修复 EMP 冲击环着色器（细环被画成实心圆盘），冲击环与电磁球壳贴近镜头时淡出，中心闪光更小、第一人称不显示——追尾视角下释放 EMP 不再白屏
- **模型预览**：第 6-10 关 Boss 显示各自的模型（原先回落为重型轰炸机），按可见几何取景（竖屏不再裁切），切换时释放 GPU 资源
- **Boss 战**：Boss 导弹伤害随难度缩放（基础 90 × 难度伤害倍率：非常简单 31 / 简单 38 / 普通 45 / 困难 56 / 专家 70，原先一律 90；幻影之翼弹舱导弹基础值加倍，普通 90）；热焰弹也能诱骗第 1-5 关 Boss 的导弹；沙墙与三叉戟的高炮、空中航母的重炮会算提前量，重型轰炸机机炮带散布；三叉戟改为真正的导弹齐射（每轮 2 枚，血量低于 35% 时 3 枚；72 米/秒、限速转向、7 秒燃尽，急转可以甩掉）；空中航母每批放出 2 架护航机；幻影之翼 9,500 血、巡航更快、可见窗口更长、隐形更短，弹舱导弹 88 米/秒按提前量追踪；各 Boss 的血量、伤害与射速按实测重新平滑（`BOSS_CONFIGS`）
- **平衡**：关卡曲线第 6 关起上一个台阶——敌机火力（伤害 ÷ 冷却）约为第 1 关的 2 倍（第 2-3 关）、2.9 倍（第 5 关）、5.1 倍（第 6 关）、9.8 倍（第 10 关），命中加成到 +0.27；敌机射击会算提前量（第 2 关 0.28 → 第 10 关 0.94 的拦截提前量）；第 2-10 关每波敌机减少，敌方地面 / 海上单位与轰炸机基础血量约降四成（武装直升机约四分之一），单位的单发伤害随关卡涨得更缓（`unitDamageShare`），关卡不再被慢速单位拖长；得分倍率到第 10 关为 2.08（原 1.5），升级预算跟上。实测（脚本飞行员，普通难度）每分钟承伤从约 20-25%（第 1-2 关）升到约 30%（第 3-6 关）与 35-40%（第 8-10 关）的最大生命值
- **性能**：静态道具按材质合批（`worldscape/staticBatch.ts`：城区、湖畔村落与码头、沙漠道具、海岛），鸟群实例化，透明面片单遍绘制——第 5 关（平衡画质）绘制调用约 1,126 → 225；植被分块并按画质切换远景替身与抽稀（关卡加载时读取画质档：性能 700 米、平衡 1,000 米、高质量 1,800 米；移动端按性能档）——第 1 关（性能画质）三角形约 920k → 264k；云层只绘制当前覆盖率下可见的云
- **其他**：「生命恢复」（Repair Kit）的说明改为与实际效果一致：「生命 +1，并完全修复战机」（原先写「恢复 30 点生命值」）；开发构建以外只输出 WARN 及以上级别的日志；波次敌机群的出生点限定在战场内，不再被压到边界、贴着玩家出现
- **测试**：新增 `BossPartLabels`、`CampaignFlow`、`Difficulty`、`HudText`、`InputHandler`、`Logger`、`ModelPreview`、`PlayerRespawn`、`RadioBudget`、`StaticBatch`、`TerrainDetail`、`WingmanFormation` 规格测试，更新 `BilingualData`、`CampaignPresentationVoice`、`RadioComms`、`SaveSystem`、`UnitController`、`VoicePack`（五句僚机台词已录制，不再豁免）、`Wingmen`；撰写时 `src/__tests__` 共 77 个 `*.test.ts`，1,662 个测试通过、2 个跳过

#### 收尾打磨（终验修复之后，`0cd1735..f6ce2d3`）

- **界面语言**：闪烁告警、Boss 状态条与道具倒计时在显示期间切换语言会立即换成新语言（原位重绘，不重播动画、不重置计时）——包括误伤扣分提示、「返回作战区域」提示、Boss 方位播报、第 6-10 关 Boss 的阶段名与特殊攻击预警；第 6-10 关 Boss 的状态提示在切换语言（多在暂停菜单里）时立即重推，不再等到继续游戏
- **Boss 伤害**：沙墙与三叉戟的高炮、八爪鱼战舰「深渊之眼」的眼睛光弹也随难度缩放（原先固定 15 / 20）：基础值翻倍为 30 / 40，普通难度保持 15 / 20，其余每发 非常简单 11 / 14、简单 13 / 17、困难 19 / 25、专家 23 / 31
- **复活**：净空探测加宽到航线两侧各 24 米、每 3 米一条线（比 8 米宽的天梯导轨更密），不再擦着刚撞上的立柱复活；复活后 8 秒内又撞地时，下一次复活的首选航向掉头、背离障碍；复活宽限期内撞上岩壁或立柱时把战机水平推出到最近的开阔处并转离墙面（原先只往上抬，贴着立柱一路爬升、宽限一结束又坠毁——脚本飞行员在第 9 关曾于同一根立柱旁连续坠毁 24 次）
- **中央大字提示与单位告警**：显示期间切换语言也会立即换成新语言（原先停留在发出时的语言）——友军支援、激光预警、僚机被击落、拾取道具（含「获得道具！」副标题）、升级反馈与升级点、护送结果、教程提示、事件波次播报、「已击坠」、特殊武器提示（「尚无特殊武器」「武器尚未解锁」、切换武器时的武器名），以及停火、导弹来袭与「残余目标脱离战区」告警；排在简报之后的大字提示在显示时取当前语言
- **教程**：中文界面把教学称为「教程」——开始菜单开关（原「试玩关卡」）、教学目标标题「教程 · 机动确认」…「教程 · 完成」（原「试玩引导 · …」）与开场提示「教程开始」（原「试玩关开启」）；英文不变
- **Boss 战敌人计数**：Boss 战（Boss 模式与战役 Boss 关）中 HUD 计数只显示在场的敌方「敌人 n」（`ENEMIES n`：Boss 放出的敌机与无人机，以及敌方单位），不再显示本关波次的「剩余」（原先整场 Boss 战都显示本关波次花名册的计数）；波次中仍为「敌人 n · 剩余 m」
- **模型预览**：模型只在名称标签上方的区域取景（写入名称后按页面实测标签位置，改变窗口大小与切换语言时重新取景），较长或换行的名称不再挡住大型 Boss；名称放得下时单行显示（窄屏字号更小）；横屏且高度不超过 520 像素的视口（如横握手机）改为左右两栏，画布在左、按钮在右（原先单列排布，画布被压得很小）
- **工程**：编队位布局只在 `FriendlyAI` 的 `getFormationSlotOffset` 中定义，友机入场点也读它；开发构建的脚本飞行员会绕开岩壁与立柱，新增调试钩子 `grantPowerUp(type)`；`HUD.showPowerUpBig(icon, name: HudText, …)` 与 `SpecialWeaponsDeps.notify(icon, text: HudText)` 改收双语原文，新增 `HUD.setEnemyCounterMode(mode: HudEnemyCounterMode)`（`'wave' | 'boss'`）

#### 运行时与测试

- 新的重型模块按需加载：`CameraRig`、`UnitSystem`、`WeaponSystem`、`CountermeasureSystem`、`ContrailSystem`、`StoryOverlay` / `RadioComms`、第 6-10 关 Boss（Boss 在登场时加载，其余在菜单空闲时预热）
- 协调器接线拆到 `src/core/` 下的控制器（`CampaignFlowController`、`UnitController`、`SpecialWeaponsController`、`PlayerViewController`、`CombatVfxController`、`CombatHudFeed`、`AdvancedBossController`），表现层统一经 `ICampaignPresentation`（见 `docs/decisions/0001-campaign-presentation-adapter.md`）
- `EventBus` 没有新增事件类型：单位开火经 `bridgeUnitFireToEventBus` 接入现有 `ENEMY_FIRED` / `FRIENDLY_FIRED`
- 开发构建专用调试钩子 `window.__AIR_SUPREME_DEV__`（生产构建裁剪）
- 去掉 `WeaponSystem.prepareFrame`、`InputHandler.getState`、`CombatSystem` 碰撞回调的逐帧分配；玩家导弹列表每帧原地压缩，`MissileSystem.getActiveCount` 只计数不再分配
- 新增规格测试：`AdvancedBosses`、`CameraRig`、`CampaignAudio`、`CampaignData`、`CampaignHud`、`CampaignMenus`、`CampaignVfx`、`PostFxPipeline`、`RadioComms`、`SaveSystem`、`SpecialWeapons`、`StoryOverlay`、`TerrainLevels`、`UnitSystem`、`UpgradeTiers`（`src/__tests__/*.test.ts`）；更新 `Boss.integration`、`BossTypes`、`UpgradeMenu`、`UpgradeSystem` 的过期断言
- 语言与配音的规格测试：`I18n`、`BilingualData`、`CampaignCast`、`VoiceScript`、`VoicePack`（语音包清单与脚本、文件一致）、`VoiceSystem`（假 AudioContext）、`StoryNarration`、`CampaignPresentationVoice`、`Wingmen`、`UnitController`；HUD、剧情、无线电、菜单、新手引导与页面外壳的测试改为英文优先并覆盖切换到中文；Boss 血量断言按实测平衡重新固定（撰写时 `src/__tests__` 共 65 个 `*.test.ts`）

### 战斗音效解锁（共享 AudioContext）

- 开始游戏 / 再来一局点击时解锁 Web Audio：战斗 SFX 与 BGM 现在能在该点击上手势上出声
- `StartMenu.startGame()` 在隐藏菜单 / 调用 `onStart` 之前同步 `unlockAudioFromUserGesture()`；`main.ts` `bootGame` 在 `disposeGame()` 之后、`await import('./core/GameCoordinator')` 之前同样解锁（重试走 `bootGame`）
- SFX 与 BGM 共用 `src/core/Audio/AudioContextHost.ts` 上的一个 `AudioContext`；`AudioManager` 与 `MusicSystem` 的增益图仍各自独立
- `AudioManager.beginSound()` 在 `canPlay()` 之前调用 `this.resume()`；`GameCoordinator.startInternal` 始终 `audioManager.resume()` / `musicSystem.resume()`（无 `audioInitialized` 闩锁）
- 全量门槛通过：`npx tsc --noEmit && npm run lint && npm run test:run && npm run build`（**40 个测试文件 / 399 个测试**）；lint 0 errors（`src/__tests__/HUD.test.ts` 仍有 2 条既有 `@typescript-eslint/no-non-null-assertion` warnings）；`vendor-three` chunk-size warning 仍在（约 517.43 kB）

### 活地形坠毁（GitHub #10）

- 玩家坠毁判定改为活地形/水面采样，不再使用固定世界平面
- `PlayerSystem.setCrashSurfaceSampler((x, z) => number)`：世界 `Y <=` 采样表面即击杀；未注入采样时回落 `WORLDSCAPE_WATER_Y`（`-48`，导出自 `src/features/terrain/TerrainGenerator.ts`）
- `GameCoordinator` 注入 `enemySystem.getLevelManager().getCrashSurfaceY(x, z)`，地形未加载时同样回落 `WORLDSCAPE_WATER_Y`
- `TerrainGenerator.getCrashSurfaceY` / `LevelManager.getCrashSurfaceY`：高度场局部 0 为水面；无高度场时回落水面高度

### 站点 chrome（GitHub #11）

- `index.html`：`<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`；源文件 `public/favicon.svg`
- viewport：`width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`
- HUD 结算层与 `PauseMenu` 使用 `env(safe-area-inset-*)` 贴齐刘海/安全区

### 航电 HUD 与锁定（GitHub #5）

- 新增 `src/ui/theme/hudTokens.ts`：`injectHudTokens()` 向 `:root` 注入航电 CSS 变量（仅一次，style id `hud-tokens`）
- 色板：`--hud-sys #8FE4FF`、`--hud-weapon #FFB347`、`--hud-lock #5CFFB0`、`--hud-threat #FF4D4D`、`--hud-ally #F4D35E`
- 布局密度 `HudLayoutDensity`：`desktop | touch-landscape | touch-portrait`；`HUD.setLayoutDensity` / `LockOnIndicator.setLayoutDensity`
- 锁定状态 `LockOnState`：`search | track | lock | break | dry`。SEARCH 空心虚线环；TRACK 菱形+弧（weapon `#FFB347`）；LOCK 薄荷绿 `#5CFFB0`（非 `#00ff00`）；BREAK 威胁红 `#FF4D4D`；DRY 文案 `NO MSL`（非 `NO MISSILE`）
- `AudioManager.playMissileLockBreak()` / `playMissileDry()`（`SoundType.MISSILE_LOCK_BREAK` / `MISSILE_DRY`）

### 战斗可读性（GitHub #6）

- `RadarMinimap` 三档都创建 `#radar-minimap`：桌面 120px 左下，触摸横屏 72px / 竖屏 64px 在摇杆上方 8px，`pointer-events: none`
- 新增 `OffscreenChevron`：敌机琥珀 / 来袭导弹绯红；`playIncomingWarning` 带 minInterval
- 护盾改为双层 `--hud-sys` 球，不再是 `#00ffff` 塑料球

### 战役节拍（GitHub #7）

- `HUD.showBriefing`：1–5 关标题 湖畔晨曦 / 沙漠风暴 / 雪山之巅 / 深海决战 / 城市废墟；Boss 重型轰炸机 / 沙漠堡垒 / 八爪鱼战舰 / 导弹驱逐舰 / 空中航空母舰
- 非 game-over 死亡显示 `LIFE × N` 复活 overlay；`showGameOver` 不显示

### 外壳统一（GitHub #8）

- StartMenu 去掉 `min-width: 400px`，改为 `width: min(420px, 100%)`；主按钮不再 `#4CAF50` 胶囊；标题无 ✈️🎮👹
- 升级卡缩写 HP / SPD / ROE / DMG / RAD / RLD / LCK；移动端暂停钮文案「暂停」；`.mobile-controls` 跟随 `GameConfig.isMobile`
- A4「最终统一 HUD 与关卡视觉语言」记为完成（#3 / #5–#8）

### 测试与工程状态（#10 / #11 / #5–#8）

- 全量门槛通过：`npx tsc --noEmit`、`npm run lint`、`npm run test:run`（**39 个测试文件 / 387 个测试**，两次）、`npm run build`
- `vendor-three` chunk-size warning 仍在（约 517.43 kB）

### 会话循环（experience-upgrade 1/5）

- 页级 `StartMenu`：开局调用 `hide()`，不再 `dispose()`；`GameCoordinator` 以 `{ showStartMenu: false, onRetry, onExitToMenu }` 启动
- 结算 HUD：`#game-over-title` 失败为 `MISSION FAILED`、通关为 `MISSION COMPLETE`；按钮 **再来一局** / **返回菜单**（`setSettlementActions`）
- 再来一局使用本局 `lastSettings` 重开；返回菜单调用 `reloadFromStorage()` 后 `show()` StartMenu
- 新增 `PauseMenu`（`#pause-menu`，z-index 200）：继续 / 升级 / 设置 / 返回菜单；设置仅 音效 / 音乐 / 画质；返回菜单确认文案 `返回主菜单？当前进度将丢失。`
- ESC / P 与移动端 `#upgrade-button` 打开暂停舱（引擎 `stopEngine`）；桌面 `U` 先暂停再打开升级商店；`GAME_OVER` 忽略暂停
- `SessionSettings` 以 `START_MENU_STORAGE_KEY = 'air-supreme:start-menu-settings'` 通过 `loadStartFlowSettings` / `saveStartFlowSettings`（先合并再规范化）持久化开始流程设置
- `InputHandler.dispose()` 清理监听；`UpgradeMenu.show()` 在 `dispose()` 之后为空操作
- 构建拆出独立 chunk `PauseMenu-*.js`
- 全量门槛通过：`npx tsc --noEmit`、`npm run lint`、`npm run test:run`、`npm run build`（**33 个测试文件 / 338 个测试**）；`vendor-three` chunk-size warning 仍在（约 517 kB）

## [2.2.1] - 2026-06-13

### 透明层与导弹可读性

- 水面、云层、卷云、天气粒子与战斗 VFX 明确关闭透明深度写入，并补齐稳定渲染顺序
- 水面、云层、卷云、雾霾、天气粒子与限定玩法 VFX / 尾迹统一回到普通透明深度排序，避免环境透明层压住前景玩法特效
- 玩家导弹尾迹频率和默认强度提高，海面与云层背景下轨迹更容易辨认

### 道具生成与气球图标

- 气球道具图标改为 Sprite，气球本体旋转时图标仍保持面向相机
- 生成气球特效由更新循环统一清理，避免同时生成时重复 dispose 或残留冻结
- 生成动画进度与淡出透明度补齐大帧率跳变钳制

### 开局状态与结算

- 测试分数档位统一为 `关闭 / 5000 / 10000 / 15000 / 20000`
- 开局测试分数同步进入 `GameState` 与 HUD，并继续授予对应升级点
- 最终通关显示 `MISSION COMPLETE`，玩家死亡仍显示 `GAME OVER`
- StartMenu 本地存储访问增加能力检测，兼容测试和受限浏览器环境

### 测试与工程状态

- 新增 `PowerUpSystem.test.ts`、`SessionSettings.test.ts`
- 当前测试规模为 **32 个测试文件 / 318 个测试**
- 全量门槛通过：`npx tsc --noEmit`、`npm run lint`、`npm run test:run`

## [2.2.0] - 2026-03-08

### 视觉与战斗反馈收口

- 飞机模型终版继续收口，玩家机与敌机补齐翼根、进气、机腹、尾段等中近景细节
- 玩家机炮、敌机炮弹、Boss 炮击的飞行轮廓与命中反馈继续拉开
- 普通弹道碰撞链路已补齐 `source/tone` 透传，命中音画不再只按目标类型近似路由
- Boss 命中玩家时的双重 `PLAYER_HIT` 默认反馈已去重，HUD 受击闪与教程统计仍保留

### 运行时边界与包体积

- 新增 `PresentationRuntimeLoader`，将 `HUD / EnemyHealthBars / LockOnIndicator / BossMissileIndicator / PresentationController` 从 `GameCoordinator` 顶层运行时导入移到按需路径
- `GameCoordinator` 构建产物从上一轮约 `155.99 kB` 继续下降到约 `105.10 kB`
- 构建已拆出 `PresentationRuntimeLoader`、`PresentationController`、`HUD`、`EnemyHealthBars`、`LockOnIndicator`、`BossMissileIndicator` 等独立 chunk

### 测试与工程状态

- 新增 `PresentationRuntimeLoader.test.ts`
- 当前测试规模为 **28 个测试文件 / 304 个测试**
- 全量门槛持续通过：`npx tsc --noEmit`、`npm run lint`、`npm run test:run`、`npm run build`

## [2.1.0] - 2026-02-19

### 配置外置系统

#### ConfigLoader

- **新增文件**: `public/config/game-config.json` - 游戏配置 JSON
- **新增文件**: `src/core/utils/ConfigLoader.ts` - 配置加载器
- **特性**:
  - 异步加载 JSON 配置
  - 完整 TypeScript 类型定义
  - 默认值 fallback（配置加载失败时使用内置默认值）
  - 便捷访问方法：`configLoader.getPlayer()`, `configLoader.getEnemy('FIGHTER')` 等

### 结构化日志系统

#### Logger

- **新增文件**: `src/core/utils/Logger.ts`
- **特性**:
  - 日志级别：DEBUG、INFO、WARN、ERROR
  - 模块名标记：每个模块独立 logger
  - 结构化输出：时间戳 + 模块 + 级别 + 消息 + 数据
  - 生产环境自动关闭 DEBUG 日志
  - 日志历史存储与导出

### Bug 修复

#### 生命恢复道具第二次无效

- **Issue**: 第一次获取生命恢复道具能起作用，之后再次获取就没效果了
- **Cause**: 即时效果（duration=0）被当作持续效果处理，重复检查逻辑错误
- **Fix**: 即时效果每次都触发回调，不走重复检查逻辑
- **File**: `src/features/powerups/PowerUpSystem.ts`

### 内存泄漏修复

#### EventBus 订阅追踪

- **新增**: `eventUnsubscribers` 数组存储所有取消函数
- **修改文件**: `GameCoordinator.ts`, `CombatSystem.ts`
- **效果**: dispose() 时正确取消所有订阅

#### setTimeout 追踪

- **新增**: `pendingTimeouts` Set 跟踪所有定时器
- **新增**: `scheduleTimeout()` 方法封装 setTimeout
- **修改文件**: `GameCoordinator.ts`, `OctopusWarshipAI.ts`, `ParticleSystem.ts`
- **效果**: dispose() 时取消所有待执行定时器

#### 对象池 dispose

- **新增**: `ProjectilePool.dispose()`, `BossProjectilePool.dispose()`
- **效果**: 正确清理池中所有对象

### 性能优化

#### 粒子系统

- **修复**: 移除共享几何体的错误 dispose
- **文件**: `src/features/effects/ParticleSystem.ts`

#### 导弹系统

- **优化**: 共享几何体，避免每枚导弹创建新几何体
- **修复**: 材质正确 dispose
- **文件**: `src/features/combat/MissileSystem.ts`

#### 材质数组清理

- **修复**: 正确清理材质数组（支持 Array<Material>）
- **修改文件**: 7 个 AI 文件（EnemyAI, FriendlyAI, BossAI 等）

#### 几何体/材质缓存

- **优化**: AircraftMeshFactory 按敌机类型缓存几何体和材质
- **文件**: `src/features/aircraft/AircraftMeshFactory.ts`

#### 地形 LOD

- **优化**: 距离 >600m 时隐藏树木/岩石
- **新增**: `TerrainGenerator.updateLOD()` 方法
- **文件**: `src/features/terrain/TerrainGenerator.ts`

### 测试补充

#### 新增测试

- **EnemyAI.test.ts**: 18 个测试用例
- **LevelManager.test.ts**: 16 个测试用例
- **总计**: 273 个测试用例全部通过

### 日志系统替换

替换 11 个文件中的 console.log/error/warn 为 Logger:

- `main.ts`, `TerrainGenerator.ts`, `LevelManager.ts`, `EnemyAI.ts`
- `PowerUpSystem.ts`, `AudioManager.ts`, `MusicSystem.ts`
- `RadarMinimap.ts`, `MissileSystem.ts`, `ECS.ts`, `InputHandler.ts`

---

## [2.0.0] - 2026-02-15

### 🏗️ 架构重构

#### EventBus 事件系统

- 新增类型安全的事件总线 `src/core/EventBus.ts`
- 定义 20+ 游戏事件类型 (`GameEventType`)
- 支持 `on`, `off`, `once`, `emit`, `clear` 操作
- 完整的 TypeScript 类型推断

#### 模块化子系统

从单体 `Game.ts` (1300+ 行) 提取为 4 个独立子系统：

| 子系统        | 文件                                | 行数 | 职责                       |
| ------------- | ----------------------------------- | ---- | -------------------------- |
| PlayerSystem  | `src/core/systems/PlayerSystem.ts`  | 213  | 玩家控制、生命、护盾、重生 |
| CombatSystem  | `src/core/systems/CombatSystem.ts`  | 158  | 投射物、导弹、碰撞检测     |
| EnemySystem   | `src/core/systems/EnemySystem.ts`   | 144  | 敌人生成、友军管理、波次   |
| PowerUpSystem | `src/core/systems/PowerUpSystem.ts` | 76   | 道具掉落、效果应用         |

#### GameCoordinator 主协调器

- 新增 `src/core/GameCoordinator.ts` (711 行)
- 替代原有 `Game.ts` 作为主入口
- 组装所有子系统，通过 EventBus 通信
- 处理游戏生命周期 (start, stop, dispose)

### 🧪 测试基础设施

#### 新增测试框架

- **Vitest**: 单元测试框架
- **jsdom**: DOM 环境模拟
- **@vitest/coverage-v8**: 测试覆盖率

#### 测试覆盖

| 测试文件                     | 测试数 | 覆盖范围 |
| ---------------------------- | ------ | -------- |
| `config.test.ts`             | 5      | 游戏配置 |
| `EventBus.test.ts`           | 6      | 事件总线 |
| `interfaces.test.ts`         | 1      | 系统接口 |
| `events.integration.test.ts` | 7      | 事件集成 |
| **总计**                     | **19** |          |

### 📦 代码质量工具

#### ESLint + Prettier

- `eslint.config.js`: ESLint 9.x 配置
- `.prettierrc`: Prettier 格式化规则
- TypeScript 严格规则

#### 新增 npm 脚本

```bash
npm run lint          # ESLint 检查
npm run lint:fix      # 自动修复
npm run format        # Prettier 格式化
npm run test          # Vitest 测试
npm run test:run      # 单次测试
npm run test:coverage # 覆盖率报告
```

### 📁 文件变更

#### 新增文件

```
src/core/EventBus.ts              # 事件总线
src/core/GameCoordinator.ts       # 主协调器
src/core/index.ts                 # 统一导出
src/core/interfaces/IGameSystem.ts # 系统接口
src/core/systems/                 # 子系统目录
  ├── PlayerSystem.ts
  ├── CombatSystem.ts
  ├── EnemySystem.ts
  └── PowerUpSystem.ts
src/__tests__/                    # 测试目录
  ├── config.test.ts
  ├── EventBus.test.ts
  ├── interfaces.test.ts
  └── events.integration.test.ts
eslint.config.js
.prettierrc
vitest.config.ts
```

#### 重命名/废弃

- `src/Game.ts` → `src/Game.legacy.ts` (@deprecated)
- `src/Game.ts` (新建) → 向后兼容导出

### 🔄 迁移指南

#### 使用新架构

```typescript
// main.ts
import { GameCoordinator } from './core/GameCoordinator';

const game = new GameCoordinator();
game.start();
```

#### 监听游戏事件

```typescript
import { EventBus, GameEventType } from '@/core/EventBus';

EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
  console.log(`敌人被击败: ${payload.config.name}`);
});
```

#### 创建新子系统

```typescript
import { IGameSystem } from '@/core/interfaces/IGameSystem';

export class MySystem implements IGameSystem {
  readonly name = 'MySystem';
  init(): void {
    /* ... */
  }
  update(deltaTime: number): void {
    /* ... */
  }
  dispose(): void {
    /* ... */
  }
}
```

### ✅ 质量指标

| 指标       | 结果              |
| ---------- | ----------------- |
| 构建       | ✅ 成功           |
| 测试       | ✅ 19/19 通过     |
| TypeScript | ✅ 严格模式       |
| ESLint     | ✅ 主要问题已修复 |

---

## [未发布] - 2026-02-14

### 地面闪烁修复（Z-fighting 问题）

#### 🎯 问题描述

- **沙漠关卡（Level 2）和雪山关卡（Level 3）地面持续闪烁**
- **PC 和移动设备都出现闪烁**，排除了配置性能问题
- **深海（Level 4）和城市（Level 5）没有闪烁问题**
- 闪烁不是全局性的，某些区域闪烁，某些不闪烁

#### 🔍 根本原因

- **Z-fighting（Z 轴冲突）**：当大平面在相似的 Z 深度渲染时，渲染器无法确定显示哪个面
- **沙漠和雪山地形**：使用大平面地面（1500m x 1500m）+ 水面，两个平面距离太近导致深度缓冲区冲突
- **海水和城市没有问题**：这些关卡的地面材质配置不同，或者平面间距更大

#### ✅ 解决方案

- **添加 polygonOffset 参数**到沙漠和雪山地面材质
- **参数配置**：
  - `polygonOffset: true` - 启用多边形偏移
  - `polygonOffsetFactor: 1` - 偏移因子
  - `polygonOffsetUnits: false` - 使用世界单位
- **修改文件**：[src/features/terrain/TerrainGenerator.ts](src/features/terrain/TerrainGenerator.ts)
  - 第 398-405 行：沙漠地面材质（`generateDesertTerrain()`）
  - 第 574-581 行：雪山地面材质（`generateMountainTerrain()`）

#### 📊 技术细节

- **polygonOffset 工作原理**：在深度缓冲区中偏移多边形，避免两个面在同一深度竞争
- **为什么只有沙漠和雪山**：这两关卡的大平面地面最接近 Z 深度冲突条件
- **海水和城市没有问题**：
  - 海水：水面和地面颜色区分明显，深度缓冲区更容易区分
  - 城市：地面配置不同，可能没有相同的大平面冲突

#### ✅ 效果

- ✅ 沙漠和雪山地面闪烁完全修复
- ✅ PC 和移动设备都不再闪烁
- ✅ 视觉效果保持不变（polygonOffset 不影响外观）
- ✅ 性能无影响（仅影响深度缓冲区计算）

---

### 关卡进度系统修复

#### 🎯 问题描述

- **清完所有敌人后，游戏没有正确进入下一关**
- **关卡完成音效播放了**，但下一关没有加载
- **游戏卡在当前关卡**，玩家需要手动选择下一关

#### 🔍 根本原因

- **onLevelComplete 回调不完整**：只播放音效和日志，没有加载下一关的逻辑
- **关卡 ID 不递增**：`currentLevelId` 保持不变
- **没有加载新关卡**：`levelManager.loadLevel()` 没有被调用
- **没有启动新波次**：进入下一关后需要等待用户手动开始

#### ✅ 解决方案

- **关卡 ID 自动递增**：`this.currentLevelId++`
- **自动加载下一关**：`this.levelManager.loadLevel(this.currentLevelId)`
- **延迟启动第一波**：等待 2 秒后启动第一波（确保地形生成完成）
- **修改文件**：[src/Game.ts](src/Game.ts) 第 166-177 行

#### 📊 技术细节

```typescript
this.levelManager.onLevelComplete = (level) => {
  this.audioManager.playLevelUp();
  console.log(`关卡 ${level} 完成！`);

  // 增加关卡号并加载下一关
  this.currentLevelId++;
  this.levelManager.loadLevel(this.currentLevelId);

  // 延迟启动第一波（等待地形生成）
  setTimeout(() => {
    const playerPos = this.playerController.getPosition();
    this.levelManager.startWave(playerPos);
  }, 2000);
};
```

#### ✅ 效果

- ✅ 清完所有敌人后自动进入下一关
- ✅ 关卡完成音效播放
- ✅ 地形生成完成后自动开始第一波敌人
- ✅ 玩家可以连续游戏，无需手动选择关卡

---

### 气球图标显示优化

#### 🎯 优化目标

- **提高气球道具图标的可见性**
- **避免气球遮挡图标**
- **改善道具收集体验**

#### ✅ 优化内容

- **图标放大 2 倍**：
  - Canvas 尺寸：64x64 → 128x128
  - 图标平面：2.5x2.5 → 5x5
  - 字体大小：32px → 64px
- **位置提高**：Y 坐标从 3.5 提高到 5.5（避免被气球遮挡）
- **修改文件**：[src/features/powerups/BalloonPowerUp.ts](src/features/powerups/BalloonPowerUp.ts) 第 64-92 行

#### ✅ 效果

- ✅ 图标更容易看清（2 倍大小）
- ✅ 不会被气球遮挡（位置提高）
- ✅ 道具收集体验更好

---

## [未发布] - 2026-02-14

### 敌人生成战场边界限制修复

#### 🎯 问题修复

- **原问题**：敌人生成位置有时候会在战场区域之外
  - 玩家飞到战场外时，敌人群中心会超出边界（±750米）
  - 只有 fallback 逻辑有边界检查，正常流程没有限制
  - 导致敌人生成到战场外，玩家无法找到敌人
- **解决方案**：所有敌人生成位置都强制限制在战场范围内

#### 🔧 技术细节

- **添加战场边界常量** - [LevelManager.ts:38-39](src/features/levels/LevelManager.ts#L38-L39)
  - `BATTLEFIELD_MIN = -750`
  - `BATTLEFIELD_MAX = 750`
  - 战场范围：X/Z 平面 -750 到 750 米（跨度 1500 米）
- **边界限制辅助方法** - [LevelManager.ts:91-93](src/features/levels/LevelManager.ts#L91-L93)
  - `clampToBattlefield(value)`：限制单个坐标值在战场范围内
  - 使用 `Math.max/min` 确保坐标在 ±750 米范围内
- **群中心计算重构** - [LevelManager.ts:98-126](src/features/levels/LevelManager.ts#L98-L126)
  - `calculateWaveGroupCenter()` 方法：
    - 计算原始群中心（玩家位置 + 600-800米随机方向）
    - 使用 `clampToBattlefield()` 限制 X/Z 坐标
    - 如果被限制（超出边界），输出警告日志
  - `startWave()` 和 `startNextWave()` 都使用此方法
- **敌人生成位置边界检查** - [LevelManager.ts:392-403](src/features/levels/LevelManager.ts#L392-L403)
  - 正常流程：群中心周围 60 米半径分布
  - 所有生成的 X/Z 坐标都经过 `clampToBattlefield()` 限制
  - Fallback 逻辑也添加边界检查
  - 默认位置生成也添加边界检查

#### ✅ 效果

- ✅ 敌人群中心始终在战场范围内（±750米）
- ✅ 每个敌人生成位置都被限制在战场内
- ✅ 无论玩家飞到哪里，敌人都不会生成到战场外
- ✅ 如果群中心被限制，会输出警告日志方便调试
- ✅ 战斗体验更好：敌人始终在可战斗区域内

---

### 生命道具修复

#### 🎯 生命道具效果修正

- **问题**：生命道具错误地增加了 maxHealth 升级等级
- **修正**：现在正确地增加玩家生命数量（playerLives）
- **效果**：
  - 生命数量 +1（从初始 3 条命开始，最多 9 条）
  - 同时补满当前生命值到最大值
  - HUD 实时更新显示新的生命数量

#### 🔧 技术细节

- **修改文件**：
  - [src/Game.ts](src/Game.ts) 第 211-214 行
    - 从 `playerStats.increaseMaxHealth()` 改为 `this.lives++`
    - 调用 `playerHealth.healToMax()` 补满血量
    - 调用 `hud.updateLives(this.lives)` 更新 UI
  - [src/features/upgrade/UpgradeSystem.ts](src/features/upgrade/UpgradeSystem.ts)
    - 删除错误的 `increaseMaxHealth()` 方法

#### ✅ 效果

- ✅ 生命道具现在正确地增加生命数量（不是 maxHealth 升级）
- ✅ 获得生命道具时自动补满血量
- ✅ HUD 实时显示更新的生命数量

---

### 敌人AI盘旋系统优化

#### 🎯 盘旋目标智能选择

- **问题修复**：
  - 原问题：敌人始终围绕玩家盘旋，不考虑友军位置
  - 解决方案：盘旋时判断玩家和友军哪个更近，围绕更近的目标
  - 动态目标选择：每帧计算距离，自动切换盘旋中心

#### 🔄 盘旋参数随机化

- **半径随机**：配置值 + 随机 20-60 米
  - 侦察机：150m → 170-210m
  - 战斗机：120m → 140-180m
  - 重型机/王牌：100m → 120-160m
  - 狙击机：180m → 200-240m
- **高度随机**：随机 0-50 米
  - 所有类型都是 0-50 米的随机高度差
- **重新生成**：每次进入盘旋状态时重新生成随机值

#### 🔧 技术细节

- **目标选择逻辑**：
  - 敌人盘旋：判断玩家和友军距离，选择更近的
  - 友军盘旋：围绕最近的敌方敌人（通过 FriendlyAI.findNearestEnemy()）
- **参数存储**：
  - 新增 `currentCircleRadius`：当前盘旋半径（配置值 + 随机增量）
  - 新增 `currentCircleHeight`：当前高度差（随机 0-50m）
  - 新增 `friendlyMeshes`：友军列表引用（用于距离判断）
- **状态切换**：
  - 切换到 CIRCLE 状态时生成新的随机参数
  - 半径：`this.config.circleRadius + 20 + Math.random() * 40`
  - 高度：`Math.random() * 50`

#### 📊 配置更新

- **文件修改**：
  - [src/features/enemy/EnemyAI.ts](src/features/enemy/EnemyAI.ts)
    - 第32-33行：添加盘旋随机参数字段
    - 第39行：添加友军列表字段
    - 第74行：update() 方法新增 friendlyMeshes 参数
    - 第226-238行：updateCircle() 实现目标选择逻辑
    - 第274-278行：切换状态时生成随机参数
  - [src/features/levels/LevelManager.ts](src/features/levels/LevelManager.ts)
    - 第227行：简化敌人更新调用，统一传入玩家位置和友军列表

#### ✅ 效果

- ✅ 盘旋参数每次都不一样，增加战斗不可预测性
- ✅ 敌人会智能选择盘旋目标（玩家或友军）
- ✅ 如果友军比玩家近，敌人会围绕友军盘旋（形成编队飞行）
- ✅ 友军仍然围绕最近的敌方敌人盘旋
- ✅ 盘旋半径和高度都有合理的随机范围

---

### 敌人AI状态切换平滑过渡优化

#### 🎯 状态切换平滑过渡

- **问题修复**：
  - 原问题：敌人在三种状态（追逐、固定方向、盘旋）之间切换时突然改变方向
  - 解决方案：实现平滑过渡机制，敌机继续沿当前方向飞行，通过转向速度限制自然过渡到新目标
  - 类似导弹改变追踪目标时的行为

#### ✈️ 固定方向飞行状态重构

- **原实现问题**：
  - `fixedDirection` 只是方向向量（单位向量），不是具体追踪点位置
  - `randomDirection()` 只生成随机角度，没有考虑距离和战场边界
  - 不符合文档描述："在战场范围内随机生成，距离当前位置200-600米"

- **新实现**：
  - 变量重命名：`fixedDirection` → `fixedDirectionTarget`（明确是追踪点）
  - 新增 `generateFixedDirectionTarget()` 方法：
    - 生成战场范围内的虚拟追踪点
    - 距离**玩家位置**100-300米（而非敌机位置）
    - 边界检查：确保追踪点在战场范围内（-750到750米）
    - 10次重试机制，失败则在战场内随机生成
  - `updateFixedDirection()` 改用追踪点计算方向

#### 🔧 技术细节

- **平滑转向逻辑**：
  - 所有三组状态切换都不直接修改 `velocity`
  - 通过 `turnSpeed` 限制每帧转向角度
  - 选择最短转向路径（处理 -PI 到 PI 的跳变）
  - 敌机保持当前飞行方向，自然过渡到新目标

- **虚拟追踪点系统**：
  - 战场边界：X/Z 平面 -750 到 750米
  - 生成距离：玩家位置 100-300米
  - 方向：水平面上随机方向（忽略Y轴）
  - 高度：保持玩家高度
  - 安全回退：如果玩家位置无效，返回敌机前方100米

#### 📊 配置更新

- **文件修改**：[src/features/enemy/EnemyAI.ts](src/features/enemy/EnemyAI.ts)
  - 第28行：变量重命名
  - 第189-326行：实现平滑转向逻辑
  - 第279-327行：实现虚拟追踪点生成

#### ✅ 效果

- ✅ 敌人状态切换时不再突然改变方向
- ✅ 固定方向飞行状态有明确的虚拟追踪点
- ✅ 追踪点距离合理（100-300米）
- ✅ 战场边界检查正常工作
- ✅ 所有三种状态切换都平滑过渡

---

### 战斗系统与阵营系统修复

#### ✈️ 友军AI系统（BOMB道具效果）

- **BOMB道具重构**：从"清屏炸弹"改为"召唤友军"
  - 道具名称：'清屏炸弹' → '召唤友军'
  - 道具描述：'消灭屏幕上所有敌人' → '召唤一架友军飞机协助战斗'
  - 道具图标：💣 → ✈️
- **友军AI实现**：
  - 复用敌人AI和模型（随机5种敌机类型）
  - 自动寻找并锁定最近敌方敌人（不攻击玩家）
  - AI行为与敌人一致（追逐、固定方向、盘旋）
  - 伤害和武器属性与敌人相同
  - 被击败后消失，不掉落道具
- **碰撞检测与伤害过滤**：
  - 友军mesh设置 `userData.isFriendly = true`
  - 子弹标识：`fireEnemyProjectile()` 支持 `isFriendly` 参数
  - 碰撞过滤：友军子弹命中玩家时仅移除子弹而不造成伤害
- **血条与UI**：
  - 与敌人相同的血条系统
  - 黄色大字"FRIENDLY"显示在血条上方
  - 箭头指示器显示友军位置和距离

#### 🔧 阵营系统实现

- **三个阵营枚举** - [src/core/Faction.ts](src/core/Faction.ts)：
  - `ENEMY`: 敌军阵营
  - `FRIENDLY`: 友军阵营（协助玩家）
  - `NEUTRAL`: 中立阵营（玩家）
- **敌对关系判断**：
  - 友军和中立（玩家）不互相伤害
  - 其他所有组合都敌对（包括敌军vs友军、敌军vs玩家）

#### 🐛 AI子弹伤害系统修复

- **问题诊断**：
  - 子弹发射正常，但碰撞后不造成伤害
  - 碰撞检测逻辑错误，参数使用混乱
  - 伤害值传递链断裂
- **修复1：阵营标识** - [ProjectilePool.ts:63-76](src/features/combat/ProjectilePool.ts#L63-L76)：
  - `fire()` 方法添加 `faction` 参数
  - 设置 `projectile.mesh.userData.faction = faction`
  - `Game.ts` 的 `fireAIProjectile()` 传递 `fromFaction` 参数
- **修复2：碰撞检测逻辑** - [Game.ts:885-921](src/Game.ts#L885-L921)：
  - **错误**：使用 `hitObject`（目标）在子弹池中找子弹
  - **正确**：使用 `projectileMesh`（子弹）在子弹池中找子弹
  - 回调参数正确理解：
    - `hitObject`: 被击中的目标 mesh
    - `projectileMesh`: 子弹的 mesh
    - `damage`: 伤害值
- **修复3：伤害值传递**：
  - `Projectile` 接口添加 `damage: number` 字段
  - `fire()` 方法接受并存储伤害值
  - `checkCollisions()` 回调传递 `projectile.damage`
  - 完整的伤害值传递链：EnemyAI → Game → ProjectilePool → Collision

#### 🔊 射击音效添加

- **AI子弹音效** - [Game.ts:174-176](src/Game.ts#L174-L176) & [Game.ts:496-498](src/Game.ts#L496-L498)：
  - 敌人射击时播放 `audioManager.playShoot()`
  - 友军射击时播放 `audioManager.playShoot()`
  - 统一音效，提升战斗反馈感

#### 📝 调试日志与追踪

- 添加碰撞检测调试日志：
  - `[碰撞检测] 敌人子弹命中玩家，伤害: XX`
  - `[碰撞检测] 友军子弹命中敌军，伤害: XX`
  - `[碰撞检测] 敌人子弹命中友军，伤害: XX`

**技术细节**：

- **对象池模式**：子弹复用，避免频繁创建/销毁
- **阵营标识**：`userData.faction` 存储阵营信息
- **发射者追踪**：`owner` 字段防止子弹立即碰撞到发射者
- **伤害验证**：
  - ✅ 敌军子弹 → 玩家（Faction.NEUTRAL）
  - ✅ 敌军子弹 → 友军（Faction.FRIENDLY）
  - ✅ 友军子弹 → 敌军（Faction.ENEMY）

---

### 关卡系统重构

### 关卡系统重构

#### 🎯 敌人生成系统优化

- **批量生成**：
  - 生成间隔：3秒 → 0.5秒（快速依次生成）
  - 群中心距离玩家：≥100m（1/3战场）
  - 敌人在群内分布：60m半径内
  - 边界检查：所有敌人在300m战场边界内
- **关卡配置更新**：
  - 第一关：5波，敌人数量 [2, 3, 4, 5, 6]
  - 第二关：5波，敌人数量 [3, 4, 5, 6, 7]
  - 移除 totalWaves 不一致的问题

**技术细节**：

- 重写 `getSpawnPosition()` 方法
- 先计算群中心（100-220m距离玩家）
- 检查并限制群中心在边界内
- 在群中心周围60m半径随机分布敌人
- 保持40m最小间距避免重叠

---

## [未发布] - 2025-02-14

#### 🔥 玩家尾迹改为发动机火焰效果

- **移除粒子尾迹**：不再使用 ParticleTrailRenderer
- **添加 Sprite 火焰**：
  - 正常状态：大小 3.0，橙黄色 (0xff8844)
  - 加速状态：大小 5.0，金黄色 (0xffaa00)
  - 径向渐变纹理（中心白 → 橙黄 → 橙 → 透明边缘）
  - 使用 AdditiveBlending 实现发光效果
  - 平滑过渡（lerp）大小和颜色变化
- **位置**：飞机尾部 (0, -0.2, 2.8) 始终朝向后方

#### ✈️ 敌人尾迹优化

- **统一颜色**：所有敌人尾迹改为白色 (0xffffff)，符合真实
- **增加密度**：
  - 粒子数量：25 → 50 (2x)
  - 生成间隔：0.2s → 0.1s (2x 频率)
  - 总密度提升：4x

#### 🎨 敌人UI优化

- **移除绿色包围框**：删除 2D box 元素
- **文字居中对齐**：
  - JavaScript 动态计算文字位置
  - 使用 `offsetWidth` 获取实际宽度
  - 居中公式：`(barWidth - textWidth) / 2`
  - 确保所有敌人名称（SCOUT、FIGHTER、HEAVY、SNIPER、ACE）中心对齐血条中心

---

## [未发布] - 2025-02-14

### 重大更新：敌人AI系统重构

#### 🎯 新敌人AI系统

- **基于导弹设计**：使用 velocity 向量 + turnSpeed 转向限制
- **三种行为状态**：
  - 追逐 (CHASE)：主动追踪玩家
  - 固定方向飞行 (FIXED_DIRECTION)：随机水平方向直线飞行
  - 盘旋 (CIRCLE)：围绕玩家的大圆周水平飞行
- **状态概率系统**：每个状态持续4-8秒，时间到后根据概率重新选择

#### 🎮 平衡性调整

**降低攻击性**：

- 侦察机追逐概率：50% → 25%
- 战斗机追逐概率：65% → 32.5%
- 重型机追逐概率：70% → 35%
- 狙击机追逐概率：60% → 30%
- 王牌追逐概率：80% → 40%

**增加"休息"时间**：敌人更倾向于固定方向飞行（远离战场），降低玩家压力

#### 🔫 射击规则优化

**追逐状态**：

- ✅ 只有当机头朝向玩家时才能射击（30°圆锥区域检测）
- 使用点积检测：dot > cos(30°) ≈ 0.866

**盘旋状态**：

- ❌ 侦察机、战斗机、狙击机、王牌：盘旋时不射击
- ✅ 重型轰炸机：盘旋时可射击（侧向火力，1.5倍冷却时间）

**固定方向飞行**：

- ❌ 所有类型都不射击

#### 🐌 修复问题

- **修复敌机尾迹显示**：添加 trail.addPoint() 调用
  - 尾迹从引擎位置生成 (local: 0, 0, 2)
  - 使用 ParticleTrailRenderer 渲染

#### ⚡ 玩家系统

- 添加射击扰动：基础精度 0.9，最大扰动 ~2.3°
- 扰动实现：`Game.ts:788-792`

#### 📝 代码质量

- 移除旧测试文件：`EnemyAircraft.ts`, `EnemyConfig.ts`
- 统一配置系统：合并到 `EnemyTypes.ts`
- 类型安全：修复 `this.target` 类型不匹配问题

---

## 配置参数参考

### 敌人速度对比（参考：导弹 = 80 m/s）

| 类型   | 速度   | 转向速度  | 说明       |
| ------ | ------ | --------- | ---------- |
| 导弹   | 80 m/s | 2.5 rad/s | 参考基准   |
| 王牌   | 70 m/s | 2.4 rad/s | 接近导弹   |
| 战斗机 | 55 m/s | 2.0 rad/s | 中等       |
| 狙击机 | 45 m/s | 1.2 rad/s | 慢速       |
| 侦察机 | 40 m/s | 1.5 rad/s | 慢速       |
| 重型机 | 35 m/s | 0.8 rad/s | 慢速转向慢 |

### 状态持续时间

| 类型   | 持续时间 | 说明               |
| ------ | -------- | ------------------ |
| 大多数 | 4-8秒    | 标准持续时间       |
| 重型机 | 5-9秒    | 反应慢，持续时间长 |
| 王牌   | 3-7秒    | 反应快，切换频繁   |

### 盘旋半径

| 类型   | 半径 | 高度差 |
| ------ | ---- | ------ |
| 侦察机 | 150m | 30m    |
| 战斗机 | 120m | 40m    |
| 王牌   | 100m | 50m    |
| 重型机 | 100m | 20m    |
| 狙击机 | 180m | 50m    |

### 射击精度与扰动

| 类型   | 精度 | 最大扰动角度 | 特点   |
| ------ | ---- | ------------ | ------ |
| 狙击机 | 0.7  | ~6.9°        | 最准确 |
| 重型机 | 0.6  | ~9.2°        | 准确   |
| 王牌   | 0.6  | ~9.2°        | 准确   |
| 玩家   | 0.9  | ~2.3°        | 最准确 |
| 战斗机 | 0.5  | ~13.8°       | 中等   |
| 侦察机 | 0.4  | ~18.4°       | 不准   |

---

## 修改指南

### 修改敌人行为

编辑 `src/features/enemy/EnemyAI.ts`:

- `updateChase()` - 追逐行为
- `updateFixedDirection()` - 固定方向行为
- `updateCircle()` - 盘旋行为
- `fire()` - 射击逻辑

### 修改敌人配置

编辑 `src/features/enemy/EnemyTypes.ts`:

- `ENEMY_CONFIGS` - 所有敌人配置
- `getEnemyTypesForWave()` - 关卡敌人出现规则
- `getRandomEnemyType()` - 敌人生成概率

### 调整难度

1. **降低攻击性**：降低 `CHASE` 概率，提高 `FIXED_DIRECTION` 概率
2. **提高攻击性**：提高 `CHASE` 概率，降低 `FIXED_DIRECTION` 概率
3. **增加准确度**：提高 `accuracy` 值（0.0-1.0）
4. **降低伤害**：降低 `damage` 值
5. **增加血量**：提高 `health` 值

---

**文档版本**: 1.0
**最后更新**: 2025-02-14
