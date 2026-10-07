export interface DifficultyProfile {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyAttackCooldownMultiplier: number;
  powerUpDropMultiplier: number;
  bossCooldownMultiplier: number;
}

const DIFFICULTY_PROFILES: Record<DifficultyProfile['level'], DifficultyProfile> = {
  1: {
    level: 1,
    label: '简单',
    enemyHealthMultiplier: 0.8,
    enemyDamageMultiplier: 0.75,
    enemyAttackCooldownMultiplier: 1.1,
    powerUpDropMultiplier: 1.25,
    bossCooldownMultiplier: 1.15,
  },
  2: {
    level: 2,
    label: '普通',
    enemyHealthMultiplier: 0.9,
    enemyDamageMultiplier: 0.9,
    enemyAttackCooldownMultiplier: 1.05,
    powerUpDropMultiplier: 1.1,
    bossCooldownMultiplier: 1.08,
  },
  3: {
    level: 3,
    label: '标准',
    enemyHealthMultiplier: 1,
    enemyDamageMultiplier: 1,
    enemyAttackCooldownMultiplier: 1,
    powerUpDropMultiplier: 1,
    bossCooldownMultiplier: 1,
  },
  4: {
    level: 4,
    label: '困难',
    enemyHealthMultiplier: 1.15,
    enemyDamageMultiplier: 1.1,
    enemyAttackCooldownMultiplier: 0.95,
    powerUpDropMultiplier: 0.9,
    bossCooldownMultiplier: 0.92,
  },
  5: {
    level: 5,
    label: '专家',
    enemyHealthMultiplier: 1.3,
    enemyDamageMultiplier: 1.25,
    enemyAttackCooldownMultiplier: 0.9,
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
  /** 地面 / 海上单位血量倍率 */
  unitHealthMultiplier: number;
  /** Boss 武器冷却倍率（< 1 表示更频繁） */
  bossCooldownMultiplier: number;
  /** 得分倍率：后期敌人更强，奖励同步提高以支撑升级节奏 */
  scoreMultiplier: number;
}

/** 战役最高关卡（与 CampaignData.TOTAL_LEVELS 保持一致） */
export const CAMPAIGN_LEVEL_CAP = 10;

export function getLevelScaling(level: number): LevelScaling {
  const safeLevel = Number.isFinite(level) ? level : 1;
  const clampedLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_CAP, Math.round(safeLevel)));
  const progress = (clampedLevel - 1) / (CAMPAIGN_LEVEL_CAP - 1);

  return {
    level: clampedLevel,
    progress,
    enemyHealthMultiplier: 1 + 0.9 * progress,
    enemyDamageMultiplier: 1 + 0.6 * progress,
    enemyCooldownMultiplier: 1 - 0.25 * progress,
    enemyAccuracyBonus: 0.15 * progress,
    unitHealthMultiplier: 1 + 0.8 * progress,
    bossCooldownMultiplier: 1 - 0.2 * progress,
    scoreMultiplier: 1 + 0.5 * progress,
  };
}
