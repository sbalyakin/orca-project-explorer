// The colours of Orca's left sidebar, which the host does not pass to panels. The worker reads the
// chosen app theme from Orca's profile database (read-only) and the theme plugin's own file, as it
// does for the interface font. Anything it cannot read gives `null`, and the panel keeps its estimate.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type { SidebarLook, SidebarLooks } from './types'

const SQLITE = '/usr/bin/sqlite3'
const ORCA_DIR = join('Library', 'Application Support', 'orca')
const PROFILE_DB = join(ORCA_DIR, 'profiles', 'local-default', 'profile-state.db')
const PLUGINS_DIR = join(ORCA_DIR, 'plugins')
const TIMEOUT_MS = 5000

const QUERY = `select json_object(
  'mode', json_extract(payload, '$.leftSidebarAppearanceMode'),
  'tintColor', json_extract(payload, '$.leftSidebarTintColor'),
  'tintOpacity', json_extract(payload, '$.leftSidebarTintOpacity'),
  'light', json_extract(payload, '$.pluginAppThemeLight'),
  'dark', json_extract(payload, '$.pluginAppThemeDark')
) from profile_state_documents where domain = 'settings'`

/** Orca's own sidebar colours when no theme plugin is chosen (`main.css`, `:root` and `.dark`). */
const BUILT_IN: Record<'light' | 'dark', SidebarLook> = {
  light: { background: '#f5f5f5', accent: '#eaeaea', active: null, activeBorder: null },
  dark: { background: '#2a2a2a', accent: '#353535', active: null, activeBorder: null }
}

/** Mirrors `left-sidebar-appearance.ts`: the defaults and the cap of the "tinted" mode. */
const DEFAULT_TINT_COLOR = '#18181b'
const DEFAULT_TINT_OPACITY = 0.08
const MAX_TINT_OPACITY = 0.35
const TINT_ACCENT_PERCENT = 9

/** What the settings row holds that matters here; every field can be missing or of another type. */
export type ThemeSettings = {
  mode?: unknown
  tintColor?: unknown
  tintOpacity?: unknown
  light?: unknown
  dark?: unknown
}

/**
 * Reads the tokens (`--name` -> value) of the theme `plugin:<publisher.id>/<theme id>`. Null means there is no
 * such theme (a bad slot, an unknown plugin or theme). A file that cannot be read now (a plugin mid-update,
 * broken JSON) rejects: that is not "no theme", and the panel must keep the colours it shows.
 */
export type ReadThemeTokens = (slot: string) => Promise<Record<string, string> | null>

/** A colour the panel may put into a style rule: hex only, never a function or a declaration. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const SLOT = /^plugin:([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/

function hex(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : null
}

/** The tinted mode paints `tint` over the app background; its hover colour is the text colour mixed in. */
function tinted(settings: ThemeSettings): SidebarLook {
  const color = hex(settings.tintColor) ?? DEFAULT_TINT_COLOR
  const opacity = typeof settings.tintOpacity === 'number' && Number.isFinite(settings.tintOpacity) ? settings.tintOpacity : DEFAULT_TINT_OPACITY
  const percent = Number((Math.min(MAX_TINT_OPACITY, Math.max(0, opacity)) * 100).toFixed(2))
  const background = `color-mix(in srgb, ${color} ${percent}%, var(--orca-background))`
  // Orca resets the active-card tokens in this mode, so the card keeps its derived colours.
  return { background, accent: `color-mix(in srgb, var(--orca-foreground) ${TINT_ACCENT_PERCENT}%, ${background})`, active: null, activeBorder: null }
}

async function fromSlot(slot: unknown, base: 'light' | 'dark', read: ReadThemeTokens): Promise<SidebarLook | null> {
  // Empty: no plugin theme, Orca's own colours. Anything else that is not a plugin theme (the
  // "match terminal" choice) depends on the terminal theme and is left to the estimate.
  if (slot === undefined || slot === null || slot === '') return BUILT_IN[base]
  if (typeof slot !== 'string' || !SLOT.test(slot)) return null
  const tokens = await read(slot)
  if (!tokens) return null
  // A theme that omits a token leaves Orca's built-in value in place.
  return {
    background: hex(tokens['--worktree-sidebar']) ?? BUILT_IN[base].background,
    accent: hex(tokens['--worktree-sidebar-accent']) ?? BUILT_IN[base].accent,
    active: hex(tokens['--worktree-sidebar-active']),
    activeBorder: hex(tokens['--worktree-sidebar-active-border'])
  }
}

/** The sidebar colours for the light and the dark theme Orca has chosen. Pure apart from `read`. */
export async function resolveSidebarLooks(settings: ThemeSettings | null, read: ReadThemeTokens): Promise<SidebarLooks> {
  if (!settings) return { light: null, dark: null }
  if (settings.mode === 'tinted') return { light: tinted(settings), dark: tinted(settings) }
  if (settings.mode === 'match-terminal') return { light: null, dark: null }
  const [light, dark] = await Promise.all([fromSlot(settings.light, 'light', read), fromSlot(settings.dark, 'dark', read)])
  return { light, dark }
}

/**
 * The settings row, or null when the database has none. A failure to read it (timeout, a moved
 * database, unreadable output) rejects, so the panel keeps the colours it has instead of dropping them.
 */
function query(database: string): Promise<ThemeSettings | null> {
  return new Promise((done, fail) => {
    execFile(SQLITE, ['-readonly', database, QUERY], { timeout: TIMEOUT_MS }, (error, stdout) => {
      if (error) return fail(error)
      if (stdout.trim() === '') return done(null)
      try {
        const parsed: unknown = JSON.parse(stdout)
        done(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as ThemeSettings) : null)
      } catch (parseError: unknown) {
        fail(parseError)
      }
    })
  })
}

export type ReadJson = (path: string) => Promise<unknown>

const readJsonFile: ReadJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/**
 * Finds a theme plugin's tokens on disk: `plugins.lock.json` names the installed version (its
 * `contentHash` is the folder name), the plugin's manifest lists the theme files. Read errors are not caught.
 */
export function createThemeReader(pluginsDir: string = join(homedir(), PLUGINS_DIR), readJson: ReadJson = readJsonFile): ReadThemeTokens {
  return async (slot) => {
    const match = SLOT.exec(slot)
    if (!match) return null
    const [, pluginKey, themeId] = match
    const lock = record(record(await readJson(join(pluginsDir, 'plugins.lock.json')))?.plugins)
    const contentHash = record(lock?.[pluginKey])?.contentHash
    if (typeof contentHash !== 'string' || !/^[0-9a-f]+$/.test(contentHash)) return null
    const root = resolve(pluginsDir, pluginKey, contentHash)
    const themes = record(record(await readJson(join(root, 'orca-plugin.json')))?.contributes)?.themes
    const entry = Array.isArray(themes) ? themes.map(record).find((theme) => theme?.id === themeId) : undefined
    if (typeof entry?.path !== 'string') return null
    // The manifest is data from a plugin: its path must stay inside the plugin's own folder.
    const file = resolve(root, entry.path)
    if (!file.startsWith(root + sep)) return null
    const tokens = record(record(await readJson(file))?.tokens)
    if (!tokens) return null
    const strings: Record<string, string> = {}
    for (const [name, value] of Object.entries(tokens)) if (typeof value === 'string') strings[name] = value
    return strings
  }
}

/** The sidebar colours Orca paints now; `null` for a theme that does not exist. Rejects when something cannot be read. */
export async function readSidebarLooks(
  database: string = join(homedir(), PROFILE_DB),
  read: ReadThemeTokens = createThemeReader()
): Promise<SidebarLooks> {
  return resolveSidebarLooks(await query(database), read)
}
