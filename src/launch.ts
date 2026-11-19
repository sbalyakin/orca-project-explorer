// Starts an agent through Orca's own CLI, the one call that takes a model, effort, prompt and
// chat-or-terminal choice (the plugin host API's `agent.launch` takes only an agent and a prompt).
import type { AgentLaunch } from './types'
import { runOrcaJson, worktreeSelector } from './worktree'

export { worktreeSelector }

const LAUNCH_TIMEOUT_MS = 60_000

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

export function launchAgent(launch: AgentLaunch): Promise<void> {
  return runOrcaJson(launchArgs(launch), { timeoutMs: LAUNCH_TIMEOUT_MS, fallback: 'launch failed' })
}
