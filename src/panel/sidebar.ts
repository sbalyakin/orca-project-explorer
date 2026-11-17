// The left sidebar's colours as the worker read them (`theme.get`), kept between sessions.
// Pure: no DOM, so the shape check and the choice of base are testable in Node.
import type { SidebarLook, SidebarLooks } from '../types'

function parseLook(value: unknown): SidebarLook | null {
  if (typeof value !== 'object' || value === null) return null
  const { background, accent, active, activeBorder } = value as Record<string, unknown>
  if (typeof background !== 'string' || typeof accent !== 'string') return null
  // An older cache has no card colours: they read as "none" until the next answer.
  return { background, accent, active: typeof active === 'string' ? active : null, activeBorder: typeof activeBorder === 'string' ? activeBorder : null }
}

/** A cached answer, or null when it is missing or of an older shape. */
export function parseLooks(stored: unknown): SidebarLooks | null {
  if (typeof stored !== 'object' || stored === null) return null
  const { light, dark } = stored as Record<string, unknown>
  return { light: parseLook(light), dark: parseLook(dark) }
}

/** The look for the theme base on screen; null leaves the stylesheet's estimate in force. */
export function lookFor(looks: SidebarLooks | null, dark: boolean): SidebarLook | null {
  return looks ? (dark ? looks.dark : looks.light) : null
}
