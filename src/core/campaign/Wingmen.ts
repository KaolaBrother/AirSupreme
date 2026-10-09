import type { LocalizedText } from '@/i18n';

/**
 * 具名僚机编队：在场的前两架友军喷气机是玩家的僚机——
 * 「渡鸦」Raven（杰克·默瑟中尉 Lt. Jack Mercer）与「雨燕」Swift（弗蕾娅·林德奎斯特中尉
 * Lt. Freya Lindqvist）。同时在场的其余友机（第三架起）是普通友军。
 *
 * 只负责“哪架友机是哪名僚机、谁还在空中”；飞行与作战行为仍由 FriendlyAI 决定。
 */

export type WingmanId = 'raven' | 'swift';

/** 入列 / 被击落（无线电与语音挂钩） */
export type WingmanEvent = 'joined' | 'down';

export interface WingmanProfile {
  readonly id: WingmanId;
  /** 呼号：友机血条标签（mesh.userData.displayName）与提示文案 */
  readonly callsign: LocalizedText;
  /** 从第几关起随队出击（战役数据标注加入章节时改这里） */
  readonly joinsAtLevel: number;
}

/** 编队顺序即入列顺序：先渡鸦，后雨燕 */
export const WINGMEN: readonly WingmanProfile[] = [
  { id: 'raven', callsign: { en: 'Raven', zh: '渡鸦' }, joinsAtLevel: 1 },
  { id: 'swift', callsign: { en: 'Swift', zh: '雨燕' }, joinsAtLevel: 1 },
];

/** 只读视图：无线电 / 语音据此判断某名僚机此刻是否在空中 */
export interface WingmanStatus {
  isFlying(id: WingmanId): boolean;
}

/**
 * 僚机名册：新友机按编队顺序领取第一个可用的僚机身份（已随队、不在空中、本关未被击落），
 * 没有可用身份时是普通友机。僚机被击落后本关不再出现，换关 / 清场后重新归队。
 */
export class WingmanRoster implements WingmanStatus {
  /** 友机 id（网格 uuid，与 FRIENDLY_SPAWNED / FRIENDLY_DEATH 的 friendlyId 一致）→ 僚机 */
  private readonly flying = new Map<string, WingmanProfile>();
  private readonly downed = new Set<WingmanId>();

  constructor(private readonly profiles: readonly WingmanProfile[] = WINGMEN) {}

  /** 新友机入场：返回它的僚机身份；null 表示普通友机 */
  public assign(friendlyId: string, level: number): WingmanProfile | null {
    for (const profile of this.profiles) {
      if (profile.joinsAtLevel > level) continue;
      if (this.downed.has(profile.id) || this.isFlying(profile.id)) continue;
      this.flying.set(friendlyId, profile);
      return profile;
    }
    return null;
  }

  /** 友机坠毁：是僚机则记为本关被击落并返回其身份；普通友机返回 null */
  public release(friendlyId: string): WingmanProfile | null {
    const profile = this.flying.get(friendlyId);
    if (!profile) return null;
    this.flying.delete(friendlyId);
    this.downed.add(profile.id);
    return profile;
  }

  /** 友机全部撤场（换关 / 读档 / Boss 击破）：僚机全部归队 */
  public reset(): void {
    this.flying.clear();
    this.downed.clear();
  }

  public isFlying(id: WingmanId): boolean {
    for (const profile of this.flying.values()) {
      if (profile.id === id) return true;
    }
    return false;
  }
}
