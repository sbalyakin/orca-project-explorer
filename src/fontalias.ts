// A font a plugin contributes is named by Orca `<family> (<pluginKey>)` (`plugin-font-contribution.ts`).
// Shared by the worker (to find the files) and the panel (to see whether the font is one of those).
export type FontAlias = { family: string; pluginKey: string }

const ALIAS = /^(.+) \(([A-Za-z0-9][A-Za-z0-9._-]*)\)$/

export function parseFontAlias(name: string): FontAlias | null {
  const match = ALIAS.exec(name.trim())
  return match ? { family: match[1], pluginKey: match[2] } : null
}

/** The first family of a CSS `font-family` stack, unquoted; null for an empty stack. */
export function firstFamily(stack: string): string | null {
  const first = stack.trim()
  if (first === '') return null
  const quoted = /^(["'])(.*?)\1/.exec(first)
  if (quoted) return quoted[2]
  return first.split(',')[0].trim() || null
}
