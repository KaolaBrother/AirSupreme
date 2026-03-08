# ✈️ Air Supreme - 3D 空战游戏

一款使用 Three.js + TypeScript 开发的 3D 飞机空战游戏，支持桌面和移动端。当前版本已包含 5 个关卡、5 个 Boss、试玩关卡、升级菜单、事件波次和模型预览。

![Game Preview](https://via.placeholder.com/800x400?text=Air+Supreme+3D+Combat+Game)

## 🎮 游戏特色

### 当前内容概览

- **5 个关卡 + 5 个 Boss**
- **普通模式 / Boss 模式**
- **试玩关卡开关**
- **升级菜单**
- **事件波次**
  - 精英歼灭
  - 限时拦截
  - 护送防守
- **模型预览**

### 多样化的敌人 AI

- **侦察机 (Scout)** - 快速但脆弱，高闪避
- **战斗机 (Fighter)** - 平衡型，标准战斗单位
- **重型轰炸机 (Heavy)** - 慢速但高血量，高伤害
- **狙击机 (Sniper)** - 远距离精确攻击
- **王牌飞行员 (Ace)** - 高难度，聪明 AI，使用高级战术

### 🚀 导弹系统

- **智能锁定** - 按住导弹键（M或右Shift）锁定目标
- **锁定进度** - 1.5 秒锁定时间（可升级），橙色进度圈从中心移动到敌人位置
- **锁定范围升级** - 新增独立升级项，满级后锁定圈可扩大到基础值的 `2x`
- **视觉提示** - 大黄色圈（瞄准区域）+ 橙色进度圈 + 锁定完成变绿
- **追踪导弹** - 自动追踪目标，目标被毁后自动重新锁定最近敌人
- **资源管理** - 初始 2 发，自动补给（每 7.5 秒恢复 1 发，最多 5 发，可升级）
- **弹药提示** - 导弹耗尽时按下 M 键会显示 "NO MISSILE" 提示
- **UI 进度条** - 右上角显示白色进度条，距离下一发导弹的进度
- **伤害** - 导弹伤害 50 点（比机炮高 4 倍）

### 多关卡地形系统

1. **湖畔晨曦** - 湖区、森林、草甸、农田与远山自然景观
2. **沙漠风暴** - 炎热沙漠，仙人掌点缀
3. **雪山之巅** - 高耸雪峰，云雾缭绕
4. **深海决战** - 广阔海洋，小岛散布
5. **城市废墟** - 工业城市、高楼街区、夜景灯光

### 道具系统

| 道具        | 效果                 | 持续时间     |
| ----------- | -------------------- | ------------ |
| ❤️ 生命恢复 | 恢复 30 点生命       | 即时         |
| 🛡️ 能量护盾 | 无敌状态             | 10 秒        |
| ⚡ 速度提升 | 速度 +50%            | 15 秒        |
| 🔥 伤害提升 | 伤害 x2              | 20 秒        |
| 🎯 多重射击 | 同时发射 3 发子弹    | 20 秒        |
| ✈️ 召唤友军 | 召唤友军飞机协助战斗 | 持续至被击败 |
| 🚀 导弹补给 | 恢复 1 发导弹        | 即时         |

### 升级系统

按 **ESC** 或 **P** 键暂停游戏，使用积分（⭐）升级飞机性能。桌面端也可按 **U** 直接打开升级菜单。每 400 分获得 1 升级点。

| 升级       | 图标 | 基础值 | 最大值 | 每档变化 | 成本      |
| ---------- | ---- | ------ | ------ | -------- | --------- |
| 最大生命值 | ❤️   | 200    | 400    | +40      | 1,2,3,4,5 |
| 飞行速度   | ⚡   | 45     | 85     | +8       | 1,2,3,4,5 |
| 射击速度   | 🔫   | 0.30s  | 0.10s  | -0.04s   | 1,2,3,4,5 |
| 武器伤害   | 💥   | 12.5   | 30     | +3.5     | 1,2,3,4,5 |
| 锁定范围   | 📡   | 1.0x   | 2.0x   | +0.2x    | 1,2,3,4,5 |
| 导弹装填   | 🚀   | 7.5s   | 2.5s   | -1.0s    | 1,2,3,4,5 |
| 导弹锁定   | 🎯   | 1.5s   | 0.5s   | -0.2s    | 1,2,3,4,5 |

### Boss 战系统

每个关卡都有独特的 Boss。普通模式流程为：

`波次 -> 事件波次 -> Boss 战 -> 下一关`

同时开始菜单支持 **Boss 模式**，可直接挑战关底 Boss。

| 关卡     | Boss         | HP   | 特点                           |
| -------- | ------------ | ---- | ------------------------------ |
| 湖畔晨曦 | 重型轰炸机   | 2000 | 四门重炮 + 导弹发射器          |
| 沙漠风暴 | 沙漠堡垒     | 2500 | 防空炮（AOE）+ 导弹发射井      |
| 雪山之巅 | 八爪鱼战舰   | 3000 | 瞬移 + 全屏激光扫射 + 眼睛激光 |
| 深海决战 | 导弹驱逐舰   | 3500 | 防空炮 + 导弹 + 起飞战斗机     |
| 城市废墟 | 空中航空母舰 | 4000 | 重炮 + 导弹 + 起飞敌机群       |

### 试玩关卡与事件波次

- **试玩关卡**：开始菜单可开关，首关会按动作推进基础教学
- **事件波次**：
  - 精英歼灭
  - 限时拦截
  - 护送防守
- **升级点反馈**：获得升级点时会有 HUD 提示，并引导打开升级菜单

### 模型预览

- 开始菜单可打开 **模型预览**
- 可查看玩家机、敌机、Boss 和导弹模型
- 首次打开前会在菜单空闲时预取资源，减少等待感

## 🎯 游戏控制

### 桌面浏览器

| 按键               | 功能             |
| ------------------ | ---------------- |
| W / S              | 俯仰（机头上下） |
| A / D              | 偏航（机头左右） |
| Q / E              | 翻滚（机翼倾斜） |
| 空格               | 机炮开火         |
| M / 右 Shift       | 导弹锁定/发射    |
| 左 Shift / 左 Ctrl | 加速             |
| ESC / P            | 暂停/升级菜单    |

### 移动设备

- **左侧虚拟摇杆**：控制飞机方向
- **右侧绿色按钮**：加速
- **右侧红色按钮**：机炮开火
- **右侧橙色按钮**：导弹锁定/发射
- **右侧紫色按钮**：暂停/升级菜单

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

## 📁 项目结构

```
src/
├── core/                    # 核心系统
│   ├── GameCoordinator.ts   # 主协调器 (v2)
│   ├── EventBus.ts          # 事件总线 (v2)
│   ├── GameLoop.ts          # 游戏循环
│   ├── GameState.ts         # 游戏状态
│   ├── interfaces/          # 系统接口 (v2)
│   │   └── IGameSystem.ts
│   ├── systems/             # 子系统 (v2)
│   │   ├── PlayerSystem.ts
│   │   ├── CombatSystem.ts
│   │   ├── EnemySystem.ts
│   │   └── PowerUpSystem.ts
│   ├── Input/               # 输入处理
│   ├── Audio/               # 音效系统
│   └── utils/               # 工具类
│       ├── ConfigLoader.ts  # 配置加载器
│       └── Logger.ts        # 日志系统
│
├── features/                # 游戏功能
│   ├── player/              # 玩家控制
│   ├── enemy/               # AI 敌人
│   │   ├── EnemyAI.ts       # 敌人逻辑
│   │   ├── FriendlyAI.ts    # 友军AI
│   │   └── EnemyTypes.ts    # 敌人类型
│   ├── boss/                # Boss 系统
│   │   ├── BossAI.ts        # Boss 基类
│   │   ├── DesertFortressAI.ts
│   │   ├── OctopusWarshipAI.ts
│   │   ├── MissileDestroyerAI.ts
│   │   ├── SkyCarrierAI.ts
│   │   └── BossTypes.ts     # Boss 类型配置
│   ├── combat/              # 战斗系统
│   │   ├── ProjectilePool.ts
│   │   ├── MissileSystem.ts
│   │   └── HealthSystem.ts
│   ├── camera/              # 相机系统
│   ├── terrain/             # 地形生成
│   ├── levels/              # 关卡管理
│   ├── powerups/            # 道具系统
│   ├── upgrade/             # 升级系统
│   └── effects/             # 粒子效果
│
├── scenes/                  # 场景管理
├── ui/                      # UI 组件
│   ├── HUD.ts              # 游戏界面
│   ├── StartMenu.ts         # 开始菜单
│   ├── LockOnIndicator.ts  # 导弹锁定
│   └── UpgradeMenu.ts       # 升级菜单
│
├── __tests__/              # 测试文件 (285 个测试)
│
├── Game.ts                  # 向后兼容导出
├── Game.legacy.ts           # 旧实现 (@deprecated)
├── main.ts                  # 入口文件
└── config.ts                # 配置文件
```

## 🛠️ 技术栈

- **Three.js** - 3D 渲染引擎
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Web Audio API** - 音效生成（无需外部音频文件）

## 📱 平台支持

| 功能     | 桌面浏览器 | 移动浏览器 |
| -------- | ---------- | ---------- |
| 控制方式 | 键盘       | 虚拟摇杆   |
| 图像质量 | 高         | 自适应     |
| 粒子数量 | 500        | 200        |
| 敌人数量 | 10         | 5-6        |
| 性能目标 | 60 FPS     | 30+ FPS    |

## 🎨 游戏机制

### 波次系统

- 每个关卡包含多个普通波次和事件波次
- 敌人分批刷新，不会同时出现太多
- 波次间隔期间可以收集道具
- 完成所有波次后进入当前关的 Boss 战，再推进下一关

### 敌人 AI 行为

- **巡逻** - 未发现玩家时绕圈飞行
- **追击** - 发现玩家后追击
- **攻击** - 进入攻击范围后射击
- **闪避** - 血量低时尝试闪避
- **环绕** - 狙击手保持距离攻击
- **俯冲** - 王牌使用的高级战术
- **撤退** - 保持安全距离

### 碰撞系统

- 玩家子弹 vs 敌人
- 敌人子弹 vs 玩家
- 玩家 vs 道具

## 📝 开发说明

### 代码规范

- 使用四元数旋转避免万向节锁
- 对象池模式优化性能
- 固定时间步长确保物理一致性
- 响应式设计支持各种屏幕尺寸
- 自动检测设备调整画质

### 性能优化

- LOD (Level of Detail) 支持
- 对象池减少 GC 压力
- 移动端自动降低画质
- 粒子数量限制

## 🔧 配置

### 传统配置 (src/config.ts)

修改 `src/config.ts` 调整游戏参数：

```typescript
// 玩家参数
PLAYER: {
  PITCH_SPEED: 2.0,    // 俯仰速度
  YAW_SPEED: 1.5,      // 偏航速度
  ROLL_SPEED: 3.0,     // 翻滚速度
  BASE_SPEED: 50,      // 基础速度
  MAX_SPEED: 100,      // 最大速度
}
```

### JSON 配置系统

游戏支持通过 JSON 文件进行外部配置，无需修改代码即可调整参数：

**配置文件位置**: `public/config/game-config.json`

```json
{
  "player": {
    "maxHealth": 200,
    "speed": 45,
    "fireRate": 0.3,
    "damage": 12.5
  },
  "enemy": {
    "spawnInterval": 2000,
    "maxCount": 10
  },
  "game": {
    "difficulty": "normal"
  }
}
```

**在代码中使用 ConfigLoader**:

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

// 异步加载配置
async function initGame() {
  await configLoader.loadConfig();

  // 获取配置值
  const playerConfig = configLoader.get('player');
  console.log(playerConfig.maxHealth); // 200

  // 获取嵌套值
  const difficulty = configLoader.get('game.difficulty'); // "normal"
}
```

## 📊 日志系统

游戏使用统一的日志系统，支持不同日志级别和模块过滤：

### 基本用法

```typescript
import { logger } from '@/core/utils/Logger';

// 不同日志级别
logger.debug('调试信息', { detail: 'value' });
logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息', new Error('Something went wrong'));
```

### 模块日志

```typescript
// 创建模块专用 logger
const moduleLogger = logger.createModuleLogger('EnemyAI');

moduleLogger.info('敌人生成'); // [EnemyAI] 敌人生成
moduleLogger.debug('AI 状态更新', { state: 'chase' });
```

### 日志级别控制

```typescript
// 设置全局日志级别
logger.setLevel('debug'); // 'debug' | 'info' | 'warn' | 'error'

// 开发环境显示所有日志，生产环境只显示警告和错误
if (import.meta.env.PROD) {
  logger.setLevel('warn');
}
```

### 性能追踪

```typescript
// 计时功能
const timer = logger.startTimer('帧更新');
// ... 执行代码
timer.end(); // 输出: [Timer] 帧更新: 16.5ms
```

## 📄 许可证

MIT License

---

**享受游戏！** 🎮✈️
