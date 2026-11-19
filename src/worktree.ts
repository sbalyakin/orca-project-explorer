// Runs `orca worktree set` for workspace metadata actions that have no plugin host method (such as Mark Read / Unread).
import { execFile } from 'node:child_process'
import { childEnv, findCommand } from './catalog/run'

const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const TIMEOUT_MS = 15_000

/** Turns a `workspace.list` id into the `--worktree` selector `orca worktree set` accepts. */
export function worktreeSelector(workspaceId: string): string {
  if (workspaceId.startsWith('identity:') || workspaceId.startsWith('folder:')) return workspaceId
  return `id:${workspaceId}`
}

export function setUnreadArgs(workspaceId: string, unread: boolean): string[] {
  return ['worktree', 'set', '--worktree', worktreeSelector(workspaceId), unread ? '--unread' : '--read', '--json']
}

export async function setWorkspaceUnread(workspaceId: string, unread: boolean): Promise<void> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) throw new Error('The orca CLI was not found')
  const args = setUnreadArgs(workspaceId, unread)
  await new Promise<void>((resolve, reject) => {
    execFile(cli, args, { timeout: TIMEOUT_MS, env: childEnv() }, (error, _stdout, stderr) => {
      if (!error) return resolve()
      const detail = stderr.trim() || error.message
      reject(new Error(`Could not mark workspace ${unread ? 'unread' : 'read'}: ${detail}`))
    })
  })
}
