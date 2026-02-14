# Claude Code 开发指南 - AirSupreme

AirSupreme 是一个基于 Three.js 和 TypeScript 的 3D 飞机战斗游戏，具有复杂的敌人AI、多个游戏系统和跨平台支持（桌面和移动端）。

## 常用命令

### 开发命令
```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器 (http://localhost:3000)
npm run build            # 生产环境构建
npm run preview          # 预览生产构建
```

### 类型检查
```bash
npx tsc --noEmit        # 仅进行 TypeScript 类型检查，不生成文件
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
**职责**: 能力道具、炸弹、导弹补给
- **7种道具**: 生命恢复、护盾、加速、伤害倍增、多重射击、炸弹、导弹补给
- **掉落**: 40%概率从被击败敌人掉落

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
- **5种类型**:
  - SCOUT（侦察机）: 40 m/s, 弱攻击性（25%追逐）
  - FIGHTER（战斗机）: 55 m/s, 中等攻击性（32.5%追逐）
  - HEAVY（重型机）: 35 m/s, 慢转向（35%追逐）
  - SNIPER（狙击机）: 45 m/s, 远距离（30%追逐）
  - ACE（王牌）: 70 m/s, 强攻击性（40%追逐）
- **平衡参数**:
  - `speed`: 飞行速度（参考导弹80 m/s）
  - `turnSpeed`: 转向速度（参考导弹2.5 rad/s）
  - `stateProbabilities`: 三种状态的概率分布
  - `accuracy`: 射击精度（影响扰动角度）

### 关卡配置 (`src/features/terrain/LevelConfig.ts`)
**用途**: 关卡定义和地形参数
- **5种地形**: 每种有独特的视觉效果和飞行高度限制

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
window.game                   // 访问游戏实例
window.game.playerStats     // 查看玩家统计
window.game.levelManager    // 查看关卡状态
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

#### 导弹补给系统（已取消）
- **自动补给**: 每7.5秒自动补充1个导弹（最多10个）
- **UI显示**: 右上角白色进度条显示到下一个导弹的进度
- **进度更新**: 基于 `updateMissileProgress()` 实时更新进度条宽度
- **配置**：
  - MISSILE_RESPAWN_TIME: 7.5（秒）
  - MAX_RESPAWN_MISSILES: 10（上限）

---

**最后更新**: 2025-02-14
**项目版本**: 1.0.0
