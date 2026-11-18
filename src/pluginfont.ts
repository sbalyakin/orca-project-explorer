// Files of a font a plugin contributes. Orca loads such fonts into its own window only, so a panel
// frame cannot see them: the worker reads the files from the plugin's folder and the panel declares them.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { findPluginRoot, PLUGINS_DIR, readJsonFile, record, type ReadJson } from './apptheme'
import { parseFontAlias } from './fontalias'
import type { FontFace } from './types'

const MIME: Record<string, string> = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }
/** One face per reply: the host caps what crosses the bridge, and a regular face is about 50 KB. */
const MAX_FACE_BYTES = 150_000

/**
 * The `index`-th upright face of the font named `alias` (`Family (plugin.key)`), with the number of such faces;
 * null when the font, the plugin or the index is not there. A file that is missing, too big or of an unknown type
 * gives `face: null`, so the caller keeps the other faces. Italic faces are skipped: the panel draws none.
 */
export async function readFontFace(
  alias: string,
  index: number,
  pluginsDir: string = join(homedir(), PLUGINS_DIR),
  readJson: ReadJson = readJsonFile,
  readBytes: typeof readFile = readFile
): Promise<{ total: number; face: FontFace | null } | null> {
  const parsed = parseFontAlias(alias)
  if (!parsed) return null
  const root = await findPluginRoot(pluginsDir, parsed.pluginKey, readJson)
  if (!root) return null
  const fonts = record(record(await readJson(join(root, 'orca-plugin.json')))?.contributes)?.fonts
  const font = Array.isArray(fonts) ? fonts.map(record).find((entry) => entry?.family === parsed.family) : undefined
  const faces = (Array.isArray(font?.faces) ? font.faces.map(record) : []).filter((face) => face?.style === 'normal' || face?.style === undefined)
  const face = faces[index]
  if (!face) return null
  const total = faces.length
  if (typeof face.path !== 'string') return { total, face: null }
  // The manifest is data from a plugin: the path must stay inside the plugin's own folder.
  const file = resolve(root, face.path)
  if (!file.startsWith(root + sep)) return { total, face: null }
  const mime = MIME[file.slice(file.lastIndexOf('.') + 1).toLowerCase()]
  if (!mime) return { total, face: null }
  const bytes = await readBytes(file)
  if (bytes.length > MAX_FACE_BYTES) return { total, face: null }
  const weight = typeof face.weight === 'string' || typeof face.weight === 'number' ? String(face.weight) : '400'
  return { total, face: { weight, mime, data: bytes.toString('base64') } }
}
