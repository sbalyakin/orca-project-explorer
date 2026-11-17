// Orca's interface font. The host gives panels no font setting, so the worker reads `appFontFamily`
// from Orca's profile database (read-only, that one value) and builds the stack as Orca does.
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_FONT = 'Geist'
const FALLBACKS = [DEFAULT_FONT, '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
const KEYWORDS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'blinkmacsystemfont'])
const SQLITE = '/usr/bin/sqlite3'
const PROFILE_DB = join('Library', 'Application Support', 'orca', 'profiles', 'local-default', 'profile-state.db')
const QUERY = "select json_extract(payload, '$.appFontFamily') from profile_state_documents where domain = 'settings'"
const TIMEOUT_MS = 5000

function quote(family: string): string {
  return family.startsWith('-') || KEYWORDS.has(family.toLowerCase()) ? family : JSON.stringify(family)
}

/** Mirrors `buildAppFontFamily` in Orca's `app-font-family.ts`: the chosen family first, then the fallbacks. */
export function buildAppFontFamily(family: string | null | undefined): string {
  // Structural characters would end the declaration the panel puts this into.
  const chosen = family?.replace(/[;{}<>\\]/g, '').trim() || DEFAULT_FONT
  const rest = FALLBACKS.filter((fallback) => fallback.toLowerCase() !== chosen.toLowerCase())
  return [chosen, ...rest].map(quote).join(', ')
}

/** The CSS font stack Orca draws its interface with now; Orca's default stack when it cannot be read. */
export function readAppFont(database: string = join(homedir(), PROFILE_DB)): Promise<string> {
  return new Promise((resolve) => {
    execFile(SQLITE, ['-readonly', database, QUERY], { timeout: TIMEOUT_MS }, (error, stdout) =>
      resolve(buildAppFontFamily(error ? null : stdout.trim()))
    )
  })
}
