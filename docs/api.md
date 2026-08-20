# API

This game has no HTTP API. Contracts below are in-process.

## EventBus

Source of truth: `src/core/EventBus.ts`.

```typescript
import { EventBus, GameEventType } from '@/core/EventBus';

EventBus.on(GameEventType.ENEMY_DEATH, ({ payload }) => {
  // payload.config.scoreValue, payload.enemyId, payload.position
});

EventBus.emit(GameEventType.SCORE_CHANGED, { score: 100, delta: 10 });
```

Event names include player fire/hit/death/respawn; enemy and friendly spawn/fire/hit/death; missile fire/hit; wave and level complete; powerup collect/expire; balloon destroyed; shield activate/deactivate; score changed. Payload shapes are `GameEventPayloads` in the same file — read that file, do not copy the enum into agent instructions.

## Config

- Runtime constants: `src/config.ts` (`PLAYER_STATS`, `WEAPONS`, `MISSILE`, device profiles)
- External JSON: `public/config/game-config.json` via `src/core/utils/ConfigLoader.ts`

```typescript
import { configLoader } from '@/core/utils/ConfigLoader';

await configLoader.load();
const playerConfig = configLoader.getPlayer();
const enemyConfig = configLoader.getEnemy('FIGHTER');
```

Enemy type tables live in `src/features/enemy/EnemyTypes.ts`. Level terrain params live in `src/features/terrain/LevelConfig.ts`.

## Logger

```typescript
import { getLogger } from '@/core/utils/Logger';

const log = getLogger('MyModule');
log.debug('debug', { data: 123 });
log.info('info');
log.warn('warn');
log.error('error');
```

## Crash surface

Source: `src/features/terrain/TerrainGenerator.ts`, `src/features/levels/LevelManager.ts`, `src/core/systems/PlayerSystem.ts`.

```typescript
/** worldscape 高度场局部 0（水位）对应的世界 Y */
export const WORLDSCAPE_WATER_Y = -48;

// TerrainGenerator / LevelManager
public getCrashSurfaceY(worldX: number, worldZ: number): number;

// PlayerSystem — 注入活地形/水面高度采样；未设置时坠毁判定回落到 WORLDSCAPE_WATER_Y
setCrashSurfaceSampler(sampler: (x: number, z: number) => number): void;
```

Kill condition: world `Y <=` sampled surface. `GameCoordinator` wires:

```typescript
this.playerSystem.setCrashSurfaceSampler(
  (x, z) => this.enemySystem?.getLevelManager().getCrashSurfaceY(x, z) ?? WORLDSCAPE_WATER_Y,
);
```

`TerrainGenerator.getCrashSurfaceY` uses the heightfield (`WORLDSCAPE_WATER_Y + heightAt`); no field → `WORLDSCAPE_WATER_Y`. `LevelManager.getCrashSurfaceY` forwards to the generator, or `WORLDSCAPE_WATER_Y` if terrain is not loaded.

## HUD tokens and layout

Source: `src/ui/theme/hudTokens.ts`. `injectHudTokens()` appends a `<style id="hud-tokens">` once.

```typescript
export type HudLayoutDensity = 'desktop' | 'touch-landscape' | 'touch-portrait';
export type LockOnState = 'search' | 'track' | 'lock' | 'break' | 'dry';

export const HUD_COLORS = {
  sys: '#8FE4FF',
  weapon: '#FFB347',
  lock: '#5CFFB0',
  lockRgb: 'rgb(92, 255, 176)',
  threat: '#FF4D4D',
  ally: '#F4D35E',
  glass: 'rgba(8,14,24,0.72)',
  edge: 'rgba(143,228,255,0.28)',
  text: '#EEF8FF',
  muted: 'rgba(183,231,255,0.86)',
  shadow: '0 12px 24px rgba(0, 0, 0, 0.28)',
} as const;

export function injectHudTokens(): void;
export function detectHudLayoutDensity(): HudLayoutDensity;

// HUD / LockOnIndicator
public setLayoutDensity(density: HudLayoutDensity): void;
```

`:root` variables include `--hud-sys #8FE4FF`, `--hud-weapon #FFB347`, `--hud-lock #5CFFB0`, `--hud-threat #FF4D4D`, `--hud-ally #F4D35E`. DRY lock chrome text is `NO MSL`. Callers of `injectHudTokens()`: `HUD`, `LockOnIndicator`, `PauseMenu`, `PresentationController`.

`PauseMenu` has no `setLayoutDensity`.

## Missile lock audio

Source: `src/core/Audio/AudioManager.ts`.

```typescript
export enum SoundType {
  // ...
  MISSILE_LOCK_BREAK = 'MISSILE_LOCK_BREAK',
  MISSILE_DRY = 'MISSILE_DRY',
  // ...
}

public playMissileLockBreak(): void;
public playMissileDry(): void;
```

`GameCoordinator` calls `playMissileDry()` when missile count is 0 and the missile input is held, and `playMissileLockBreak()` on transition into lock state `'break'`.

## Browser debug handles

When running the game, `window.game` exposes the coordinator for console inspection.
