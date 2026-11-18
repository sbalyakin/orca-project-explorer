// The panel keeps a plugin font's faces in `orca.storage`. A panel may send the host at most 64 KiB per message,
// so the faces go in pieces. These are the pure parts: cutting into pieces and joining them back.
import type { FontFace } from './types'

/** Characters per piece: well under the 64 KiB message cap, with room for the key and the envelope. */
export const CHUNK_CHARS = 40_000

export type CacheMeta = { family: string; faces: { weight: string; mime: string; length: number }[]; parts: number }

export function isMeta(value: unknown): value is CacheMeta {
  const meta = value as Partial<CacheMeta> | null
  return (
    typeof meta?.family === 'string' &&
    typeof meta.parts === 'number' &&
    Array.isArray(meta.faces) &&
    meta.faces.every((face) => typeof face?.weight === 'string' && typeof face.mime === 'string' && typeof face.length === 'number')
  )
}

/** The description of `faces` and their data cut into pieces of at most `chunk` characters. */
export function splitFaces(family: string, faces: readonly FontFace[], chunk: number = CHUNK_CHARS): { meta: CacheMeta; parts: string[] } {
  const all = faces.map((face) => face.data).join('')
  const parts: string[] = []
  for (let at = 0; at < all.length; at += chunk) parts.push(all.slice(at, at + chunk))
  return { meta: { family, parts: parts.length, faces: faces.map(({ weight, mime, data }) => ({ weight, mime, length: data.length })) }, parts }
}

/** The faces back from a description and its pieces; null when the pieces do not add up to what the description says. */
export function joinFaces(meta: CacheMeta, parts: readonly string[]): FontFace[] | null {
  const all = parts.join('')
  if (parts.length !== meta.parts || all.length !== meta.faces.reduce((sum, face) => sum + face.length, 0)) return null
  let at = 0
  return meta.faces.map(({ weight, mime, length }) => {
    const data = all.slice(at, at + length)
    at += length
    return { weight, mime, data }
  })
}
