# Claude Code 开发指南 - AirSupreme

AirSupreme 是一个基于 Three.js 和 TypeScript 的 3D 飞机战斗游戏，具有复杂的敌人AI、多个游戏系统和跨平台支持（桌面和移动端）。

> **分支说明**: 不要假设固定分支，先用 `git branch --show-current` 确认当前工作分支。
>
> **当前主线状态**: 事件驱动架构已稳定，`GameCoordinator` 继续承担装配职责；战斗 runtime、Boss 控制器、升级菜单与 presentation runtime 都已接入按需初始化/预热路径。

## 常用命令

### 开发命令

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器 (http://localhost:3000)
npm run build            # 生产环境构建
npm run preview          # 预览生产构建
```

### 代码质量

```bash
npm run lint             # ESLint 代码检查
npm run lint:fix         # 自动修复 lint 问题
npm run format           # Prettier 格式化代码
npm run format:check     # 检查格式化
```

### 测试

```bash
npm run test             # 运行测试 (watch 模式)
npm run test:run         # 运行测试 (单次)
npm run test:coverage    # 测试覆盖率报告
```

### 类型检查

```bash
npx tsc --noEmit        # 仅进行 TypeScript 类型检查，不生成文件
```

## v2 架构 (当前)

### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      GameCoordinator                        │
│                    (主协调器, 711 行)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       EventBus                              │
│              (类型安全事件总线, 20+ 事件类型)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ PlayerSystem  │ │ CombatSystem  │ │ EnemySystem   │
│ (玩家系统)    │ │ (战斗系统)    │ │ (敌人系统)    │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                  ┌───────────────┐
                  │ PowerUpSystem │
                  │ (道具系统)    │
                  └───────────────┘
```

### 核心文件

| 文件                                | 行数 | 职责                 |
| ----------------------------------- | ---- | -------------------- |
| `src/core/GameCoordinator.ts`       | 711  | 主协调器，组装子系统 |
| `src/core/PresentationRuntimeLoader.ts` | - | 表现层 runtime 延迟加载 |
| `src/core/EventBus.ts`              | 142  | 类型安全事件总线     |
| `src/core/systems/PlayerSystem.ts`  | 213  | 玩家控制、生命、护盾 |
| `src/core/systems/CombatSystem.ts`  | 158  | 投射物、导弹、碰撞   |
| `src/core/systems/EnemySystem.ts`   | 144  | 敌人生成、友军管理   |
| `src/core/systems/PowerUpSystem.ts` | 76   | 道具掉落、效果       |

### 事件类型 (GameEventType)

```typescript
enum GameEventType {
  // 玩家事件
  PLAYER_FIRED,
  PLAYER_HIT,
  PLAYER_DEATH,
  PLAYER_RESPAWN,
  // 敌人事件
  ENEMY_SPAWNED,
  ENEMY_FIRED,
  ENEMY_HIT,
  ENEMY_DEATH,
  // 友军事件
  FRIENDLY_SPAWNED,
  FRIENDLY_FIRED,
  FRIENDLY_DEATH,
  // 战斗事件
  MISSILE_FIRED,
  MISSILE_HIT,
  // 波次事件
  WAVE_START,
  WAVE_COMPLETE,
  LEVEL_COMPLETE,
  // 道具事件
  POWERUP_COLLECTED,
  POWERUP_EXPIRED,
  BALLOON_DESTROYED,
  // 状态事件
  SHIELD_ACTIVATED,
  SHIELD_DEACTIVATED,
  SCORE_CHANGED,
}
```

### 使用 EventBus

```typescript
import { EventBus, GameEventType } from '@/core/EventBus';

class MySystem implements IGameSystem {
  init() {
    EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
      console.log(`敌人 ${payload.enemyId} 被击败`);
    });
  }

  someAction() {
    EventBus.emit(GameEventType.SCORE_CHANGED, {
      score: 100,
      delta: 10,
    });
  }
}
```

### 废弃文件

| 文件                 | 状态         | 替代                       |
| -------------------- | ------------ | -------------------------- |
| `src/Game.legacy.ts` | @deprecated  | 使用 `GameCoordinator`     |
| `src/Game.ts`        | 向后兼容导出 | 实际导出 `GameCoordinator` |

## 配置系统 (ConfigLoader)

### 配置文件

位置: `public/config/game-config.json`

### 使用方式

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

await configLoader.load();
const playerConfig = configLoader.getPlayer();
const enemyConfig = configLoader.getEnemy('FIGHTER');
```

## 日志系统 (Logger)

### 使用方式

```typescript
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MyModule');
log.debug('调试信息', { data: 123 });
log.info('普通信息');
log.warn('警告');
log.error('错误');
```

## 项目架构概览

AirSupreme 采用**模块化功能架构**，每个系统独立工作并通过事件通信。

### 核心系统

#### 1. 敌人AI系统 (`src/features/enemy/`)

**职责**: 敌人行为控制、状态机、战斗AI

- **EnemyAI.ts**: 基于导弹的运动系统，三种行为状态（追逐、固定方向、盘旋）
- **EnemyTypes.ts**: 5种敌人类型配置（侦察机、战斗机、重型机、狙击机、王牌）
- **关键特性**:
  - 只能向前飞，通过转向调整方向
  - 状态概率系统控制攻击性
  - 圆锥区域检测限制射击

#### 2. 玩家控制系统 (`src/features/player/`)

**职责**: 玩家飞行控制、物理模拟

- **PlayerController.ts**: 使用四元数避免万向节锁
- **控制**: W/S（俯仰）、A/D（偏航）、Q/E（翻滚）、Shift（油门）
- **关键特性**:
  - 基于速度的特效
  - 碰撞检测和重生系统（死亡位置记忆）

#### 3. 战斗系统 (`src/features/combat/`)

**职责**: 投射物管理、伤害计算、碰撞检测

- **ProjectilePool.ts**: 对象池管理（200个投射物）
- **MissileSystem.ts**: 智能锁定与追踪导弹
- **HealthSystem.ts**: 生命值管理
- **关键特性**:
  - 自动瞄准辅助系统
  - 投射物扰动（精度系统）

#### 4. 关卡管理 (`src/features/levels/`)

**职责**: 波次生成、敌人生成、地形生成

- **LevelManager.ts**: 波次系统和敌人生成
- **TerrainGenerator.ts**: 动态地形（5种环境：湖泊、沙漠、山脉、海洋、城市）
- **关键特性**:
  - 传送门动画（5秒生成序列）
  - 敌人对象池复用

#### 5. 粒子系统 (`src/features/effects/`)

**职责**: 视觉效果、尾迹、爆炸

- **ParticleSystem.ts**: 粒子效果（爆炸、尾迹）
- **ParticleTrailRenderer.ts**: 动态尾迹渲染
- **SpawnPortal.ts**: 敌人生成传送门
- **关键特性**:
  - 性能优化的粒子复用
  - 移动设备自动减少粒子数量

#### 6. UI系统 (`src/ui/`)

**职责**: HUD、小地图、血条、锁定指示

- **HUD.ts**: 速度、血量、分数、敌人数量
- **RadarMinimap.ts**: 实时小地图
- **EnemyHealthBars.ts**: 动态血条
- **LockOnIndicator.ts**: 导弹锁定系统

#### 7. 道具系统 (`src/features/powerups/`)

**职责**: 能力道具、友军召唤

- **7种道具**: 生命恢复、护盾、加速、伤害倍增、多重射击、召唤友军、导弹补给
- **掉落**: 40%概率从被击败敌人掉落
- **召唤友军**: 召唤一架友军飞机（使用敌机AI和模型），自动攻击敌方敌人
- **友军特性**: 与敌人AI行为一致，攻击敌军而非玩家，被击败后不掉落道具

### 核心系统 (`src/core/`)

- **GameLoop.ts**: 固定时间步长循环，目标60FPS，性能降级
- **GameState.ts**: 集中式状态管理（菜单、游戏中、暂停、游戏结束）
- **InputHandler.ts**: 统一输入处理（键盘和触摸）

## 关键配置文件

### 游戏配置 (`src/config.ts`)

**用途**: 全局游戏常量和设备自动检测

- **重要常量**:
  - `PLAYER_STATS`: 玩家属性（速度、转向率、武器）
  - `WEAPONS`: 武器属性（射速、伤害、扰动）
  - `MISSILE`: 导弹属性（转向速度、飞行距离、伤害）
  - `DEVICE_PROFILES`: 移动设备性能配置

### 敌人配置 (`src/features/enemy/EnemyTypes.ts`)

**用途**: 敌人类型定义和AI概率配置

#### 5种敌人类型 - AI概率配置

**三种AI状态**:

1. **CHASE（追逐）**: 飞机使用平滑转向追踪玩家/友军
2. **FIXED_DIRECTION（固定方向飞行）**: 飞机平滑飞向战场内的虚拟追踪点（距离玩家位置100-300米，-750到750范围）
3. **CIRCLE（盘旋）**: 飞机围绕目标盘旋飞行
   - **目标智能选择**：判断玩家和友军哪个更近，围绕更近的目标
   - **半径随机**：配置值 + 随机20-60米（每次进入盘旋时重新生成）
   - **高度随机**：0-50米随机高度差

| 类型              | 速度   | 追逐    | 固定方向 | 盘旋 | 追逐/盘旋时间 | 固定方向时间  | 特点                   |
| ----------------- | ------ | ------- | -------- | ---- | ------------- | ------------- | ---------------------- |
| SCOUT（侦察机）   | 40 m/s | 25%     | **50%**  | 25%  | 4-8秒         | **2-4秒**     | 弱攻击性，固定方向为主 |
| FIGHTER（战斗机） | 55 m/s | 32.5%   | 47.5%    | 20%  | 4-8秒         | **2-4秒**     | 平衡型，中等攻击性     |
| HEAVY（重型机）   | 35 m/s | 35%     | 45%      | 20%  | 5-9秒         | **2.5-4.5秒** | 慢速转向，持续时间稍长 |
| SNIPER（狙击机）  | 45 m/s | 30%     | **50%**  | 20%  | 4-8秒         | **2-4秒**     | 保持距离，固定方向为主 |
| ACE（王牌）       | 70 m/s | **40%** | 45%      | 15%  | 3-7秒         | **1.5-3.5秒** | 强攻击性，状态切换快   |

**注**: 固定方向飞行状态持续时间会**减半**（0.5倍），使其更频繁地改变行为。

#### 平衡参数

- `speed`: 飞行速度（参考导弹80 m/s）
- `turnSpeed`: 转向速度（参考导弹2.5 rad/s）
- `stateProbabilities`: 三种状态的概率分布
- `accuracy`: 射击精度（影响扰动角度）

### 关卡配置 (`src/features/terrain/LevelConfig.ts`)

**用途**: 关卡定义和地形参数

- **5种地形**: 每种有独特的视觉效果和飞行高度限制

### 战场范围

- **平面范围 (X/Z)**: -750 到 750（跨度1500米）
- **高度范围 (Y)**: 50-300米（飞机飞行高度）
- **固定方向飞行的虚拟追踪点**: 在战场范围内随机生成，距离玩家位置100-300米

## 开发约定

### 1. 事件驱动通信

系统通过回调通信，而非直接引用：

```typescript
// 在关卡管理器中
enemy.onFire = (position, direction, damage) => {
  this.enemyProjectilePool.fire(position, direction);
};

enemy.onDestroy = (position) => {
  this.gameState.addScore(config.scoreValue);
  this.particleSystem.createExplosion(position, config.scale);
};
```

### 2. 对象池模式

**必须使用**对象池管理频繁创建销毁的对象：

- 投射物: `ProjectilePool`（200个）
- 敌人: `LevelManager.enemyPool`
- 粒子: `ParticleSystem`

**原因**: 维持60 FPS，避免垃圾回收停顿

### 3. 四元数旋转

**必须使用**四元数进行飞机旋转：

```typescript
// 正确：使用四元数
this.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);

// 错误：使用欧拉角会导致万向节锁
this.mesh.rotation.y = angle;
```

### 4. 性能优化

- **移动设备**: 自动减少粒子数量（50%）
- **LOD**: 远距离对象降低细节
- **对象池**: 复用对象而非创建新对象
- **固定时间步长**: 物理模拟使用固定dt，避免帧率影响

### 5. 跨平台兼容

- **输入**: 自动检测键盘或触摸
- **性能**: 根据设备自动调整
- **控制**: 触摸屏虚拟摇杆和键盘支持

## 添加新敌人类型

### 步骤:

1. 在 `EnemyTypes.ts` 中添加枚举值
2. 在 `ENEMY_CONFIGS` 中添加配置
3. 在 `getEnemyTypesForWave()` 中配置出现规则

### 配置参数:

```typescript
[EnemyType.YOUR_TYPE]: {
  type: EnemyType.YOUR_TYPE,
  name: '名称',
  health: 100,              // 生命值
  speed: 50,              // 速度（参考导弹80）
  damage: 20,             // 伤害
  turnSpeed: 1.8,         // 转向速度（参考导弹2.5）
  accuracy: 0.5,           // 精度（0-1）
  stateProbabilities: {
    CHASE: 0.4,           // 追逐概率（总和1.0）
    FIXED_DIRECTION: 0.4, // 固定方向概率
    CIRCLE: 0.2            // 盘旋概率
  },
  stateDurationRange: [4, 8],  // 状态持续时间（秒）
  circleRadius: 120,        // 盘旋半径（米）
  circleHeight: 35,         // 盘旋高度差（米）
  scoreValue: 150,         // 分数值
  color: 0xff0000,         // 颜色（十六进制）
  scale: 1.0,             // 模型缩放
}
```

## 修改游戏平衡性

### 降低敌人攻击性:

在 `EnemyTypes.ts` 中降低 `CHASE` 概率，提高 `FIXED_DIRECTION` 概率。

### 提高敌人攻击性:

反向操作：提高 `CHASE` 概率，降低 `FIXED_DIRECTION` 概率。

### 调整难度:

- **速度**: 降低 `speed` 使敌人更慢
- **转向**: 降低 `turnSpeed` 使敌人转向更慢
- **精度**: 提高 `accuracy` 使敌人更准
- **伤害**: 提高 `damage` 增加威胁度
- **生命**: 提高 `health` 使敌人更耐打

## 重要文件清单

### 必读文件:

- **Game.ts**: 主游戏循环，系统初始化，更新顺序
- **LevelManager.ts**: 敌人生成逻辑，波次管理
- **EnemyAI.ts**: 敌人AI实现（基于导弹运动）
- **PlayerController.ts**: 玩家控制物理

### 配置文件:

- **config.ts**: 全局游戏常量
- **EnemyTypes.ts**: 敌人类型和AI配置
- **LevelConfig.ts**: 关卡配置
- **vite.config.ts**: 构建配置，路径别名

### 特性:

- **跨平台**: 自动检测移动设备并优化
- **性能优化**: 对象池、粒子复用、LOD
- **响应式**: 适配不同屏幕尺寸
- **渐进增强**: 低端设备保持核心玩法

## 常见任务

### 添加新武器:

1. 在 `config.ts` 的 `WEAPONS` 中添加配置
2. 在 `PlayerController.ts` 中实现射击逻辑
3. 在 `Game.ts` 中绑定输入

### 添加新道具:

1. 在 `PowerUpType` 枚举中添加类型
2. 在 `PowerUpManager.ts` 中实现效果
3. 在 `PowerUpConfig.ts` 中配置参数

### 添加新地形:

1. 在 `TerrainType` 枚举中添加类型
2. 在 `LevelConfig.ts` 中配置地形参数
3. 在 `TerrainGenerator.ts` 中实现生成逻辑

### 调整敌人AI:

- **修改追逐行为**: 编辑 `EnemyAI.ts` 的 `updateChase()`
- **修改盘旋行为**: 编辑 `EnemyAI.ts` 的 `updateCircle()`
- **修改射击逻辑**: 编辑 `EnemyAI.ts` 的 `fire()`
- **调整概率分布**: 编辑 `EnemyTypes.ts` 的 `stateProbabilities`

## 调试技巧

### 使用浏览器开发工具:

- **性能**: FPS监控，渲染时间分析
- **调试**: 控制台日志，对象检查
- **网络**: 请求监控（资源加载）

### 常用控制台命令:

```javascript
// 在浏览器控制台中
window.game; // 访问游戏实例
window.game.playerStats; // 查看玩家统计
window.game.levelManager; // 查看关卡状态
```

### 性能分析:

- 确保60 FPS稳定
- 检查对象池是否溢出
- 监控粒子数量
- 测试移动设备性能

## 已知技术债

### 旧代码:

- `EnemyFSM.ts`: 旧版状态机，已废弃但保留（兼容性）
- 部分使用 `any` 类型避免严格类型检查

### 待优化:

- 敌人生成可能重叠（虽然有分散算法）
- 粒子系统在大量敌人时可能性能下降
- 远距离敌人渲染裁剪可优化

## 提交指南

### 提交前检查:

1. 运行 `npm run build` 确保无类型错误
2. 测试桌面和移动设备
3. 确认60 FPS稳定
4. 检查控制台无错误

### 提交消息格式:

```
类型(范围): 简短描述

- 详细变更1
- 详细变更2

影响: 影响范围
测试: 测试方法
```

## 获取帮助

### 技术文档:

- **TECHNICAL_DOCUMENTATION.md**: 完整技术文档
- **CHANGELOG.md**: 更新日志

### 外部资源:

- [Three.js 文档](https://threejs.org/docs/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Vite 文档](https://vitejs.dev/)

## 最新更新记录

### 导弹系统更新（2025-02-14）

#### 导弹重新锁定系统

- **自动重新锁定**: 当导弹追踪的目标被摧毁后，会自动寻找并攻击最近的敌人
- **多次重新锁定**: 导弹可以多次重新锁定目标（不限于一次），直到达到最大飞行距离或寿命
- **敌人列表更新**: Game.ts 每帧更新导弹系统的敌人列表（通过 `missileSystem.updateEnemies()`）
- **寻找逻辑**: 使用 `findNearestEnemy()` 方法，基于导弹当前位置寻找最近的存活敌人
- **目标检测**: 每帧检查目标是否有效（通过 `target.parent` 判断），无效时立即触发重新锁定

#### 导弹平衡性调整

- **伤害减半**: 导弹伤害从100降低到50（配合血量翻倍）
- **飞行距离加倍**: 导弹最大飞行距离从1200m增加到2400m（给更多追踪和重新锁定时间）
- **血量翻倍**：
  - 玩家血量：100 → 200
  - 敌人血量翻倍：
    - 侦察机（SCOUT）：30 → 60
    - 战斗机（FIGHTER）：50 → 100
    - 重型轰炸机（HEAVY）：150 → 300
    - 狙击机（SNIPER）：40 → 80
    - 王牌（ACE）：80 → 160

#### 导弹补给系统

- **自动补给**: 每7.5秒自动补充1个导弹（最多5个）
- **UI显示**: 右上角白色进度条显示到下一个导弹的进度
- **进度更新**: 基于 `updateMissileProgress()` 实时更新进度条宽度
- **配置**：
  - MISSILE_RESPAWN_TIME: 7.5（秒）
  - MAX_RESPAWN_MISSILES: 5（上限）

---

### 道具系统更新（2025-02-14）

#### BOMB道具变更：清屏炸弹 → 召唤友军

- **道具类型**：`PowerUpType.BOMB` 从"清屏炸弹"改为"召唤友军"
- **效果变更**：从消灭所有敌人改为召唤一架友军飞机协助战斗
- **图标更新**：从 💣 改为 ✈️
- **描述更新**：从"消灭屏幕上所有敌人"改为"召唤一架友军飞机协助战斗"
- **配置文件**：[PowerUpSystem.ts:80-88](src/features/powerups/PowerUpSystem.ts#L80-L88)

#### 气球图标显示优化

- **图标放大**：Canvas尺寸从64x64增加到128x128（**2倍**）
- **字体放大**：图标字体从32px增加到64px（**2倍**）
- **平面放大**：图标平面从2.5x2.5增加到5x5（**2倍**）
- **位置提高**：图标位置从y=3.5提高到y=5.5（**避免被气球遮挡**）
- **文件**: [BalloonPowerUp.ts:64-92](src/features/powerups/BalloonPowerUp.ts#L64-L92)

#### 道具效果激活

- **自动激活**：气球被打破时立即激活道具效果（通过`addActivePowerUp()`）
- **即时效果**：生命恢复立即恢复30点生命值，护盾立即激活10秒无敌
- **持续效果**：速度提升（50%，15秒）、伤害提升（100%，20秒）、多重射击（3发，20秒）
- **召唤友军**：召唤一架友军飞机协助战斗（替代原清屏炸弹）
- **文件**: [Game.ts:232-236](src/Game.ts#L232-L236)

#### 友军AI系统（BOMB道具效果）

- **核心特性**：使用敌人AI和模型，攻击敌方敌人而不是玩家
- **AI行为**：与敌人一致（追逐、固定方向、盘旋状态），伤害和AI行为与敌人相同
- **目标锁定**：自动寻找并攻击最近的敌方敌人（不攻击玩家）
- **碰撞检测**：友军子弹不会伤害玩家（通过`userData.isFriendly`标识）
- **血条显示**：与敌人相同的血条系统，显示友军血量和状态
- **名称标识**：黄色大字"FRIENDLY"显示在血条上方，与敌人白色名称区分
- **视野外指示**：箭头指示器显示友军位置和距离
- **销毁处理**：被击败后消失，不掉落道具
- **生成位置**：在玩家附近随机位置生成（±100m范围）
- **文件**：
  - [FriendlyAI.ts](src/features/enemy/FriendlyAI.ts)：友军AI包装类
  - [Game.ts:314-347](src/Game.ts#L314-L347)：`spawnFriendlyAI()`生成逻辑
  - [Game.ts:242-259](src/Game.ts#L242-L259)：`fireEnemyProjectile()`友军标识
  - [Game.ts:635-658](src/Game.ts#L635-L658)：碰撞检测过滤友军子弹
  - [EnemyHealthBars.ts](src/ui/EnemyHealthBars.ts)：扩展支持友军血条显示
  - [Game.ts:975-1027](src/Game.ts#L975-L1027)：`updateEnemyHealthBars()`传递友军数据

#### 测试模式（自动获得友军道具）

- **自动触发**：游戏开始1秒后自动召唤一架友军飞机
- **UI反馈**：显示屏幕中央大字提示（✈️ 召唤友军）
- **调试用途**：方便测试友军AI系统，无需寻找和打破气球
- **实现位置**：[Game.ts:964-970](src/Game.ts#L964-L970)
- **禁用方法**：移除或注释`setTimeout`代码块即可恢复正常游戏

#### 屏幕中央大字提示UI

- **新增元素**：`powerUpBigDisplay`全屏覆盖层，z-index为80（HUD之上）
- **UI设计**：
  - 大图标（120-150px）：弹跳动画效果
  - 道具名称（48-64px）：黄色发光文字（#ffff00）
  - "获得道具！"副标题（24-32px）：白色文字
- **显示时长**：至少显示1秒（`minDisplayTime = 1`）
- **自动隐藏**：时间到后通过`hidePowerUpBig()`隐藏
- **文件**: [HUD.ts:20-280](src/ui/HUD.ts#L20-L280)

#### 双重提示系统

- **右上角提示**（`powerUpDisplay`）：显示道具名称和图标，用于持续效果的倒计时显示
- **屏幕中央提示**（`powerUpBigDisplay`）：大字提示，至少显示1秒，强调获得道具
- **触发逻辑**：
  - 气球被打破 → 激活道具效果 → 屏幕中央大字提示（1秒） → 右上角提示（如有持续时间）
- **文件**: [HUD.ts:324-380](src/ui/HUD.ts#L324-L380)

---

### 友军AI系统（2025-02-14）

#### BOMB道具变更：清屏炸弹 → 召唤友军

- **道具重构**：`PowerUpType.BOMB` 从"清屏炸弹"完全重构为"召唤友军"
- **核心改变**：不再消灭所有敌人，改为召唤友军飞机协助战斗
- **设计理念**：增加战术深度而非简单清屏，提供持续战斗支援
- **配置更新**：[PowerUpSystem.ts:80-88](src/features/powerups/PowerUpSystem.ts#L80-L88)
  - 名称：'清屏炸弹' → '召唤友军'
  - 描述：'消灭屏幕上所有敌人' → '召唤一架友军飞机协助战斗'
  - 图标：💣 → ✈️

#### 友军AI实现

- **架构设计**：`FriendlyAI`包装类（wrapper）包裹`EnemyAI`，复用完整AI行为
- **关键特性**：
  - 使用敌人AI和模型（随机选择5种敌机类型）
  - 自动寻找并锁定最近的敌方敌人（不攻击玩家）
  - AI行为与敌人完全一致（追逐、固定方向、盘旋三种状态）
  - 伤害和武器属性与敌人相同
  - 被击败后消失，不掉落道具（不干扰经济平衡）
- **文件**：
  - [FriendlyAI.ts](src/features/enemy/FriendlyAI.ts)：友军AI包装类实现
  - [Game.ts:314-347](src/Game.ts#L314-L347)：`spawnFriendlyAI()`生成逻辑
  - [Game.ts:293-309](src/Game.ts#L293-L309)：`updateFriendlyAIs()`更新循环

#### 碰撞检测与友军伤害过滤

- **问题**：防止友军子弹误伤玩家
- **解决方案**：三层过滤系统
  1. **友军标识**：友军mesh设置`userData.isFriendly = true`
  2. **子弹标识**：`fireEnemyProjectile()`支持`isFriendly`参数，标记子弹来源
  3. **碰撞过滤**：检测子弹`userData.isFriendly`，友军子弹命中玩家时仅移除子弹而不造成伤害
- **文件**：
  - [Game.ts:242-259](src/Game.ts#L242-L259)：`fireEnemyProjectile()`友军标识
  - [Game.ts:635-658](src/Game.ts#L635-L658)：碰撞检测过滤逻辑
  - [FriendlyAI.ts:25](src/features/enemy/FriendlyAI.ts#L25)：mesh友军标识

#### 测试模式（自动获得友军道具）

- **调试辅助**：游戏开始1秒后自动召唤一架友军飞机
- **UI反馈**：显示屏幕中央大字提示（✈️ 召唤友军）
- **用途**：无需寻找和打破气球即可测试友军AI系统
- **实现**：[Game.ts:964-970](src/Game.ts#L964-L970)
- **禁用方法**：移除`setTimeout`代码块（964-970行）即可恢复正常游戏

#### 友军AI行为细节

- **生成位置**：玩家附近随机偏移（X/Z: ±100m, Y: ±50m）
- **目标选择**：`findNearestEnemy()`寻找最近敌方敌人（排除友军自己）
- **状态管理**：完全继承`EnemyAI`的三种状态（CHASE, FIXED_DIRECTION, CIRCLE）
- **死亡处理**：`onDeath`回调清理友军列表并触发爆炸效果
- **性能优化**：使用对象池复用，无额外内存开销

---

### 友军AI伤害系统修复（2026-02-14）

#### 问题修复

- **友军开火问题**: 修复友军无法攻击敌人的问题
  - **原因**: ProjectilePool.fire() 方法缺少 damage 参数，导致伤害信息丢失
  - **解决**: 在 Projectile 接口添加 `damage: number` 字段
  - **修改文件**: [ProjectilePool.ts](src/features/combat/ProjectilePool.ts)
    - 修改 Projectile 接口（第 8-13 行）
    - 修改 fire() 方法签名（第 57 行）：`fire(origin, direction, damage = 10)`
    - 修改 checkCollisions 回调签名（第 93-96 行）：传入 `damage` 参数
    - 修改碰撞检测调用（第 107 行）：`onHit(target, projectile.mesh, projectile.damage)`

- **敌人子弹对友军伤害问题**: 修复敌人子弹无法伤害友军的问题
  - **原因**: Game.ts 第 882 行使用 `!projectile.mesh.userData.isFriendly` 检查非友军子弹，但敌人子弹的 `isFriendly` 为 `undefined`（未设置），导致 `!undefined === true`，所有子弹都跳过伤害逻辑
  - **解决**: 改为精确检查 `isFriendly !== true`
  - **修改文件**: [Game.ts](src/Game.ts)
    - 第 882 行：`if (projectile && projectile.mesh.userData.isFriendly !== true)`
    - 第 858 行：`if (projectile && projectile.mesh.userData.isFriendly === true)`

#### 伤害系统改进

- **伤害值传递链**:
  1. EnemyAI.fire() 调用 `this.onFire?.(position, direction, this.config.damage)` → 传入配置的伤害值
  2. Game.ts spawnFriendlyAI() 设置 `friendly['enemy'].onFire = (pos, dir, damage) => { this.fireEnemyProjectile(pos, dir, true, damage); }` → 传递 damage 参数
  3. Game.ts fireEnemyProjectile() 调用 `this.enemyProjectilePool.fire(position, direction, damage)` → 传入伤害值
  4. ProjectilePool.fire() 设置 `projectile.damage = damage` → 存储伤害值
  5. ProjectilePool.checkCollisions() 触发 `onHit(target, projectile.mesh, projectile.damage)` → 传递给碰撞回调
  6. Game.ts 碰撞检测回调使用 `enemy.takeDamage(damage)` → 应用正确的伤害值

#### 修复的文件

- [src/features/combat/ProjectilePool.ts](src/features/combat/ProjectilePool.ts)
  - Projectile 接口添加 damage 字段
  - fire() 方法添加 damage 参数
  - checkCollisions 回调传递 damage 参数
- [src/Game.ts](src/Game.ts)
  - fireEnemyProjectile() 添加 damage 参数并传递给 ProjectilePool
  - spawnFriendlyAI() 中 onFire 回调传递 damage 参数
  - 碰撞检测逻辑使用正确的 damage 值（非友军子弹 vs 友军、友军子弹 vs 敌人）
  - 修复 `isFriendly` 检查逻辑（`!== true` 而非 `!`）

---

**最后更新**: 2026-02-19
**项目版本**: 2.1.0 (v2 分支)

---

## 2026-02-19 更新

### 配置外置系统 (ConfigLoader)

将游戏配置从代码中分离到外部 JSON 文件，支持热重载和自定义配置。

- **配置文件位置**: `public/config/game-config.json`
- **使用方式**:
  ```typescript
  import { configLoader } from '@/core/utils/ConfigLoader';
  await configLoader.load();
  const playerConfig = configLoader.getPlayer();
  const enemyConfig = configLoader.getEnemy('FIGHTER');
  ```
- **优势**: 无需重新构建即可调整游戏参数

### 日志系统 (Logger)

结构化日志系统，支持多级别日志和历史导出。

- **使用方式**:
  ```typescript
  import { getLogger } from '@/core/utils/Logger';
  const log = getLogger('MyModule');
  log.debug('调试信息', { data: 123 });
  log.info('普通信息');
  log.warn('警告');
  log.error('错误');
  ```
- **功能**: 日志级别控制、历史记录导出、模块化命名

### 内存泄漏修复

修复多处内存泄漏问题，提升长时间运行稳定性。

- **EventBus 清理**: 确保事件监听器在系统销毁时正确移除
- **Three.js 资源**: 正确释放几何体、材质和纹理
- **定时器清理**: 防止悬空的 setTimeout/setInterval

### 性能优化

多项性能优化，提升帧率和响应速度。

- **对象池扩展**: 更多类型的对象复用
- **更新节流**: 非关键系统降低更新频率
- **渲染优化**: 减少不必要的 draw call

---

## v2 架构重构 (2026-02-15)

### 架构变更

#### 从单体到模块化

- **之前**: `Game.ts` (1300+ 行) 包含所有游戏逻辑
- **之后**: `GameCoordinator` (711 行) + 4 个独立子系统

#### 新增子系统

| 子系统          | 职责                       | 文件                                |
| --------------- | -------------------------- | ----------------------------------- |
| `PlayerSystem`  | 玩家控制、生命、护盾、重生 | `src/core/systems/PlayerSystem.ts`  |
| `CombatSystem`  | 投射物、导弹、碰撞检测     | `src/core/systems/CombatSystem.ts`  |
| `EnemySystem`   | 敌人生成、友军管理、波次   | `src/core/systems/EnemySystem.ts`   |
| `PowerUpSystem` | 道具掉落、效果应用         | `src/core/systems/PowerUpSystem.ts` |

#### 事件驱动架构

```typescript
// 旧方式：直接回调
enemy.onFire = (position, direction) => {
  this.enemyProjectilePool.fire(position, direction);
};

// 新方式：EventBus
EventBus.on(GameEventType.ENEMY_FIRED, ({ payload }) => {
  // 处理射击
});
EventBus.emit(GameEventType.ENEMY_FIRED, { position, direction, damage });
```

### 测试覆盖

| 测试范围  | 测试数  |
| --------- | ------- |
| 核心系统  | 50+     |
| AI 系统   | 80+     |
| 战斗系统  | 60+     |
| Boss 系统 | 50+     |
| UI 系统   | 30+     |
| **总计**  | **273** |

### 新增开发工具

```bash
# 代码质量
npm run lint          # ESLint 检查
npm run lint:fix      # 自动修复
npm run format        # Prettier 格式化

# 测试
npm run test          # Vitest 测试
npm run test:coverage # 覆盖率报告
```

### 文件结构变更

```
新增文件:
src/core/EventBus.ts              # 事件总线
src/core/GameCoordinator.ts       # 主协调器
src/core/interfaces/IGameSystem.ts # 系统接口
src/core/systems/                 # 子系统目录
  ├── PlayerSystem.ts
  ├── CombatSystem.ts
  ├── EnemySystem.ts
  └── PowerUpSystem.ts
src/__tests__/                    # 测试目录

重命名:
src/Game.ts → src/Game.legacy.ts  # 旧实现 (@deprecated)
src/Game.ts (新建)                # 向后兼容导出
```

### 迁移指南

#### 使用新架构

```typescript
// main.ts - 使用 GameCoordinator
import { GameCoordinator } from './core/GameCoordinator';

const game = new GameCoordinator();
game.start();
```

#### 监听游戏事件

```typescript
import { EventBus, GameEventType } from '@/core/EventBus';

// 监听敌人死亡
EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
  console.log(`敌人被击败: ${payload.config.name}`);
  console.log(`得分: ${payload.config.scoreValue}`);
});

// 监听道具收集
EventBus.on(GameEventType.POWERUP_COLLECTED, ({ payload }) => {
  console.log(`获得道具: ${payload.config.name}`);
});
```

#### 创建新子系统

```typescript
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EventBus, GameEventType } from '@/core/EventBus';

export class MySystem implements IGameSystem {
  readonly name = 'MySystem';

  init(): void {
    EventBus.on(GameEventType.PLAYER_FIRED, this.handlePlayerFired);
  }

  update(deltaTime: number): void {
    // 每帧更新逻辑
  }

  dispose(): void {
    // 清理资源
  }

  private handlePlayerFired = (event: GameEvent<GameEventType.PLAYER_FIRED>) => {
    // 处理玩家射击
  };
}
```
