# AirSupreme 技术文档

## 项目概述

AirSupreme 是一个基于 Three.js 和 TypeScript 的 3D 飞机战斗游戏。

### 当前实现状态（2026-10）

- 十关故事战役已集成：十章剧情（章节卡片、无线电、任务结算、结局）、第 6-10 关环境与 Boss、17 种地面 / 海上 / 空中单位、5 种特殊武器与热焰弹、第一 / 第三人称相机组、分级升级与机库、自动存档与继续战役、程序化音乐与新音效、实例化粒子与 HDR 后处理（详见下文「十关战役系统」与 `CHANGELOG.md`）
- 界面默认英文，简体中文可在开始菜单 / 暂停菜单实时切换（`src/i18n/`，文案就地双语 `LocalizedText`）；国际化角色阵容与具名僚机渡鸦 / 雨燕；无线电与剧情旁白有英文与普通话配音（`VoiceSystem`，语音包在 `public/voice/`）；难度曲线与 Boss 血量按脚本飞行员实测重新调校（见下文「界面语言」「角色配音」「具名僚机」与「平衡与难度曲线」）
- 主流程：`main.ts -> StartMenu -> 动态导入 GameCoordinator -> 按需初始化战斗 / 表现层 runtime`；开始菜单「继续战役」与失败结算「从检查点继续」都由 `main.ts` 以检查点重新开局
- `GameCoordinator` 负责装配；战役接线拆到 `src/core/` 下的控制器（`CampaignFlowController`、`UnitController`、`SpecialWeaponsController`、`PlayerViewController`、`CombatVfxController`、`CombatHudFeed`、`AdvancedBossController`），剧情 / HUD / 音乐 / 音效统一经 `ICampaignPresentation`（见 `docs/decisions/0001-campaign-presentation-adapter.md`）
- 战斗 runtime、Boss 控制器、升级菜单、presentation runtime，以及相机组、单位、特殊武器、尾迹、剧情界面与第 6-10 关 Boss 都在按需加载路径上
- `PresentationRuntimeLoader` 负责按需创建 `HUD / EnemyHealthBars / LockOnIndicator / BossMissileIndicator / PresentationController`
- 普通弹道碰撞链路已支持 `source/tone` 透传，玩家机炮、敌弹、Boss 炮弹、导弹命中可按来源映射不同反馈；对单位与 Boss 部件按命中半径判定
- 独立终验之后的两波修复已合并（`2e9941d..0cd1735`）：复活沿航迹后退 + 坠毁宽限、移动端暂停锁存、僚机编队整队出击与编队位、Boss 击破即存机库检查点、紧急告警配音限频与 Boss 收尾等完台词、HUD 可本地化文案与手机布局、Boss 导弹伤害随难度、热焰弹诱骗全部 Boss 导弹、关卡曲线与波次重调、地形静态合批与植被分块 LOD（见下文各节与 `CHANGELOG.md` 的「终验修复」）；随后的收尾打磨（`0cd1735..f6ce2d3`）让闪烁告警 / Boss 状态条 / 道具倒计时 / 中央大字提示随语言切换重绘、高炮与八爪鱼眼睛光弹伤害随难度缩放、复活时避开竖直结构、Boss 战敌人计数只计在场敌方、模型预览在名称标签上方取景，中文界面的教学改称「教程」（见「收尾打磨」）
- 测试：位于 `src/__tests__`；测试数量与结果以 `npm run test:run` 的实际输出为准

### 技术栈

- **渲染引擎**: Three.js (WebGL)
- **编程语言**: TypeScript
- **构建工具**: Vite
- **包管理**: npm

### 核心系统

1. **玩家控制系统** - 飞机飞行控制
2. **敌人AI系统** - 基于导弹设计的敌机AI
3. **战斗系统** - 子弹、导弹、碰撞检测
4. **关卡管理** - 波次生成、敌机生成
5. **粒子系统** - 尾迹、爆炸效果
6. **UI系统** - HUD、小地图、血条
7. **配置系统** - JSON 配置加载、默认值 fallback
8. **日志系统** - 结构化日志、模块标记、级别控制
9. **运行时边界系统** - 动态导入、预热、表现层 runtime loader
10. **战役流程与表现层** - 章节 → 波次 → 检查点 → Boss → 结算 → 机库；剧情卡片、无线电、HUD 面板、音乐与音效统一经 `ICampaignPresentation`
11. **地面 / 海上 / 空中单位** - `UnitSystem`：17 种单位、三阵营、按波部署
12. **特殊武器与热焰弹** - `WeaponSystem` / `CountermeasureSystem`
13. **相机系统** - `CameraRig`：第一 / 第三人称、座舱、震动
14. **升级与存档** - 分级升级线、机库、`SaveSystem` 检查点
15. **音乐与音效** - 前瞻式音序器、23 首曲目、7 个刺激音、新音效
16. **VFX 与后处理** - 实例化粒子、HDR 后处理、屏幕效果、尾迹
17. **界面语言** - `src/i18n/`：英文默认、简体中文可选，`LocalizedText` 就地双语，`onLocaleChange` 实时切换
18. **角色配音** - `VoiceSystem`：英文 / 普通话语音包、电台 / 旁白链路、响度归一化、音乐闪避
19. **具名僚机** - `WingmanRoster`：渡鸦与雨燕的身份、在空状态与无线电事件

---

## 敌人AI系统

### 设计理念

敌机AI采用**基于导弹的运动系统**：

- 使用 `velocity` 向量控制运动方向和速度
- 通过 `turnSpeed` 限制转向速度
- **只能向前飞**，通过转向调整方向
- 使用四元数平滑朝向更新

### 三种行为状态

#### 1. 追逐状态 (CHASE)

**行为**: 主动追踪玩家位置
**特点**:

- 持续转向玩家方向（受转向速度限制）
- **只有机头朝向玩家时才能射击**（30°圆锥内）
- 攻击性最强的状态

#### 2. 固定方向飞行状态 (FIXED_DIRECTION)

**行为**: 平滑转向虚拟追踪点（距离玩家100-300米）直线飞行
**特点**:

- 在战场范围内生成虚拟追踪点（距离玩家位置100-300米）
- 通过转向速度限制平滑转向追踪点
- **不射击**
- 用于"休息"，降低游戏压力

#### 3. 盘旋状态 (CIRCLE)

**行为**: 围绕目标的大圆周水平飞行
**特点**:

- **智能目标选择**: 判断玩家和友军哪个更近，围绕更近的目标
  - 敌人：围绕玩家或友军中更近的
  - 友军：围绕最近的敌方敌人
- **参数随机性**: 每次进入盘旋状态时重新生成
  - 半径：配置值 + 随机20-60米
  - 高度：0-50米随机高度差
- **重型轰炸机可以射击**（侧向火力）
- 其他类型盘旋时不射击
- 用于观察和保持距离

### 状态机机制

```
┌─────────────────────────────────────┐
│         状态持续时间 (4-8秒)          │
│                                     │
┌─────────┐    ┌─────────┐    ┌─────────┐
│  追逐   │    │固定方向 │    │  盘旋   │
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┴──────────────┘
                    │
              概率随机选择
                 (每4-8秒)
```

- 每个状态持续 4-8秒随机时间
- 时间到期后根据**概率分布**重新选择状态
- 不同类型敌机有不同的概率分布

### 地形避让、EMP 瘫痪与关卡强度（十关战役）

- `EnemyAI.setTerrainSampler(sampler)`：设置后敌机沿速度方向前瞻采样地表，预计高度低于“地表 + 安全高度”时按亏欠高度爬升；位置落到地表以下时直接抬到地表上方。`LevelManager` 为敌机注入自己的 `getCrashSurfaceY`，协调器为友军僚机注入同一采样。未设置时保持原有自由飞行。
- `EnemyAI.applyStun(seconds)` / `isStunned()`：EMP 瘫痪期间航电失灵——不开火、不切换机动状态，保持惯性滑行。
- 敌机强度在 `LevelManager` 生成时计算：血量 / 伤害 / 攻击冷却 = 基础配置 × 玩家难度档（`getDifficultyProfile`）× 关卡曲线（`getLevelScaling`，读取 `src/core/Difficulty.ts` 中逐关一列的 `LEVEL_CURVE` 表）；精度叠加关卡曲线的 `enemyAccuracyBonus` 与敌方雷达站加成（`UnitController.getHostileRadarBonus()`，经 `setAccuracyBonusProvider`），并设上限。`LevelConfig.difficulty` 为旧字段，不再参与计算。
- 开火距离：敌机只在开火距离上限 `FIRE_RANGE`（420 米，`src/features/enemy/EnemyAI.ts`）以内射击，即使机头已对准目标。
- 射击提前量：`LevelManager` 每步按玩家位置差分估计其速度（单步折算超过 250 米/秒视为瞬移、清零），经 `EnemyAI.setTargetVelocity` 交给敌机；生成敌机时把关卡曲线的 `enemyAimLead` 写入 `EnemyConfig.aimLead`（第 1 关 0，第 2 关 0.28，逐关升到第 10 关 0.94）。开火时瞄准 `目标 + 速度 × 拦截时间 × aimLead`（按子弹速度两次迭代的一阶拦截，上限 4 秒），再叠加精度散布；友军僚机不设 `aimLead`。
- 同屏上限：`LevelManager.getMaxConcurrentEnemies()` = `GameConfig.getMaxEnemies()`（桌面 6 / 移动端 5）+ 关卡曲线的 `concurrentEnemyBonus`（第 4-6 关 +1，第 7-10 关 +2）。
- 外部操纵：`EnemyAI.updateKinematic(dt)` 按调用方写好的 `velocity` 积分（地形避让、贴地兜底、四元数朝向、尾迹与渲染插值与 `update` 相同），不运行机动状态机、不开火，机动状态与计时冻结，攻击冷却与 EMP 瘫痪照常计时；僚机编队飞行用它（见「具名僚机」）。

---

## 敌机类型配置

### 概览表

| 类型       | 追逐  | 固定方向 | 盘旋 | 速度   | 转向      | 血量 | 特点                 |
| ---------- | ----- | -------- | ---- | ------ | --------- | ---- | -------------------- |
| **侦察机** | 25%   | 50%      | 25%  | 40 m/s | 1.5 rad/s | 60   | 快速但脆弱，攻击性弱 |
| **战斗机** | 32.5% | 47.5%    | 20%  | 55 m/s | 2.0 rad/s | 100  | 平衡型               |
| **重型机** | 35%   | 45%      | 20%  | 35 m/s | 0.8 rad/s | 300  | 慢但血厚，有侧向火力 |
| **狙击机** | 30%   | 50%      | 20%  | 45 m/s | 1.2 rad/s | 80   | 远距离攻击，保持距离 |
| **王牌**   | 40%   | 45%      | 15%  | 70 m/s | 2.4 rad/s | 160  | 高难度，攻击性强     |

### 配置详情

#### 侦察机 (SCOUT)

```typescript
{
  speed: 40,                    // 速度（导弹的50%）
  turnSpeed: 1.5,              // 转向速度
  health: 60,
  damage: 10,
  attackCooldown: 0.4,
  accuracy: 0.4,

  // 状态概率
  stateProbabilities: {
    CHASE: 0.25,              // 25% 追逐
    FIXED_DIRECTION: 0.50,      // 50% 固定方向
    CIRCLE: 0.25              // 25% 盘旋
  },
  stateDurationRange: [4, 8],   // 4-8秒

  // 盘旋参数
  circleRadius: 150,             // 150米半径
  circleHeight: 30               // 30米高度差
}
```

#### 战斗机 (FIGHTER)

```typescript
{
  speed: 55,                    // 速度（导弹的69%）
  turnSpeed: 2.0,
  health: 100,
  damage: 15,
  attackCooldown: 0.5,
  accuracy: 0.5,

  stateProbabilities: {
    CHASE: 0.325,             // 32.5% 追逐
    FIXED_DIRECTION: 0.475,     // 47.5% 固定方向
    CIRCLE: 0.20               // 20% 盘旋
  },
  stateDurationRange: [4, 8],

  circleRadius: 120,
  circleHeight: 40
}
```

#### 重型轰炸机 (HEAVY)

```typescript
{
  speed: 35,                    // 慢速
  turnSpeed: 0.8,              // 转向慢
  health: 300,                 // 血厚
  damage: 30,
  attackCooldown: 0.8,
  accuracy: 0.6,

  stateProbabilities: {
    CHASE: 0.35,              // 35% 追逐
    FIXED_DIRECTION: 0.45,      // 45% 固定方向
    CIRCLE: 0.20               // 20% 盘旋
  },
  stateDurationRange: [5, 9],    // 反应慢，持续时间长

  circleRadius: 100,
  circleHeight: 20
}
```

#### 狙击机 (SNIPER)

```typescript
{
  speed: 45,
  turnSpeed: 1.2,
  health: 80,
  damage: 40,                  // 高伤害
  attackCooldown: 1.0,
  accuracy: 0.7,

  stateProbabilities: {
    CHASE: 0.30,
    FIXED_DIRECTION: 0.50,
    CIRCLE: 0.20
  },
  stateDurationRange: [4, 8],

  circleRadius: 180,            // 保持远距离
  circleHeight: 50
}
```

#### 王牌 (ACE)

```typescript
{
  speed: 70,                    // 接近导弹速度
  turnSpeed: 2.4,              // 接近导弹转向
  health: 160,
  damage: 25,
  attackCooldown: 0.4,
  accuracy: 0.6,

  stateProbabilities: {
    CHASE: 0.40,              // 40% 追逐（最高）
    FIXED_DIRECTION: 0.45,
    CIRCLE: 0.15               // 15% 盘旋
  },
  stateDurationRange: [3, 7],    // 反应快，状态切换频繁

  circleRadius: 100,
  circleHeight: 50
}
```

---

## 射击规则

### 追逐状态射击条件

**圆锥区域检测**: 只有当敌机机头朝向玩家时才能射击

```typescript
// 计算机头方向与玩家方向的夹角
const toPlayer = targetPosition - enemyPosition;
const forward = velocity.normalized();
const dot = toPlayer.dot(forward); // 1.0 = 正对准，0.0 = 垂直

// 30°圆锥内（cos(30°) ≈ 0.866）
if (dot > 0.866) {
  fire(); // 可以射击
}
```

### 盘旋状态射击规则

- **侦察机、战斗机、狙击机、王牌**: 盘旋时**不射击**
- **重型轰炸机**: 盘旋时**可以射击**（侧向火力）
  - 射击频率更低（1.5倍冷却时间）

### 固定方向飞行

**所有类型固定方向飞行时都不射击**

---

## 精度系统

所有射击（包括玩家和敌人）都有随机扰动。敌机（`EnemyAI.fire`）的散布同时作用于偏航与俯仰，两个方向各自独立均匀分布：

```typescript
// 总散布角 = (1 - 精度) × AIM_SPREAD（AIM_SPREAD = 0.4 弧度）
const spread = Math.max(0, 1 - accuracy) * AIM_SPREAD;
// 偏航：绕世界 Y 轴
tmpQuaternion.setFromAxisAngle(WORLD_UP, (Math.random() - 0.5) * spread);
direction.applyQuaternion(tmpQuaternion);
// 俯仰：绕水平侧轴（direction × 世界上方向；竖直射击时侧轴退化，跳过）
tmpAxis.crossVectors(direction, WORLD_UP);
if (tmpAxis.lengthSq() > 1e-8) {
  tmpQuaternion.setFromAxisAngle(tmpAxis.normalize(), (Math.random() - 0.5) * spread);
  direction.applyQuaternion(tmpQuaternion);
}
```

下表的“最大扰动角度”即每个方向上的散布范围 `(1 - 精度) × 0.4` 弧度（中心两侧各一半）：

| 精度            | 最大扰动角度 | 特点   |
| --------------- | ------------ | ------ |
| 0.4 (侦察机)    | ~13.7°       | 不太准 |
| 0.5 (战斗机)    | ~11.5°       | 中等   |
| 0.6 (王牌/重型) | ~9.2°        | 较准   |
| 0.7 (狙击机)    | ~6.9°        | 准确   |
| 0.9 (玩家基础)  | ~2.3°        | 很准   |

---

## 十关战役系统（2026-10）

签名与契约见 `docs/api.md`，模块接线、逐帧顺序与数据流见 `docs/architecture.md`；本节是长篇说明。仍在调校的平衡数值（花费、血量、波次规模、强度曲线）以源码为准：`src/core/Difficulty.ts`、`public/config/game-config.json`、`src/config.ts`、`src/features/terrain/LevelConfig.ts`、`src/features/units/UnitDeployments.ts`、`src/features/upgrade/UpgradeSystem.ts`、`src/features/boss/BossTypes.ts`。

### 战役流程

- 剧本：统一从 `src/features/campaign/CampaignData.ts` 导入——`TOTAL_LEVELS = 10`、十个 `CampaignChapter`（章节标签、行动代号、标题、地点、正文、任务目标、简报、Boss 简报、无线电、解锁武器与解锁台词、结算总结）、说话人 `CAMPAIGN_SPEAKERS`、首次遭遇台词 `UNIT_FIRST_CONTACT_RADIO`、通用台词 `GENERIC_RADIO`、序章 / 尾声 / 片尾字幕与配音脚本 `getVoiceScript()`。数据分文件存放：`CampaignTypes`（类型）、`CampaignCast`（角色）、`CampaignChapters`（章节）、`CampaignRadio`（首次遭遇 / 通用台词）、`CampaignStory`（标题 / 序章 / 尾声 / 字幕）、`ChapterTitles`（章节标题，与 `LevelConfig` 的关卡名是同一个对象）。所有面向玩家的字段都是 `LocalizedText`；每句配音台词（`RadioLine`、`VoicedText`）带稳定唯一 id，同时是语音文件名。纯数据与纯函数，不依赖渲染 / 音频 / DOM。
- 流程控制：`CampaignFlowController`（`src/core/campaign/`）只决定“接下来发生什么”；加载关卡、开始波次 / Boss、机库、进度同步、剧情冻结、存档快照由协调器经 `CampaignFlowDeps` 提供。
- 正常模式：章节卡片（新游戏第一章前播序章；有新武器的章节附解锁台词）→ 检查点 `level-start` → 入关无线电 + 简报 → 波次（每波开始部署单位；本波敌机与敌方单位全部清空才过波）→ 检查点 `wave` → … → 检查点 `boss` → Boss 战 → 击破即写检查点 `hangar`（第 1-9 关：level 为下一关，wave 为 0；提示「第N关完成」）→ 击破收尾 → 任务结算 → 机库（下一章的升级上限与武器解锁）→「出击」（`launchChapter`：先静默重写 `hangar` 检查点）→ 下一章。第 10 章之后：`markCampaignCompleted` + `clearCampaignCheckpoint` → 收尾 → 结算 → 尾声与片尾字幕 → `MISSION COMPLETE`。
- 击破收尾：按 `tick` 推进的游戏时间（暂停与剧情冻结时不推进）至少停顿 `BOSS_OUTRO_MIN_SECONDS`（1.6 秒），之后等 `presentation.isRadioBusy()` 为假；看门狗上限在收尾开始时取 `min(BOSS_OUTRO_MAX_SECONDS（75 秒）, max(1.6, getRadioBacklogSeconds()) + BOSS_OUTRO_SLACK_SECONDS（6 秒）)`，到上限时结算卡片出现、正在说的那句说完；期间失败或退出则放弃收尾。`CampaignFlowDeps` 不再有 `scheduleTimeout`。
- 雨燕入列：协调器在僚机编队升空时调用 `handleWingmanLaunched(id)`；雨燕本局第一次升空时播 `onWingmanEvent('swift', 'joined')`（Boss 模式不播），并把 `swiftJoined: true` 补写进当前检查点，之后每个检查点都带上这个标记，读档时以 `isSwiftJoinAnnounced(save)` 恢复。
- Boss 模式：没有剧情卡片、结算与检查点；武器解锁到所选关卡；Boss 之间进入机库；无线电只播 Boss 登场台词与高优先级告警；不派出僚机编队（Boss 战的友军支援机可领取空出的僚机呼号，但不播入列台词）。
- 新开一局：`setupNewRun(L)` 清空升级、设定关卡上限、解锁至 L 的武器；L > 1 时补发 `getStartingUpgradePoints(L)` 并先进入机库；正常模式清除旧检查点。
- 剧情冻结：`setStoryHold(true)` 期间模拟暂停（渲染继续），只推进表现层，并吞掉暂停 / 升级 / 单次动作按键。

### 表现层（ICampaignPresentation）

- 玩法代码只经 `ICampaignPresentation`（`src/core/campaign/CampaignPresentation.ts`）讲故事 / 报状态 / 出声音；`DefaultCampaignPresentation` 驱动 `StoryOverlay`、`RadioComms`、HUD 新面板、雷达量程、`MusicSystem`、`CampaignSfxRouter`，以及（可选的）配音 `CampaignVoice`（协调器传入它的 `VoiceSystem`）。
- `StoryOverlay`：章节 / 序章 / 解锁卡片（打字机，`onTypeTick` 每字回调用于打字音）、结算卡片（逐行计数音）、尾声 + 片尾字幕；点击 / 轻触 / 空格 / 回车先显示全文再翻页，Esc 或「跳过」结束整段；卡片显示时 `<html data-story-overlay>` 隐藏 HUD、雷达、无线电、移动端按键与指示层。有旁白挂钩（`narration: StoryNarration`）时，序章 / 简报 / 尾声的每一段先按段落 id 请求配音，短暂等待开口（超时则按纯文字打字），按配音时长调整打字节奏，让文字在配音结束前一点打完，再等配音说完（有兜底上限）才进入下一段；整张卡听完后只留看任务目标的时间再自动翻页。显示全文、翻页、Esc / 跳过、收起都会停下旁白；减少动态效果时直接显示全文但照常朗读；卡片写成后切换过语言则不再朗读。
- `RadioComms`：说话人呼号 / 头像 / 色调来自 `CAMPAIGN_SPEAKERS`（头像图标 `getSpeakerGlyph`，每个说话人都有）；空闲时立即显示（两句之间的短暂间隔也算忙碌），`high` 优先级打断普通台词（被打断且未传达完的台词回到普通队首重播，每句至多一次：重播时再被打断就放弃），重复文本忽略，队列有上限；显示时间只由 `update(dt)` 推进（暂停即停住）。剧情界面加载完成前的台词先缓存。有配音时：开口后 `holdForVoice(line, 时长)` 让台词至少停留到配音结束再加一小段尾巴，下一句等 `releaseVoice(line)`（有兜底上限）；配音没说完就被打断的台词重播时配音从头再说。`isVoicing()` 表示当前台词的配音正在说；`estimateRemainingSeconds(voiceSeconds?)` 估计当前与排队台词全部说完的秒数（有配音的按配音时长计），只用于 Boss 收尾的等待上限。切换语言时当前台词的呼号、正文与读屏文本立即重写。
- 配音接线：`onLineShown` 播放该句无线电配音（`kind: 'radio'`，按说话人选电台音色）；旁白挂钩以 `NARRATION_SPEAKER`（天穹）朗读；入关（`showChapterIntro`）预取本章台词——序章（显示时）、简报、入关台词、其余章节台词与紧急告警，`playBossMusic` 预取本章 Boss 台词；`onPause` / `onResume` 暂停 / 续播；`clearRadio` 停下无线电配音，结算卡片让正在说的那句说完，失败 / 通关 / 释放停下全部配音。
- 高优先级通用台词：平民误伤、导弹告警、低血量。它们打断只显示文字的普通台词，但从不打断正在配音的台词——此时 `genericRadio` 跳过这句并返回 `false`（Boss 模式过滤掉的普通台词同样返回 `false`），低血量台词等配音说完再报（低血量蜂鸣照常）。地空导弹每次发射都有 HUD 闪烁告警「Missile inbound · Press G for flares / 导弹来袭 · 按 G 投放热焰弹」与 `sam-launched` 音效事件，误伤平民每次都有「Cease fire! Those are civilians! / 停火！那是平民目标！」与 `civilian-hit` 音效事件；两者的配音由 `UnitController` 的 `RadioBudget`（`src/core/campaign/RadioBudget.ts`）限频：每波（每场 Boss 战，`spawnForWave` 与 `clear()` 时重新计数）最多 2 次，导弹告警冷却 20 秒、之后 45 秒，误伤平民 15 秒、之后 30 秒；`genericRadio` 返回 `true` 时才计数。告警文案按当前语言发出。
- 无线电积压：`getRadioBacklogSeconds()` 用 `RadioComms.estimateRemainingSeconds` 与配音的 `getLineDuration`（当前语言的清单时长）估计无线电说完还要多少秒；剧情界面加载前的缓存台词按配音时长或 6.5 秒、每句再加 1.5 秒粗估。
- HUD 推送做差分：数值不变时不调用 HUD、不分配对象；导弹告警合并单位（SAM）与 Boss 导弹两路，取最高级（`none` / `locking` / `incoming`）。

### 界面语言（i18n）

- 核心：`src/i18n/index.ts`，导入时不访问 `document` / `window`。`Locale = 'en' | 'zh-CN'`，`DEFAULT_LOCALE = 'en'`；双语文案 `LocalizedText { en, zh }`（两个字段都必填）；`tr(text, params?)` = `localize` + `format`（`{name}` 占位符，未提供的保持原样）；`localize` 对纯字符串原样返回；`normalizeLocale` 把 `zh` / `zh-cn` / `zh-hans…` 规整为 `'zh-CN'`，其余一律回到英文；`setLocale` 语言未变化时不通知，变化时同步 `<html lang>` 并逐个通知 `onLocaleChange` 的订阅者（某个订阅者抛错不影响其余）。
- 数据约定：文案就地双语，不用键值字符串表（见 `docs/decisions/0002-bilingual-text-and-voice-packs.md`）。`UnitConfig.name`、`BossConfig.name`、`EnemyConfig.name`、`SpecialWeaponConfig.name` / `description`、`UpgradeConfig.name` / `description` / `unit`、`PowerUpConfig.name` / `description`、`LevelConfig.name` / `description`、`DifficultyProfile.label` 与战役剧本的全部面向玩家字段都是 `LocalizedText`，在显示处用 `tr()` 取当前语言；交给 HUD 的快照（如 `WeaponSystem.getHudState().name`）在生成时就是当前语言的字符串。逐帧路径把双语对象提升为模块常量，不做逐帧分配。
- 设置与启动：`StartFlowSettings.language`（缺省英文，不跟随浏览器；旧存档与无法识别的值按英文读取）随开始流程设置持久化；`main.ts` 在任何界面渲染之前 `setLocale(loadStartFlowSettings().language)`，并写入对应语言的页面标题、加载画面与触控按键文字（含读屏标签）。`index.html` 本身以 `lang="en"` 与英文默认文案发布。
- 切换：开始菜单与暂停菜单的「Language / 语言」一行（选项名 `LANGUAGE_ENDONYMS`：English / 中文，`stepLanguage` 循环切换）保存设置后调用 `setLocale`。订阅者：开始 / 暂停 / 升级菜单原位重绘，HUD 重写自身文字与结算面板，血条立即改名（暂停中也生效），模型预览重建列表并按新名称标签重新取景，无线电重写当前台词，`VoiceSystem` 停下当前配音并按新语言重新预取，`main.ts` 改写页面外壳。剧情卡片在显示时按当前语言写成，切换后从下一张起换语言。HUD 的 `showBriefing` / `showAutosave` / `flashWarning` / `setBossStatus` / `showPowerUp` / `showPowerUpBig` 接受 `HudText`（纯字符串、`LocalizedText` 或 `{ text, params }`），保留原文，显示期间切换语言时原位重绘（不重播动画、不重置计时；排在简报之后的大字提示在显示时取语言）：协调器交给 HUD 的有入关 / Boss 简报的双语原文、存档提示的 `{ text, params }` 与「继续：…」的双语对象（`describeCheckpointText`）、道具倒计时的道具名、误伤扣分告警（`{ text, params }`），以及中央大字提示（僚机被击落、拾取道具及其「获得道具！」副标题、升级反馈与升级点、护送结果、教学提示、事件波次播报、「已击坠」等）；Boss 战控制器交出的有「返回作战区域」提示、Boss 方位播报（双语拼好）与友军支援、激光预警的大字提示；`UnitController` 交出停火、导弹来袭与「残余目标脱离战区」告警；`SpecialWeaponsController` 经 `SpecialWeaponsDeps.notify(icon, text: HudText)` 交出「尚无特殊武器」「武器尚未解锁」与切换武器时武器配置里的双语名称；第 6-10 关 Boss 的阶段名与特殊攻击预警经 `IAdvancedBoss.onPhaseChange` / `onHazardWarning` 以 `HudText` 传出。第 6-10 关 Boss 的状态提示由 Boss 按当前语言生成（`getStatusLabel`，按状态与语言缓存），控制器每 0.25 秒推送一次，Boss 在场时还订阅 `onLocaleChange` 立即重推。事件波次 / 教学的完成提示（约 2-3 秒）保留双语原文，每次 HUD 刷新时取当前语言。
- 英文排版：大字公告与简报标题换行，英文剧情标题字号更小，叙事衬线字体拉丁优先（`:lang(zh)` 时回到 CJK 衬线）；打字机停顿用 Unicode 标点类别，中英文句读都会停顿。

### 角色配音（VoiceSystem）

- 语音包：`public/voice/<en|zh>/<台词 id>.mp3`（运行时路径 `/voice/...`），两种语言各一套，覆盖 `getVoiceScript()` 列出的全部台词；`public/voice/manifest.json`（`{ version, format, languages: { en: { [id]: { duration, bytes } }, zh: {...} } }`）是运行时契约，`public/voice/provenance.json` 记录生成方式（模型、声音 id、生成 id、每个文件的 sha256），游戏不读取它。文件保留生成器嵌入的 C2PA 来源凭证。格式、id 规则与重新生成的步骤见 `docs/voice-lines.md`。
- `VoiceSystem`（`src/core/Audio/VoiceSystem.ts`，协调器持有，经共享 AudioContext）：清单懒加载；按界面语言选包（`getVoicePackLanguage`：`zh-CN` → `zh`，其余 → `en`）；只请求清单里有的 id，缺失的台词直接纯文字；同一时刻只有一句配音，新的 `play()` 顶掉旧的；`play()` 立即返回请求编号、从不抛错，结果经 `onStart` → `onEnd`，或 `onSilent(原因)`（`unavailable` / `muted` / `timeout` / `error` / `stopped` / `superseded` / `disposed`）异步回调；加载超过 `maxStartDelayMs` 时这一句改为纯文字（缓冲区照常缓存）。
- 链路：无线电台词经逐句按说话人的带通与底噪（`RADIO_PROFILES`，指挥部 / 预警机较宽较干净，座舱、护卫舰与民用频道更窄、底噪更重，神谕的频道更宽）→ 共用电台级（带限、存在感峰值、软饱和、压缩器），自然说完时补一声静噪尾音；旁白走高通 + 轻压缩的干净链路；解码后按门限 RMS（`measureVoiceGainDb`）归一化响度；语音音量 × 总线电平 → 与音效、音乐共用的输出限幅。无线电台词在开麦提示音之后才开口。
- 闪避：说话时经 `voiceDuckBridge`（`src/core/Audio/VoiceDucking.ts`，保持型闪避，新请求覆盖未执行的旧请求）把 `MusicSystem` 总线末端的配音闪避级压低（无线电比旁白压得更深），说完后延迟一会儿再平滑恢复，连续几句无线电之间音乐不回弹；停下 / 暂停时立即恢复。
- 暂停与容错：`pause()` 淡出并记住断点，`resume()` 从断点续播；实时看门狗在收不到 `onended` 时按说完处理，无线电队列与打字机不会卡住；切换语言时 `stopAll()` 并按新语言重新预取最近一批。缓存：解码缓冲区与编码数据各一个 LRU；`prefetch(ids)` 去重，前几句立即解码，其余只取编码数据。
- 音量：`StartFlowSettings.voiceVolume`（0..1，缺省 `DEFAULT_VOICE_VOLUME`），开始菜单「Voice volume / 语音音量」与暂停菜单「Voice / 语音」一行（10% 步进，实时生效并持久化）；为 0 时不加载语音，无线电与剧情卡片只显示文字。
- 诊断：`createOutputAnalyser()` / `getDebugState()`；开发构建的 `window.__AIR_SUPREME_DEV__.voice` 提供 `state()`、`sample()`（人声 / 音乐电平与闪避量）、`say(id, kind)`、`radio(key)`、`wingman(id, event)`。

### 具名僚机（Wingmen）

- `WingmanRoster`（`src/core/campaign/Wingmen.ts`，协调器持有）：友军 AI 战机入场时调用 `assign(mesh.uuid, 关卡)`，按 `WINGMEN` 的编队顺序领取第一个“已随队、不在空中、本关未被击落”的身份——渡鸦 Raven（第 1 关起）、雨燕 Swift（第 3 关起），没有可用身份时是普通友军；`countAvailable(关卡)` 给出此刻还能领取的身份数。呼号写入 `mesh.userData.displayName`，血条据此显示。`FRIENDLY_DEATH` 时 `release` 把僚机记为本关被击落，坠毁提示点名僚机；准备关卡（换关 / 读档）与 Boss 击破时 `reset()` 全员归队。
- 出击：关卡开场后不久（`startLevelCombat`：1 秒后，第 1 关教学时在教学引导之后）与读档回到 Boss 战前（普通模式的 `startBossEncounter`），协调器的 `launchWingmen()` 让 `countAvailable` 架僚机一起升空——第 1-2 关渡鸦，第 3 关起渡鸦与雨燕——并逐架调用 `CampaignFlowController.handleWingmanLaunched(id)`；从波次打到 Boss 时编队已在空中，不会重复起飞。增援、Boss 战友军支援（`BossBattleController` 在开战后与每 30 秒）、「召唤友军」道具与护送友机走 `spawnFriendlyAI()`，只在有空出的身份时领取呼号（实际上只发生在不派编队的 Boss 模式），从不播入列台词。
- 编队飞行（`FriendlyAI` + `EnemySystem`）：`EnemySystem.spawnFriendly` 给新友机分配最小的空闲编队位（`FriendlyAI.setFormationSlot`）；编队位在玩家水平航向坐标系里（航向取 `EnemySystem` 由相邻两步玩家位置推算的平滑速度）：0 号左、1 号右，机翼线前 38 米、横向 40 米、高 6 米，之后每排再向外 35 米、向后 25 米、向上 4 米。没有目标时僚机飞向编队位，并避开追尾相机的视线走廊（座机后 60 米到前 35 米、横向 ±28 米）：已在走廊内先横向让出（增益更大），直飞编队位会横穿走廊时从相机后方或座机前方绕行（右侧编队位绕得更远，两架换边时航线不交汇）；期望速度 = 玩家速度 + 限幅的位置修正，以 2 弧度/秒的转向角速度与 25 米/秒² 的加速度跟随，再经 `EnemyAI.updateKinematic` 积分。一旦出现敌机或 Boss 目标，照常追击。
- 入场位姿：`EnemySystem.getFriendlySpawnPose(playerPosition, playerForward, outPosition, outHeading)` 把下一架友机放在其编队位后方 12 米（横向 40 米 + 每排 35 米、前方 26 米 − 每排 25 米、高 6 米 + 每排 4 米）；编队位布局只在 `FriendlyAI.ts` 导出的 `getFormationSlotOffset(slot, out)`（`FormationSlotOffset`：side / along / lateral / up，不分配）里定义，编队飞行与入场位姿都读它；机头朝玩家的水平航向（机头接近竖直时改用平滑速度，仍不可用时朝 -Z）；协调器在构造 `FriendlyAI` 之前把位姿写到网格上（`EnemyAI` 构造时记录插值起点），保持离地至少 30 米，初速为 `max(配置速度, 玩家速度)`。
- 无线电：`ICampaignPresentation.onWingmanEvent(id, 'joined' | 'down')` 经 `WINGMAN_EVENT_RADIO` 播放通用台词——雨燕入列报到（`swift-joined`，每局战役只由 `handleWingmanLaunched` 触发一次）；渡鸦被击落时雨燕在空中则由她播报（`raven-down-swift`），否则由天穹指挥部（`raven-down-hq`）；雨燕被击落同理（`swift-down-raven` / `swift-down-hq`）。渡鸦没有入列台词。`isWingmanFlying(id)` 由名册（`WingmanStatus`）回答。
- 友军单位损失：`UnitController` 的 `ALLY_LOSS_RADIO` 让友军预警机与护卫舰被击毁时播放各自机组 / 舰员的台词（`awacs-lost` / `frigate-lost`），其余友军单位为 `ally-unit-destroyed`。

### 平衡与难度曲线

- 逐关强度：`getLevelScaling(level)` 读取 `src/core/Difficulty.ts` 中的 `LEVEL_CURVE` 表（每列一关，第 1 关为基准 1.0 / 0，逐关单调变难）。压力主要来自同一时刻的火力密度：敌机火力（伤害 ÷ 冷却）相对第 1 关约为 2 倍（第 2-3 关）、2.5-2.9 倍（第 4-5 关），第 6 关起上一个台阶（约 5.1 倍），到第 10 关约 9.8 倍；命中加成到 +0.27，射击提前量 `enemyAimLead` 到 0.94，同屏敌机加成 `concurrentEnemyBonus` 到 +2；血量涨幅压低（第 10 关敌机 1.27 倍、单位 1.18 倍），以免关卡越拖越长。单位伤害 = `enemyDamageMultiplier × unitDamageShare`（份额从 1.0 降到第 10 关的 0.6：单位单发伤害大，涨幅放缓）。得分倍率 `scoreMultiplier` 从 1.0 升到 2.08，使升级预算跟上。
- 难度档：`getDifficultyProfile(1..5)` 在关卡曲线之上整体缩放敌人；基础数值按“专家”手感编写，默认档 3（「普通」，英文 Normal）由脚本飞行员实测调校：每分钟受到的伤害约为最大生命值的 20-25%（第 1-2 关）、约 30%（第 3-6 关），升到 35-40%（第 8-10 关），不会躲避的脚本飞行员每关（不含坠地）阵亡 0-2 次。档名为 `LocalizedText`，中英文逐档对应：Very Easy 非常简单 / Easy 简单 / Normal 普通 / Hard 困难 / Expert 专家；开始菜单的难度行与「继续战役」说明直接取 `getDifficultyProfile(level).label`。
- 敌机：开火距离上限 `FIRE_RANGE` 与偏航 + 俯仰散布（`EnemyAI.ts`，见上文「精度系统」），射击提前量见上文「地形避让、EMP 瘫痪与关卡强度」；同时在场的敌机上限 = 按设备固定的基础值（`GameConfig.getMaxEnemies()`，桌面 6 / 移动端 5）+ 关卡加成，与画质无关。
- 波次与单位：第 1 关为教学关（敌机逐波缓升、战斗机从第 3 波开始、不部署高炮与地空导弹车）；第 2-10 关每波敌机减少，后期重型机上限降低；敌方地面 / 海上单位与轰炸机基础血量约降四成（武装直升机约四分之一），慢速单位不再把关卡拖长。具体数值以源码为准（`LevelConfig.enemiesPerWave`、`UnitDeployments`、`UNIT_CONFIGS`）。
- Boss：血量、伤害与射速按实测击杀时间与承伤平滑（`BOSS_CONFIGS`）；导弹单发伤害 `missileDamage` 在 Boss 战开始时按难度档的 `enemyDamageMultiplier` 缩放（见下文「Boss 系统」）。
- 测量工具：开发构建专用的脚本飞行员（`src/core/dev/ScriptedPilot.ts`）与平衡测量（`src/core/dev/BalanceHarness.ts`，`window.__AIR_SUPREME_DEV__.balance`）：以称职的普通玩家水平飞行（地形前瞻同时检查航线两侧 14 米的平行线，会绕开岩壁与立柱）、自动机库采购（贪心购买），记录每波清场时间、伤害来源、阵亡与最后 10 秒的主要伤害来源、Boss 击杀时间、得分与升级点。

### 关卡与地形环境

| 关卡 | 地形 | 天气预设 | 可航行水面 | 环境 |
| ---- | ---- | -------- | ---------- | ---- |
| 1 湖畔晨曦 | `LAKE` | `clear` | 湖内 | Worldscape 湖谷 |
| 2 沙漠风暴 | `DESERT` | `sandstorm` | 无 | Worldscape 沙丘 |
| 3 雪山之巅 | `MOUNTAINS` | `snow` | 无 | Worldscape 雪线山脊 |
| 4 深海决战 | `OCEAN` | `cloudy` | 岛屿之外 | Worldscape 远洋 |
| 5 城市废墟 | `CITY` | `smog` | 无 | 纽约化城区 |
| 6 熔炉之心 | `VOLCANO` | `ash` | 岛外海域 | `VolcanoEnvironment`：火山岛兵工厂、熔岩河 |
| 7 极光冰海 | `ARCTIC` | `aurora` | 冰架与冰山之外 | `ArcticEnvironment`：冰架、冰山、漂移浮冰 |
| 8 雷霆峡谷 | `CANYON` | `storm` | 主峡谷河道 | `CanyonEnvironment`：砂岩峡谷、特斯拉收集塔 |
| 9 天梯之巅 | `STRATOSPHERE` | `clear` | 无（云海为坠毁面） | `StratosphereEnvironment`：云海、天梯 |
| 10 神谕核心 | `CITADEL` | `ash` | 无 | `CitadelEnvironment`：陨石坑黑曜城堡 |

- 环境模块：`TERRAIN_ENVIRONMENT_FACTORIES`（`src/features/terrain/environments/index.ts`）按 `TerrainType` 创建；继承 `EnvironmentBase`，实现 `build` / `sampleHeight` / `isWater`，可选 `surfaceKindAt` / `update`；`sampleEnvironmentSurface` 把高度与水面组合成 `sampleSurface` 结果。第 1-5 关仍由 `TerrainGenerator` 内部的专用生成函数负责。
- 采样：`TerrainGenerator.sampleSurface(x, z)` → `{ y, water }`（可航行水面 `y` 为水位 `WORLDSCAPE_WATER_Y`）；`getSurfaceKind` → `'water' | 'ground' | 'desert' | 'snow' | 'city' | 'lava' | 'ice' | 'rock' | 'cloud'`；`getCrashSurfaceY` 在第 6-10 关委托环境模块。`LevelManager.getSurfaceSample` / `getSurfaceKind` 包装二者，地形加载前回落到水面 / `'ground'`。
- 环境扩展：峡谷 `getConvoyRoute()` 与城堡 `getAssaultRoute()`（地面车队航线，经 `UnitSystem.setRouteProvider`）；城堡 `getCoreArena()`（神谕主宰决战区）与 `setCoreState('online' | 'exposed' | 'overload' | 'offline')`（核心光柱随 Boss 阶段变化）。
- 每关 `postFx`（曝光 / 对比度 / 饱和度 / 泛光 / 暗角）随关卡环境交给后处理调色。
- 静态合批（`src/features/terrain/worldscape/staticBatch.ts`）：`StaticBatcher` 按「材质 + renderOrder」分桶，把零件几何按世界矩阵烘焙后每桶合并为一个网格（`add` / `addObject` / `flush`；顶点色材质的零件可带各自颜色，楼体墙色因此共用一个材质）；`addObject` 把无法合批的可渲染对象（InstancedMesh、多材质网格、点 / 线 / 精灵、灯光）连同子树原样交还，由 `TerrainGenerator.flushStaticBatch` 按世界变换挂回地形组。城区楼群、道路、地标、悬索桥、高架与灯带，湖畔村落与码头，沙丘、干河床、仙人掌、枯树、拱石与绿洲棕榈，海岛都在暂存组里拼好后合批；会动的部分（车流、列车、探照灯、闪烁的信标与塔吊、霓虹、体育场光环）保留各自材质照常动画；透明薄片单遍绘制（`forceSinglePass`），玻璃塔与高架列车的实例化盒体用 `consolidateMaterialGroups` 从 6 个材质分组降到 2 个；鸟群改为两个 InstancedMesh（机身 / 双翼）。实测第 5 关（平衡画质）绘制调用约 1,126 → 225。
- 植被分块 LOD（`worldscape/vegetation.ts`，`VegetationProfile.lod: { tiles, farDistance, keep? }`）：放置结果不变，按网格分块，每块各自的 InstancedMesh 带实例包围球（主相机与阴影相机都能按块剔除），挂在 `THREE.LOD` 下——近处全细节，超过 `farDistance` 换成远景替身（松树一个锥体、阔叶树冠一个二十面体、20 面岩石，不画树干与草簇）；岩石用约一半的粗网格（至少 3 × 3）；`keep` 按实例序号均匀抽稀。`TerrainGenerator` 在生成关卡时读取 `GameConfig.getEffectiveQualityPreset()`（运行中自动降档从下一次换关生效；移动端按 performance 档）：performance 6 × 6 块、700 米切换、保留 80% 树木 / 75% 岩石 / 55% 草；balanced 5 × 5、1,000 米、85% 草；quality 5 × 5、1,800 米、全密度；第 3 关最多 4 × 4 块，第 2 关稀疏的碎石与干草仍是两个整图网格。实测第 1 关（性能画质）三角形约 920k → 264k。
- 云层：`CloudField.update` 只把当前覆盖率下可见的云（缩放大于 0.2%）写进各变体实例缓冲的前部并设置 `count` / `visible`，隐藏的云不再占用顶点处理。
- 出生姿态：`resolveLevelStartPose`（`src/core/campaign/LevelStartPose.ts`）按各关首选航向校验前方航道净空，不安全时在一圈候选航向中选所需高度最低的一个。
- 坠毁复活（`PlayerSystem`，复活延迟 2 秒）：飞行中每 0.25 秒把离地超过 10 米的位置记入固定大小的环形航迹缓冲（64 个样本，约 16 秒，无逐帧分配）；构造、`placeAt`（入关 / 读档）与每次复活都从当前点重新开始记录。复活点取坠毁前至少 3 秒、且与坠毁点水平距离至少 150 米的最新样本；航迹太短（刚入关 / 读档 / 复活后不久又坠毁）时取离坠毁点最远的样本，沿「坠毁点 → 该样本」方向外推到 150 米。复活点限制在软边界 `SOFT_BOUNDARY_RADIUS` 以内，离地至少 40 米，机翼水平。航向从该样本处的飞行方向开始（若这次是复活后 8 秒内（飞行时钟）又撞上地表，首选航向掉头、背离坠毁点；被击落不在此列），依次试 ±45°、±90°、±135° 与调头共 8 个，沿航向探测 0-400 米（40 米内 2 米步长、之后 3 米；航线两侧各 24 米内每 3 米一条平行线，比 8 米宽的天梯导轨更密），表面高于飞行高度 - 20 米即视为挡路，取第一个无遮挡的；全部受阻时爬升到障碍顶最低那条航线之上（不超过软顶界 `SOFT_CEILING`），爬不过去则取首个障碍最远的航向。复活后 3 秒坠毁宽限：触地不坠毁——地面 / 缓坡抬到表面上方 3 米，机头低于约 12° 时改平机翼并拉起到 12°；需要抬升超过 12 米即视为撞上竖直结构（岩壁 / 立柱 / 塔身），改为水平推出到最近的开阔处（由近到远每 2 米一圈、最远 48 米，每圈 16 个方位，表面低于机体 3 米以上为开阔），机头去掉撞向墙面的分量并偏向外侧，机翼与俯仰改平；找不到开阔处时仍按抬升处理。`placeAt` 清除坠毁记录、「复活后不久又坠毁」状态与宽限。坠毁判定直接作用于生命值，能量护盾道具不防撞地。

### 地面 / 海上 / 空中单位

- `UnitSystem`（`src/features/units/UnitSystem.ts`，实现 `IGameSystem`）：17 种单位（`UnitType`），同时存在上限 `MAX_UNITS`；行为分在 `UnitBehaviors.ts`（地面 + 海上与总调度 `updateUnitBehavior`）与 `UnitBehaviorsAir.ts`（空中 / 友军 / 平民）；单位导弹（`UnitMissiles`）与弹道（`UnitProjectiles`）在系统内部的池中结算；不访问 DOM，`particleSystem` 为 null 时只跑逻辑。`UnitController`（`src/core/units/`）负责按需加载与接线。
- 阵营：敌方 `Faction.ENEMY`、友军 `Faction.FRIENDLY`、平民 `Faction.CIVILIAN`（`areHostile` 对平民恒为 false）。
- 行为：坦克追踪开炮；地空导弹车锁定 → 发射（导弹有能量模型，会被热焰弹诱骗）；高炮提前量弹幕，玩家不在射界时转打友军战机；雷达站旋转并提高敌机精度；炮艇蛇形高速机动并开火；护卫舰垂发 + 近防；潜艇潜航 / 上浮锁定发射（潜航时不可命中）；武装直升机贴地侧滑扫射、被击落时自旋坠落；轰炸机高空直线航路轰炸友军地面 / 海上单位、尾炮自卫；自杀无人机编队巡航后俯冲撞击；友军护卫舰近防拦截导弹、对空对舰射击；友军预警机盘旋；护送目标与平民沿航线行进，抵达或驶出后离场。EMP 瘫痪时停火、停车、锁定中断，无人机断电坠落。
- 部署：`getWaveDeployment(level, waveIndex)` 返回本波 `UnitSpawnSpec[]`（放置方式 `ahead` / `flank` / `around` / `water` / `route` / `high-altitude`）；无水地形不部署海上单位；本关会部署的模型在关卡加载时预热。
- 波次门控：`LevelManager.setWaveHoldProvider(() => units.getWaveHoldCount())`——存活敌方单位（含潜航潜艇）拖住波次；敌机清空后残留单位拖住超过时限则放行。
- 命中：玩家子弹逐颗做半径命中（瞄准点 `userData.aimPoint` + `hitRadius`）；锁定导弹对单位瞄准点判定；玩家火力穿过友军单位、会误伤平民；敌方子弹经 `applyHostileFireToUnit` 命中友军单位。
- 得分：玩家击毁敌方单位 → `scoreValue × 关卡得分倍率`；玩家击毁平民 / 友军 → 扣除 `penalty`（总分不低于 0）并告警；任何原因的平民 / 友军损失都计入结算；护送目标抵达 → 奖励分。
- 雷达与告警：SAM 锁定 → `PlayerLockState`（`none` / `locking` / `incoming`）→ HUD 导弹告警；友军预警机在线 → 雷达量程倍率；潜航潜艇以声呐接触显示在雷达上；每类单位第一次出现播首次遭遇台词（整局有效，新开一局 `resetFirstContacts()`）。
- 第 6-10 关 Boss 召唤的 `drone` 小兵由 `UnitController.spawnBossDrone` 生成自杀无人机（有同时存在上限；单位系统未就绪时退回侦察机），其余小兵映射到敌机。

### 特殊武器与热焰弹

- `WeaponSystem`（`src/features/weapons/WeaponSystem.ts`）：选择、弹药、冷却、热量、蓄力与命中；火箭 / 蜂群由 `ProjectileController`、激光 / 轨道炮 / EMP 由 `EnergyWeaponControllers` 实现，视觉在 `WeaponFx*` 与 `WeaponParticleField`；`scene` 为 null 时只跑逻辑。
- 发射模式（`SpecialWeaponMode`）：`salvo` 按下沿齐射（集束火箭、蜂群导弹）；`beam` 按住照射并积热（脉冲激光，过热后冷却到底才能再用）；`charge` 按住蓄力、松开发射（电磁轨道炮，蓄力不足松开则取消且不耗弹，`onDryFire`）；`pulse` 按下释放（电磁脉冲）。切换武器或过热后需松开扳机才能再次开火。
- 目标与阵营：协调器每帧提供 `CombatTarget[]`（敌机包装、全部单位、Boss 部件与可拦截的 Boss 导弹）；只伤 `ENEMY` 与 `CIVILIAN`，`FRIENDLY` 与玩家永不受伤；蜂群导弹与 EMP 只认 `ENEMY`；有效命中半径取契约半径与 `getDeclaredHitRadius(mesh)` 的较大者。
- EMP：半径内敌方目标 `applyStun`，对导弹与无人机造成伤害；`onEmpPulse` 中协调器再让单位瘫痪、销毁单位导弹与半径内的 Boss 导弹、对幻影之翼调用 `applyEmpPulse`（强制现形）、触发屏幕电磁闪与震动。
- 解锁与强化：解锁章节来自 `CampaignChapter.unlockedWeapons`（火箭 2、激光 4、蜂群 6、轨道炮 7、EMP 9）；强化等级 0..5 由 `PlayerStats.getWeaponUpgradeLevel` → `WeaponSystem.setUpgradeLevel` → `getSpecialWeaponStats(id, level)` 数值表决定；新解锁的武器满弹；关卡开始 / 复活 `refill()`；存档 `exportState()` / `importState()`（先设等级再导入，弹药按当前等级上限钳制）。
- 热焰弹：`CountermeasureSystem` 实现 `IDecoyProvider`；`deploy` 从机尾两侧抛出一扇燃烧的热焰弹，诱骗强度随燃尽衰减；充能制，容量由「热焰弹挂架」升级决定（`setCapacity`），回复时间见 `setRechargeTime`。SAM 导弹（`UnitSystem.setDecoyProvider`）与第 1-10 关 Boss 导弹（`BossFlareDecoyRedirector`：第 6-10 关由 `AdvancedBossController`、第 1-5 关由 `BossBattleController` 运行，规则相同）据此偏转。
- 视角与画质：`setViewMode('first-person')` 缩小枪口特效、前移光束起点；`setEffectDensity` 随粒子预算（画质预设）变化。HUD 由 `SpecialWeaponsController` 以约 12 Hz 轮询 `getHudState()` 推送。

### 相机系统

- `CameraRig`（`src/features/camera/CameraRig.ts`）：第三人称追尾（机体局部偏移 (0, 5, 15)，与帧率无关的指数平滑；竖直穿越时以平滑滚转代替 lookAt 翻转）与第一人称座舱（飞行员眼点，姿态完全跟随机体四元数）。
- 切换：`CAMERA_BLEND_SECONDS`（0.55 秒）smootherstep 位置 / 姿态混合，路径带轻微上拱；混合接近座舱时才隐藏机体外壳（`PLAYER_EXTERIOR_LAYER = 3`，相机关闭该层）并显示座舱模型。
- 座舱：`CockpitModel`（遮光罩、三块 MFD、UFC、两块圆表、告警灯、HUD 组合玻璃、风挡立柱；静态部件按材质合并）与 `CockpitDisplays`（显示屏图集纹理）。
- 震动：`CameraShake` 创伤模型（trauma 0..1 累加并线性衰减，实际幅度为 trauma²，确定性平滑噪声，不用 `Math.random`）；`computeExplosionShake(distance, scale, radius)` 按距离二次衰减。FOV 随速度比与加力平滑放大；目标位姿含 NaN / Infinity 时保持上一帧；传送 / 复活 / 读档后 `snapToTarget()`。
- 接线：`PlayerViewController`（`src/core/camera/`）按需加载；V / 视角按钮 → `toggleMode()`；`onModeChanged` → 武器视角、HUD 视角标签 + 切换音、写回设置；渲染步推进玩家加力尾焰（`updatePlayerAfterburner`），护盾按 `1 - 0.7 × blend` 淡化。友军僚机使用盟军涂装（`createFriendlyMesh`，与敌机同机体、同命中半径）。

### Boss 系统（第 6-10 关）

- 契约：所有 Boss 满足 `IBossCore`；第 6-10 关实现 `IAdvancedBoss`——阶段（`getPhase` / `getPhaseCount`）、无敌窗口（`isInvulnerable`）、部件倍率（`getDamageMultiplier`）、唯一伤害入口 `takeDamageAt(part, 原始伤害)`（倍率与子目标血量由 Boss 自己计算）、特殊攻击判定 `checkHazard`（无内部冷却）、状态提示 `getStatusLabel`、可选 `getSubTargets` 与 `applyStun`。
- 控制器：`AdvancedBossController`（由 `BossBattleController` 持有）——按地表采样选择出生点并保持在玩家前方（神谕主宰锚定城堡核心决战区）、注入地面采样、开启死亡演出（演出结束后才触发 `onDestroy`）、按部件半径路由命中、为玩家与每架僚机做特殊攻击判定（每目标约 0.6 秒冷却）、热焰弹诱骗 Boss 导弹、Boss 状态 / 子目标血条、低血量台词与音乐强度、神谕阶段 → 城堡核心状态、幻影隐形时从雷达与锁定中隐藏。各 Boss 模块在登场时按需加载。
- 熔岩巨像（`MagmaColossusAI`）：四足 IK 步行，头部热能炮、双肩迫击炮齐射（落点准星预警）、熔岩导弹、践踏冲击环；齐射后背部散热口开启发光（弱点，被毁剥离装甲）；阶段 2 熔炉闸门打开（核心弱点）、熔岩柱与胸口光束横扫；阶段 3 熔毁暴走，濒死时周期性踉跄。
- 深渊利维坦（`AbyssalLeviathanAI`）：潜航时无敌，只露出尾流与声呐环；上浮前水面出现红色预警圈，随后破冰跃出（冲击环、冰块四溅）；上浮时甲板炮塔与导弹舱开火；指挥塔、4 个压载舱（每毁一个潜航更短，全毁无法下潜）与导弹舱为子目标；阶段 2 布下可击毁的水雷并放出无人机；阶段 3 永久上浮、倾斜起火、沿红色航道冲撞。
- 雷霆飞艇（`TempestZeppelinAI`）：6 个气囊子目标（每击破一个降低并倾斜）、特斯拉线圈充能后连锁电击、雷暴云电击云内目标；阶段 2 打开无人机舱并沿玩家航迹召雷；阶段 3 暴露风暴核心、全线圈齐射，低血量时下坠。
- 幻影之翼（`PhantomWingAI`）：可见 → 隐形（无敌、不可锁定）→ 侧移潜行 → 现形伏击的循环；激光长矛沿红色危险航道俯冲；翼尖两枚相位发射器子目标；阶段 2 投射全息诱饵（青色尾焰，一击即散）；阶段 3 超频；低血量时隐形涂层剥落。EMP（`applyStun` / `applyEmpPulse`）强制现形并打散诱饵。
- 神谕主宰（`OraclePrimeAI`）：阶段 1 四座水晶护盾塔（棱镜 / 电弧 / 追猎 / 光矛）为核心护盾供能，塔各有血量，核心无敌；护盾崩溃后阶段 2 核心暴露，赤道光环发射器旋转扫掠、审判之矛锁定发射；过载后阶段 3 门环冲击波（绿色安全缺口）与双环冲击波交替、天罚光柱、最后的「终焉之光」；约 6.4 秒死亡演出（凝滞 → 内爆 → 白光新星），遗言在凝滞时播出。
- 第 1-5 关 Boss：`resolveLegacyBossSpawn` 把出生点放到玩家前方（贴近战场边缘时偏转或朝向中心）；`LegacyBossHitVolumes` 由部件包围盒生成命中球；按血量三段驱动 HUD 阶段菱形与音乐强度；只有玩家与友军僚机的子弹伤害 Boss；`BossBattleController` 也运行 `BossFlareDecoyRedirector`，热焰弹可诱骗它们的导弹（420 米内追踪玩家的导弹，按最强的热焰弹决定成功率，在诱饵锚点 `BOSS_DECOY_ANCHOR_NAME` 处引爆）。沙墙高炮（80 米/秒、提前量 50%）与空中航母重炮（提前量 60%）经 `TargetLeadTracker`（`src/features/boss/BossAim.ts`）瞄准拦截点，重型轰炸机机炮带散布；三叉戟每轮齐射 2 枚（血量低于 35% 时 3 枚）限速追踪导弹（`BossMissileFlightProfile`：72 米/秒、0.85 弧度/秒、提前量 0.3、7 秒燃尽），高炮 95 米/秒、提前量 50%、±32 米散布；空中航母导弹 72 米/秒、每批 2 架护航机。
- Boss 导弹伤害：`GameCoordinator.getAdjustedBossConfig` 把 `missileDamage` 与血量、伤害一起按难度档缩放（`enemyDamageMultiplier`，四舍五入、至少 1），九个带导弹的 Boss 都把它传给 `BossMissileSystem`（构造参数 `damage`），`BossHitFeedback` 按导弹系统报告的伤害结算玩家（经装甲减伤，护盾时只有特效）与僚机。基础 90 时每发：非常简单 31 / 简单 38 / 普通 45 / 困难 56 / 专家 70；幻影之翼的基础值翻倍（普通 90）。幻影之翼的弹舱导弹 88 米/秒、1.3 弧度/秒、提前量 0.5、8 秒燃尽，机炮提前量 0.9。高炮与八爪鱼战舰的眼睛光弹同样按难度缩放：`FlakCannonSystem(scene, explosionRadius, onExplode, damage)` 取 Boss 配置的 `damage`（沙墙、三叉戟；基础值 30），每发高炮弹爆炸按它结算；`EyeSystem(scene, damage)` 取可选的 `BossConfig.eyeDamage`（基础值 40，`getEyeDamage()` 返回系统的值）。每发：高炮 非常简单 11 / 简单 13 / 普通 15 / 困难 19 / 专家 23，眼睛光弹 14 / 17 / 20 / 25 / 31（普通档保持原先调校的 15 / 20）。

### 升级与机库

- 14 条升级线（`src/features/upgrade/UpgradeSystem.ts`）：核心 7 条（10 级，终值与旧版 5 级满级一致）、防御 2 条（复合装甲、热焰弹挂架）、特殊武器 5 条（各 5 级，武器解锁前锁定）。
- 层级上限 `getUpgradeCapForLevel(type, campaignLevel)`：核心 `min(10, 关卡 + 1)`；防御 `min(满级, ceil(关卡 / 2) + 1)`；武器解锁前为 0，之后 `min(5, 关卡 - 解锁关卡 + 2)`。`canUpgrade` 要求未锁定、未满级、低于本关上限且升级点足够；`getNextCapRaiseLevel` 供菜单提示「第 N 关开放」。
- 升级点：分数累计发放（关卡得分倍率由调用方乘入；扣分不收回已发放的点数）；`awardBonusPoints` 发放额外点数；从后续章节开局时按 `getStartingUpgradePoints(L)` 补偿（按上一关全部上限总花费的一定比例）。
- 效果：`getArmorReduction()`（0..0.4，`PlayerSystem.takeCombatDamage` 先减伤）、`getFlareCapacity()`（2..6）、`getWeaponUpgradeLevel(id)`（0..5）。
- 机库：`UpgradeMenu.show({ mode: 'hangar', subtitle, onContinue })`，标题「机库整备」、底部按钮「出击」（英文界面为 Refit & Rearm / Launch）；每张卡片显示等级、本章上限与锁定武器的解锁章节。购买后 `syncProgression` 同步武器等级、热焰弹容量、锁定参数与生命上限。

### 存档

- `SaveSystem`（`src/core/save/SaveSystem.ts`）：单个检查点 `air-supreme:campaign-save`（`CAMPAIGN_SAVE_VERSION = 1`）+ 战役进度 `air-supreme:campaign-progress`；只在调用时访问 `localStorage`，读写失败不抛出；读取时校验并规范化（损坏或外来数据删除键并返回 null；越界钳制、缺失取默认）。
- 检查点类型：`level-start`（章节卡片之后，wave 0）、`wave`（第 k 波结束后，wave = k + 1，最后一波除外）、`boss`（全部波次清空后，wave = 总波数）、`hangar`（第 1-9 关击破 Boss 时，level 为下一关、wave 为 0；机库「出击」时静默重写一次）；只在正常模式写入。`describeCheckpoint(data, locale?)` 默认按当前语言（传入 locale 时按该语言）生成「第6关 · 熔炉之心 · 第3波」「… · Boss 战」或「第2关 · 沙漠风暴 · 机库整备」（英文为 `Ch. 6 · Heart of the Forge · Wave 3` / `… · Boss` / `Ch. 2 · Sandstorm · Hangar`）；`describeCheckpointText(data)` 返回双语版本。
- 内容：关卡、波次、难度、分数、生命、导弹、`PlayerUpgrades.export()`、`WeaponSystem.exportState()`、热焰弹、视角、本局统计（击落、平民损失、阵亡、游戏时间），以及可选的 `swiftJoined`（本局雨燕的入列台词是否已播；没有这个字段的旧存档由 `isSwiftJoinAnnounced` 按关卡推断：level > 3 视为已播）。`hangar` 检查点的快照把升级上限（`campaignLevel`）与武器解锁改写为下一关的值。加入 `hangar` 与 `swiftJoined` 之前的存档照常读取（`CAMPAIGN_SAVE_VERSION` 仍为 1）。
- 继续：开始菜单「继续战役」/ 失败结算「从检查点继续」→ `main.ts` 用存档的难度 / 关卡 / 生命 / 视角重新开局（`resume`）→ `restoreCheckpoint`（reset → import → 关卡上限 → 武器解锁 → 武器等级 → importState → 分数 / 生命 / 导弹 / 视角）→ `resumeFromCheckpoint` 回到存档波次或 Boss 战前；`hangar` 检查点回到机库，「出击」后与刚打完上一关一样进入章节卡片与战斗（不播序章与教学，弹药与热焰弹在章节开始时补满；其余检查点读档后的第一次 `prepareLevel` 保留存档里的弹药）。
- 清除：普通模式新开一局、通关第 10 章；`recordLevelReached` / `markCampaignCompleted` 维护进度记录。

### 音乐与音效

- `MusicSystem`：23 首程序化曲目（`LevelMusic`：10 首关卡曲、10 首 Boss 曲与 `MENU` / `STORY` / `VICTORY`）与 7 个刺激音（`MusicStinger`），由 `src/core/Audio/music/`（`Sequencer` 前瞻式音序器、`Instruments`、`Compose`、`Theory`、`tracks/`）实时合成，音乐与音效都不加载音频文件（唯一的音频文件是配音包）；按 AudioContext 时钟提前调度，主线程卡顿时自动放大前瞻窗口。总线顺序：会话 → 刺激音闪避 → 音效闪避 → 音量 → 配音闪避（`voiceDuckBridge`）→ 次声高通 → 共享输出（限幅）。
- `setIntensity(0..1)`：图层增减、速度微升、低通逐渐打开；Boss 阶段越高强度越高，低于 25% 血量拉满，神谕主宰逐帧使用 `getMusicIntensity()`；切换曲目时恢复为新曲目的缺省强度。
- 刺激音对齐下一拍并移调到当前调性，播放时闪避主音乐；`boss-defeated` / `level-complete` / `game-over` / `campaign-complete` 接管并结束当前曲目；曲目切换使用交叉淡化。
- 调用时机：章节卡片 → 剧情曲 + 章节重音 + 打字音；入关 → 关卡曲 + `chapter-start`；波次检查点 → `checkpoint`；清场 → `level-complete`；Boss → Boss 曲；阶段切换 → 警报 + `phase-change`；击破 → `boss-defeated`；结算 → 胜利曲 + 计数音；结局 → 剧情曲；失败 → `game-over`；通关 → `campaign-complete` + 胜利曲；暂停 → `pauseMusic` + `stopSustainedSounds`，继续 → `resumeMusic`。
- 菜单音乐：`MenuMusic` 在第一次用户手势后播放，进入战斗淡出，回到菜单恢复。
- 音效：`AudioManager` 新增特殊武器、热焰弹、单位、界面、叙事与 Boss 效果音效（声部在 `src/core/Audio/sfx/SfxLibrary.ts`），音效总线带压缩器；`CampaignSfxRouter` 按距离静音并限流远处单位事件，把 Boss 效果提示映射到熔岩喷发、声呐、汽笛、雷击、护盾受击、阶段警报等音效。

### VFX 与后处理

- 粒子：`ParticleSystem` 是稳定的外观层，后端为单 draw call 的实例化批（预乘混合 + 视深排序，`particles/ParticleBatch`）与实心碎片（`particles/DebrisField`），效果由分层配方（`particles/recipes/`：combat / environment / special / trail）组成；预算随画质预设与负载动态调整（`getBudget()`），接近预算时自动降低新效果的粒子数。
- 后处理：`PostFxPipeline`（显示参考的 `RenderPass` → `UnrealBloomPass` → 调色 / 屏幕效果 `ShaderPass`）；渲染器不支持半浮点渲染目标或创建失败时回退直出；`balanced` / `quality` 开启，`performance` 关闭（屏幕效果改由 `ScreenOverlay` 的单个全屏三角形绘制）。末尾 Pass `needsSwap = false`，保证每帧都渲染到带深度缓冲的场景目标（`0db18f2`，`PostFxPipeline.test.ts` 固定）。
- 屏幕效果（`ScreenEffectsState`）：`damagePulse` / `flash` / `empFlash` 为脉冲（取最大值后自动衰减），`lowHealth` / `speed` 为持续量（平滑趋近）；低血量暗角带心跳包络。EMP 脉冲约 0.5 秒衰减，调色 Pass 与 `performance` 档的 `ScreenOverlay` 都把它画成有上限的电光蓝屏幕边缘 + 一道从准星外扫向边缘的细环，故障条纹稀疏，中心不提亮、不混向白色。
- EMP 世界特效（`WeaponFx`）：`spawnRing(..., additive = true, nearFade = 0)` 的 `nearFade > 0` 时离镜头该距离内的环段淡出（两道 EMP 冲击环用 48 米，轨道炮的环为 0）；环着色器保证 `smoothstep` 的两个边缘有序（细环原先被画成实心圆盘）；EMP 球壳在镜头贴近时整体压暗、约 4-32 米内的壳面淡出；中心闪光更小，第一人称不显示——追尾视角释放 EMP 不再白屏。
- 尾迹：`ContrailSystem` 所有拖尾共享一个几何体（单 draw call），可见度随速度、过载与高度变化；`ContrailController` 为玩家常驻挂载，敌机与僚机按存活列表定期对账。
- 护盾受击涟漪 `ShieldRipple`（`PlayerSystem.notifyShieldHit`）；玩家与残血敌机周期性 `createDamageSmoke`。
- 透明材质规则：`transparent: true`、`depthTest: true`、`depthWrite: false`、`renderOrder 0`。

### HUD、雷达与移动端

- HUD 新面板：`updateWeaponPanel`（特殊武器挂架）、`updateFlares`、`showAutosave`、`setCameraMode`、`setBossStatus`（`null` 收起）、`setMissileWarning`、`flashWarning`；自动存档提示与闪烁告警的计时由 `hud.update(dt)` 推进（暂停时冻结）。`showBriefing(BriefingRequest)`、`showAutosave(label?)`、`flashWarning(text, tone)`、`setBossStatus(label, phase?)`、`showPowerUp(name, icon, duration)` 与 `showPowerUpBig(icon, name, minDisplayTime?, hideSubtext?, variant?)` 接受 `HudText`（见「界面语言」）；道具倒计时逐帧只读缓存好的文字。`setEnemyCounterMode(mode: HudEnemyCounterMode)`（`'wave' | 'boss'`）：波次中计数为「敌人 n · 剩余 m」（`ENEMIES n · LEFT m`）；Boss 战（Boss 模式或战役 Boss 关，由 `GameCoordinator.updateUI` 设置）只显示在场的敌方「敌人 n」——存活敌机（含 Boss 放出的）加存活敌方单位（含 Boss 无人机），不显示本关波次的「剩余」。
- HUD 布局：`#hud` 按 `env(safe-area-inset-*)` 内缩，位置与尺寸按 `HudLayoutDensity` 写在 CSS 里（旋转屏幕即重新布局）。右侧状态列 `#hud-status`：波次、生命、导弹、导弹装填与道具计时（竖屏时生命与导弹点并排）；中央消息栈 `#hud-top-stack`：Boss 条、简报、事件目标与竖屏下的存档提示，手机竖屏时是状态带下方的整行，无线电面板经 `<html>` 上的 `--hud-stack-bottom` 跟在栈底；竖屏下简报显示期间、或 Boss 条与事件目标同在栈里时，存档提示暂缓（隐藏、计时暂停），有空间后完整显示。中央大字提示（`showPowerUpBig`）改为锁定圈上方的横幅（横屏手机上在消息栈下方），不挡准星；ENEMIES / LEFT 计数器与驾驶舱信息栏同样的深色底。
- 雷达：`RadarBlipKind` 新增 `enemy-ground`（红色方块）、`enemy-sea`（红色菱形）、`ally-unit`（金色三角）、`neutral`（灰色空心圆）；`setRangeMultiplier` 由友军预警机驱动；`CombatHudFeed` 用池化对象生成雷达点（20 Hz）与血条快照（含第 6-10 关 Boss 子目标）。
- 移动端：`index.html` 拇指弧按键簇新增 `#special-button`、`#flare-button`、`#cycle-button`、`#camera-button`；按键文字默认英文（FIRE / MSL / SPEC / FLARE / BOOST / SWAP / VIEW / PAUSE），`main.ts` 按语言改写（中文为 开火 / 导弹 / 特武 / 热焰 / 加速 / 切换 / 视角 / 暂停）；HUD 写入按钮的武器代号、外圈进度（`--tc-meter`）、空弹 / 告警状态（`data-alert`）与视角状态。暂停键（`#upgrade-button`）与其他单击键一样在 `touchstart` 时锁存，直到 `InputHandler.isPauseToggled()` 读取（`resetPauseState()` 清除），低帧率下短于一个模拟步长的轻触也不会丢；桌面 Esc / P 仍取按下沿。
- 血条：友军 AI 战机的 `mesh.userData.displayName`（僚机呼号）优先于按名称缓存的标签；敌机显示机型，Boss 显示名称，单位显示阵营标签，都按当前语言，切换语言时所有血条立即改名。三种尺寸：Boss 本体 120 × 10 像素（带名称）、Boss 部件 44 × 5 像素（深色底槽）、其他目标 60 × 6 像素（带名称）；视野内的 Boss 部件只有离准星最近的一个显示名称（带滞回：新部件离准星的距离须小于当前焦点的 80% 才切换），部件不再各自产生屏外箭头；名称标签用样式居中，不再逐次测量文字宽度。
- 模型预览：`ModelPreview` 经 `Record<BossType, loader>` 按需导入每个 Boss 自己的网格工厂（第 6-10 关来自 `MagmaColossusMesh` / `AbyssalLeviathanMesh` / `TempestZeppelinMesh` / `PhantomWingMesh` / `OraclePrimeMesh`），把可见几何（排除隐藏部件与精灵）缩放到固定半径的包围球，切换模型时逐一释放几何体、材质与实例缓冲（跳过共享资源）。取景只用名称标签上方的区域：写入名称后（以及改变窗口大小、切换语言时）`frameCamera()` 从 DOM 读取标签上沿，与标签、画布上沿各留 8 像素（区域至少延伸到画布一半高度），相机后退到包围球放得进区域高度（画布更窄时按画布宽度），再用 `setViewOffset` 把投影中心移到区域中心；画布尚未布局时按整个画布取景。名称标签放得下时单行显示（宽度 600 像素以下字号 18 像素）；横屏且高度不超过 520 像素的视口改为左右两栏：画布在左、按钮列在右。

---

## 文件结构

```
src/
├── main.ts                       # 入口：先应用已保存的语言，StartMenu、MenuMusic、按需导入 GameCoordinator、继续战役
├── i18n/                         # 本地化核心：LocalizedText、tr / localize / format、getLocale / setLocale / onLocaleChange
├── Game.ts                       # 向后兼容导出（re-export GameCoordinator）
├── Game.legacy.ts                # 旧实现（已废弃）
├── config.ts                     # GameConfig（设备 / 画质预设）与 GAME_CONSTANTS
├── core/
│   ├── GameCoordinator.ts        # 主协调器
│   ├── BossBattleController.ts   # Boss 生命周期与第 1-5 关 Boss
│   ├── PresentationRuntimeLoader.ts / PresentationController.ts
│   ├── EventBus.ts / GameLoop.ts / GameState.ts / GameSessionState.ts / SessionSettings.ts
│   ├── CombatContracts.ts / Faction.ts / Difficulty.ts
│   ├── campaign/                 # CampaignFlowController、CampaignPresentation、CampaignSfx、LevelStartPose、MenuMusic、Wingmen、RadioBudget
│   ├── units/                    # UnitController
│   ├── combat/                   # SpecialWeaponsController
│   ├── camera/                   # PlayerViewController
│   ├── vfx/                      # CombatVfxController、ContrailController
│   ├── boss/                     # AdvancedBossController、AdvancedBossSupport、BossHitFeedback、LegacyBossHitVolumes
│   ├── hud/                      # CombatHudFeed
│   ├── save/                     # SaveSystem
│   ├── dev/                      # DevHooks、ScriptedPilot、BalanceHarness（仅开发构建）
│   ├── systems/                  # PlayerSystem、CombatSystem、EnemySystem、PowerUpSystem
│   ├── Input/                    # InputHandler
│   ├── Audio/                    # AudioManager、MusicSystem、VoiceSystem、VoiceDucking、AudioContextHost、AudioKit、music/、sfx/
│   └── utils/                    # ConfigLoader、Logger
├── features/
│   ├── campaign/                 # CampaignData（导入入口）、CampaignTypes、CampaignCast、CampaignChapters、CampaignRadio、CampaignStory、ChapterTitles
│   ├── enemy/                    # EnemyAI、FriendlyAI、EnemyTypes、EnemyFSM（旧版，已废弃）
│   ├── units/                    # UnitTypes、UnitDeployments、UnitSystem、UnitBehaviors、UnitBehaviorsAir、UnitMesh*、UnitMissiles、UnitProjectiles、UnitEventBridge …
│   ├── weapons/                  # WeaponTypes、WeaponSystem、CountermeasureSystem、控制器与特效
│   ├── boss/                     # BossTypes、BossContracts、BossAI、各关 Boss AI / Mesh / 特效、BossMissileSystem、BossAim
│   ├── camera/                   # CameraRig、CockpitModel、CockpitDisplays、CameraShake、ThirdPersonCamera
│   ├── combat/                   # ProjectilePool、BossProjectilePool、MissileSystem、HealthSystem、AutoAimSystem
│   ├── effects/                  # ParticleSystem、particles/、postfx/、ContrailSystem、ShieldRipple、SpawnPortal …
│   ├── levels/                   # LevelManager
│   ├── terrain/                  # LevelConfig、TerrainGenerator、environments/、worldscape/（含 staticBatch、vegetation、clouds）
│   ├── player/                   # PlayerController
│   ├── aircraft/                 # AircraftMeshFactory
│   ├── powerups/                 # PowerUpSystem、BalloonPowerUp
│   └── upgrade/                  # UpgradeSystem
├── scenes/                       # GameScene（渲染器、光照、后处理）
├── ui/                           # HUD、StartMenu、PauseMenu、UpgradeMenu、StoryOverlay、RadioComms、RadarMinimap、CheckpointResumeButton、EnemyHealthBars、LockOnIndicator、ModelPreview、theme/ …
└── __tests__/                    # Vitest 测试

public/voice/                     # 配音包：en/、zh/（<台词 id>.mp3）、manifest.json、provenance.json
```

---

## 最近更新记录

### 2026-10: 收尾打磨

**主要变更**（`0cd1735..f6ce2d3`，逐项见 `CHANGELOG.md` 的「收尾打磨」）:

1. **界面语言** - `HUD.flashWarning` / `setBossStatus` / `showPowerUp` / `showPowerUpBig` 接受 `HudText` 并在语言切换时原位重绘；`ICampaignPresentation.flashWarning` / `setBossStatus` / `onBossPhaseChange` 与 `IAdvancedBoss.onPhaseChange` / `onHazardWarning` 改传 `HudText`，`SpecialWeaponsDeps.notify` 与 `UnitController` 的告警也传双语原文；第 6-10 关 Boss 状态提示在切换语言时立即重推；中文界面的教学改称「教程」（开始菜单开关、教学目标标题与开场提示）
2. **Boss 伤害** - 高炮（`FlakCannonSystem` 的 `damage` 参数，基础值 30）与八爪鱼眼睛光弹（`EyeSystem` 的 `damage` 参数、`BossConfig.eyeDamage`，基础值 40）随难度缩放，普通档 15 / 20
3. **复活** - 净空探测加宽到航线两侧各 24 米、每 3 米一条线；复活后 8 秒内又撞地时首选航向掉头；宽限期撞上竖直结构时水平推出并转离墙面
4. **僚机** - `getFormationSlotOffset` 成为编队位布局的唯一来源（`EnemySystem.getFriendlySpawnPose` 也读它）
5. **开发工具** - 脚本飞行员绕开岩壁与立柱；`window.__AIR_SUPREME_DEV__.grantPowerUp(type)`
6. **HUD 与模型预览** - `HUD.setEnemyCounterMode(mode: HudEnemyCounterMode)`：Boss 战的敌人计数只计在场敌方、不显示波次剩余；`ModelPreview` 在名称标签上方的区域取景（`setViewOffset`），横屏手机改为左右两栏

### 2026-10: 终验修复（两波）

**主要变更**（`2e9941d..0cd1735`，逐项见 `CHANGELOG.md` 的「终验修复」）:

1. **复活与操作** - 复活点沿安全航迹后退（≥ 3 秒、≥ 150 米）+ 0-400 米净空探测 + 3 秒坠毁宽限；移动端暂停键锁存
2. **僚机** - 每关开场整队升空（第 3 关起渡鸦与雨燕），雨燕入列台词每局一次（存档字段 `swiftJoined`），编队位避开追尾相机视线走廊，`EnemyAI.updateKinematic`，`EnemySystem.getFriendlySpawnPose`
3. **存档** - `CheckpointKind` 新增 `'hangar'`（Boss 击破时写入，机库「出击」时重写），`describeCheckpoint(data, locale?)` / `describeCheckpointText` / `isSwiftJoinAnnounced`
4. **无线电** - `RadioBudget` 限制紧急告警配音，紧急告警不打断正在配音的台词，被打断的台词至多重播一次，`genericRadio` 返回是否入队，Boss 收尾按无线电积压等待（`getRadioBacklogSeconds`）
5. **界面** - `HudText` 可本地化横幅与提示、手机安全区布局、Boss 部件紧凑血条、EMP 屏幕脉冲、第 6-10 关 Boss 的模型预览、中文难度名逐档对齐
6. **战斗与平衡** - Boss 导弹伤害随难度、热焰弹诱骗第 1-5 关 Boss 导弹、`BossMissileFlightProfile` 与 `TargetLeadTracker`、三叉戟齐射与幻影之翼调校、关卡曲线新增 `enemyAimLead` / `concurrentEnemyBonus` / `unitDamageShare`、波次与单位减量
7. **性能** - `StaticBatcher` 静态合批、植被分块 LOD 按画质档、鸟群实例化、隐藏的云不绘制
8. **其他** - 「生命恢复」说明与效果一致、非开发构建日志级别 WARN、波次敌机群出生点不再被压到边界

### 2026-10: 英文默认、角色配音与实测平衡

**主要变更**（逐项见 `CHANGELOG.md` 的 Unreleased）:

1. **界面语言** - 英文默认、简体中文可在开始 / 暂停菜单实时切换；`src/i18n/` 本地化核心，数据层与界面文案就地双语（`LocalizedText`），语言随设置持久化
2. **角色阵容** - 英文重写的剧本附中文版；国际化角色表（四名女性友方角色），新增雨燕、灯塔、壁垒三个角色；每句配音台词有稳定 id 与 `getVoiceScript()`
3. **具名僚机** - `WingmanRoster`：渡鸦与雨燕（第 3 关起），血条显示呼号，入列 / 被击落的无线电；友军预警机与护卫舰损失由各自的机组播报
4. **角色配音** - 英文与普通话语音包（`public/voice/`）、`VoiceSystem`（电台 / 旁白链路、响度归一化、音乐闪避、预取、暂停续播、看门狗）、无线电与剧情卡片按配音计时、语音音量；Boss 收尾等待上限放宽到 16 秒（终验修复中改为按无线电积压等待，见上）
5. **平衡** - `LEVEL_CURVE` 逐关曲线、难度档重新居中、敌机开火距离与俯仰散布、固定的同屏敌机上限、第 1 关更温和、Boss 血量按实测重设、开发构建的脚本飞行员测量工具
6. **修复** - 第 1-10 关 Boss 统一出场定位与返回提示、出生姿态航道净空、血条命名、熔岩巨像 / 深渊利维坦命中半径、非有限音量、无线电间隔、导弹列表原地压缩、语言切换的重绘问题与旁白打字节奏

### 2026-10: 十关故事战役

**主要变更**（分支 `workflow/ten-level-campaign`，逐项见 `CHANGELOG.md` 的 Unreleased）:

1. **十章剧情与战役流程** - `CampaignData`、`CampaignFlowController`、`ICampaignPresentation`（`StoryOverlay` 章节卡片 / 结算 / 结局，`RadioComms` 无线电）
2. **第 6-10 关** - 火山、冰海、峡谷、平流层、城堡五个环境模块，地表采样 `sampleSurface` / `getSurfaceKind`
3. **Boss 6-10** - 熔岩巨像、深渊利维坦、雷霆飞艇、幻影之翼、神谕主宰（`IAdvancedBoss`、`AdvancedBossController`）
4. **地面 / 海上 / 空中单位** - 17 种单位、敌方 / 友军 / 平民三阵营、按波部署与波次门控
5. **特殊武器与热焰弹** - 集束火箭、脉冲激光、蜂群导弹、电磁轨道炮、电磁脉冲，按章节解锁
6. **相机** - 第一 / 第三人称 `CameraRig`、座舱、震动、盟军涂装与加力尾焰
7. **成长与存档** - 14 条分级升级线、机库、自动存档与继续战役
8. **音乐与音效** - 前瞻式音序器、23 首曲目、7 个刺激音、新音效与总线压缩器
9. **VFX** - 实例化粒子、HDR 后处理（含隔帧丢深度修复 `0db18f2`）、屏幕效果、翼尖尾迹、护盾涟漪
10. **修复** - 第 1-5 关 Boss 出生在玩家前方并按部件命中、各关安全出生姿态、敌机避让地形、敌机血条不再显示「NaNm」、Boss 导弹 NaN 防护

### 2026-02-14: 生命道具修复

**主要变更**:

1. **生命道具效果修正** - [Game.ts:211-214](src/Game.ts#L211-L214)
   - **问题**: 生命道具错误地增加了 maxHealth 升级等级
   - **修正**: 现在正确地增加玩家生命数量（playerLives）
   - **效果**:
     - 生命数量 +1（从初始 3 条命开始，最多 9 条）
     - 同时补满当前生命值到最大值
     - HUD 实时更新显示新的生命数量
   - **实现**:
     - 从 `playerStats.increaseMaxHealth()` 改为 `this.lives++`
     - 调用 `playerHealth.healToMax()` 补满血量
     - 调用 `hud.updateLives(this.lives)` 更新 UI
   - **移除**: [UpgradeSystem.ts:237-242](src/features/upgrade/UpgradeSystem.ts#L237-L242) 删除错误的 `increaseMaxHealth()` 方法

### 2026-02-14: 战斗系统与阵营系统修复

**主要变更**:

1. **友军AI系统实现** - BOMB道具重构为召唤友军
   - `FriendlyAI.ts`: 友军AI包装类，复用EnemyAI逻辑
   - 友军使用敌人AI和模型，自动攻击敌方敌人
   - AI行为与敌人一致（追逐、固定方向、盘旋三种状态）
   - 被击败后消失，不掉落道具
   - 位置：玩家附近随机偏移（±100m X/Z, ±50m Y）
   - 目标选择：`findNearestEnemy()` 寻找最近敌方敌人

2. **阵营系统实现** - [core/Faction.ts](src/core/Faction.ts)
   - 定义三个阵营枚举：
     - `ENEMY`: 敌军阵营
     - `FRIENDLY`: 友军阵营（协助玩家）
     - `NEUTRAL`: 中立阵营（玩家）
   - `areHostile()` 函数：判断两个阵营是否敌对
     - 友军和中立（玩家）不互相伤害
     - 其他组合都敌对（敌军vs友军、敌军vs玩家）

3. **AI子弹伤害系统修复** - [Game.ts:885-921](src/Game.ts#L885-L921)
   - **问题1**: 子弹没有阵营标识
     - 修复：`ProjectilePool.fire()` 添加 `faction` 参数
     - 修复：设置 `projectile.mesh.userData.faction = faction`
     - 修复：`fireAIProjectile()` 传递 `fromFaction` 参数

   - **问题2**: 碰撞检测逻辑错误
     - 错误：使用 `hitObject`（目标）在子弹池中找子弹
     - 正确：使用 `projectileMesh`（子弹）在子弹池中找子弹
     - 修复回调参数理解：
       - `hitObject`: 被击中的目标 mesh（玩家/敌人/友军）
       - `projectileMesh`: 子弹的 mesh
       - `damage`: 伤害值

   - **问题3**: 伤害值传递链断裂
     - `Projectile` 接口添加 `damage: number` 字段
     - `fire()` 方法接受 `damage` 参数并存储
     - `checkCollisions()` 回调传递 `projectile.damage`
     - `Game.ts` 所有调用传递正确的伤害值

4. **射击音效添加** - [Game.ts:174-176](src/Game.ts#L174-L176) & [Game.ts:496-498](src/Game.ts#L496-L498)
   - 敌人射击时播放 `audioManager.playShoot()`
   - 友军射击时播放 `audioManager.playShoot()`
   - 统一音效，提升战斗反馈感

5. **碰撞检测完善**
   - 子弹发射者追踪：`owner` 字段防止子弹立即碰撞到发射者
   - 阵营判断：使用 `areHostile()` 判断是否造成伤害
   - 目标伤害：
     - 敌军子弹 → 玩家（NEUTRAL）和友军（FRIENDLY）
     - 友军子弹 → 敌军（ENEMY）
   - 添加调试日志：`[碰撞检测] XX子弹命中XX，伤害: XX`

**技术细节**:

- **对象池模式**: 子弹复用，避免频繁创建/销毁
- **阵营标识**: `userData.faction` 存储阵营信息
- **发射者追踪**: `owner` 字段用于防碰撞检测
- **伤害传递**: 完整的 damage 传递链：EnemyAI → Game → ProjectilePool → Collision

---

### 2026-02-14: 视觉效果优化

**主要变更**:

1. **玩家尾迹改为发动机火焰效果** - 移除粒子尾迹，添加 Sprite 火焰
   - 使用 `THREE.Sprite` + `THREE.SpriteMaterial`
   - 径向渐变纹理（CanvasTexture）：中心白色高亮 → 橙黄 → 橙 → 透明边缘
   - AdditiveBlending 实现发光效果
   - 动态大小和颜色变化：
     - 正常：size 3.0, color 0xff8844 (橙黄色）
     - 加速：size 5.0, color 0xffaa00 (金黄色)
   - 平滑过渡使用 lerp (size: 8.0 coefficient, color: 5.0 coefficient)
   - 位置：飞机尾部 (local: 0, -0.2, 2.8)

2. **敌人尾迹优化** - 统一白色，增加密度
   - 所有敌人尾迹颜色改为 0xffffff (白色）
   - 粒子密度提升 4x：
     - maxParticles: 25 → 50 (2x)
     - spawnInterval: 0.2s → 0.1s (2x frequency)
   - 更符合真实飞机尾迹效果

3. **敌人UI优化** - 移除包围框，文字居中
   - 移除绿色 2D 包围框（box 元素）
   - 文字名称中心与血条中心对齐：
     - 使用 `offsetWidth` 动态获取文字实际宽度
     - 居中位置计算：`(barWidth - textWidth) / 2`
     - 适用于所有敌人类型（SCOUT、FIGHTER、HEAVY、SNIPER、ACE）

**技术细节**:

- 火焰纹理：128x128 Canvas，5 层径向渐变
- 火焰朝向：Sprite 始终面朝相机（billboard）
- 性能优化：火焰材质复用，避免每帧创建新纹理

---

### 2025-02-14: 敌人AI重构

**主要变更**:

1. **重写敌人AI系统** - 基于导弹设计
   - 使用 `velocity` 向量 + `turnSpeed` 转向限制
   - 移除复杂的 Euler 角度控制
   - 只能向前飞，通过转向调整方向

2. **实现三种行为状态**:
   - 追逐 (CHASE) - 追踪玩家
   - 固定方向 (FIXED_DIRECTION) - 随机方向直线飞行
   - 盘旋 (CIRCLE) - 围绕玩家大圆周

3. **状态概率系统**:
   - 每个状态持续4-8秒
   - 根据概率分布重新选择状态
   - 不同类型有不同攻击性

4. **射击规则优化**:
   - 追逐状态：机头朝向玩家时射击（30°圆锥）
   - 盘旋状态：仅重型轰炸机可射击（侧向火力）
   - 固定方向：不射击

5. **降低攻击性**:
   - 所有敌人追逐概率减半
   - 侦察机：50% → 25%
   - 战斗机：65% → 32.5%
   - 王牌：80% → 40%

6. **修复敌机尾迹显示**
   - 添加 `addPoint()` 调用
   - 从引擎位置(local坐标 (0, 0, 2)) 生成粒子

7. **添加玩家射击扰动**
   - 基础精度 0.9
   - 最大扰动 ~2.3°

**删除文件**:

- `EnemyAircraft.ts` (测试文件，已删除)
- `EnemyConfig.ts` (合并到 EnemyTypes.ts)

---

## 开发指南

### 运行项目

```bash
npm install
npm run dev        # 开发服务器（http://localhost:3000）
npm run build      # 生产构建（tsc && vite build）
npm run preview    # 预览生产构建
npx tsc --noEmit   # 类型检查
npm run lint       # ESLint
npm run test:run   # Vitest 单次运行（npm run test 为监听模式）
```

### 扩展战役内容

新特殊武器、单位、Boss、关卡 / 章节与环境模块的改动点见 `docs/conventions.md` 的「Adding content」；契约签名见 `docs/api.md`。

### 修改文案与配音

- 面向玩家的文案写成 `LocalizedText`（`{ en, zh }`，两种语言都要填），在显示处用 `tr()` 取值；逐帧路径把双语对象提升为模块常量。
- 改动有配音的台词（无线电、章节简报、序章 / 尾声）时，id 保持不变就必须重新录制两种语言（或者换一个新 id），否则旧录音会配在新字幕上；新增台词要在两套语音包里录制并更新 `manifest.json` 与 `provenance.json`。步骤见 `docs/voice-lines.md`，`src/__tests__/VoicePack.test.ts` 会检查清单与脚本是否一致。

### 修改敌人配置

编辑 `src/features/enemy/EnemyTypes.ts`:

- 修改 `ENEMY_CONFIGS` 对象
- 调整速度、转向、概率等参数
- 保持概率总和为 1.0

### 修改敌人AI行为

编辑 `src/features/enemy/EnemyAI.ts`:

- `updateChase()` - 追逐状态行为
- `updateFixedDirection()` - 固定方向行为
- `updateCircle()` - 盘旋状态行为
- `fire()` - 射击逻辑

### 添加新敌人类型

1. 在 `EnemyTypes.ts` 中添加枚举值
2. 在 `ENEMY_CONFIGS` 中添加配置
3. 在 `getEnemyTypesForWave()` 中配置出现规则

---

## 设计原则

### 敌人AI设计

1. **只能向前飞** - 飞机不能后退或横向平移
2. **转向受限** - 转向速度受 `turnSpeed` 限制
3. **平滑运动** - 使用四元数插值，避免突然转向
4. **概率驱动** - 状态切换基于概率，增加随机性
5. **友好难度** - 降低追逐概率，多"固定方向"休息

### 射击设计

1. **真实朝向** - 机头必须朝向目标才能射击
2. **精度差异** - 不同类型有不同精度和扰动
3. **合理限制** - 盘旋时不射击（除重型机）
4. **玩家优势** - 玩家精度高，敌人精度低

### 性能优化

1. **对象池** - 子弹使用对象池复用
2. **粒子复用** - 尾迹粒子材质复用
3. **状态缓存** - 避免每帧创建新对象
4. **几何复用** - 敌人模型从对象池获取

---

## 已知问题

### 待优化

1. 敌人生成可能重叠（虽然有分散算法）
2. 战役进度记录（`air-supreme:campaign-progress`：通关、最高分、到达的最高关卡）目前只写入，界面未展示

### 技术债

1. `EnemyFSM.ts` 已废弃但未删除（兼容性保留）
2. 部分类型使用 `any` 避免严格类型检查
3. 硬编码的魔法数字（如 30° 圆锥角）

---

## 未来计划

### 短期

1. 添加更多敌人类型（如轰炸机、支援机）——十关战役已加入战略轰炸机、预警机等地面 / 海上 / 空中单位（见「十关战役系统」）
2. 实现敌机编队飞行
3. 优化粒子性能

### 长期

1. 多人联机
2. 任务系统
3. 飞机自定义
4. 关卡编辑器

---

## 配置系统 (ConfigLoader)

### 配置文件

位置: `public/config/game-config.json`

包含所有游戏参数：玩家、敌人、Boss、导弹、升级等配置。

### 使用方式

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

// 异步加载配置
await configLoader.load();

// 获取各类配置
const playerConfig = configLoader.getPlayer();
const enemyConfig = configLoader.getEnemy('FIGHTER');
const bossConfig = configLoader.getBoss('HEAVY_BOMBER');
const missileConfig = configLoader.getMissile();
```

---

## 日志系统 (Logger)

### 特性

- 日志级别：DEBUG、INFO、WARN、ERROR
- 模块名标记
- 结构化数据输出
- 开发构建（`import.meta.env.MODE === 'development'`）输出 DEBUG 及以上；其余构建（生产 / 预览 / 测试）只输出 WARN 与 ERROR
- 日志历史存储（仅开发构建）与导出

### 使用方式

```typescript
import { getLogger, loggerManager, LogLevel } from '@/core/utils/Logger';

const log = getLogger('MyModule');

log.debug('调试信息', { data: 123 });
log.info('普通信息');
log.warn('警告');
log.error('错误');

// 配置日志级别
loggerManager.setMinLevel(LogLevel.WARN);

// 导出日志历史
const history = loggerManager.exportHistory();
```

---

## 参考资源

- [Three.js 文档](https://threejs.org/docs/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Vite 文档](https://vitejs.dev/)

---

**文档更新日期**: 2026-10-09
**项目版本**: 2.2.1 + Unreleased（十关故事战役、英文默认与角色配音）
