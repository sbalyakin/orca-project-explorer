// The agents the right-click menu offers: Orca's installed agents by default, or the plugin's `agents` setting when set.
import type { InstalledAgent } from '../types'

const DEFAULT_AGENTS = 'claude,codex,opencode2,pi,cursor'

const NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  opencode: 'OpenCode',
  opencode2: 'OpenCode 2',
  pi: 'Pi',
  cursor: 'Cursor',
  gemini: 'Gemini',
  copilot: 'Copilot',
  droid: 'Droid',
  grok: 'Grok',
  kimi: 'Kimi',
  kiro: 'Kiro'
}

/** Agent ids from a comma-separated setting: lower-case, unique, in the order written. */
function parseAgents(value: unknown): string[] {
  const text = typeof value === 'string' ? value : DEFAULT_AGENTS
  const ids = text
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((id) => /^[a-z0-9-]+$/.test(id))
  return [...new Set(ids)]
}

export function agentLabel(id: string): string {
  return NAMES[id] ?? id
}

/** Fallback list used before the first `agents.installed` response or when the CLI is unavailable. */
export function defaultAgents(): InstalledAgent[] {
  return parseAgents(DEFAULT_AGENTS).map((id) => ({ id, name: agentLabel(id) }))
}

/** Parses a manual `agents` setting override; returns null when empty so Orca's installed agents are used. */
export function parseAgentOverride(value: unknown): InstalledAgent[] | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const ids = parseAgents(value)
  return ids.length > 0 ? ids.map((id) => ({ id, name: agentLabel(id) })) : null
}

/** Parses a cached `InstalledAgent[]` list from plugin storage. */
export function parseStoredAgents(value: unknown): InstalledAgent[] | null {
  if (!Array.isArray(value)) return null
  const agents: InstalledAgent[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as { id?: unknown; name?: unknown }
    if (typeof raw.id !== 'string' || !/^[a-z0-9-]+$/.test(raw.id)) continue
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : agentLabel(raw.id)
    agents.push({ id: raw.id, name })
  }
  return agents.length > 0 ? agents : null
}
