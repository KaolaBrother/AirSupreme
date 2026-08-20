declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { isFile(): boolean };
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
