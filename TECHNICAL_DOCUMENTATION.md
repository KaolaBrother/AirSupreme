# AirSupreme 技术文档

## 项目概述

AirSupreme 是一个基于 Three.js 和 TypeScript 的 3D 飞机战斗游戏。

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

---

## 敌机类型配置

### 概览表

| 类型 | 追逐 | 固定方向 | 盘旋 | 速度 | 转向 | 血量 | 特点 |
|-----|------------|--------------|----------|------|------|------|------|
| **侦察机** | 25% | 50% | 25% | 40 m/s | 1.5 rad/s | 30 | 快速但脆弱，攻击性弱 |
| **战斗机** | 32.5% | 47.5% | 20% | 55 m/s | 2.0 rad/s | 50 | 平衡型 |
| **重型机** | 35% | 45% | 20% | 35 m/s | 0.8 rad/s | 150 | 慢但血厚，有侧向火力 |
| **狙击机** | 30% | 50% | 20% | 45 m/s | 1.2 rad/s | 40 | 远距离攻击，保持距离 |
| **王牌** | 40% | 45% | 15% | 70 m/s | 2.4 rad/s | 80 | 高难度，攻击性强 |

### 配置详情

#### 侦察机 (SCOUT)
```typescript
{
  speed: 40,                    // 速度（导弹的50%）
  turnSpeed: 1.5,              // 转向速度
  health: 30,
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
  health: 50,
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
  health: 150,                 // 血厚
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
  health: 40,
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
  health: 80,
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
const dot = toPlayer.dot(forward);  // 1.0 = 正对准，0.0 = 垂直

// 30°圆锥内（cos(30°) ≈ 0.866）
if (dot > 0.866) {
  fire();  // 可以射击
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

所有射击（包括玩家和敌人）都有随机扰动：

```typescript
// 扰动强度 = (1 - 精度) × 0.4
const perturbationStrength = (1 - accuracy) * 0.4;
const anglePerturbation = (Math.random() - 0.5) * perturbationStrength;

// 在Y轴应用随机旋转
direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), anglePerturbation);
```

| 精度 | 最大扰动角度 | 特点 |
|-----|--------------|------|
| 0.4 (侦察机) | ~13.7° | 不太准 |
| 0.5 (战斗机) | ~11.5° | 中等 |
| 0.6 (王牌/重型) | ~9.2° | 较准 |
| 0.7 (狙击机) | ~6.9° | 准确 |
| 0.9 (玩家基础) | ~2.3° | 很准 |

---

## 文件结构

```
src/
├── features/
│   ├── enemy/
│   │   ├── EnemyAI.ts           # 敌人AI主类（基于导弹设计）
│   │   ├── EnemyTypes.ts        # 敌人类型枚举和配置
│   │   └── EnemyFSM.ts          # [旧版] 状态机（已废弃）
│   ├── combat/
│   │   ├── MissileSystem.ts     # 导弹系统
│   │   ├── ProjectilePool.ts    # 子弹池
│   │   └── HealthSystem.ts      # 生命值系统
│   ├── effects/
│   │   ├── ParticleSystem.ts    # 粒子效果系统
│   │   ├── ParticleTrailRenderer.ts  # 粒子尾迹渲染器
│   │   └── SpawnPortal.ts       # 生成传送门
│   ├── levels/
│   │   ├── LevelManager.ts      # 关卡管理器
│   │   ├── LevelConfig.ts       # 关卡配置
│   │   └── TerrainGenerator.ts  # 地形生成器
│   ├── player/
│   │   ├── PlayerController.ts  # 玩家控制
│   │   └── ThirdPersonCamera.ts # 第三人称相机
│   └── upgrade/
│       └── UpgradeSystem.ts     # 升级系统
├── core/
│   └── GameState.ts            # 游戏状态管理
├── ui/
│   ├── HUD.ts                  # 抬头显示
│   ├── EnemyHealthBars.ts     # 敌人血条
│   ├── RadarMinimap.ts        # 小地图
│   └── LockOnIndicator.ts     # 锁定指示器
├── Game.ts                    # 游戏主循环
└── main.ts                   # 入口点
```

---

## 最近更新记录

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
npm run dev     # 开发服务器
npm run build   # 生产构建
```

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
2. 粒子系统在大量敌机时可能性能下降
3. 远距离敌机渲染裁剪可优化

### 技术债
1. `EnemyFSM.ts` 已废弃但未删除（兼容性保留）
2. 部分类型使用 `any` 避免严格类型检查
3. 硬编码的魔法数字（如 30° 圆锥角）

---

## 未来计划

### 短期
1. 添加更多敌人类型（如轰炸机、支援机）
2. 实现敌机编队飞行
3. 添加Boss战
4. 优化粒子性能

### 长期
1. 多人联机
2. 任务系统
3. 飞机自定义
4. 关卡编辑器

---

## 参考资源

- [Three.js 文档](https://threejs.org/docs/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Vite 文档](https://vitejs.dev/)

---

**文档更新日期**: 2025-02-14
**项目版本**: 1.0.0
