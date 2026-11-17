// Asks each agent's own CLI for its models, the way Orca's own picker does.
import { parseClaudeModels, parseCodexModels, parseCursorModels, parseOpenCodeModels, parsePiModels, parsePiRpcModels } from './parse'
import { findCommand, runLines, runText, type LineIo } from './run'
import type { AgentModel } from '../types'

const PROBE_TIMEOUT_MS = 25_000

function requireCommand(names: readonly string[]): string {
  const command = findCommand(names)
  if (!command) throw new Error(`${names[0]} was not found on this machine`)
  return command
}

function parseRecord(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** `codex app-server`: initialize, then `model/list` page by page. */
async function codexModels(): Promise<AgentModel[]> {
  const rows: unknown[] = []
  let nextId = 2
  const listPage = (io: LineIo, cursor?: string): void =>
    io.write(`${JSON.stringify({ method: 'model/list', id: nextId++, params: cursor ? { cursor } : {} })}\n`)
  return runLines(requireCommand(['codex']), ['app-server'], {
    timeoutMs: PROBE_TIMEOUT_MS,
    start: (io) =>
      io.write(`${JSON.stringify({ method: 'initialize', id: 1, params: { clientInfo: { name: 'orca_project_tree', title: 'Project Tree', version: '0.1.0' } } })}\n`),
    onLine: (line, io) => {
      const record = parseRecord(line)
      if (!record) return undefined
      if (record.error) throw new Error(`codex: ${JSON.stringify(record.error).slice(0, 200)}`)
      if (record.id === 1) {
        io.write(`${JSON.stringify({ method: 'initialized' })}\n`)
        listPage(io)
        return undefined
      }
      const result = record.result
      if (typeof result !== 'object' || result === null) return undefined
      const page = result as { data?: unknown; nextCursor?: unknown }
      if (Array.isArray(page.data)) rows.push(...page.data)
      if (typeof page.nextCursor === 'string' && page.nextCursor) {
        listPage(io, page.nextCursor)
        return undefined
      }
      return parseCodexModels(rows)
    }
  })
}

/** `claude -p` in stream-json mode answers a `list_models` control request without a model turn. */
async function claudeModels(): Promise<AgentModel[]> {
  const requestId = 'project-tree-models'
  return runLines(
    requireCommand(['claude']),
    ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config'],
    {
      timeoutMs: PROBE_TIMEOUT_MS,
      start: (io) => io.write(`${JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'list_models' } })}\n`),
      onLine: (line) => {
        const record = parseRecord(line)
        if (record?.type !== 'control_response') return undefined
        const response = record.response as { subtype?: unknown; response?: { models?: unknown }; error?: unknown } | undefined
        if (response?.subtype !== 'success') throw new Error(`claude: ${String(response?.error ?? 'list_models failed')}`)
        const models = parseClaudeModels(response.response?.models)
        if (models.length === 0) throw new Error('claude listed no models')
        return models
      }
    }
  )
}

/** Pi in RPC mode names its models and levels as Orca's picker shows them. */
async function piModels(): Promise<AgentModel[]> {
  const pi = requireCommand(['pi'])
  try {
    return await runLines(pi, ['--mode', 'rpc'], {
      timeoutMs: PROBE_TIMEOUT_MS,
      start: (io) => io.write(`${JSON.stringify({ type: 'get_available_models' })}\n`),
      onLine: (line) => {
        const record = parseRecord(line)
        if (record?.type !== 'response' || record.command !== 'get_available_models') return undefined
        if (record.success !== true) throw new Error(`pi: ${String(record.error ?? 'get_available_models failed')}`)
        const data = record.data as { models?: unknown } | undefined
        return parsePiRpcModels(data?.models)
      }
    })
  } catch {
    // An older Pi without RPC mode still prints its table.
    return parsePiModels(await runText(pi, ['--list-models'], { timeoutMs: PROBE_TIMEOUT_MS }))
  }
}

/** Agent ids whose CLI can list models. Others launch without a model list. */
const PROBES: Record<string, () => Promise<AgentModel[]>> = {
  codex: codexModels,
  claude: claudeModels,
  pi: piModels,
  // The user's wrapper first: it sets the environment a GUI-started Orca lacks.
  opencode: async () => parseOpenCodeModels(await runText(requireCommand(['opencode-jb', 'opencode']), ['models'], { timeoutMs: PROBE_TIMEOUT_MS })),
  opencode2: async () => parseOpenCodeModels(await runText(requireCommand(['opencode-jb', 'opencode2', 'opencode']), ['models'], { timeoutMs: PROBE_TIMEOUT_MS })),
  cursor: async () => parseCursorModels(await runText(requireCommand(['cursor-agent', 'agent']), ['--list-models'], { timeoutMs: PROBE_TIMEOUT_MS }))
}

export function canListModels(agent: string): boolean {
  return Object.hasOwn(PROBES, agent)
}

export async function probeModels(agent: string): Promise<AgentModel[]> {
  const probe = PROBES[agent]
  if (!probe) throw new Error(`no model listing for ${agent}`)
  const models = await probe()
  if (models.length === 0) throw new Error(`${agent} listed no models`)
  return models
}
