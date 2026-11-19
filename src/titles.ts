// The title shown after a workspace's name in "title" mode: what its agents are called.
// The plugin API's `agents.list` leaves out native chats, which `orca agent list --json` includes, so the CLI is the main source.
import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { childEnv, findCommand } from './catalog/run'
import type { AgentText } from './types'

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

const MESSAGE_MAX = 240

/** A reply as one line: line breaks become spaces and Markdown emphasis marks go; cut at `MESSAGE_MAX`. */
export function oneLine(message: string): string {
  return message.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().slice(0, MESSAGE_MAX)
}

/** One agent as the CLI lists it: the workspace folder it works in, what it says, and when it last changed. */
export type CliAgent = AgentText & { path: string; updatedAt: number; kind?: string }

/**
 * The agents of `orca agent list --json` that have a title, a reply, or are native chats (counted in tooltips).
 * The CLI's `worktreeId` is `<repo id>::<path>`, and the path is what ties a row to a workspace.
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
    const kind = typeof row.kind === 'string' ? row.kind : undefined
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const message = typeof row.lastAssistantMessage === 'string' ? oneLine(row.lastAssistantMessage) : ''
    if (cut < 0 || (!title && !message && kind !== 'chat')) continue
    agents.push({
      path: normalizePath(id.slice(cut + 2)),
      ...(kind ? { kind } : {}),
      ...(title ? { title } : {}),
      ...(message ? { message } : {}),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0
    })
  }
  return agents
}

const FOLDER_WORKSPACE_SUFFIX = /::workspace:[^:]+$/

/**
 * A folder workspace's key: its folder (symlinks resolved) plus the `::workspace:<uuid>` its ids carry. Several
 * workspaces can sit on one folder, and only that suffix tells them apart; a plain worktree has none.
 */
export async function agentKey(path: string, suffix = ''): Promise<string> {
  return `${await realPath(path)}${suffix}`
}

/** The suffix `::workspace:<uuid>` at the end of an Orca id or CLI path, or ''. */
export function workspaceSuffix(id: string): string {
  return FOLDER_WORKSPACE_SUFFIX.exec(id)?.[0] ?? ''
}

/** The agents with their keys resolved (see `agentKey`); each distinct path is resolved once. */
export async function resolveAgentPaths(agents: readonly CliAgent[]): Promise<CliAgent[]> {
  const paths = [...new Set(agents.map((agent) => agent.path))]
  const resolved = new Map(
    await Promise.all(
      paths.map(async (path) => {
        const suffix = workspaceSuffix(path)
        return [path, await agentKey(path.slice(0, path.length - suffix.length), suffix)] as const
      })
    )
  )
  return agents.map((agent) => ({ ...agent, path: resolved.get(agent.path) ?? agent.path }))
}

/** Per folder path, the title of the newest agent that has one, the reply and timestamp of the newest that has one, and the native chat count. */
export function latestByPath(agents: readonly CliAgent[]): Map<string, AgentText> {
  const newest = new Map<string, { title?: CliAgent; message?: CliAgent; chats: number }>()
  for (const agent of agents) {
    const known = newest.get(agent.path) ?? { chats: 0 }
    if (agent.kind === 'chat') known.chats += 1
    for (const field of ['title', 'message'] as const) {
      const best = known[field]
      if (agent[field] && (!best || agent.updatedAt > best.updatedAt)) known[field] = agent
    }
    newest.set(agent.path, known)
  }
  return new Map(
    [...newest].map(([path, { title, message, chats }]) => [
      path,
      {
        ...(title?.title ? { title: title.title } : {}),
        ...(message?.message ? { message: message.message } : {}),
        ...(message?.message && message.updatedAt > 0 ? { messageAt: message.updatedAt } : {}),
        ...(chats > 0 ? { chats } : {})
      }
    ])
  )
}

const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const TIMEOUT_MS = 15_000
const MAX_BUFFER = 64 * 1024 * 1024

/** The agents with a title or reply the CLI knows; null when the CLI is missing or fails, so the caller can fall back. */
export function fetchCliAgents(): Promise<CliAgent[] | null> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(cli, ['agent', 'list', '--json'], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, env: childEnv() }, (error, stdout) => {
      resolve(error ? null : parseCliAgents(stdout))
    })
  })
}
