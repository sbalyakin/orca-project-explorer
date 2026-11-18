// The Node APIs the worker uses; the plugin ships no @types/node.
declare module 'node:os' {
  export function homedir(): string
}
declare module 'node:fs' {
  export function existsSync(path: string): boolean
}
declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function readFile(path: string): Promise<{ length: number; toString(encoding: 'base64'): string }>
}
declare module 'node:path' {
  export function join(...parts: string[]): string
  export function resolve(...parts: string[]): string
  export const sep: string
}
declare module 'node:child_process' {
  type Stream = { setEncoding(encoding: 'utf8'): void; on(event: 'data', listener: (chunk: string) => void): void }
  export type ChildProcess = {
    stdin: { write(text: string): void; end(): void; on(event: 'error', listener: () => void): void }
    stdout: Stream
    stderr: Stream
    kill(): void
    on(event: 'error', listener: (error: Error) => void): void
    on(event: 'close', listener: (code: number | null) => void): void
  }
  export function spawn(
    command: string,
    args: readonly string[],
    options?: { cwd?: string; env?: Record<string, string | undefined>; stdio?: 'pipe' }
  ): ChildProcess
  export function execFile(
    file: string,
    args: readonly string[],
    options: { timeout?: number; maxBuffer?: number; env?: Record<string, string | undefined>; cwd?: string },
    callback: (error: (Error & { code?: number | string }) | null, stdout: string, stderr: string) => void
  ): ChildProcess
}
declare const process: { env: Record<string, string | undefined> }
declare function fetch(
  url: string,
  init?: { signal?: unknown }
): Promise<{ ok: boolean; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>
declare const Buffer: {
  from(data: ArrayBuffer): { length: number; toString(encoding: 'base64'): string }
}
