import { EnemyType } from '../EnemyTypes';
import type { IEnemyDoctrine } from './DoctrineTypes';
import { AceDoctrine } from './AceDoctrine';
import { FighterDoctrine } from './FighterDoctrine';
import { HeavyDoctrine } from './HeavyDoctrine';
import { ScoutDoctrine } from './ScoutDoctrine';
import { SniperDoctrine } from './SniperDoctrine';

/**
 * 机型 → 条令。每架敌机一份独立实例（条令带状态）。
 *
 * JAMMER / STRIKER / WRAITH 的专属条令在里程碑 2 加入；在那之前它们沿用战斗机条令
 * （波次表不会生成它们，只有开发钩子能生成）。
 */
export function createJetDoctrine(type: EnemyType): IEnemyDoctrine {
  switch (type) {
    case EnemyType.SCOUT:
      return new ScoutDoctrine();
    case EnemyType.HEAVY:
      return new HeavyDoctrine();
    case EnemyType.SNIPER:
      return new SniperDoctrine();
    case EnemyType.ACE:
      return new AceDoctrine();
    case EnemyType.FIGHTER:
    case EnemyType.JAMMER:
    case EnemyType.STRIKER:
    case EnemyType.WRAITH:
    default:
      return new FighterDoctrine();
  }
}
