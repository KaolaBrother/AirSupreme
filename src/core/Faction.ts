/**
 * 阵营枚举
 *
 * 用于区分不同阵营的单位，处理碰撞和伤害逻辑
 */
export enum Faction {
  /**
   * 敌军阵营 - 玩家控制的敌方单位
   */
  ENEMY = 'ENEMY',

  /**
   * 友军阵营 - 协助玩家的AI单位
   */
  FRIENDLY = 'FRIENDLY',

  /**
   * 中立阵营 - 玩家单位（玩家）
   */
  NEUTRAL = 'NEUTRAL',
}

/**
 * 检查两个阵营是否敌对
 * @param faction1 第一个阵营
 * @param faction2 第二个阵营
 * @returns 是否敌对（true = 可造成伤害）
 */
export function areHostile(faction1: Faction, faction2: Faction): boolean {
  // 友军和中立（玩家）不互相伤害
  if ((faction1 === Faction.FRIENDLY && faction2 === Faction.NEUTRAL) ||
      (faction1 === Faction.NEUTRAL && faction2 === Faction.FRIENDLY)) {
    return false;
  }

  // 其他所有组合都敌对（包括敌军vs友军、敌军vs玩家）
  return true;
}
