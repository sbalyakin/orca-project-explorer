// Starts an agent through Orca's own CLI, the one call that takes a model, effort, prompt and
// chat-or-terminal choice (the plugin host API's `agent.launch` takes only an agent and a prompt).
import { execFile } from 'node:child_process'
import { childEnv, findCommand } from './catalog/run'
import type { AgentLaunch } from './types'

const LAUNCH_TIMEOUT_MS = 60_000
const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'

/** `identity:…` ids are selectors as they are; other ids (folder workspaces) go behind `id:`. */
export function worktreeSelector(workspaceId: string): string {
  return workspaceId.startsWith('identity:') ? workspaceId : `id:${workspaceId}`
}

export function launchArgs(launch: AgentLaunch): string[] {
  const args = ['agent', 'launch', '--agent', launch.agent, '--worktree', worktreeSelector(launch.workspaceId), '--focus', '--json']
  if (launch.surface) args.push('--surface', launch.surface)
  // The CLI refuses an effort without a model.
  if (launch.model) {
    args.push('--model', launch.model)
    if (launch.effort) args.push('--effort', launch.effort)
  }
  if (launch.prompt?.trim()) args.push('--prompt', launch.prompt)
  return args
}

function failureText(stdout: string, fallback: string): string {
  try {
    const reply = JSON.parse(stdout) as { error?: { message?: unknown } }
    if (typeof reply.error?.message === 'string') return reply.error.message
  } catch {
    // Not JSON: use the process error below.
  }
  return fallback
}

export function launchAgent(launch: AgentLaunch): Promise<void> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) return Promise.reject(new Error('the orca command was not found'))
  return new Promise((resolve, reject) => {
    execFile(cli, launchArgs(launch), { timeout: LAUNCH_TIMEOUT_MS, env: childEnv() }, (error, stdout, stderr) => {
      let ok = !error
      try {
        ok = ok && (JSON.parse(stdout) as { ok?: unknown }).ok !== false
      } catch {
        // Output that is not JSON counts as success when the process exited cleanly.
      }
      if (ok) resolve()
      else reject(new Error(failureText(stdout, (stderr || error?.message || 'launch failed').trim().slice(-300))))
    })
  })
}
