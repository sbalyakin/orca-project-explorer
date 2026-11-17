import { assert, test } from 'orca/testing'
import { createThemeReader, readSidebarLooks, resolveSidebarLooks, type ReadThemeTokens } from './apptheme'

const DARK = 'plugin:acme.night/night'
const tokens: Record<string, Record<string, string>> = {
  [DARK]: {
    '--worktree-sidebar': '#20201E',
    '--worktree-sidebar-accent': '#2E2E2B',
    '--worktree-sidebar-active': '#2D2C28',
    '--worktree-sidebar-active-border': '#D97757'
  },
  'plugin:acme.night/bare': { '--background': '#000000' },
  'plugin:acme.night/evil': { '--worktree-sidebar': 'red; background: url(x)', '--worktree-sidebar-accent': 'var(--x)' }
}
const read: ReadThemeTokens = async (slot) => tokens[slot] ?? null

test('a plugin theme gives its own sidebar colours for the base it is chosen for', async () => {
  const looks = await resolveSidebarLooks({ mode: 'default', dark: DARK }, read)
  assert.deepEqual(looks.dark, { background: '#20201E', accent: '#2E2E2B', active: '#2D2C28', activeBorder: '#D97757' })
  // No theme chosen for light: Orca's own light colours.
  assert.deepEqual(looks.light, { background: '#f5f5f5', accent: '#eaeaea', active: null, activeBorder: null })
})

test('a theme that omits the tokens, or holds anything but a hex colour, falls back to the built-in colours', async () => {
  const bare = await resolveSidebarLooks({ mode: 'default', dark: 'plugin:acme.night/bare' }, read)
  assert.deepEqual(bare.dark, { background: '#2a2a2a', accent: '#353535', active: null, activeBorder: null })
  const evil = await resolveSidebarLooks({ mode: 'default', dark: 'plugin:acme.night/evil' }, read)
  assert.deepEqual(evil.dark, { background: '#2a2a2a', accent: '#353535', active: null, activeBorder: null })
})

test('an unreadable theme, a foreign slot or "match terminal" leave the colour to the estimate', async () => {
  assert.equal((await resolveSidebarLooks({ mode: 'default', dark: 'plugin:acme.night/missing' }, read)).dark, null)
  assert.equal((await resolveSidebarLooks({ mode: 'default', dark: 'match-terminal' }, read)).dark, null)
  assert.equal((await resolveSidebarLooks({ mode: 'default', dark: 42 }, read)).dark, null)
  assert.deepEqual(await resolveSidebarLooks({ mode: 'match-terminal' }, read), { light: null, dark: null })
  assert.deepEqual(await resolveSidebarLooks(null, read), { light: null, dark: null })
})

test('the tinted mode mixes the tint into the app background, capped at 35%', async () => {
  const looks = await resolveSidebarLooks({ mode: 'tinted', tintColor: '#434f60', tintOpacity: 0.35 }, read)
  assert.equal(looks.dark?.background, 'color-mix(in srgb, #434f60 35%, var(--orca-background))')
  assert.equal(looks.dark?.accent, 'color-mix(in srgb, var(--orca-foreground) 9%, color-mix(in srgb, #434f60 35%, var(--orca-background)))')
  const capped = await resolveSidebarLooks({ mode: 'tinted', tintColor: '#434f60', tintOpacity: 2 }, read)
  assert.ok(capped.light?.background.includes(' 35%'))
  const defaults = await resolveSidebarLooks({ mode: 'tinted', tintColor: 'not a colour' }, read)
  assert.equal(defaults.light?.background, 'color-mix(in srgb, #18181b 8%, var(--orca-background))')
})

const files: Record<string, unknown> = {
  '/p/plugins.lock.json': { version: 1, plugins: { 'acme.night': { contentHash: 'abc123' } } },
  '/p/acme.night/abc123/orca-plugin.json': {
    contributes: {
      themes: [
        { id: 'night', path: 'themes/night.json' },
        { id: 'escape', path: '../../../outside.json' },
        { id: 'ghost', path: 'themes/ghost.json' }
      ]
    }
  },
  '/p/acme.night/abc123/themes/night.json': { tokens: { '--worktree-sidebar': '#111111', '--other': 5 } },
  '/p/outside.json': { tokens: { '--worktree-sidebar': '#ffffff' } }
}
const readFromFiles = createThemeReader('/p', async (path) => {
  if (!(path in files)) throw new Error(`no such file: ${path}`)
  return files[path]
})

test('a theme is found through the lock file and the plugin manifest; non-text tokens are dropped', async () => {
  assert.deepEqual(await readFromFiles('plugin:acme.night/night'), { '--worktree-sidebar': '#111111' })
})

test('a theme file that is missing now is an error, not "no such theme"', async () => {
  await assert.rejects(readFromFiles('plugin:acme.night/ghost'))
})

test('a lock file that cannot be read is an error too', async () => {
  const noLock = createThemeReader('/elsewhere', async () => {
    throw new Error('ENOENT')
  })
  await assert.rejects(noLock('plugin:acme.night/night'))
})

test('unknown plugins and themes give null, and a manifest path cannot leave the plugin folder', async () => {
  assert.equal(await readFromFiles('plugin:acme.night/none'), null)
  assert.equal(await readFromFiles('plugin:other.plugin/night'), null)
  assert.equal(await readFromFiles('plugin:acme.night/escape'), null)
  assert.equal(await readFromFiles('plugin:../x/night'), null)
})

test('a database that cannot be read is an error, not "no colours", so the panel keeps what it shows', async () => {
  await assert.rejects(readSidebarLooks('/nonexistent/profile-state.db', read))
})
