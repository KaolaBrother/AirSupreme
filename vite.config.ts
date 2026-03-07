import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/features/terrain/TerrainGenerator.ts')) {
            return 'terrain';
          }

          if (id.includes('/src/scenes/GameScene.ts')) {
            return 'scene-core';
          }

          if (id.includes('/node_modules/three/src/renderers/')) {
            return 'vendor-three-renderers';
          }

          if (
            id.includes('/node_modules/three/src/geometries/')
            || id.includes('/node_modules/three/src/objects/')
          ) {
            return 'vendor-three-geo';
          }

          if (
            id.includes('/node_modules/three/src/math/')
            || id.includes('/node_modules/three/src/core/')
          ) {
            return 'vendor-three-core';
          }

          if (id.includes('/node_modules/three/')) {
            return 'vendor-three';
          }

          if (id.includes('node_modules')) {
            return 'vendor';
          }

          if (
            id.includes('/src/features/boss/BossAI.ts')
            || id.includes('/src/features/boss/DesertFortressAI.ts')
            || id.includes('/src/features/boss/OctopusWarshipAI.ts')
            || id.includes('/src/features/boss/MissileDestroyerAI.ts')
            || id.includes('/src/features/boss/SkyCarrierAI.ts')
            || id.includes('/src/core/BossBattleController.ts')
          ) {
            return 'boss';
          }

          if (id.includes('/src/core/Audio/')) {
            return 'audio';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: true, // 允许局域网访问（移动端测试）
    port: 3000,
  },
});
