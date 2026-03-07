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
