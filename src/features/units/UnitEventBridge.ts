import { EventBus, GameEventType } from '@/core/EventBus';
import { Faction } from '@/core/Faction';
import type { UnitSystem } from './UnitSystem';

/**
 * 集成辅助：把 UnitSystem 的开火回调接入现有 EventBus。
 *
 * CombatSystem 已订阅 ENEMY_FIRED / FRIENDLY_FIRED 并把子弹送入敌方子弹池
 * （敌方子弹命中玩家 / 友军，友军子弹命中敌机），协调器也会据此播放射击音效。
 * 单独成文件，避免 UnitSystem 本身依赖 EventBus（保持逻辑可在无 DOM 环境测试）。
 *
 * 返回解除函数：恢复接入前的 onUnitFire。
 */
export function bridgeUnitFireToEventBus(system: UnitSystem): () => void {
  const previous = system.onUnitFire;
  system.onUnitFire = (position, direction, damage, faction, owner) => {
    previous?.(position, direction, damage, faction, owner);
    const payload = { position, direction, damage, faction, owner };
    if (faction === Faction.FRIENDLY) {
      EventBus.emit(GameEventType.FRIENDLY_FIRED, payload);
    } else {
      EventBus.emit(GameEventType.ENEMY_FIRED, payload);
    }
  };
  return () => {
    system.onUnitFire = previous;
  };
}
