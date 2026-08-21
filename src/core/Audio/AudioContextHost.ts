import { getLogger } from '@/core/utils/Logger';

const log = getLogger('AudioContextHost');

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const holders = new Set<object>();
let sharedContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const audioWindow = window as WebkitAudioWindow;
  return audioWindow.AudioContext || audioWindow.webkitAudioContext;
}

/** Safari 会在路由切换后报告 `'interrupted'`，标准 lib 不一定包含该状态。 */
function audioContextNeedsResume(context: AudioContext): boolean {
  const state = context.state as string;
  return state === 'suspended' || state === 'interrupted';
}

function dropClosedSharedContext(): void {
  if (sharedContext && sharedContext.state === 'closed') {
    sharedContext = null;
    holders.clear();
  }
}

function closeSharedContext(): void {
  const context = sharedContext;
  sharedContext = null;
  if (!context || context.state === 'closed') {
    return;
  }
  void context.close().catch(() => {
    // 关闭失败不影响后续重建
  });
}

/**
 * 确保存在可复用的 AudioContext；已关闭的实例视为缺失。
 */
function ensureSharedAudioContext(): AudioContext | null {
  dropClosedSharedContext();
  if (sharedContext) {
    return sharedContext;
  }

  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    log.warn('Web Audio API not supported');
    return null;
  }

  try {
    sharedContext = new AudioContextCtor();
    return sharedContext;
  } catch {
    log.warn('Web Audio API not supported');
    sharedContext = null;
    return null;
  }
}

function resumeContext(context: AudioContext): void {
  if (!audioContextNeedsResume(context)) {
    return;
  }
  void context.resume().catch(() => {
    log.warn('AudioContext resume blocked by autoplay policy');
  });
}

/**
 * 返回当前共享 AudioContext；尚未创建或已关闭时为 null。
 */
export function getSharedAudioContext(): AudioContext | null {
  dropClosedSharedContext();
  return sharedContext;
}

/**
 * 为持有者获取共享 AudioContext（引用计数，最后一位释放时关闭）。
 */
export function acquireSharedAudioContext(holder: object): AudioContext | null {
  const context = ensureSharedAudioContext();
  if (!context) {
    return null;
  }
  holders.add(holder);
  return context;
}

/**
 * 释放持有者对共享 AudioContext 的引用。
 */
export function releaseSharedAudioContext(holder: object): void {
  if (!holders.delete(holder)) {
    return;
  }
  dropClosedSharedContext();
  if (holders.size === 0) {
    closeSharedContext();
  }
}

/** 若共享上下文处于 suspended / interrupted，则调用 resume()。 */
export function resumeSharedAudioContext(): void {
  const context = getSharedAudioContext();
  if (!context) {
    return;
  }
  resumeContext(context);
}

/**
 * 在用户手势栈上创建（如需要）并 resume 共享 AudioContext。
 * 解锁本身不占用 holder，允许后续 AudioManager / MusicSystem 接管。
 */
export function unlockAudioFromUserGesture(): void {
  const context = ensureSharedAudioContext();
  if (!context) {
    return;
  }
  resumeContext(context);
}

/**
 * 测试隔离：清空 holder，关闭仍存活的上下文，并丢掉单例。
 */
export function resetSharedAudioContextForTests(): void {
  holders.clear();
  closeSharedContext();
}
