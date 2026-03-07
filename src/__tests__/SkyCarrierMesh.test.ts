import { describe, expect, it } from 'vitest';
import { BOSS_CONFIGS, BossType } from '@/features/boss/BossTypes';
import { createSkyCarrierMesh } from '@/features/boss/SkyCarrierAI';

describe('createSkyCarrierMesh', () => {
  it('should keep key runtime nodes and a rich final-boss structure', () => {
    const mesh = createSkyCarrierMesh(BOSS_CONFIGS[BossType.SKY_CARRIER]);

    expect(mesh.children.length).toBeGreaterThanOrEqual(45);

    const requiredNodes = [
      'carrier_deck_core_glow',
      'carrier_island_beacon',
      'carrier_missile_glow_left',
      'carrier_missile_glow_right',
      'carrier_engine_core_0',
      'carrier_engine_core_1',
      'carrier_engine_core_2',
      'carrier_engine_core_3',
      'carrier_cannon_muzzle_left',
      'carrier_cannon_muzzle_right',
      'carrier_keel',
      'carrier_keel_core',
      'carrier_side_sponson_left',
      'carrier_side_sponson_right',
      'carrier_hangar_bay_left',
      'carrier_hangar_bay_right',
      'carrier_engine_pylon_0',
      'carrier_engine_pylon_1',
      'carrier_engine_pylon_2',
      'carrier_engine_pylon_3',
    ];

    for (const nodeName of requiredNodes) {
      expect(mesh.getObjectByName(nodeName), nodeName).toBeTruthy();
    }
  });
});
