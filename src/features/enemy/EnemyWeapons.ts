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

/**
 * 敌机（王牌 / 导弹机）发射的追踪导弹：走单位导弹池（UnitSystem.launchJetMissile），所以
 * HUD 的“锁定中 → 来袭”预警、热焰弹、EMP、近防炮对它照常生效。
 *
 * 以地空导弹为基准（伤害 36、最大速度 92、转向 1.7 弧度/秒、寿命 9 秒）略微削弱：
 * 伤害更低、转得更慢（更容易靠急转甩开）、稍慢一点；寿命相同，够得着 700 米外的导弹机。
 */
export const JET_MISSILE_SPEC = {
  /** 基础伤害：发射时再乘以与地空导弹相同的关卡 / 难度倍率 */
  DAMAGE: 30,
  MAX_SPEED: 88,
  /** 转向角速度（弧度/秒） */
  TURN_RATE: 1.4,
  /** 寿命（秒） */
  LIFE: 9,
  /** 离架初速（米/秒） */
  LAUNCH_SPEED: 55,
  /** 离架点：机头前方这么远（米），不从机体里钻出来 */
  MUZZLE_OFFSET: 6,
} as const;

/** 全队导弹令牌：同时飞向玩家的敌机导弹数上限 */
export const JET_MISSILE_RULES = {
  /** 1–5 关 */
  EARLY_CAP: 1,
  /** 6–10 关 */
  LATE_CAP: 2,
  LATE_LEVEL: 6,
} as const;
