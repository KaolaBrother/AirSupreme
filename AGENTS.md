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
