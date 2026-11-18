// Declares the interface font in the panel when Orca's font is one a plugin contributes. Orca keeps those
// in its own window, so the frame gets the name in `--orca-font-sans` but not the font: the worker sends the files.
// The last answer is kept in `orca.storage`, so the next start draws the font from the first frame.
import '../protocol'
import { firstFamily, parseFontAlias } from '../fontalias'
import { isMeta, joinFaces, splitFaces } from '../fontcache'
import type { FontFace } from '../types'

const CACHE_KEY = 'pluginfont:v1'
const style = document.createElement('style')
let declared: string | null = null
let sequence = 0

function css(family: string, faces: readonly FontFace[]): string {
  return faces
    .map(
      ({ weight, mime, data }) =>
        `@font-face { font-family: ${JSON.stringify(family)}; font-weight: ${weight}; font-style: normal; font-display: swap; src: url(data:${mime};base64,${data}); }`
    )
    .join('\n')
}

function currentFamily(): string | null {
  return firstFamily(getComputedStyle(document.documentElement).getPropertyValue('--orca-font-sans'))
}

function declare(family: string, faces: readonly FontFace[]): void {
  style.textContent = css(family, faces)
  document.head.appendChild(style)
  declared = family
}

function isFace(value: unknown): value is FontFace {
  const face = value as Partial<Record<keyof FontFace, unknown>> | null
  return typeof face?.weight === 'string' && typeof face.mime === 'string' && typeof face.data === 'string'
}

/** Draws the cached faces when they belong to the font Orca uses now; anything else in the cache is ignored. */
export function restorePluginFont(stored: unknown): void {
  const cache = stored as { family?: unknown; faces?: unknown } | null
  if (typeof cache?.family !== 'string' || !Array.isArray(cache.faces) || !cache.faces.every(isFace)) return
  if (declared === null && cache.family === currentFamily() && cache.faces.length > 0) declare(cache.family, cache.faces)
}

/** The cached answer as `{ family, faces }`, or null when it is missing or incomplete. */
export async function readPluginFontCache(): Promise<unknown> {
  const meta = await orca.storage.get(CACHE_KEY)
  if (!isMeta(meta)) return null
  const parts = await Promise.all(Array.from({ length: meta.parts }, (_, part) => orca.storage.get(`${CACHE_KEY}:${part}`)))
  if (!parts.every((part): part is string => typeof part === 'string')) return null
  const faces = joinFaces(meta, parts)
  return faces && { family: meta.family, faces }
}

/** Pieces first, the description last: an interrupted write leaves a cache that is ignored. */
async function writePluginFontCache(family: string, faces: readonly FontFace[]): Promise<void> {
  const { meta, parts } = splitFaces(family, faces)
  for (const [part, piece] of parts.entries()) await orca.storage.set(`${CACHE_KEY}:${part}`, piece)
  await orca.storage.set(CACHE_KEY, meta)
}

/** Reads the current font name and declares it when a plugin owns it. Keeps what is on screen on any failure. */
export async function syncPluginFont(): Promise<void> {
  const family = currentFamily()
  if (family === declared) return
  const request = ++sequence
  if (!family || !parseFontAlias(family)) {
    style.remove()
    declared = family
    return
  }
  try {
    const faces: FontFace[] = []
    let total = 1
    for (let index = 0; index < total; index++) {
      const reply = await orca.plugin.request('font.face', { alias: family, index })
      if (request !== sequence) return
      if (!reply) return // the font's files are not on disk: the stack falls back
      total = reply.total
      // A face that cannot be sent (too big) is skipped; the others still draw.
      if (reply.face) faces.push(reply.face)
    }
    if (faces.length === 0) return
    if (declared !== family) declare(family, faces)
    // A failed write only costs the cache: the font then arrives after the first frame.
    writePluginFontCache(family, faces).catch(() => {})
  } catch {
    // Keep the font on screen; the stack falls back to Geist.
  }
}
