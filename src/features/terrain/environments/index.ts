/**
 * 地形环境注册表：TerrainType → TerrainEnvironment 工厂。
 * TerrainGenerator.generateTerrain() 对表中的地形类型走环境模块分支；
 * 第 1-5 关的地形仍由 TerrainGenerator 内部的专用生成函数负责。
 */
import { TerrainType } from '../LevelConfig';
import type { TerrainEnvironment, TerrainEnvironmentFactory } from './TerrainEnvironment';
import { CanyonEnvironment } from './CanyonEnvironment';
import { CitadelEnvironment } from './CitadelEnvironment';
import { StratosphereEnvironment } from './StratosphereEnvironment';
import { VolcanoEnvironment } from './VolcanoEnvironment';

export const TERRAIN_ENVIRONMENT_FACTORIES: Readonly<
  Partial<Record<TerrainType, TerrainEnvironmentFactory>>
> = {
  [TerrainType.VOLCANO]: () => new VolcanoEnvironment(),
  [TerrainType.CANYON]: () => new CanyonEnvironment(),
  [TerrainType.STRATOSPHERE]: () => new StratosphereEnvironment(),
  [TerrainType.CITADEL]: () => new CitadelEnvironment(),
};

/** 该地形类型是否由环境模块构建 */
export function hasTerrainEnvironment(terrain: TerrainType): boolean {
  return TERRAIN_ENVIRONMENT_FACTORIES[terrain] !== undefined;
}

/** 创建环境实例；未注册的地形返回 null */
export function createTerrainEnvironment(terrain: TerrainType): TerrainEnvironment | null {
  const factory = TERRAIN_ENVIRONMENT_FACTORIES[terrain];
  return factory ? factory() : null;
}

export type {
  TerrainEnvironment,
  TerrainEnvironmentContext,
  TerrainEnvironmentFactory,
  TerrainSurfaceSample,
} from './TerrainEnvironment';
export { sampleEnvironmentSurface } from './TerrainEnvironment';
