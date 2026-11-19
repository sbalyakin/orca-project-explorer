// Turns what each agent's own CLI prints into one model shape. Pure: the formats are the contract,
// so every parser is covered by a test with a real sample.
import type { AgentModel } from '../types'

const STANDARD_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function uniqueById(models: AgentModel[]): AgentModel[] {
  const seen = new Set<string>()
  return models.filter((model) => !seen.has(model.id) && seen.add(model.id))
}

/** Codex `model/list` rows: visible models with their reasoning levels and the default one. */
export function parseCodexModels(rows: unknown): AgentModel[] {
  if (!Array.isArray(rows)) return []
  const models: AgentModel[] = []
  for (const row of rows) {
    if (!isObject(row) || typeof row.id !== 'string' || row.hidden === true) continue
    const efforts = Array.isArray(row.supportedReasoningEfforts)
      ? row.supportedReasoningEfforts.flatMap((item) =>
          isObject(item) && typeof item.reasoningEffort === 'string' ? [item.reasoningEffort] : []
        )
      : []
    const model: AgentModel = {
      id: row.id,
      label: typeof row.displayName === 'string' ? row.displayName : row.id,
      efforts
    }
    if (typeof row.defaultReasoningEffort === 'string' && efforts.includes(row.defaultReasoningEffort)) {
      model.defaultEffort = row.defaultReasoningEffort
    }
    if (row.isDefault === true) model.isDefault = true
    models.push(model)
  }
  return uniqueById(models)
}

/**
 * Claude `list_models` rows. Its `default` row only points at a real model, so it is dropped and
 * the model it resolves to is marked as the default instead.
 */
export function parseClaudeModels(rows: unknown): AgentModel[] {
  if (!Array.isArray(rows)) return []
  const defaultRow = rows.find((row) => isObject(row) && row.value === 'default')
  const defaultId = isObject(defaultRow) && typeof defaultRow.resolvedModel === 'string' ? defaultRow.resolvedModel : null
  const models: AgentModel[] = []
  for (const row of rows) {
    if (!isObject(row) || typeof row.value !== 'string' || row.value === 'default') continue
    const efforts = row.supportsEffort === true ? strings(row.supportedEffortLevels) : []
    const model: AgentModel = {
      id: row.value,
      label: typeof row.displayName === 'string' ? row.displayName : row.value,
      efforts
    }
    if (row.value === defaultId || row.resolvedModel === defaultId) model.isDefault = true
    models.push(model)
  }
  return uniqueById(models)
}

/** `pi --list-models`: a table of provider, model, context, max-out, thinking, images. */
export function parsePiModels(text: string): AgentModel[] {
  const models: AgentModel[] = []
  for (const line of text.split(/\r?\n/)) {
    const [provider, name, , , thinking] = line.trim().split(/\s+/)
    if (!provider || !name || provider === 'provider' || (thinking !== 'yes' && thinking !== 'no')) continue
    const id = `${provider}/${name}`
    models.push({ id, label: id, efforts: thinking === 'yes' ? STANDARD_EFFORTS : [] })
  }
  return uniqueById(models)
}

const PI_LEVELS = ['off', 'minimal', 'low', 'medium', 'high']
const PI_EXTRA_LEVELS = ['xhigh', 'max']

/**
 * Pi's `get_available_models` rows: display names, and per-model thinking levels. A level mapped to
 * null is not offered; xhigh and max exist only where the model maps them.
 */
export function parsePiRpcModels(rows: unknown): AgentModel[] {
  if (!Array.isArray(rows)) return []
  const models: AgentModel[] = []
  for (const row of rows) {
    if (!isObject(row) || typeof row.id !== 'string' || typeof row.provider !== 'string') continue
    const map = isObject(row.thinkingLevelMap) ? row.thinkingLevelMap : {}
    const efforts =
      row.reasoning === true
        ? [...PI_LEVELS.filter((level) => map[level] !== null), ...PI_EXTRA_LEVELS.filter((level) => typeof map[level] === 'string')]
        : []
    models.push({ id: `${row.provider}/${row.id}`, label: typeof row.name === 'string' && row.name ? row.name : row.id, efforts })
  }
  return uniqueById(models)
}

/** `opencode models`: one `provider/model` id per line; log noise has no slash or has spaces. */
export function parseOpenCodeModels(text: string): AgentModel[] {
  const models: AgentModel[] = []
  for (const line of text.split(/\r?\n/)) {
    const id = line.trim()
    const slash = id.indexOf('/')
    if (slash > 0 && slash < id.length - 1 && !/\s/.test(id)) models.push({ id, label: id, efforts: [] })
  }
  return uniqueById(models)
}

/** `cursor-agent --list-models`: `id - Label` lines under a heading. */
export function parseCursorModels(text: string): AgentModel[] {
  const models: AgentModel[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^(\S+) - (.+)$/.exec(line.trim())
    if (!match) continue
    const isDefault = /\(default\)\s*$/.test(match[2])
    const model: AgentModel = { id: match[1], label: match[2].replace(/\s*\(default\)\s*$/, ''), efforts: [] }
    if (isDefault) model.isDefault = true
    models.push(model)
  }
  return uniqueById(models)
}

/** `gemini --list-models`: `id (Label)` header lines with indented metadata lines below. */
export function parseGeminiModels(text: string): AgentModel[] {
  const models: AgentModel[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-z0-9][a-z0-9._-]*)\s+\((.+)\)\s*$/i.exec(line)
    if (!match) continue
    models.push({ id: match[1], label: match[2].trim(), efforts: [] })
  }
  return uniqueById(models)
}
