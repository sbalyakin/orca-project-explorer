import { assert, test } from 'orca/testing'
import { setUnreadArgs, worktreeSelector } from './worktree'

test('worktreeSelector keeps identity: and folder: ids and prefixes raw ids with id:', () => {
  assert.equal(worktreeSelector('identity:wt2:local:abc'), 'identity:wt2:local:abc')
  assert.equal(worktreeSelector('folder:f1'), 'folder:f1')
  assert.equal(worktreeSelector('r1::/Users/me/hacks'), 'id:r1::/Users/me/hacks')
  assert.equal(worktreeSelector('r1::/Users/me/hacks::workspace:w1'), 'id:r1::/Users/me/hacks::workspace:w1')
})

test('setUnreadArgs builds the CLI flags for --read and --unread', () => {
  assert.deepEqual(setUnreadArgs('identity:wt2:local:abc', false), [
    'worktree', 'set', '--worktree', 'identity:wt2:local:abc', '--read', '--json'
  ])
  assert.deepEqual(setUnreadArgs('r1::/Users/me/app', true), [
    'worktree', 'set', '--worktree', 'id:r1::/Users/me/app', '--unread', '--json'
  ])
})
