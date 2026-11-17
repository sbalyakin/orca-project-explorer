import { assert, test } from 'orca/testing'
import { createChord, newWorktreeArgs, toChord } from './newworktree'

test('the hotkey call has no screenshot and carries the chord', () => {
  const args = newWorktreeArgs('CmdOrCtrl+N')
  assert.equal(args[0], 'computer')
  assert.equal(args[1], 'hotkey')
  assert.equal(args[args.indexOf('--key') + 1], 'CmdOrCtrl+N')
  assert.ok(args.includes('--no-screenshot'))
})

test('shortcut text becomes a chord', () => {
  assert.equal(toChord('Mod+Shift+N'), 'CmdOrCtrl+Shift+N')
  assert.equal(toChord('Mod+Comma'), 'CmdOrCtrl+,')
  assert.equal(toChord('Ctrl+Alt+Enter'), 'Ctrl+Alt+Return')
  assert.equal(toChord('N'), null)
  assert.equal(toChord('Hyper+N'), null)
})

test('no override: the default; platform beats common; unbound is null', () => {
  assert.equal(createChord({}, 'darwin'), 'CmdOrCtrl+N')
  assert.equal(createChord(null, 'darwin'), 'CmdOrCtrl+N')
  const doc = {
    keybindings: { 'workspace.create': ['Mod+J'] },
    platforms: { darwin: { 'workspace.create': ['Mod+Alt+K'] }, linux: {} }
  }
  assert.equal(createChord(doc, 'darwin'), 'CmdOrCtrl+Alt+K')
  assert.equal(createChord(doc, 'linux'), 'CmdOrCtrl+J')
  assert.equal(createChord({ platforms: { darwin: { 'workspace.create': [] } } }, 'darwin'), null)
  assert.equal(createChord({ platforms: { darwin: { 'workspace.create': 'Mod+B' } } }, 'darwin'), 'CmdOrCtrl+B')
})
