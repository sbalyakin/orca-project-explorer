// Shared `orca ... --json` CLI runner and workspace metadata commands that have no plugin host method.
import { execFile } from 'node:child_process'
import { childEnv, findCommand } from './catalog/run'

const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const TIMEOUT_MS = 15_000

/** Turns a `workspace.list` id into the `--worktree` selector `orca` accepts. */
export function worktreeSelector(workspaceId: string): string {
  if (workspaceId.startsWith('identity:') || workspaceId.startsWith('folder:')) return workspaceId
  return `id:${workspaceId}`
}

/**
 * Checks the output of an `orca ... --json` call. Returns `null` on success, or the error message:
 * `orca` writes `{"ok":false,"error":{"message":...}}` to stdout even when stderr is empty.
 */
export function parseOrcaJsonError(stdout: string, stderr: string, error: Error | null, fallback: string): string | null {
  let reply: { ok?: unknown; error?: { message?: unknown } } | null = null
  try {
    reply = JSON.parse(stdout) as { ok?: unknown; error?: { message?: unknown } }
  } catch {
    // Non-JSON output counts as success when the process exited cleanly.
  }
  const ok = !error && reply?.ok !== false
  if (ok) return null
  if (typeof reply?.error?.message === 'string' && reply.error.message.trim()) return reply.error.message.trim()
  return (stderr || error?.message || fallback).trim().slice(-300)
}

export function findOrcaCli(): string | null {
  return findCommand(['orca'], [APP_CLI])
}

export function runOrcaJson(args: string[], options: { timeoutMs?: number; fallback: string }): Promise<void> {
  const cli = findOrcaCli()
  if (!cli) return Promise.reject(new Error('the orca command was not found'))
  return new Promise((resolve, reject) => {
    execFile(cli, args, { timeout: options.timeoutMs ?? TIMEOUT_MS, env: childEnv() }, (error, stdout, stderr) => {
      const failure = parseOrcaJsonError(stdout, stderr, error, options.fallback)
      if (failure === null) resolve()
      else reject(new Error(failure))
    })
  })
}

export function setUnreadArgs(workspaceId: string, unread: boolean): string[] {
  return ['worktree', 'set', '--worktree', worktreeSelector(workspaceId), unread ? '--unread' : '--read', '--json']
}

export function deleteWorktreeArgs(workspaceId: string): string[] {
  return ['worktree', 'rm', '--worktree', worktreeSelector(workspaceId), '--json']
}

export function setWorkspaceUnread(workspaceId: string, unread: boolean): Promise<void> {
  return runOrcaJson(setUnreadArgs(workspaceId, unread), { fallback: `Could not mark workspace ${unread ? 'unread' : 'read'}` })
}

export function deleteWorkspace(workspaceId: string): Promise<void> {
  return runOrcaJson(deleteWorktreeArgs(workspaceId), { fallback: 'Could not delete workspace' })
}
