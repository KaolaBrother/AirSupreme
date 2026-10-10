import { EnemyType } from '../EnemyTypes';
import type { IEnemyDoctrine } from './DoctrineTypes';
import { AceDoctrine } from './AceDoctrine';
import { FighterDoctrine } from './FighterDoctrine';
import { HeavyDoctrine } from './HeavyDoctrine';
import { JammerDoctrine } from './JammerDoctrine';
import { ScoutDoctrine } from './ScoutDoctrine';
import { SniperDoctrine } from './SniperDoctrine';
import { StrikerDoctrine } from './StrikerDoctrine';
import { WraithDoctrine } from './WraithDoctrine';

/** 机型 → 条令。每架敌机一份独立实例（条令带状态）。 */
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
    case EnemyType.STRIKER:
      return new StrikerDoctrine();
    case EnemyType.JAMMER:
      return new JammerDoctrine();
    case EnemyType.WRAITH:
      return new WraithDoctrine();
    case EnemyType.FIGHTER:
    default:
      return new FighterDoctrine();
  }
}
