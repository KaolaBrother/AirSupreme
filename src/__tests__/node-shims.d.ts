declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { isFile(): boolean; size: number };
  export function readdirSync(path: string): string[];
}

declare module 'path' {
  const path: {
    resolve(...parts: string[]): string;
    join(...parts: string[]): string;
    dirname(p: string): string;
    sep: string;
  };
  export default path;
}

declare module 'url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'vm' {
  /** 在新的上下文里执行一段脚本；timeout（毫秒）到了还没执行完就中断并抛错 */
  export function runInNewContext(
    code: string,
    contextObject?: Record<string, unknown>,
    options?: { timeout?: number }
  ): unknown;
}
