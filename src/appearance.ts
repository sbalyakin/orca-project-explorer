// Project icons and badge colours. The plugin host API leaves them out of `project.list`, so they
// come from `orca project list --json`, whose rows carry `repoIcon` and `badgeColor`.
import { execFile } from 'node:child_process'
import { childEnv, findCommand } from './catalog/run'
import type { ProjectLook } from './tree'
import type { ProjectIcon } from './types'

export type LooksLoader = () => Promise<Map<string, ProjectLook>>
export type LooksCache = ReturnType<typeof createLooksCache>

const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const TIMEOUT_MS = 15_000
const MAX_BUFFER = 64 * 1024 * 1024

function iconOf(value: unknown): ProjectIcon | undefined {
  if (!value || typeof value !== 'object') return undefined
  const icon = value as Record<string, unknown>
  if (icon.type === 'lucide' && typeof icon.name === 'string') return { type: 'lucide', name: icon.name }
  if (icon.type === 'emoji' && typeof icon.emoji === 'string') return { type: 'emoji', emoji: icon.emoji }
  if (icon.type === 'image' && typeof icon.src === 'string') return { type: 'image', src: icon.src }
  if (icon.type === 'letters' && typeof icon.text === 'string') return { type: 'letters', text: icon.text }
  return undefined
}

/**
 * Looks keyed by repository uuid, the id the host API gives a project. One CLI row can cover several
 * repositories (`sourceRepoIds`), and they share its icon.
 */
export function parseLooks(stdout: string): Map<string, ProjectLook> {
  const looks = new Map<string, ProjectLook>()
  let rows: unknown
  try {
    rows = (JSON.parse(stdout) as { result?: { projects?: unknown } }).result?.projects
  } catch {
    return looks
  }
  if (!Array.isArray(rows)) return looks
  for (const row of rows as Record<string, unknown>[]) {
    const look: ProjectLook = {}
    const icon = iconOf(row.repoIcon)
    if (icon) look.icon = icon
    if (typeof row.badgeColor === 'string') look.color = row.badgeColor
    const ids = Array.isArray(row.sourceRepoIds) ? row.sourceRepoIds : []
    for (const id of [row.id, ...ids]) if (typeof id === 'string') looks.set(id.replace(/^repo:/, ''), look)
  }
  return looks
}

const remoteImages = new Map<string, Promise<string | null>>()
const MAX_IMAGE_BYTES = 256 * 1024

/** Orca's own favicon and avatar URLs, fetched here because the panel has no network. Cached per URL. */
function inlineRemote(src: string): Promise<string | null> {
  let cached = remoteImages.get(src)
  if (!cached) {
    cached = fetchDataUri(src)
    remoteImages.set(src, cached)
    // A failure is retried on the next load.
    void cached.then((uri) => { if (!uri) remoteImages.delete(src) })
  }
  return cached
}

async function fetchDataUri(src: string): Promise<string | null> {
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    const type = response.headers.get('content-type') ?? ''
    if (!response.ok || !type.startsWith('image/')) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.length > MAX_IMAGE_BYTES ? null : `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/** Swaps https image icons for data URIs; one that cannot be fetched is dropped, so the default folder shows. */
export async function inlineRemoteIcons(looks: Map<string, ProjectLook>): Promise<void> {
  const remote = [...new Set([...looks.values()].map((look) => look.icon).filter((icon) => icon?.type === 'image' && icon.src.startsWith('https:')))]
  await Promise.all(
    remote.map(async (icon) => {
      if (icon?.type !== 'image') return
      const uri = await inlineRemote(icon.src)
      if (uri) icon.src = uri
    })
  )
}

const lookSignature = (looks: Map<string, ProjectLook>): string => JSON.stringify([...looks])

/**
 * Looks change almost never, but loading them costs a CLI call (about a second, more with favicons).
 * Every call answers from memory at once, `null` until the first load is done, and refreshes in the
 * background; `onChange` fires when a refresh brings different looks. A failed refresh (empty result)
 * keeps the earlier looks.
 */
export function createLooksCache(
  load: LooksLoader = fetchLooks,
  onChange: () => void = () => {}
): () => Map<string, ProjectLook> | null {
  let looks: Map<string, ProjectLook> | null = null
  let signature = ''
  let running: Promise<void> | null = null
  const settle = (fresh: Map<string, ProjectLook>): void => {
    if (fresh.size === 0 && looks) return
    const next = lookSignature(fresh)
    const changed = !looks || next !== signature
    looks = fresh
    signature = next
    if (changed) onChange()
  }
  return () => {
    running ??= load()
      .catch(() => new Map<string, ProjectLook>())
      .then(settle)
      .finally(() => {
        running = null
      })
    return looks
  }
}

/** Never rejects: without the CLI every project simply keeps Orca's default icon. */
export function fetchLooks(): Promise<Map<string, ProjectLook>> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) return Promise.resolve(new Map())
  return new Promise((resolve) => {
    execFile(cli, ['project', 'list', '--json'], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, env: childEnv() }, (error, stdout) => {
      if (error) return resolve(new Map())
      const looks = parseLooks(stdout)
      inlineRemoteIcons(looks).then(() => resolve(looks), () => resolve(looks))
    })
  })
}
