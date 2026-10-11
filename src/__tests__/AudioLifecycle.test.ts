import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioManager } from '@/core/Audio/AudioManager';
import {
  createGesture,
  flushTasks,
  GESTURE_TYPES,
  installDelayedAudioContext,
  installPageReturnEvents,
  type DelayedAudioRig,
  type FakeContextState,
  type FakeLifecycleAudioContext,
  type GestureType,
  type PageReturnEvents,
} from './audioLifecycleRig';
import { trackListeners, type ListenerTracker } from './listenerTracker';
import { watchUnhandledRejections, type RejectionWatch } from './menuTestUtils';

/**
 * 音频生命周期：Android 平板（Chrome）上回到主屏 / 锁屏之后，音乐与音效有时回不来。
 *
 * 合约：
 * 1. 回到前台就恢复。页面启动时装一次安装器（幂等：再装一次不加监听）。之后 document 的
 *    visibilitychange 且 visibilityState === 'visible'，或 window 的 pageshow / focus，
 *    共享上下文存在且处于 'suspended' / 'interrupted' 时调用它的 resume()；没有上下文、
 *    在运行或已关闭时什么也不做；转入后台（hidden）不调用 resume()。
 * 2. 手势永远能救回来。同一安装器在 window 上挂捕获阶段的 pointerup / touchend / click / keydown
 *    监听，永不摘除：处理函数返回之前同步调用 resume()（条件同上）；从不 preventDefault /
 *    stopPropagation；上下文在运行 / 已关闭 / 不存在时什么也不做，也从不新建 AudioContext。
 * 3. 引擎声跟着回来。startEngine 之后（期间没有 stopEngine）因为上下文没在运行而没响的引擎，
 *    在上下文变成 'running' 之后的第一次 updateEngine 时启动；stopEngine 取消这个意愿。
 * 4. resume() 的拒绝都被接住（没有未处理的拒绝）；已在运行的上下文一切照旧。
 *
 * 替身见 audioLifecycleRig.ts：resume() 在之后的微任务里才改状态，可以停在原状态、一直挂着
 * 或被拒绝。被测模块每个用例重新载入（vi.resetModules），所以“每页一次”的安装状态不会串到
 * 下一个用例；安装器挂上的监听在用例结束时由监听登记簿逐个摘掉。
 */

/** 安装器在 AudioContextHost.ts 里的导出名；实现若用了别的名字，只改这一行 */
const INSTALLER_EXPORT = 'installAudioLifecycle';

type HostModule = typeof import('@/core/Audio/AudioContextHost');

function resolveInstaller(host: HostModule): () => void {
  const installer = (host as unknown as Record<string, unknown>)[INSTALLER_EXPORT];
  if (typeof installer !== 'function') {
    throw new Error(`AudioContextHost should export ${INSTALLER_EXPORT}()`);
  }
  return installer as () => void;
}

type ReturnEvent = 'visible' | 'pageshow' | 'focus';
const RETURN_EVENTS: readonly ReturnEvent[] = ['visible', 'pageshow', 'focus'];
const NEEDS_RESUME: readonly FakeContextState[] = ['suspended', 'interrupted'];

describe('audio lifecycle: the shared AudioContext comes back after the page does', () => {
  let rig: DelayedAudioRig;
  let page: PageReturnEvents;
  let listeners: ListenerTracker;
  let rejections: RejectionWatch;
  let listenerErrors: unknown[];
  let host: HostModule;
  let audio: AudioManager | null;
  let target: HTMLButtonElement;
  const holder = {};

  const onListenerError = (event: ErrorEvent): void => {
    listenerErrors.push(event.error ?? event.message);
    event.preventDefault();
  };

  function install(): void {
    resolveInstaller(host)();
  }

  /** 让共享上下文以给定状态存在（不经过 resume） */
  function createSharedContext(state: FakeContextState): FakeLifecycleAudioContext {
    rig.initialState = state;
    host.acquireSharedAudioContext(holder);
    const context = rig.latest();
    expect(host.getSharedAudioContext()).toBe(context as unknown as AudioContext);
    return context;
  }

  function fireReturn(event: ReturnEvent): void {
    if (event === 'visible') {
      page.show();
    } else if (event === 'pageshow') {
      page.pageShow();
    } else {
      page.focus();
    }
  }

  function gesture(type: GestureType): Event {
    const event = createGesture(type);
    target.dispatchEvent(event);
    return event;
  }

  async function loadAudioManager(): Promise<AudioManager> {
    const { AudioManager: AudioManagerClass } = await import('@/core/Audio/AudioManager');
    audio = new AudioManagerClass();
    return audio;
  }

  beforeEach(async () => {
    listenerErrors = [];
    audio = null;
    window.addEventListener('error', onListenerError);
    listeners = trackListeners();
    rejections = watchUnhandledRejections();
    rig = installDelayedAudioContext();
    page = installPageReturnEvents();
    vi.resetModules();
    host = await import('@/core/Audio/AudioContextHost');
    target = document.createElement('button');
    target.id = 'lifecycle-target';
    document.body.appendChild(target);
  });

  afterEach(async () => {
    audio?.dispose();
    audio = null;
    host.resetSharedAudioContextForTests();
    await flushTasks();
    const errors = [...listenerErrors];
    const unhandled = [...rejections.seen];

    // 先还原全局，再断言（断言失败不能留下监听）
    for (const entry of [...listeners.live]) {
      entry.target.removeEventListener(
        entry.type,
        entry.listener as EventListenerOrEventListenerObject,
        entry.capture
      );
    }
    listeners.stop();
    rejections.stop();
    page.restore();
    rig.restore();
    window.removeEventListener('error', onListenerError);
    document.body.innerHTML = '';
    vi.doUnmock('@/ui/StartMenu');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    expect(errors, 'no event listener may throw').toEqual([]);
    expect(unhandled, 'every rejected resume() must be caught').toEqual([]);
  });

  describe('resume on return (contract 1)', () => {
    for (const event of RETURN_EVENTS) {
      for (const state of NEEDS_RESUME) {
        it(`calls resume() when the page returns (${event}) and the context is ${state}`, async () => {
          install();
          const context = createSharedContext(state);

          fireReturn(event);
          await flushTasks();

          expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
          expect(context.state).toBe('running');
        });
      }
    }

    it('does not call resume() when the page goes to the background', async () => {
      install();
      const context = createSharedContext('suspended');

      page.hide();
      await flushTasks();

      expect(context.resumeCalls).toBe(0);
      expect(context.state).toBe('suspended');
    });

    it('does nothing on return while no AudioContext exists, and does not create one', async () => {
      install();

      page.hide();
      page.show();
      page.pageShow();
      page.focus();
      await flushTasks();

      expect(rig.contexts).toHaveLength(0);
      expect(host.getSharedAudioContext()).toBeNull();
    });

    it('leaves a running context alone on return', async () => {
      install();
      const context = createSharedContext('running');

      page.hide();
      page.show();
      page.pageShow();
      page.focus();
      await flushTasks();

      expect(context.resumeCalls).toBe(0);
      expect(context.stateChanges).toBe(0);
      expect(context.state).toBe('running');
    });

    it('leaves a closed context alone on return and does not build a new one', async () => {
      install();
      const context = createSharedContext('running');
      context.force('closed');

      page.show();
      page.pageShow();
      page.focus();
      await flushTasks();

      expect(context.resumeCalls).toBe(0);
      expect(rig.contexts).toHaveLength(1);
    });

    it('acts on the context that exists when the page returns, not the one at install time', async () => {
      install();
      const first = createSharedContext('suspended');
      page.hide();
      page.show();
      await flushTasks();
      expect(first.resumeCalls).toBeGreaterThanOrEqual(1);
      expect(first.state).toBe('running');

      // 上下文被关闭重建（例如最后一位持有者释放后又有人要声音）
      host.resetSharedAudioContextForTests();
      const second = createSharedContext('interrupted');
      expect(second).not.toBe(first);
      page.hide();
      page.show();
      await flushTasks();

      expect(second.resumeCalls).toBeGreaterThanOrEqual(1);
      expect(second.state).toBe('running');
    });
  });

  describe('gesture recovery, forever (contract 2)', () => {
    for (const type of GESTURE_TYPES) {
      for (const state of NEEDS_RESUME) {
        it(`${type} calls resume() before its handler returns when the context is ${state}`, async () => {
          install();
          const context = createSharedContext(state);
          let callsSeenAtTarget = -1;
          target.addEventListener(type, () => {
            callsSeenAtTarget = context.resumeCalls;
          });

          gesture(type);
          const callsWhenDispatchReturned = context.resumeCalls;

          expect(
            callsSeenAtTarget,
            'resume() runs in the capture phase, before the target'
          ).toBeGreaterThanOrEqual(1);
          expect(callsWhenDispatchReturned).toBeGreaterThanOrEqual(1);
          expect(context.state, 'the fake changes state only on a later microtask').toBe(state);
          await flushTasks();
          expect(context.state).toBe('running');
        });
      }

      it(`${type} is never default-prevented or stopped by the recovery listener`, () => {
        install();
        const context = createSharedContext('suspended');
        let targetRan = false;
        let bubbledToDocument = false;
        target.addEventListener(type, () => {
          targetRan = true;
        });
        const onDocument = (): void => {
          bubbledToDocument = true;
        };
        document.addEventListener(type, onDocument);

        const event = createGesture(type);
        const notCancelled = target.dispatchEvent(event);
        document.removeEventListener(type, onDocument);

        expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
        expect(event.defaultPrevented).toBe(false);
        expect(notCancelled).toBe(true);
        expect(targetRan, 'target listeners still run').toBe(true);
        expect(bubbledToDocument, 'the event keeps bubbling').toBe(true);
      });

      it(`${type} resumes even when the page's own handler stops the event (capture phase)`, () => {
        install();
        const context = createSharedContext('interrupted');
        target.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
        });

        gesture(type);

        expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
      });
    }

    it('keeps working after repeated interruptions: the 2nd, 5th, ... gesture still resumes', async () => {
      install();
      const context = createSharedContext('running');

      for (let round = 1; round <= 8; round++) {
        const type = GESTURE_TYPES[round % GESTURE_TYPES.length];
        context.force(round % 2 === 0 ? 'interrupted' : 'suspended');
        const before = context.resumeCalls;

        gesture(type);
        await flushTasks();

        expect(context.resumeCalls, `round ${round} (${type})`).toBeGreaterThan(before);
        expect(context.state, `round ${round} (${type})`).toBe('running');
      }
    });

    it('calls resume() again on every gesture while the context stays interrupted', async () => {
      install();
      const context = createSharedContext('interrupted');
      rig.resumeOutcome = 'stay';

      for (let tap = 1; tap <= 4; tap++) {
        const before = context.resumeCalls;
        gesture('touchend');
        await flushTasks();
        expect(context.resumeCalls, `tap ${tap}`).toBeGreaterThan(before);
        expect(context.state, `tap ${tap}`).toBe('interrupted');
      }

      rig.resumeOutcome = 'run';
      gesture('touchend');
      await flushTasks();
      expect(context.state, 'the 5th tap brings it back').toBe('running');
    });

    it('a gesture still calls resume() while an earlier resume() has not settled', async () => {
      install();
      const context = createSharedContext('interrupted');
      rig.resumeOutcome = 'pending';
      page.hide();
      page.show();
      await flushTasks();
      const before = context.resumeCalls;
      expect(context.state).toBe('interrupted');

      rig.resumeOutcome = 'run';
      gesture('touchend');

      expect(context.resumeCalls, 'no in-flight guard may swallow the gesture').toBe(before + 1);
      await flushTasks();
      expect(context.state).toBe('running');
    });

    it('gestures leave a running context alone', async () => {
      install();
      const context = createSharedContext('running');

      for (const type of GESTURE_TYPES) {
        gesture(type);
      }
      await flushTasks();

      expect(context.resumeCalls).toBe(0);
      expect(context.stateChanges).toBe(0);
    });

    it('gestures do nothing and never create an AudioContext when none exists', async () => {
      install();

      for (const type of GESTURE_TYPES) {
        gesture(type);
      }
      await flushTasks();

      expect(rig.contexts).toHaveLength(0);
      expect(host.getSharedAudioContext()).toBeNull();
    });

    it('gestures leave a closed context alone and do not build a new one', async () => {
      install();
      const context = createSharedContext('running');
      context.force('closed');

      for (const type of GESTURE_TYPES) {
        gesture(type);
      }
      await flushTasks();

      expect(context.resumeCalls).toBe(0);
      expect(rig.contexts).toHaveLength(1);
    });
  });

  describe('installer', () => {
    it('a second install adds no listeners: one gesture or one return still means one resume()', async () => {
      install();
      const afterFirst = listeners.live.length;
      install();
      expect(listeners.live.length).toBe(afterFirst);

      const context = createSharedContext('suspended');
      rig.resumeOutcome = 'stay';
      gesture('touchend');
      expect(context.resumeCalls).toBe(1);

      page.hide();
      page.show();
      await flushTasks();
      expect(context.resumeCalls).toBe(2);
    });

    it('runs at boot: once src/main.ts has loaded, return and touchend resume the context', async () => {
      // 菜单换成替身（它的开始键自己会解锁音频）。菜单音乐保留真的：它只在第一次
      // pointerdown / keydown / touchstart 时解锁，不碰下面用到的 visibilitychange 与 touchend，
      // 而且安装器放在 MenuMusic.install() 里也算“页面启动时装上”
      vi.doMock('@/ui/StartMenu', () => ({
        StartMenu: class {
          setOnStart(): void {}
          setOnContinue(): void {}
          show(): void {}
          hide(): void {}
          reloadFromStorage(): void {}
          whenLaunched(): Promise<void> {
            return Promise.resolve();
          }
        },
      }));
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) =>
        kind.includes('webgl')
          ? ({} as RenderingContext)
          : null) as HTMLCanvasElement['getContext']);
      vi.stubGlobal('requestIdleCallback', () => 1);

      vi.resetModules();
      await import('@/main');
      host = await import('@/core/Audio/AudioContextHost');
      await flushTasks();

      const context = createSharedContext('interrupted');
      page.hide();
      page.show();
      await flushTasks();
      expect(context.resumeCalls, 'visible → resume()').toBeGreaterThanOrEqual(1);
      expect(context.state).toBe('running');

      context.force('suspended');
      const before = context.resumeCalls;
      gesture('touchend');
      expect(context.resumeCalls, 'touchend → resume()').toBeGreaterThan(before);
      await flushTasks();
      expect(context.state).toBe('running');
    });
  });

  describe('recovery stories', () => {
    it('running → the OS interrupts → hidden → visible: the context is running again', async () => {
      install();
      host.unlockAudioFromUserGesture();
      await flushTasks();
      const context = rig.latest();
      expect(context.state).toBe('running');

      context.force('interrupted');
      const before = context.resumeCalls;
      page.hide();
      await flushTasks();
      expect(context.resumeCalls, 'hidden: no resume()').toBe(before);
      expect(context.state).toBe('interrupted');

      page.show();
      await flushTasks();
      expect(context.resumeCalls).toBeGreaterThan(before);
      expect(context.state).toBe('running');
    });

    it('when the visible-resume does not take, the context stays interrupted until a touchend', async () => {
      install();
      const context = createSharedContext('running');
      context.force('interrupted');
      page.hide();

      rig.resumeOutcome = 'stay';
      page.show();
      await flushTasks();
      expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
      expect(context.state).toBe('interrupted');

      rig.resumeOutcome = 'run';
      const before = context.resumeCalls;
      gesture('touchend');
      expect(context.resumeCalls).toBe(before + 1);
      await flushTasks();
      expect(context.state).toBe('running');
    });

    it('when the visible-resume is rejected, nothing leaks and a touchend still recovers', async () => {
      install();
      const context = createSharedContext('running');
      context.force('interrupted');
      page.hide();

      rig.resumeOutcome = 'reject';
      page.show();
      await flushTasks();
      expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
      expect(context.state).toBe('interrupted');
      expect(rejections.seen).toEqual([]);

      rig.resumeOutcome = 'run';
      gesture('touchend');
      await flushTasks();
      expect(context.state).toBe('running');
    });

    it('the engine wanted during an interruption plays on the first frame after the page returns', async () => {
      install();
      const manager = await loadAudioManager();
      manager.resume();
      await flushTasks();
      const context = rig.latest();
      expect(context.state).toBe('running');

      // 复活（startEngine）恰好发生在被系统打断的时候
      context.force('interrupted');
      page.hide();
      manager.startEngine();
      manager.updateEngine(40);
      expect(rig.liveOscillators()).toBe(0);

      page.show();
      await flushTasks();
      expect(context.state).toBe('running');
      manager.updateEngine(40);

      expect(rig.liveOscillators(), 'the engine drone is playing').toBeGreaterThan(0);
    });
  });

  describe('rejections are caught (contract 4)', () => {
    for (const event of RETURN_EVENTS) {
      it(`a rejected resume() on return (${event}) is caught`, async () => {
        install();
        const context = createSharedContext('suspended');
        rig.resumeOutcome = 'reject';

        fireReturn(event);
        await flushTasks();

        expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
        expect(context.state).toBe('suspended');
        expect(rejections.seen).toEqual([]);
      });
    }

    for (const type of GESTURE_TYPES) {
      it(`a rejected resume() from ${type} is caught`, async () => {
        install();
        const context = createSharedContext('interrupted');
        rig.resumeOutcome = 'reject';

        gesture(type);
        await flushTasks();

        expect(context.resumeCalls).toBeGreaterThanOrEqual(1);
        expect(rejections.seen).toEqual([]);
      });
    }
  });

  describe('engine recovers (contract 3)', () => {
    for (const state of NEEDS_RESUME) {
      it(`startEngine() while ${state} plays nothing; the first updateEngine() once running starts it`, async () => {
        const manager = await loadAudioManager();
        rig.initialState = state;

        manager.startEngine();
        manager.updateEngine(30);
        manager.updateEngine(30);
        expect(rig.liveOscillators(), 'no engine while the context is not running').toBe(0);

        host.resumeSharedAudioContext();
        await flushTasks();
        expect(rig.latest().state).toBe('running');
        manager.updateEngine(30);

        const playing = rig.liveOscillators();
        expect(playing, 'the engine starts on the first update after resume').toBeGreaterThan(0);

        manager.updateEngine(60);
        manager.updateEngine(60);
        expect(rig.liveOscillators(), 'later updates do not start a second engine').toBe(playing);
      });
    }

    it('stopEngine() cancels the wish: a context that resumes while paused starts no engine', async () => {
      const manager = await loadAudioManager();

      manager.startEngine();
      manager.stopEngine();
      host.resumeSharedAudioContext();
      await flushTasks();
      expect(rig.latest().state).toBe('running');
      manager.updateEngine(30);
      manager.updateEngine(30);

      expect(rig.liveOscillators()).toBe(0);
    });

    it('a wish re-armed after stopEngine() starts exactly one engine once running', async () => {
      const manager = await loadAudioManager();

      manager.startEngine();
      manager.stopEngine();
      manager.startEngine();
      host.resumeSharedAudioContext();
      await flushTasks();
      manager.updateEngine(30);
      const playing = rig.liveOscillators();
      expect(playing).toBeGreaterThan(0);

      manager.stopEngine();
      expect(rig.liveOscillators(), 'stopEngine silences it').toBe(0);
    });

    it('starts at once on a running context, and an interruption does not double it', async () => {
      const manager = await loadAudioManager();
      rig.initialState = 'running';

      manager.startEngine();
      const playing = rig.liveOscillators();
      expect(playing, 'unchanged: a running context plays the engine at once').toBeGreaterThan(0);

      const context = rig.latest();
      context.force('interrupted');
      manager.updateEngine(30);
      host.resumeSharedAudioContext();
      await flushTasks();
      expect(context.state).toBe('running');
      manager.updateEngine(30);

      expect(rig.liveOscillators(), 'the same engine keeps playing; no second one').toBe(playing);
    });
  });
});
