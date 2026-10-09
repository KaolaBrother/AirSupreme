import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * 日志默认级别（Logger，终验修复 F2）：开发构建（MODE = development）输出全部日志（DEBUG 起），
 * 其余构建（生产 / 预览 / 测试）默认只输出警告与错误（WARN 起）。
 * 默认级别在模块加载时按 import.meta.env.MODE 决定：每个用例换 MODE 后重新加载模块。
 */

type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error';
const METHODS: readonly ConsoleMethod[] = ['debug', 'info', 'warn', 'error'];

describe('Logger default level', () => {
  const spies: Array<{ mockRestore(): void }> = [];

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** 在给定 MODE 下重新加载 Logger，各级别各记一条，返回每个 console 方法被调用的次数 */
  async function logEveryLevel(mode: string): Promise<Record<ConsoleMethod, number>> {
    vi.stubEnv('MODE', mode);
    vi.resetModules();
    const { getLogger } = await import('@/core/utils/Logger');
    const calls = {} as Record<ConsoleMethod, ReturnType<typeof vi.fn>>;
    for (const method of METHODS) {
      const spy = vi.spyOn(console, method).mockImplementation(() => undefined);
      spies.push(spy);
      calls[method] = spy as unknown as ReturnType<typeof vi.fn>;
    }
    const log = getLogger('LoggerDefaultLevelTest');
    log.debug('debug line');
    log.info('info line');
    log.warn('warn line');
    log.error('error line');
    return {
      debug: calls.debug.mock.calls.length,
      info: calls.info.mock.calls.length,
      warn: calls.warn.mock.calls.length,
      error: calls.error.mock.calls.length,
    };
  }

  it.each(['production', 'preview', 'test'])(
    'outside development (%s) only warnings and errors reach the console',
    async (mode) => {
      expect(await logEveryLevel(mode)).toEqual({ debug: 0, info: 0, warn: 1, error: 1 });
    }
  );

  it('in development everything down to DEBUG reaches the console', async () => {
    expect(await logEveryLevel('development')).toEqual({ debug: 1, info: 1, warn: 1, error: 1 });
  });
});
