import { createOutputChain } from '@/core/Audio/AudioKit';
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
 * 永久手势恢复监听的事件。按 HTML 规范，触屏上的 pointerdown / touchstart 不算激活手势，
 * pointerup / touchend / keydown 才算；click 兜底。
 */
const GESTURE_RECOVERY_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;
let lifecycleInstalled = false;

/** 页面重新可见：恢复被系统挂起 / 打断的共享上下文 */
function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    resumeSharedAudioContext();
  }
}

/** pageshow / focus / 用户手势：同步 resume（落在手势栈上），不拦截事件，也不新建上下文 */
function handleAudioRecovery(): void {
  resumeSharedAudioContext();
}

/**
 * 页面级音频生命周期：启动时安装一次，重复调用不再加监听，监听永不移除。
 * - 页面重新可见、pageshow、focus 时恢复被挂起 / 打断的共享 AudioContext；
 * - 捕获阶段监听 pointerup / touchend / click / keydown，在手势栈上同步 resume。
 *   切后台、锁屏回来后，菜单 / 暂停 / 剧情卡这类不播声的界面上第一次操作也能把声音找回来。
 * 只恢复已存在的上下文，从不新建；已在运行或已关闭时什么也不做。
 */
export function installAudioLifecycle(): void {
  if (lifecycleInstalled || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  lifecycleInstalled = true;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handleAudioRecovery);
  window.addEventListener('focus', handleAudioRecovery);
  for (const type of GESTURE_RECOVERY_EVENTS) {
    window.addEventListener(type, handleAudioRecovery, true);
  }
}

const outputNodes = new WeakMap<BaseAudioContext, AudioNode>();

/**
 * 共享输出总线入口（限幅器 + 软削波 → destination）。
 * 音效与音乐都汇入同一条链路，密集战斗叠加时总输出也不会削波；每个上下文只建一次。
 */
export function getSharedOutputNode(context: BaseAudioContext): AudioNode {
  const cached = outputNodes.get(context);
  if (cached) {
    return cached;
  }
  const node = createOutputChain(context, context.destination).input;
  outputNodes.set(context, node);
  return node;
}

/**
 * 测试隔离：清空 holder，关闭仍存活的上下文，并丢掉单例。
 */
export function resetSharedAudioContextForTests(): void {
  holders.clear();
  closeSharedContext();
}
