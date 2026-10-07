import { SPECIAL_WEAPON_IDS, type SpecialWeaponId } from '@/core/CombatContracts';

/**
 * 特殊武器类型与数值曲线
 *
 * - salvo：按下扳机瞬间齐射（集束火箭、蜂群导弹）
 * - beam：按住持续照射，积累热量（脉冲激光）
 * - charge：按住蓄力，松开发射（电磁轨道炮）
 * - pulse：按下释放范围脉冲（电磁脉冲）
 *
 * 数值按 0..5 级升级单调增强；弹药 / 装填 / 冷却统一以“秒”和“发（齐射）”为单位。
 */

export { SPECIAL_WEAPON_IDS };
export type { SpecialWeaponId };

export type SpecialWeaponMode = 'salvo' | 'beam' | 'charge' | 'pulse';

export interface SpecialWeaponConfig {
  id: SpecialWeaponId;
  name: string;
  shortCode: string;
  icon: string;
  description: string;
  mode: SpecialWeaponMode;
  maxUpgradeLevel: 5;
}

export interface SpecialWeaponStats {
  /** salvo：每枚弹头伤害；beam：每秒伤害；charge：满蓄力伤害；pulse：对导弹 / 无人机的伤害 */
  damage: number;
  /** 最大射程 / 索敌距离（米） */
  range: number;
  /** 两次射击 / 脉冲之间的冷却（秒） */
  cooldown: number;
  /** 弹药上限（salvo 以“次齐射”计）；热量武器为 Infinity */
  maxAmmo: number;
  /** 补充 1 发弹药所需时间（秒）；热量武器为 0 */
  reloadTime: number;
  /** 每次齐射的火箭 / 微型导弹数量 */
  projectileCount: number;
  /** 爆炸溅射半径（米） */
  splashRadius: number;
  /** 蓄满所需时间（秒） */
  chargeTime: number;
  /** 持续照射时每秒积累的热量（0..1 满载） */
  heatPerSecond: number;
  /** 每秒散热量 */
  coolPerSecond: number;
  /** EMP 瘫痪时长（秒） */
  stunSeconds: number;
  /** EMP 作用半径（米） */
  radius: number;
}

export const SPECIAL_WEAPON_MAX_UPGRADE_LEVEL = 5;

export const SPECIAL_WEAPON_CONFIGS: Record<SpecialWeaponId, SpecialWeaponConfig> = {
  rockets: {
    id: 'rockets',
    name: '集束火箭',
    shortCode: 'RKT',
    icon: '🚀',
    description: '按 F 齐射一组无制导火箭，命中、近炸或飞抵射程尽头时爆炸，范围杀伤装甲车队。',
    mode: 'salvo',
    maxUpgradeLevel: 5,
  },
  laser: {
    id: 'laser',
    name: '脉冲激光',
    shortCode: 'LSR',
    icon: '🔆',
    description: '按住 F 持续照射，灼烧光束上的第一个目标；热量满载会强制冷却。',
    mode: 'beam',
    maxUpgradeLevel: 5,
  },
  swarm: {
    id: 'swarm',
    name: '蜂群导弹',
    shortCode: 'SWM',
    icon: '🐝',
    description: '按 F 齐射一群微型导弹，自动分配给前方锥形范围内的不同敌方目标。',
    mode: 'salvo',
    maxUpgradeLevel: 5,
  },
  railgun: {
    id: 'railgun',
    name: '电磁轨道炮',
    shortCode: 'RLG',
    icon: '☄️',
    description: '按住 F 蓄力，松开射出瞬时穿甲弹，贯穿弹道上的所有目标；蓄力越满伤害越高。',
    mode: 'charge',
    maxUpgradeLevel: 5,
  },
  emp: {
    id: 'emp',
    name: '电磁脉冲',
    shortCode: 'EMP',
    icon: '🌀',
    description: '按 F 释放电磁脉冲，瘫痪范围内的敌方单位与来袭导弹，并迫使隐形目标现形。',
    mode: 'pulse',
    maxUpgradeLevel: 5,
  },
};

/** 每项数值的 0..5 级取值表（必须单调不变差） */
type StatTable = {
  [K in keyof SpecialWeaponStats]:
    | number
    | readonly [number, number, number, number, number, number];
};

/**
 * 平衡说明（对照：主炮约 42 DPS，锁定导弹 50 伤害，普通敌机 60-300 血，Boss 2000-9000 血）
 * - 火箭：单次齐射满中约 144-480 伤害，适合压制地面 / 海上编队
 * - 激光：70-125 DPS，持续约 4-5.7 秒后过热
 * - 蜂群：每轮 6-12 枚自动分配目标，清理成群的小目标
 * - 轨道炮：满蓄力 260-430 穿透伤害，对 Boss 与直线编队最有效
 * - EMP：大范围瘫痪 3-5.5 秒，并对导弹 / 无人机造成少量伤害
 */
const STAT_TABLES: Record<SpecialWeaponId, StatTable> = {
  rockets: {
    damage: [24, 27, 30, 33, 36, 40],
    range: [520, 550, 580, 610, 640, 680],
    cooldown: [0.85, 0.8, 0.75, 0.7, 0.65, 0.6],
    maxAmmo: [4, 4, 5, 5, 6, 6],
    reloadTime: [6, 5.6, 5.2, 4.8, 4.4, 4],
    projectileCount: [6, 7, 8, 9, 10, 12],
    splashRadius: [9, 9.5, 10, 11, 12, 13],
    chargeTime: 0,
    heatPerSecond: 0,
    coolPerSecond: 0,
    stunSeconds: 0,
    radius: 0,
  },
  laser: {
    damage: [70, 80, 90, 100, 112, 125],
    range: [420, 450, 480, 510, 540, 580],
    cooldown: 0,
    maxAmmo: Infinity,
    reloadTime: 0,
    projectileCount: 1,
    splashRadius: 0,
    chargeTime: 0,
    heatPerSecond: [0.25, 0.235, 0.22, 0.205, 0.19, 0.175],
    coolPerSecond: [0.34, 0.37, 0.4, 0.44, 0.48, 0.52],
    stunSeconds: 0,
    radius: 0,
  },
  swarm: {
    damage: [26, 29, 32, 35, 38, 42],
    range: [460, 490, 520, 550, 580, 620],
    cooldown: [1.2, 1.12, 1.04, 0.96, 0.88, 0.8],
    maxAmmo: [3, 3, 4, 4, 5, 5],
    reloadTime: [9, 8.4, 7.8, 7.2, 6.6, 6],
    projectileCount: [6, 7, 8, 9, 10, 12],
    splashRadius: [6, 6.5, 7, 7.5, 8, 9],
    chargeTime: 0,
    heatPerSecond: 0,
    coolPerSecond: 0,
    stunSeconds: 0,
    radius: 0,
  },
  railgun: {
    damage: [260, 290, 320, 355, 390, 430],
    range: [900, 960, 1020, 1080, 1140, 1200],
    cooldown: [1, 0.94, 0.88, 0.82, 0.76, 0.7],
    maxAmmo: [3, 3, 4, 4, 5, 5],
    reloadTime: [7, 6.6, 6.2, 5.8, 5.4, 5],
    projectileCount: 1,
    splashRadius: 0,
    chargeTime: [1.3, 1.22, 1.14, 1.06, 0.98, 0.9],
    heatPerSecond: 0,
    coolPerSecond: 0,
    stunSeconds: 0,
    radius: 0,
  },
  emp: {
    damage: [30, 36, 42, 48, 54, 60],
    range: [160, 172, 184, 196, 208, 220],
    cooldown: [10, 9.2, 8.4, 7.6, 6.8, 6],
    maxAmmo: [2, 2, 2, 3, 3, 3],
    reloadTime: [32, 30, 28, 26, 24, 22],
    projectileCount: 1,
    splashRadius: 0,
    chargeTime: 0,
    heatPerSecond: 0,
    coolPerSecond: 0,
    stunSeconds: [3, 3.5, 4, 4.5, 5, 5.5],
    radius: [160, 172, 184, 196, 208, 220],
  },
};

/** 钳制升级等级：NaN → 0，小数向下取整，超出范围夹到 0..5 */
export function clampWeaponUpgradeLevel(level: number): number {
  if (Number.isNaN(level)) {
    return 0;
  }
  return Math.max(0, Math.min(SPECIAL_WEAPON_MAX_UPGRADE_LEVEL, Math.floor(level)));
}

/** 运行时校验武器 id（存档 / 外部输入） */
export function isSpecialWeaponId(value: unknown): value is SpecialWeaponId {
  return typeof value === 'string' && (SPECIAL_WEAPON_IDS as readonly string[]).includes(value);
}

/** 热量武器（无弹药上限） */
export function isHeatBasedMode(mode: SpecialWeaponMode): boolean {
  return mode === 'beam';
}

/**
 * 取某武器在指定升级等级的数值（每次返回新对象，可安全修改）
 */
export function getSpecialWeaponStats(
  id: SpecialWeaponId,
  upgradeLevel: number
): SpecialWeaponStats {
  const table = STAT_TABLES[id] ?? STAT_TABLES.rockets;
  const level = clampWeaponUpgradeLevel(upgradeLevel);
  const pick = (key: keyof SpecialWeaponStats): number => {
    const entry = table[key];
    return typeof entry === 'number' ? entry : entry[level];
  };

  return {
    damage: pick('damage'),
    range: pick('range'),
    cooldown: pick('cooldown'),
    maxAmmo: pick('maxAmmo'),
    reloadTime: pick('reloadTime'),
    projectileCount: pick('projectileCount'),
    splashRadius: pick('splashRadius'),
    chargeTime: pick('chargeTime'),
    heatPerSecond: pick('heatPerSecond'),
    coolPerSecond: pick('coolPerSecond'),
    stunSeconds: pick('stunSeconds'),
    radius: pick('radius'),
  };
}
