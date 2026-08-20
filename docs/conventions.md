# Conventions

## Coding

- Strict TypeScript. Avoid `any` unless there is no practical alternative.
- Three.js: `import * as THREE from 'three';`
- App imports: prefer `@/`. Same-feature imports: relative paths.
- Classes/enums `PascalCase`, methods/variables `camelCase`, constants `UPPER_SNAKE_CASE`, interfaces `IPascalCase`.
- Comments/JSDoc in Chinese when useful; identifiers in English.
- Semicolons, single quotes, trailing commas, print width about 100.
- Runtime systems implement `IGameSystem`. Cross-system communication uses `EventBus`, not hidden direct graphs.
- Pools for projectiles, enemies, particles, indicators.
- Aircraft rotation: quaternions, not Euler.
- Validate positions; reject `NaN` / `Infinity`.

## Testing and review

- Meaningful changes finish with `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`.
- Whoever implements a behavior does not author its tests.
- Do not merge to `main` unless explicitly asked. Confirm the current branch with `git branch --show-current`.

## Agent execution

- Main session is PM: split, assign disjoint files, integrate, validate.
- Medium/large rounds use Batch A (visuals), Batch B (combat/feedback), Batch C (runtime/tests). Shared files serialize.
- Update `IMPLEMENTATION_PLAN.md` when work changes plan state.

## Adding content

- New enemy type: `EnemyTypes.ts` enum + `ENEMY_CONFIGS`, then wave rules in spawn selection.
- New weapon: `WEAPONS` in `src/config.ts`, then player fire wiring.
- New powerup: `PowerUpType`, manager effect, and config.
- New terrain: `TerrainType`, `LevelConfig.ts`, `TerrainGenerator` / worldscape.
- Balance: prefer `public/config/game-config.json` and existing config objects over new hardcoded constants.

## Git

Suggested commit subject: `type(scope): short description`. Keep the body factual. Do not commit unless asked.
