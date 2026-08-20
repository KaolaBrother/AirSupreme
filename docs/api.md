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

## Browser debug handles

When running the game, `window.game` exposes the coordinator for console inspection.
