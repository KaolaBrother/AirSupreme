import { describe, it, expect } from 'vitest';
import { IGameSystem } from '@/core/interfaces/IGameSystem';

describe('IGameSystem Interface', () => {
  it('should define required properties', () => {
    const system: IGameSystem = {
      name: 'TestSystem',
      init: () => {},
      update: (_deltaTime: number) => {},
      dispose: () => {},
    };

    expect(system.name).toBe('TestSystem');
    expect(typeof system.init).toBe('function');
    expect(typeof system.update).toBe('function');
    expect(typeof system.dispose).toBe('function');
  });
});
