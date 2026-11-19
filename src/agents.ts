// Lists the agent CLIs Orca detects on this host via `orca agent installed --json`.
import { execFile } from 'node:child_process'
import { childEnv } from './catalog/run'
import { findOrcaCli } from './worktree'
import type { InstalledAgent } from './types'

const TIMEOUT_MS = 10_000

/** Parses `orca agent installed --json`. Returns null when the output is not a valid `ok: true` reply. */
export function parseInstalledAgents(stdout: string): InstalledAgent[] | null {
  let reply: { ok?: unknown; result?: { agents?: unknown } }
  try {
    reply = JSON.parse(stdout) as { ok?: unknown; result?: { agents?: unknown } }
  } catch {
    return null
  }
  if (reply.ok === false || !Array.isArray(reply.result?.agents)) return null
  const seen = new Set<string>()
  const agents: InstalledAgent[] = []
  for (const row of reply.result.agents) {
    if (!row || typeof row !== 'object') continue
    const raw = row as { id?: unknown; name?: unknown }
    if (typeof raw.id !== 'string') continue
    const id = raw.id.trim().toLowerCase()
    if (!/^[a-z0-9-]+$/.test(id) || seen.has(id)) continue
    seen.add(id)
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id
    agents.push({ id, name })
  }
  return agents
}

/** Agents Orca can launch on this host; null when the CLI is missing or fails. */
export function fetchInstalledAgents(): Promise<InstalledAgent[] | null> {
  const cli = findOrcaCli()
  if (!cli) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile(cli, ['agent', 'installed', '--json'], { timeout: TIMEOUT_MS, env: childEnv() }, (error, stdout) => {
      resolve(error ? null : parseInstalledAgents(stdout))
    })
  })
}
