import { GAME_CONSTANTS } from '@/config';

/**
 * 敌机武器弹种（经 ENEMY_FIRED 事件送入共享的敌方子弹池）：
 * - bullet：普通机炮弹（点射 / 尾炮），与原先的单发子弹一致
 * - heavy-shell：重型机的高炮弹——又慢又大的红橙色光球，靠机动躲开
 * - lance：狙击机的蓄力长枪弹——极快，沿冻结的瞄准线飞行
 */
export type EnemyWeaponKind = 'bullet' | 'heavy-shell' | 'lance';

export interface EnemyWeaponSpec {
  /** 弹速（米/秒） */
  readonly speed: number;
  /** 最大飞行距离（米）：超过后回收 */
  readonly maxDistance: number;
  /** 弹体自身的命中半径（米），叠加到目标的命中半径上 */
  readonly radius: number;
  /** 高速弹：按本步扫过的线段判定命中，不会从目标身上跳过去 */
  readonly swept: boolean;
}

/** 弹种数值的唯一来源：条令按它算提前量，子弹池按它飞行 */
export const ENEMY_WEAPON_SPECS: Readonly<Record<EnemyWeaponKind, EnemyWeaponSpec>> = {
  bullet: {
    speed: GAME_CONSTANTS.PROJECTILE.SPEED,
    maxDistance: GAME_CONSTANTS.PROJECTILE.MAX_DISTANCE,
    radius: 0,
    swept: false,
  },
  'heavy-shell': {
    speed: 60,
    // 6 秒多一点的寿命：射程之外的慢速弹不再占着共享子弹池
    maxDistance: 380,
    radius: 1.2,
    swept: false,
  },
  lance: {
    speed: 320,
    maxDistance: 700,
    radius: 0.5,
    swept: true,
  },
};

export function isEnemyWeaponKind(value: unknown): value is EnemyWeaponKind {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(ENEMY_WEAPON_SPECS, value)
  );
}
