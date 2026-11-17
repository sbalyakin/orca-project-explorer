// Opens Orca's own "Create worktree" window. The plugin host has no method for it (only `workspace.create`,
// which has no UI), so the worker sends the window's shortcut (action `workspace.create`, default Mod+N)
// through `orca computer hotkey`. The shortcut is read from Orca's `~/.orca/keybindings.json`, so a rebind works.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { childEnv, findCommand } from './catalog/run'

const TIMEOUT_MS = 20_000
const APP_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const ORCA_BUNDLE_ID = 'com.stablyai.orca'
const KEYBINDINGS = join(homedir(), '.orca', 'keybindings.json')
// The plugin is macOS-only (the CLI path above, `orca computer`), so the platform section is fixed.
const PLATFORM = 'darwin'
const ACTION = 'workspace.create'
const DEFAULT_CHORD = 'CmdOrCtrl+N'

const MODIFIERS: Record<string, string> = { mod: 'CmdOrCtrl', cmd: 'Cmd', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' }
// Orca's key tokens (`parser.js`) that `orca computer hotkey` names differently or as a character. Punctuation
// as a character: the CLI takes `,` and refuses `Comma` (`unsupported key 'CmdOrCtrl+Comma'`, checked 2026-11-17).
const KEYS: Record<string, string> = {
  Enter: 'Return', ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Plus: '+', Comma: ',', Period: '.',
  Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Orca's shortcut text (`Mod+Shift+N`) as a chord for `orca computer hotkey`; null when it is not a plain chord. */
export function toChord(binding: string): string | null {
  const parts = binding.split('+').map((part) => part.trim())
  const key = parts.pop()
  if (!key || parts.length === 0) return null
  const modifiers = parts.map((part) => MODIFIERS[part.toLowerCase()])
  if (modifiers.some((modifier) => modifier === undefined)) return null
  return [...modifiers, KEYS[key] ?? key].join('+')
}

/**
 * The chord for the create-worktree window from a parsed `keybindings.json` (a platform's override beats the
 * common one, which beats Orca's default). Null when the person unbound it.
 */
export function createChord(document: unknown, platform: string): string | null {
  const platforms = isRecord(document) && isRecord(document.platforms) ? document.platforms : {}
  const forPlatform = isRecord(platforms[platform]) ? platforms[platform] : {}
  const common = isRecord(document) && isRecord(document.keybindings) ? document.keybindings : {}
  const set = [forPlatform, common].find((section) => Object.hasOwn(section, ACTION))
  if (!set) return DEFAULT_CHORD
  const value = set[ACTION]
  const bindings = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  for (const binding of bindings) {
    const chord = typeof binding === 'string' ? toChord(binding) : null
    if (chord) return chord
  }
  return null
}

export function newWorktreeArgs(chord: string): string[] {
  return ['computer', 'hotkey', '--app', ORCA_BUNDLE_ID, '--key', chord, '--no-screenshot', '--json']
}

async function readChord(): Promise<string | null> {
  let text: string
  try {
    text = await readFile(KEYBINDINGS, 'utf8')
  } catch {
    return DEFAULT_CHORD // no file: Orca's defaults
  }
  try {
    return createChord(JSON.parse(text), PLATFORM)
  } catch {
    return DEFAULT_CHORD // a broken file: Orca falls back to its defaults too (assumed)
  }
}

export async function openNewWorktreeDialog(): Promise<void> {
  const cli = findCommand(['orca'], [APP_CLI])
  if (!cli) throw new Error('the orca command was not found')
  const chord = await readChord()
  if (!chord) throw new Error('"Create worktree" has no shortcut in Orca, or one the plugin cannot press')
  return new Promise((resolve, reject) => {
    execFile(cli, newWorktreeArgs(chord), { timeout: TIMEOUT_MS, env: childEnv() }, (error, stdout, stderr) => {
      let message = error ? (stderr || error.message).trim().slice(-300) : ''
      try {
        const reply = JSON.parse(stdout) as { ok?: unknown; error?: { message?: unknown } }
        if (reply.ok === false) message = typeof reply.error?.message === 'string' ? reply.error.message : 'the shortcut was refused'
      } catch {
        // Output that is not JSON counts as success when the process exited cleanly.
      }
      if (message) reject(new Error(message))
      else resolve()
    })
  })
}
