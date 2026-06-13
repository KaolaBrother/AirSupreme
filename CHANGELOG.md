# AirSupreme 更新日志

## [2.2.1] - 2026-06-13

### 透明层与导弹可读性

- 水面、云层、卷云、天气粒子与战斗 VFX 明确关闭透明深度写入，并补齐稳定渲染顺序
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
- 当前测试规模为 **31 个测试文件 / 315 个测试**
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
