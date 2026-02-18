# AGENTS.md - AI Coding Agent Guidelines

This document provides essential information for AI coding agents working in the AirSupreme codebase.

## Project Overview

AirSupreme is a 3D flight combat game built with **Three.js + TypeScript + Vite**. The project follows a modular, event-driven architecture (v2 branch).

## Build/Lint/Test Commands

```bash
# Development
npm run dev              # Start dev server at http://localhost:3000

# Build
npm run build            # TypeScript check + Vite build
npx tsc --noEmit         # Type check only (no emit)

# Linting & Formatting
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix lint issues
npm run format           # Prettier format all .ts files
npm run format:check     # Check formatting

# Testing
npm run test             # Vitest in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run with coverage report
npx vitest run path/to/file.test.ts  # Run single test file
```

## Code Style Guidelines

### Imports

```typescript
// Three.js - use namespace import
import * as THREE from 'three';

// Local modules - use path alias @/
import { EventBus, GameEventType } from '@/core/EventBus';
import { IGameSystem } from '@/core/interfaces/IGameSystem';
import { EnemyConfig } from '@/features/enemy/EnemyTypes';

// Relative imports for same-feature files
import { HealthSystem } from './HealthSystem';
```

### Naming Conventions

| Element                   | Convention            | Example                          |
| ------------------------- | --------------------- | -------------------------------- |
| Classes                   | PascalCase            | `PlayerSystem`, `EnemyAI`        |
| Interfaces                | IPascalCase           | `IGameSystem`, `IHealth`         |
| Enums                     | PascalCase            | `GameEventType`, `EnemyType`     |
| Methods/Functions         | camelCase             | `handleDeath()`, `takeDamage()`  |
| Private properties        | camelCase (no prefix) | `private health: number`         |
| Constants                 | UPPER_SNAKE_CASE      | `GAME_CONSTANTS`, `MAX_SPEED`    |
| Readonly class properties | camelCase             | `readonly name = 'PlayerSystem'` |

### TypeScript Patterns

```typescript
// Use strict types - no 'any' unless absolutely necessary
private health: HealthSystem;
private config: EnemyConfig;

// Optional properties with ? or undefined
private target?: THREE.Object3D;
private deathPosition: THREE.Vector3 | undefined;

// Readonly for constants and interface properties
readonly name = 'PlayerSystem';
interface IHealth {
  readonly current: number;
}

// Arrow functions for callbacks to preserve 'this'
this.health.onDeath = () => {
  this.handleDeath();
};

// Type-safe event handling
EventBus.emit(GameEventType.PLAYER_DEATH, {
  position: this.mesh.position.clone(),
  lives: this.lives,
});
```

### Formatting (Prettier)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### Error Handling

```typescript
// Validate positions before use (avoid NaN/Infinity bugs)
const pos = this.mesh.position;
if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
  console.error('Invalid position, resetting', { position: pos });
  this.mesh.position.set(0, 0, 0);
  return;
}

// Console logging is allowed in this game project
console.log('Enemy spawned:', enemyId);

// Defensive checks for optional callbacks
public onFire?: (position: THREE.Vector3, direction: THREE.Vector3) => void;
// Call safely:
this.onFire?.(position, direction);
```

## Architecture Patterns

### Event-Driven Communication

Use `EventBus` for decoupled system communication:

```typescript
// Subscribe to events
EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
  console.log(`Enemy ${payload.enemyId} destroyed`);
});

// Emit events
EventBus.emit(GameEventType.SCORE_CHANGED, { score: 100, delta: 10 });

// Unsubscribe (on() returns cleanup function)
const unsubscribe = EventBus.on(GameEventType.PLAYER_HIT, handler);
unsubscribe();
```

### IGameSystem Interface

All game subsystems must implement `IGameSystem`:

```typescript
export class PlayerSystem implements IGameSystem {
  readonly name = 'PlayerSystem'; // Required: unique system name

  init(): void {
    // Initialize event listeners, set up callbacks
  }

  update(deltaTime: number): void {
    // Called every frame with fixed timestep
  }

  dispose(): void {
    // Clean up resources, remove listeners
  }
}
```

### Object Pool Pattern

For frequently created/destroyed objects:

```typescript
// Reuse objects instead of creating new ones
class ProjectilePool {
  private pool: Projectile[] = [];

  acquire(): Projectile {
    return this.pool.find((p) => !p.active) || this.createNew();
  }

  release(projectile: Projectile): void {
    projectile.active = false;
  }
}
```

### Quaternion-Based Rotation

**Always use quaternions** for aircraft rotation to avoid gimbal lock:

```typescript
// CORRECT: Quaternion rotation
this.mesh.quaternion.setFromAxisAngle(axis, angle);

// WRONG: Euler angles can cause gimbal lock
this.mesh.rotation.y = angle;
```

## Test Patterns

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SystemName', () => {
  beforeEach(() => {
    // Reset state before each test
    EventBus.clear();
  });

  it('should do something', () => {
    const handler = vi.fn();
    EventBus.on(GameEventType.SCORE_CHANGED, handler);

    EventBus.emit(GameEventType.SCORE_CHANGED, { score: 100, delta: 10 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: GameEventType.SCORE_CHANGED,
        payload: { score: 100, delta: 10 },
      })
    );
  });
});
```

## Performance Considerations

- **Mobile devices**: Auto-detect and reduce particle count, shadow quality
- **Object pools**: Reuse projectiles, enemies, particles
- **Fixed timestep**: GameLoop uses fixed dt for physics consistency
- **LOD**: Reduce detail for distant objects

## Documentation Language

- Code comments: Chinese (中文) for complex logic explanations
- Variable/function names: English
- JSDoc: Chinese for public APIs
- Git commit messages: Conventional format (feat:, fix:, refactor:, etc.)

## Key Files to Reference

| Purpose            | File                                      |
| ------------------ | ----------------------------------------- |
| Game orchestrator  | `src/core/GameCoordinator.ts`             |
| Event system       | `src/core/EventBus.ts`                    |
| System interface   | `src/core/interfaces/IGameSystem.ts`      |
| Game constants     | `src/config.ts`                           |
| Enemy types/config | `src/features/enemy/EnemyTypes.ts`        |
| Enemy AI           | `src/features/enemy/EnemyAI.ts`           |
| Player controller  | `src/features/player/PlayerController.ts` |

## Branch Notes

- **Current branch**: `v2` - Event-driven architecture refactor
- **Do NOT merge to main** unless explicitly requested
- **Legacy code**: `src/Game.legacy.ts` is deprecated; use `GameCoordinator`

## Recent Fixes (2025-02-15)

### Level Transition Enemy Count Bug

- **Issue**: Enemy count showed wrong number when transitioning between levels
- **Cause**: `LevelManager.totalEnemiesSpawned` was not reset in `loadLevel()`
- **Fix**: Added `this.totalEnemiesSpawned = 0` and `this.enemiesSpawnedThisWave = 0` in `loadLevel()`

### Health Powerup Bug

- **Issue**: Health powerup sometimes didn't heal player or add life
- **Cause 1**: `HealthSystem.healToMax()` had `isDead` guard that prevented healing during respawn
- **Cause 2**: `HealthSystem.maxHealth` not synced with `PlayerStats.getMaxHealth()` after upgrades
- **Fix**:
  - `healToMax()` now resets `isDead = false` and heals unconditionally
  - Added `PlayerSystem.syncMaxHealth()` to sync max health before healing
  - Added respawn check in `handleBalloonCollisions()` to prevent powerup collection during respawn

### Particle System Cleanup Bug

- **Issue**: Explosion particles sometimes not cleared properly, especially during level transitions
- **Cause**: `createExplosion()` used `setTimeout` for delayed smoke particles, but `clear()` didn't cancel these timeouts
- **Fix**: Added `pendingTimeouts` Set to track all timeouts, cancel them in `clear()` before clearing particles

### Wave Completion Logic Bug

- **Issue**: After last wave completed, game tried to start an extra empty wave
- **Cause**: Wave completion check `currentWave >= totalWaves` was incorrect (waves are 0-indexed)
- **Fix**: Changed to `currentWave + 1 >= totalWaves` to correctly check before starting next wave

### Level Enemy Count Balance

Adjusted enemy counts for smoother difficulty curve (each level +5 enemies):

| Level | Waves | Enemies Per Wave | Total |
| ----- | ----- | ---------------- | ----- |
| 1     | 5     | [2,3,4,5,6]      | 20    |
| 2     | 5     | [3,4,5,6,7]      | 25    |
| 3     | 6     | [4,4,5,5,6,6]    | 30    |
| 4     | 6     | [5,5,6,6,6,7]    | 35    |
| 5     | 7     | [5,5,5,6,6,6,7]  | 40    |

### Level Music System

Each level now has a unique melody and style:

| Level  | Theme                   | Key     | Waveform | BPM |
| ------ | ----------------------- | ------- | -------- | --- |
| Lake   | Peaceful, flowing       | A minor | triangle | 130 |
| Desert | Intense, Middle Eastern | D minor | sawtooth | 150 |
| Snow   | Ethereal, mysterious    | E minor | sine     | 110 |
| Ocean  | Wave-like, fluid        | C major | triangle | 125 |
| City   | Tense, industrial       | F minor | square   | 165 |

## Architecture Notes

### Upgrade System (Not Yet Implemented in UI)

The upgrade system exists in code but has no UI:

```typescript
// PlayerStats tracks score and upgrade points
playerStats.addScore(score); // Every 500 score = 1 upgrade point

// Available upgrades:
// - MAX_HEALTH: +20 HP per level
// - DAMAGE: +5 damage per level
// - FIRE_RATE: -0.02s cooldown per level
// - SPEED: +5 max speed per level
// - SHIELD_DURATION: +2 seconds per level

// Missing: UI to spend upgrade points
// Location for UI: Could be added to StartMenu or HUD
```

**Implementation needed**:

- Upgrade menu UI component
- Display available points, current levels, upgrade costs
- Call `playerStats.getUpgrades().upgrade(UpgradeType.XXX)` on button click

### Health System Sync Pattern

When healing or affecting player health, always sync max health first:

```typescript
// CORRECT pattern for health restoration
playerSystem.syncMaxHealth(); // Sync with upgrades
playerSystem.getHealth().healToMax();

// WRONG - may use stale maxHealth if upgrades changed
playerSystem.getHealth().healToMax();
```

### Event Flow for Powerups

```
Balloon Collision (projectile or player touch)
    ↓
PowerUpSystem.addActivePowerUp()
    ↓
EventBus.emit(POWERUP_COLLECTED)
    ↓
GameCoordinator.handlePowerUpEffect()
    ↓
Apply effect based on PowerUpType
```

**Important**: Powerups should not be collectable during respawn. Check `isPlayerRespawning()` before processing collisions.

## Boss Battle System (2025-02-15)

### Overview

Boss 战系统允许玩家直接挑战关底 Boss，或完成普通波次后与 Boss 战斗。

### Files

| Purpose       | File                                     |
| ------------- | ---------------------------------------- |
| Boss 配置     | `src/features/boss/BossTypes.ts`         |
| Boss AI       | `src/features/boss/BossAI.ts`            |
| Boss 导弹系统 | `src/features/boss/BossMissileSystem.ts` |

### Boss 配置

第一关 Boss - 重型轰炸机：

| 属性 | 数值                  |
| ---- | --------------------- |
| 体型 | scale 5               |
| 血量 | 2000                  |
| 速度 | 10                    |
| 武器 | 四门重炮 + 导弹发射器 |

### Boss 武器系统

**四门重炮**：

- 位置：左翼、右翼、机背、机腹
- 轮流发射，每 0.5 秒一门
- **目标选择策略**：
  - 左翼/右翼炮：优先攻击最近威胁（玩家或友军）
  - 机背/机腹炮：随机选择目标

**导弹发射器**：

- 每 10 秒发射一枚
- 目标：玩家或最近的友军
- 导弹可被摧毁（HP=20）
- 红色追踪指示器

### 游戏模式

| 模式 | 流程                                   |
| ---- | -------------------------------------- |
| 普通 | 波次1→...→波次N→音乐切换→Boss战→下一关 |
| Boss | 开始菜单→直接Boss战→下一关Boss战→...   |

### Boss 战特性

- 每 30 秒生成友军助战
- Boss 专用音乐（180 BPM，紧张激烈）
- Boss 导弹可被玩家导弹锁定摧毁
- 红色追踪指示器（区别于敌机的黄色）

### Boss 导弹属性

| 属性     | Boss 导弹 | 玩家导弹 |
| -------- | --------- | -------- |
| 模型大小 | 4x        | 1x       |
| 速度     | 0.5x      | 1x       |
| HP       | 20        | 不可摧毁 |
| 颜色     | 红色      | -        |
| 射程     | 5000      | -        |

---

## Recent Fixes (2025-02-16)

### Boss 导弹追踪修复

- **Issue**: Boss 导弹没有正确追踪玩家，总是在追踪友机
- **Cause**: `BossMissileSystem.update()` 中 `huntTarget()` 调用条件错误
- **Fix**: 修改条件为 `this.isTargetingPlayer || (this.target && this.target.parent)`
- **File**: `src/features/boss/BossMissileSystem.ts`

### 友军 AI 重构

- **Issue**: 友军 AI 行为与敌军不一致，`isTargetInView` 逻辑混乱
- **Changes**:
  1. 删除 `isTargetInView()` 函数
  2. `EnemyAI.update()` 添加 `fireTarget` 参数，分离移动目标和开火目标
  3. 友军无目标时跟随玩家但不开火（`fireTarget = null`）
  4. 使用 `getWorldPosition()` 获取 Boss 部件世界坐标
- **Files**: `src/features/enemy/FriendlyAI.ts`, `src/features/enemy/EnemyAI.ts`

### 友军 AI 行为规则

```typescript
// 友军 update 签名
public update(deltaTime: number, enemyMeshes: THREE.Object3D[], playerPosition: THREE.Vector3): void

// 行为逻辑：
// 1. 有敌人时：移动到敌人位置 + 对敌人开火
// 2. 无敌人时：移动到玩家位置 + 不开火
// 3. 只对敌军和 Boss 开火，不会对玩家开火
```

### Boss 重炮目标选择

- **Issue**: Boss 重炮一直在攻击玩家，不攻击友军
- **Fix**:
  - 左翼/右翼炮：`findNearestThreat()` 攻击最近威胁（玩家或友军）
  - 机背/机腹炮：`selectRandomTarget()` 随机选择目标
- **File**: `src/features/boss/BossAI.ts`

### 敌机 Mesh 方向修复

- **Issue**: 敌机 mesh 方向不正确（如 Fighter 没有翅膀）
- **Fix**:
  - 机身改用 `ConeGeometry`（机头细机尾粗）
  - 移除单独的机头锥体
  - 部件位置改为相对 `bodyLength` 比例
  - 机头朝向 -Z 方向
- **File**: `src/core/GameCoordinator.ts` - `createAircraftMesh()`

### 飞机模型预览功能

- **New File**: `src/ui/ModelPreview.ts`
- **Features**:
  - 3D 渲染所有飞机模型（玩家 + 5 敌机 + 1 Boss）
  - 左右滑动/按钮切换模型
  - 自动旋转 + 手动拖拽旋转
  - 初始隐藏，点击后显示
- **Modified**: `src/ui/StartMenu.ts`
  - 添加「模型预览」按钮，与「开始游戏」并排
  - 添加滚动条支持
  - 集成 ModelPreview 组件

### 关键文件更新

| File                                     | Change                                     |
| ---------------------------------------- | ------------------------------------------ |
| `src/features/boss/BossMissileSystem.ts` | huntTarget 调用条件修复                    |
| `src/features/boss/BossAI.ts`            | 重炮目标选择逻辑（两门优先威胁，两门随机） |
| `src/features/enemy/EnemyAI.ts`          | 添加 fireTarget 参数                       |
| `src/features/enemy/FriendlyAI.ts`       | 删除 isTargetInView，跟随玩家逻辑          |
| `src/core/GameCoordinator.ts`            | 敌机 mesh 方向修复                         |
| `src/ui/ModelPreview.ts`                 | 新建模型预览组件                           |
| `src/ui/StartMenu.ts`                    | 集成模型预览按钮和滚动条                   |

---

## Completed Implementation (2025-02-16)

### 普通模式 Boss 战触发

**实现状态**：✅ 已完成并验证

**实现流程**：

```
波次1 → 波次2 → ... → 波次N → 音乐切换 → Boss战 → 下一关
```

**事件流程**：

```
LevelManager.update()
  → waveDelayTimer expired
  → onLevelComplete(level)
  → EnemySystem emits LEVEL_COMPLETE event
  → GameCoordinator.startLevelBossBattle()
  → Boss 生成
  → Boss 击败后进入下一关
```

**实现细节**：

- 新增 `inLevelBossBattle` 状态变量，标记普通模式的 Boss 战状态
- `LEVEL_COMPLETE` 事件现在触发 `startLevelBossBattle()` 而不是直接进入下一关
- 新增 `startLevelBossBattle()` 方法：
  - 播放 Boss 音乐
  - 生成当前关卡的 Boss
  - Boss 击败后进入下一关并开始波次
- `update()` 方法现在检查 `bossMode || inLevelBossBattle` 来决定是否调用 `updateBossBattle()`

**测试验证**：

通过浏览器测试确认事件流程正确：

1. 波次完成 → `waveDelayTimer` 开始倒计时
2. 3秒后 → 触发 `onLevelComplete` 回调
3. EnemySystem → 发出 `LEVEL_COMPLETE` 事件
4. GameCoordinator → 接收事件，调用 `startLevelBossBattle()`
5. Boss → 正确生成（`HEAVY_BOMBER`）

**修改文件**：

- `src/core/GameCoordinator.ts`

---

## Second Boss Implementation (2026-02-17)

### 第二关 Boss - 沙漠堡垒 (DESERT_FORTRESS)

**实现状态**：✅ 已完成

| 属性 | 数值                        |
| ---- | --------------------------- |
| 体型 | scale 5                     |
| 血量 | 2500                        |
| 速度 | 0（地面固定）               |
| 位置 | y = -50（地面）             |
| 武器 | 四门防空炮 + 两个导弹发射器 |

### 防空炮系统 (FlakCannonSystem)

- **发射频率**：2.0 秒/发（四门轮流）
- **炮弹速度**：50
- **AOE 半径**：50
- **伤害**：15
- **特性**：
  - 不追踪目标，发射时锁定玩家当前位置
  - 炮弹飞到固定位置后爆炸
  - 玩家可通过移动躲避

### 新增文件

| File                                     | Description      |
| ---------------------------------------- | ---------------- |
| `src/features/boss/FlakCannonSystem.ts`  | 防空炮弹系统     |
| `src/features/boss/DesertFortressAI.ts`  | 沙漠堡垒 Boss AI |
| `src/__tests__/FlakCannonSystem.test.ts` | 防空炮测试       |
| `src/__tests__/DesertFortressAI.test.ts` | Boss AI 测试     |

### 修改文件

| File                                     | Change                                   |
| ---------------------------------------- | ---------------------------------------- |
| `src/features/boss/BossTypes.ts`         | 添加 DESERT_FORTRESS、FLAK_CANNON_CONFIG |
| `src/features/effects/ParticleSystem.ts` | 添加 createFlakExplosion()               |
| `src/core/Audio/AudioManager.ts`         | 添加防空炮音效                           |
| `src/core/Audio/MusicSystem.ts`          | 添加 DESERT_BOSS 音乐                    |
| `src/core/GameCoordinator.ts`            | Boss 创建和战斗逻辑                      |

---

## Recent Fixes (2026-02-17)

### Boss 音乐节奏调整

- **Issue**：Boss 音乐节奏太快
- **Fix**：BPM 减半
  - 第一关 Boss：180 → 90 BPM
  - 第二关 Boss：190 → 95 BPM
- **File**：`src/core/Audio/MusicSystem.ts`

### Boss 导弹模型重设计

- **Changes**：
  - 全新专业外观：机身 + 弹头 + 四片尾翼 + 双层火焰
  - 机身：圆柱形，前细后粗
  - 弹头：黑色锥形
  - 尾翼：四片长方形，向外展开
  - 火焰：外层橙色 + 内层黄色
- **Files**：`src/features/boss/BossMissileSystem.ts`, `src/ui/ModelPreview.ts`

### Boss 导弹转向性能

- **Issue**：导弹追踪能力太强，难以躲避
- **Fix**：`turnSpeed` 从 1.0 → 0.5 → 0.25
- **File**：`src/features/boss/BossMissileSystem.ts`

### Boss 导弹地面碰撞

- **Issue**：导弹追踪时穿过地面不销毁
- **Fix**：当 `y <= -50` 时爆炸销毁
- **File**：`src/features/boss/BossMissileSystem.ts`

### 模型预览更新

- **Changes**：
  - 添加 Boss 导弹到预览列表
  - 现在共 9 个模型：玩家 + 5 敌机 + 2 Boss + 导弹
- **File**：`src/ui/ModelPreview.ts`

### 防空炮不追踪玩家

- **Issue**：防空炮像导弹一样追踪玩家，无法躲避
- **Fix**：炮弹发射时锁定玩家当前位置，飞到固定点爆炸，不再追踪
- **File**：`src/features/boss/FlakCannonSystem.ts`

### 沙漠堡垒 Boss 高度

- **Issue**：Boss 悬空
- **Fix**：位置从 y=0 改为 y=-50（地面）
- **File**：`src/core/GameCoordinator.ts`

### 防空炮发射频率

- **Issue**：发射太快
- **Fix**：`cannonFireInterval` 从 0.5s 改为 2.0s
- **File**：`src/features/boss/BossTypes.ts`

### Boss 武器发射位置

- **Issue**：导弹和防空炮从错误位置发射
- **Fix**：
  - 防空炮：从炮管顶端发射（y=3）
  - 导弹：从两个发射井轮流发射（左/右发射井，y=4.5）
- **File**：`src/features/boss/DesertFortressAI.ts`

### 导弹发射井方向

- **Issue**：发射井横向放置
- **Fix**：改用 CylinderGeometry，竖直向上
- **File**：`src/features/boss/DesertFortressAI.ts`

### 敌人追踪指示器 Y 方向修复

- **Issue**：敌人位于飞机下方/后面时，黄色追踪指示器错误地出现在屏幕角落
- **Cause**：
  - X 方向使用 3D 世界空间计算（正确）
  - Y 方向使用投影后的 `screenPos.y`（错误）
  - 当敌人在相机后面（z > 1）时，投影坐标镜像翻转
- **Fix**：使用**相机局部坐标系**统一处理 X/Y 方向
  ```typescript
  const cameraLocal = toEnemy.clone().applyQuaternion(camera.quaternion.clone().invert());
  // cameraLocal.x: 正=右, 负=左
  // cameraLocal.y: 正=上, 负=下
  // cameraLocal.z: 正=前, 负=后
  ```
- **算法逻辑**：
  1. 计算水平角 `angleH = atan2(x, |z|)` 和垂直角 `angleV = atan2(y, |z|)`
  2. 敌人在后面：根据 `|y| > |x|` 判断放上下边缘还是左右边缘
  3. 敌人在前面但超出视野：将角度映射到屏幕位置并钳制到边缘
  4. 旋转角度基于实际角度计算，而非屏幕位置
- **File**：`src/ui/EnemyHealthBars.ts`
  - `updateOrCreateHealthBar()`：添加相机局部坐标计算
  - `updateArrowIndicator()`：完全重写，使用角度定位和旋转

---

## Third Boss Implementation (2026-02-17)

### 第三关 Boss - 八爪鱼战舰 (OCTOPUS_WARSHIP)

**实现状态**：✅ 已完成

| 属性     | 数值              |
| -------- | ----------------- |
| 体型     | scale 5           |
| 血量     | 3000 HP           |
| 速度     | 5（缓慢追踪玩家） |
| 高度     | y = 150（浮空）   |
| 模型风格 | 机械风            |

### 机制一：瞬移

- **触发条件**：被攻击后 5% 概率
- **冷却时间**：10 秒
- **目标位置**：战场范围内随机位置（x: ±400, y: 100~250, z: ±400）
- **视觉效果**：消失 + 闪烁 + 重新出现（带粒子效果）

### 机制二：全屏激光扫射

- **触发频率**：每 5 秒一次
- **预警时间**：3 秒（显示激光平面位置）
- **激光颜色**：蓝色
- **旋转速度**：60°/秒（6 秒一圈）
- **伤害**：100 HP
- **激光平面**：随机（水平/垂直/倾斜）
- **躲避方式**：玩家飞离激光平面即可

### 机制三：八只机械臂

- **数量**：8 只，均匀分布
- **独立血量**：300 HP
- **碰撞伤害**：50 HP
- **击退效果**：推远 50 米
- **碰撞冷却**：1 秒（每只独立）
- **可被攻击**：✅ 玩家/友军可攻击，可被导弹锁定
- **伤害传递**：✅ 机械臂伤害计入 Boss 本体 HP
- **被消灭效果**：爆炸 + 消失
- **长度**：~100 米

### 新增文件

| File                                     | Description                         |
| ---------------------------------------- | ----------------------------------- |
| `src/features/boss/OctopusWarshipAI.ts`  | Boss AI（移动、瞬移、激光、机械臂） |
| `src/features/boss/LaserSweepSystem.ts`  | 全屏激光扫射系统                    |
| `src/features/boss/TentacleSystem.ts`    | 机械臂系统（摆动、碰撞）            |
| `src/__tests__/OctopusWarshipAI.test.ts` | Boss AI 测试                        |
| `src/__tests__/LaserSweepSystem.test.ts` | 激光系统测试                        |
| `src/__tests__/TentacleSystem.test.ts`   | 机械臂系统测试                      |

### 修改文件

| File                                     | Change                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/features/boss/BossTypes.ts`         | 添加 OCTOPUS_WARSHIP、LASER_SWEEP_CONFIG、TENTACLE_CONFIG、TELEPORT_CONFIG                          |
| `src/features/effects/ParticleSystem.ts` | 添加 createTeleportOut()、createTeleportIn()、createLaserBeam()、createTentacleExplosion()          |
| `src/core/GameCoordinator.ts`            | Boss 创建和战斗逻辑（createOctopusWarshipBoss、updateOctopusWarshipBattle）                         |
| `src/core/Audio/MusicSystem.ts`          | 添加 OCTOPUS_BOSS 音乐（100 BPM）                                                                   |
| `src/core/Audio/AudioManager.ts`         | 添加 playTeleport()、playLaserWarning()、playLaserSweep()、playTentacleHit()、playTentacleDestroy() |
| `src/ui/ModelPreview.ts`                 | 添加 Boss 3 到预览列表                                                                              |

### Boss 音乐配置

| 关卡   | 主题       | 调式   | 波形     | BPM |
| ------ | ---------- | ------ | -------- | --- |
| Boss 1 | 紧张激烈   | E 小调 | sawtooth | 90  |
| Boss 2 | 热烈中东风 | D 小调 | sawtooth | 95  |
| Boss 3 | 空灵神秘   | E 小调 | sine     | 100 |

---

## Recent Fixes (2026-02-17) - Session 2

### 第三关 Boss 重构：触手改眼睛

**实现状态**：✅ 已完成

- 删除机械触手系统 (TentacleSystem.ts)
- 新增眼睛系统 (EyeSystem.ts)
- 8 个眼睛均匀分布，可被摧毁，发射红色激光子弹
- 眼睛 HP：300，伤害：20

### 眼睛碰撞检测修复

- **Issue**：导弹锁定眼睛但伤害打在 Boss 本体，眼睛 HP 不减少
- **Cause**：
  - `updateBossBattle()` 中有两个碰撞检查：通用 Boss 检查和眼睛专用检查
  - 通用检查先运行，如果在 `bossAllParts` 中找到眼睛，伤害打给 Boss
  - 导弹被停用后，眼睛专用检查永远不会触发
- **Fix**：将眼睛碰撞检查移到 `updateBossBattle()` 的最前面，在 Boss 本体检查之前
- **File**：`src/core/GameCoordinator.ts`
  - 新增眼睛碰撞检查代码块（导弹和机枪）
  - 移除 `updateOctopusWarshipBattle()` 中重复的玩家碰撞检查

### 激光扫射平面不一致修复

- **Issue**：预警平面显示正确倾斜角度，但激光扫射方向与预警平面不一致
- **Cause**：
  - `PlaneGeometry` 默认法线是 **+Z 轴**，不是 +Y 轴
  - 代码从 `(0, 1, 0)` 旋转到 `planeNormal`，这是错误的
- **Fix**：将 `createWarningVisual()` 中的旋转轴从 `(0, 1, 0)` 改为 `(0, 0, 1)`

  ```typescript
  // 修改前
  const up = new THREE.Vector3(0, 1, 0); // Y 轴 - 错误

  // 修改后
  const defaultNormal = new THREE.Vector3(0, 0, 1); // Z 轴 - PlaneGeometry 默认法线
  ```

- **File**：`src/features/boss/LaserSweepSystem.ts`

### Boss 击败后模型未清除修复

- **Issue**：Boss 被击败后，模型仍然显示在场景中，进入下一关时不消失
- **Cause**：`handleBossDestroy()` 设置 `this.currentBoss = null` 但从未调用 `this.currentBoss.dispose()`
  - `dispose()` 方法负责：`mesh.visible = false` 和 `mesh.parent.remove(mesh)`
  - 但这个方法只在测试文件中调用，游戏代码从未调用
- **Fix**：在 `handleBossDestroy()` 中添加 `this.currentBoss?.dispose()` 调用
  ```typescript
  this.hud.showPowerUpBig('🏆', 'Boss 已击败！');
  this.currentBoss?.dispose(); // 新增：移除 Boss 模型
  this.currentBoss = null;
  ```
- **影响范围**：所有三个 Boss（HeavyBomber、DesertFortress、OctopusWarship）
- **File**：`src/core/GameCoordinator.ts`

### 修改文件汇总

| File                                    | Change                                 |
| --------------------------------------- | -------------------------------------- |
| `src/features/boss/LaserSweepSystem.ts` | 修复预警平面旋转轴（Y → Z）            |
| `src/core/GameCoordinator.ts`           | 眼睛碰撞检查前置 + Boss dispose() 调用 |
| `src/features/boss/TentacleSystem.ts`   | 已删除                                 |
| `src/features/boss/EyeSystem.ts`        | 新建 - 眼睛系统                        |
| `src/__tests__/TentacleSystem.test.ts`  | 已删除                                 |

### 关键代码位置

| 功能              | 文件                                   | 行号/方法                 |
| ----------------- | -------------------------------------- | ------------------------- |
| 眼睛碰撞检查      | `GameCoordinator.ts`                   | `updateBossBattle()` 开头 |
| 激光预警平面旋转  | `LaserSweepSystem.ts`                  | `createWarningVisual()`   |
| Boss 模型清理     | `GameCoordinator.ts`                   | `handleBossDestroy()`     |
| Boss dispose 方法 | `BossAI.ts`, `DesertFortressAI.ts`, 等 | `dispose()` 方法          |
