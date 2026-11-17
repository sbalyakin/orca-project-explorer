// The agents the right-click menu offers, taken from the plugin's `agents` setting.
export const DEFAULT_AGENTS = 'claude,codex,opencode2,pi,cursor'

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
export function parseAgents(value: unknown): string[] {
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
