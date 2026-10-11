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
 * （src/core/dev/BalanceHarness.ts，贪心购买升级）实测调校——波次中每分钟受到的伤害约为最大
 * 生命值的 4%（第 1 关）、8-11%（第 2-5 关）、14-17%（第 6-9 关），第 10 关约 20% 最高；
 * 不会躲避的脚本飞行员第 1-3 关不阵亡，第 8-10 关通常每关阵亡 1-2 次。“非常简单”约为普通的
 * 0.35 倍（整轮战役通常一次都不被击落），“专家”约 2 倍。单关单次测量波动很大，看多次跑的平均。
 * 伤害 × 冷却共同决定敌方火力：DPS 倍率 ≈ enemyDamageMultiplier / enemyAttackCooldownMultiplier。
 */
const DIFFICULTY_PROFILES: Record<DifficultyProfile['level'], DifficultyProfile> = {
  1: {
    level: 1,
    label: { en: 'Very Easy', zh: '非常简单' },
    enemyHealthMultiplier: 0.72,
    enemyDamageMultiplier: 0.22,
    enemyAttackCooldownMultiplier: 1.9,
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
  /**
   * 单位（地面 / 海上 / 空中单位）伤害相对 enemyDamageMultiplier 的份额：单位的单发伤害大
   * （炸弹、自杀无人机、地空导弹），后期涨幅比敌机缓一些，避免一次失误就满血归零。
   */
  unitDamageShare: number;
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
 *
 * 伤害 ÷ 冷却（敌方火力）按 BalanceHarness 实测反推：每关压力（波次中每分钟受伤占最大生命值
 * 的百分比）≈ k(关卡) × 伤害 ÷ 冷却。k 由本关编成与玩家已买到的生命 / 装甲决定：第 1-3 关约 6，
 * 第 4-6 关约 3-3.4，第 7-9 关约 1.6-1.8，第 10 关约 1.2（满级升级的玩家清波最快）。
 * 所以敌方火力在第 4 关、第 7 关和第 10 关各上一个台阶，目标是压力逐关上升约 15%、第 10 关最高。
 * 单关测量波动很大（单次跑约 ±40%），按多次跑的平均看趋势。
 * 单位火力 = 伤害 × unitDamageShare ÷ 冷却：单发伤害逐关不降、后期涨幅比敌机缓。
 */
const LEVEL_CURVE: Readonly<Record<LevelCurveKey, readonly number[]>> = {
  //                       L1    L2    L3    L4    L5    L6    L7    L8    L9    L10
  enemyHealthMultiplier: [1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.21, 1.24, 1.27],
  enemyDamageMultiplier: [1.0, 1.11, 1.13, 2.12, 2.38, 2.95, 4.73, 4.79, 5.25, 7.48],
  enemyCooldownMultiplier: [1.0, 0.95, 0.92, 0.8, 0.78, 0.72, 0.56, 0.55, 0.5, 0.44],
  enemyAccuracyBonus: [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24, 0.27],
  enemyAimLead: [0, 0.28, 0.38, 0.5, 0.6, 0.68, 0.76, 0.82, 0.88, 0.94],
  concurrentEnemyBonus: [0, 0, 0, 1, 1, 1, 2, 2, 2, 2],
  unitHealthMultiplier: [1.0, 1.02, 1.04, 1.06, 1.08, 1.1, 1.12, 1.14, 1.16, 1.18],
  unitDamageShare: [1.0, 0.92, 0.91, 0.9, 0.87, 0.73, 0.64, 0.64, 0.64, 0.6],
  bossCooldownMultiplier: [1.0, 0.98, 0.96, 0.94, 0.92, 0.89, 0.87, 0.85, 0.82, 0.8],
  scoreMultiplier: [1.0, 1.12, 1.24, 1.36, 1.48, 1.6, 1.72, 1.84, 1.96, 2.08],
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
    unitDamageShare: pick('unitDamageShare'),
    bossCooldownMultiplier: pick('bossCooldownMultiplier'),
    scoreMultiplier: pick('scoreMultiplier'),
  };
}
