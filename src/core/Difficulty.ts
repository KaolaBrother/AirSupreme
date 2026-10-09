import type { LocalizedText } from '@/i18n';

export interface DifficultyProfile {
  level: 1 | 2 | 3 | 4 | 5;
  /** 难度名（中英双语，逐档一一对应）：Very Easy 非常简单 → Easy 简单 → Normal 普通 → Hard 困难 → Expert 专家 */
  label: LocalizedText;
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyAttackCooldownMultiplier: number;
  powerUpDropMultiplier: number;
  bossCooldownMultiplier: number;
}

/**
 * 难度档（开始菜单的“难度”设置）：在关卡曲线之上整体缩放敌人（敌机、地面 / 海上单位、Boss）。
 *
 * 敌机 / 单位的基础数值（EnemyTypes、UnitBehaviors、BossTypes）按“专家”手感编写；
 * 各档把伤害与开火频率映射到对应的玩家水平。“普通”（Normal）是默认档：由脚本飞行员
 * （src/core/dev/BalanceHarness.ts）实测调校为“称职的普通玩家每关最多损失约一条命”。
 * 伤害 × 冷却共同决定敌方火力：DPS 倍率 ≈ enemyDamageMultiplier / enemyAttackCooldownMultiplier。
 */
const DIFFICULTY_PROFILES: Record<DifficultyProfile['level'], DifficultyProfile> = {
  1: {
    level: 1,
    label: { en: 'Very Easy', zh: '非常简单' },
    enemyHealthMultiplier: 0.8,
    enemyDamageMultiplier: 0.35,
    enemyAttackCooldownMultiplier: 1.7,
    powerUpDropMultiplier: 1.25,
    bossCooldownMultiplier: 1.2,
  },
  2: {
    level: 2,
    label: { en: 'Easy', zh: '简单' },
    enemyHealthMultiplier: 0.9,
    enemyDamageMultiplier: 0.42,
    enemyAttackCooldownMultiplier: 1.6,
    powerUpDropMultiplier: 1.1,
    bossCooldownMultiplier: 1.1,
  },
  3: {
    level: 3,
    label: { en: 'Normal', zh: '普通' },
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 0.5,
    enemyAttackCooldownMultiplier: 1.5,
    powerUpDropMultiplier: 1,
    bossCooldownMultiplier: 1,
  },
  4: {
    level: 4,
    label: { en: 'Hard', zh: '困难' },
    enemyHealthMultiplier: 1.12,
    enemyDamageMultiplier: 0.62,
    enemyAttackCooldownMultiplier: 1.35,
    powerUpDropMultiplier: 0.9,
    bossCooldownMultiplier: 0.92,
  },
  5: {
    level: 5,
    label: { en: 'Expert', zh: '专家' },
    enemyHealthMultiplier: 1.25,
    enemyDamageMultiplier: 0.78,
    enemyAttackCooldownMultiplier: 1.2,
    powerUpDropMultiplier: 0.85,
    bossCooldownMultiplier: 0.85,
  },
};

export function getDifficultyProfile(level: number): DifficultyProfile {
  const normalizedLevel = Math.max(1, Math.min(5, Math.round(level))) as DifficultyProfile['level'];
  return DIFFICULTY_PROFILES[normalizedLevel];
}

/**
 * 战役关卡强度曲线（与玩家选择的难度档叠乘）。
 * 第 1 关为基准 1.0，第 10 关达到上限；玩家升级上限也按关卡同步解锁，
 * 两条曲线一起推进，保证后期关卡“更难但打得过”。
 */
export interface LevelScaling {
  /** 关卡号（已钳制到 1..CAMPAIGN_LEVEL_CAP） */
  level: number;
  /** 0（第 1 关）→ 1（第 10 关）的归一化进度 */
  progress: number;
  /** 普通敌机 / 敌方单位血量倍率 */
  enemyHealthMultiplier: number;
  /** 普通敌机 / 敌方单位伤害倍率 */
  enemyDamageMultiplier: number;
  /** 攻击冷却倍率（< 1 表示开火更频繁） */
  enemyCooldownMultiplier: number;
  /** 命中精度加成（叠加到 0-1 的 accuracy 上） */
  enemyAccuracyBonus: number;
  /**
   * 敌机射击提前量 0..1：0 = 瞄准玩家当前位置（只有直线对飞 / 追尾才打得中），
   * 1 = 按一阶拦截点完整提前。随关卡提高——后期敌机“会算提前量”，玩家必须机动规避。
   */
  enemyAimLead: number;
  /** 同时在场敌机上限的加成（叠加到 GameConfig.getMaxEnemies() 的桌面 / 移动端基础值上） */
  concurrentEnemyBonus: number;
  /** 地面 / 海上单位血量倍率 */
  unitHealthMultiplier: number;
  /** Boss 武器冷却倍率（< 1 表示更频繁） */
  bossCooldownMultiplier: number;
  /** 得分倍率：后期敌人更强，奖励同步提高以支撑升级节奏 */
  scoreMultiplier: number;
}

/** 战役最高关卡（与 CampaignData.TOTAL_LEVELS 保持一致） */
export const CAMPAIGN_LEVEL_CAP = 10;

type LevelCurveKey = Exclude<keyof LevelScaling, 'level' | 'progress'>;

/**
 * 关卡强度曲线：每列对应第 1..10 关，全部逐关平衡数值集中在这一张表里。
 * 第 1 关恒为基准（倍率 1、加成 0）；逐关单调变难（冷却倍率单调变小）。
 *
 * 压力主要来自“同一时刻的火力密度”：后期敌机提前量更足、同时在场更多、伤害与射速更高；
 * 血量涨幅压低（关卡时长由敌人数量决定，波次编成见 LevelConfig / UnitDeployments），
 * 避免关卡越拖越长、把压力稀释掉。玩家这一侧的成长见 UpgradeSystem（层级上限随关卡开放）。
 */
const LEVEL_CURVE: Readonly<Record<LevelCurveKey, readonly number[]>> = {
  //                       L1    L2    L3    L4    L5    L6    L7    L8    L9    L10
  enemyHealthMultiplier: [1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.21, 1.24, 1.27],
  enemyDamageMultiplier: [1.0, 1.5, 1.68, 1.98, 2.2, 2.6, 2.9, 3.2, 3.5, 3.9],
  enemyCooldownMultiplier: [1.0, 0.93, 0.87, 0.82, 0.78, 0.74, 0.7, 0.67, 0.64, 0.62],
  enemyAccuracyBonus: [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24, 0.27],
  enemyAimLead: [0, 0.2, 0.35, 0.5, 0.6, 0.68, 0.76, 0.82, 0.88, 0.94],
  concurrentEnemyBonus: [0, 0, 0, 1, 1, 1, 2, 2, 2, 2],
  unitHealthMultiplier: [1.0, 1.02, 1.04, 1.06, 1.08, 1.1, 1.12, 1.14, 1.16, 1.18],
  bossCooldownMultiplier: [1.0, 0.98, 0.96, 0.94, 0.92, 0.89, 0.87, 0.85, 0.82, 0.8],
  scoreMultiplier: [1.0, 1.06, 1.11, 1.17, 1.22, 1.28, 1.33, 1.39, 1.44, 1.5],
};

export function getLevelScaling(level: number): LevelScaling {
  const safeLevel = Number.isFinite(level) ? level : 1;
  const clampedLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_CAP, Math.round(safeLevel)));
  const index = clampedLevel - 1;
  const pick = (key: LevelCurveKey): number => LEVEL_CURVE[key][index];

  return {
    level: clampedLevel,
    progress: index / (CAMPAIGN_LEVEL_CAP - 1),
    enemyHealthMultiplier: pick('enemyHealthMultiplier'),
    enemyDamageMultiplier: pick('enemyDamageMultiplier'),
    enemyCooldownMultiplier: pick('enemyCooldownMultiplier'),
    enemyAccuracyBonus: pick('enemyAccuracyBonus'),
    enemyAimLead: pick('enemyAimLead'),
    concurrentEnemyBonus: pick('concurrentEnemyBonus'),
    unitHealthMultiplier: pick('unitHealthMultiplier'),
    bossCooldownMultiplier: pick('bossCooldownMultiplier'),
    scoreMultiplier: pick('scoreMultiplier'),
  };
}
