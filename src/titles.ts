// The title shown after a workspace's name in "title" mode: what its agents are called.
// The plugin API's `agents.list` leaves out native chats, which `orca agent list --json` includes, so the CLI is the main source.
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { childEnv, findCommand } from './catalog/run'

/** The parts of an `agents.list` row this module reads. */
export type AgentRow = { title: string | null; task?: { title: string } | null }

/** The first agent's title (the host lists the newest state first), or its open task's title; none for an agent with neither. */
export function titleOf(agents: readonly AgentRow[]): string | undefined {
  for (const agent of agents) {
    const title = agent.title?.trim() || agent.task?.title.trim()
    if (title) return title
  }
  return undefined
}

/** A folder path without trailing slashes, so two spellings of one folder compare equal. */
export function normalizePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path
}

/** The folder with symlinks resolved (`/tmp` is `/private/tmp` on macOS); a folder that is gone keeps its normalized spelling. */
export async function realPath(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch {
    return normalizePath(path)
  }
}

/** One agent as the CLI lists it: the workspace folder it works in, its title, and when it last changed. */
export type CliAgent = { path: string; title: string; updatedAt: number }

/**
 * The agents of `orca agent list --json` that have a title. The CLI's `worktreeId` is `<repo id>::<path>`, and
 * the path is what ties a row to a workspace.
 */
export function parseCliAgents(stdout: string): CliAgent[] {
  let rows: unknown
  try {
    rows = (JSON.parse(stdout) as { result?: { agents?: unknown } }).result?.agents
  } catch {
    return []
  }
  if (!Array.isArray(rows)) return []
  const agents: CliAgent[] = []
  for (const row of rows as Record<string, unknown>[]) {
    const id = typeof row.worktreeId === 'string' ? row.worktreeId : ''
    const cut = id.indexOf('::')
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (cut < 0 || !title) continue
    agents.push({ path: normalizePath(id.slice(cut + 2)), title, updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0 })
  }
  return agents
}

/** The agents with their folder paths resolved; each distinct path is resolved once. */
export async function resolveAgentPaths(agents: readonly CliAgent[]): Promise<CliAgent[]> {
  const paths = [...new Set(agents.map((agent) => agent.path))]
  const resolved = new Map(await Promise.all(paths.map(async (path) => [path, await realPath(path)] as const)))
  return agents.map((agent) => ({ ...agent, path: resolved.get(agent.path) ?? agent.path }))
}

/** Per folder path, the title of the agent that changed last. */
export function latestByPath(agents: readonly CliAgent[]): Map<string, string> {
  const newest = new Map<string, CliAgent>()
  for (const agent of agents) {
    const known = newest.get(agent.path)
    if (!known || agent.updatedAt > known.updatedAt) newest.set(agent.path, agent)
  }
  return new Map([...newest].map(([path, agent]) => [path, agent.title]))
}

const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const TIMEOUT_MS = 15_000
const MAX_BUFFER = 64 * 1024 * 1024

/** The titled agents the CLI knows; null when the CLI is missing or fails, so the caller can fall back. */
export function fetchCliAgents(): Promise<CliAgent[] | null> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(cli, ['agent', 'list', '--json'], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, env: childEnv() }, (error, stdout) => {
      resolve(error ? null : parseCliAgents(stdout))
    })
  })
}
