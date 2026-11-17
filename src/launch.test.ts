import { assert, test } from 'orca/testing'
import { launchArgs, worktreeSelector } from './launch'

test('worktree selectors: identity ids as they are, folder ids behind id:', () => {
  assert.equal(worktreeSelector('identity:wt2:local:abc'), 'identity:wt2:local:abc')
  assert.equal(worktreeSelector('uuid::/Users/me/notes'), 'id:uuid::/Users/me/notes')
})

test('launch args: model and effort go together, an empty prompt is left out', () => {
  const base = { workspaceId: 'identity:wt2:local:abc', agent: 'codex', surface: 'chat' as const }
  assert.deepEqual(launchArgs({ ...base, model: 'gpt-6-luna', effort: 'high', prompt: 'Fix it' }), [
    'agent', 'launch', '--agent', 'codex', '--worktree', 'identity:wt2:local:abc', '--focus', '--json', '--surface', 'chat',
    '--model', 'gpt-6-luna', '--effort', 'high', '--prompt', 'Fix it'
  ])
  const plain = launchArgs({ ...base, effort: 'high', prompt: '  ' })
  assert.equal(plain.includes('--effort'), false)
  assert.equal(plain.includes('--prompt'), false)
})

test('launch args: no surface flag leaves the choice to Orca', () => {
  const args = launchArgs({ workspaceId: 'identity:wt2:local:abc', agent: 'pi' })
  assert.equal(args.includes('--surface'), false)
})
