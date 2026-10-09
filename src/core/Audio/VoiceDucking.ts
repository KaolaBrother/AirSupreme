/**
 * 配音 → 音乐的闪避桥（VoiceSystem 与 MusicSystem 互不引用）。
 *
 * 与音效的 musicDuckingBridge（固定时长的短促闪避）不同，这里是“保持型”闪避：
 * 配音开始时把音乐压到 level（0..1 的增益倍数），说完再请求 level = 1 恢复；
 * 恢复可以带延迟（delaySeconds），连续几句无线电之间的短暂停顿里音乐不会忽大忽小。
 * 新的请求总是覆盖尚未执行的旧请求。新建的 MusicSystem 用 getLevel() 继承当前闪避量。
 */

export type VoiceDuckListener = (level: number, rampSeconds: number, delaySeconds: number) => void;

const listeners = new Set<VoiceDuckListener>();
let currentLevel = 1;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export const voiceDuckBridge = {
  subscribe(listener: VoiceDuckListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * 请求音乐增益倍数：level 1 = 不闪避；rampSeconds 为过渡时长；delaySeconds 后才开始过渡。
   * 非有限值按安全缺省处理（level → 1，时长 → 0）。
   */
  set(level: number, rampSeconds: number, delaySeconds: number = 0): void {
    const safeLevel = Math.max(0, Math.min(1, finiteOr(level, 1)));
    const safeRamp = Math.max(0, finiteOr(rampSeconds, 0));
    const safeDelay = Math.max(0, finiteOr(delaySeconds, 0));
    currentLevel = safeLevel;
    for (const listener of Array.from(listeners)) {
      try {
        listener(safeLevel, safeRamp, safeDelay);
      } catch {
        // 某个监听者失败不影响其余
      }
    }
  },

  /** 最近一次请求的目标倍数（新建的音乐总线以此为初值） */
  getLevel(): number {
    return currentLevel;
  },

  /** 测试隔离：清空监听者并回到不闪避 */
  resetForTests(): void {
    listeners.clear();
    currentLevel = 1;
  },
};
