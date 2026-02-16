import { vi } from 'vitest';

vi.mock('@/features/effects/ParticleTrailRenderer', () => ({
  ParticleTrailRenderer: vi.fn().mockImplementation(() => ({
    addPoint: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}));
