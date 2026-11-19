// The agents the right-click menu offers: Orca's installed agents, with a built-in fallback.
import type { InstalledAgent } from '../types'

const DEFAULT_AGENT_IDS = ['claude', 'codex', 'opencode2', 'pi', 'cursor'] as const

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

export function agentLabel(id: string): string {
  return NAMES[id] ?? id
}

/** Fallback list used before the first `agents.installed` response or when the CLI is unavailable. */
export function defaultAgents(): InstalledAgent[] {
  return DEFAULT_AGENT_IDS.map((id) => ({ id, name: agentLabel(id) }))
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
