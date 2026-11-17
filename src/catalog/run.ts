// Runs agent CLIs from the worker. A GUI-launched Orca has a thin PATH, so commands are looked up in
// the usual install folders too.
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EXTRA_DIRS = ['.local/bin', '.opencode/bin', '.bun/bin', '.npm-global/bin', '.cargo/bin']
const SYSTEM_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']

function searchDirs(): string[] {
  const home = homedir()
  const fromPath = (process.env.PATH ?? '').split(':').filter(Boolean)
  return [...new Set([...fromPath, ...EXTRA_DIRS.map((dir) => join(home, dir)), ...SYSTEM_DIRS])]
}

/** The first of `names` found in PATH or a usual install folder, as an absolute path. */
export function findCommand(names: readonly string[], extraPaths: readonly string[] = []): string | null {
  for (const absolute of extraPaths) if (existsSync(absolute)) return absolute
  const dirs = searchDirs()
  for (const name of names) {
    for (const dir of dirs) {
      const path = join(dir, name)
      if (existsSync(path)) return path
    }
  }
  return null
}

/** The environment children run in: ours, with the search folders on PATH so shebangs resolve. */
export function childEnv(): Record<string, string | undefined> {
  return { ...process.env, PATH: searchDirs().join(':') }
}

export type LineIo = { write: (text: string) => void }

/**
 * Spawns a CLI that talks in lines and resolves with what `onLine` returns first. The child is
 * stopped as soon as it has answered, and on failure or timeout.
 */
export function runLines<T>(
  command: string,
  args: readonly string[],
  options: { timeoutMs: number; start?: (io: LineIo) => void; onLine: (line: string, io: LineIo) => T | undefined }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: homedir(), env: childEnv(), stdio: 'pipe' })
    let settled = false
    let buffer = ''
    let stderr = ''
    const settle = (finish: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      finish()
    }
    const io: LineIo = { write: (text) => child.stdin.write(text) }
    const timer = setTimeout(() => settle(() => reject(new Error(`${command} did not answer in ${options.timeoutMs / 1000}s`))), options.timeoutMs)
    child.stdin.on('error', () => undefined)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-2000)))
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (settled) return
        try {
          const result = options.onLine(line, io)
          if (result !== undefined) return settle(() => resolve(result))
        } catch (error: unknown) {
          return settle(() => reject(error))
        }
      }
    })
    child.on('error', (error) => settle(() => reject(error)))
    child.on('close', (code) =>
      settle(() => reject(new Error(`${command} exited (${code ?? 'signal'}) before it answered${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`)))
    )
    try {
      options.start?.(io)
    } catch (error: unknown) {
      settle(() => reject(error))
    }
  })
}

/** Runs a CLI to the end and gives its stdout and stderr together: some print their tables to stderr. */
export function runText(command: string, args: readonly string[], options: { timeoutMs: number; cwd?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: options.timeoutMs, maxBuffer: 8 * 1024 * 1024, env: childEnv(), cwd: options.cwd ?? homedir() },
      (error, stdout, stderr) => {
        if (error && !stdout) reject(new Error(`${command} failed: ${(stderr || error.message).trim().slice(-300)}`))
        else resolve(`${stdout}\n${stderr}`)
      }
    )
  })
}
