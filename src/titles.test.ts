import { assert, test } from 'orca/testing'
import { latestByPath, parseCliAgents, titleOf } from './titles'

test('the newest agent with a title gives it', () => {
  assert.equal(titleOf([{ title: null }, { title: '  Fix tests ' }, { title: 'old' }]), 'Fix tests')
})

test('an open task names an agent that has no title', () => {
  assert.equal(titleOf([{ title: '', task: { title: 'Review PR' } }]), 'Review PR')
})

test('no agents or no titles give nothing', () => {
  assert.equal(titleOf([]), undefined)
  assert.equal(titleOf([{ title: null, task: null }, { title: ' ', task: { title: '' } }]), undefined)
})

const cli = JSON.stringify({
  result: {
    agents: [
      { worktreeId: 'r1::/a/b', title: 'old', updatedAt: 1 },
      { worktreeId: 'r1::/a/b', title: ' new ', updatedAt: 5 },
      { worktreeId: 'r2::/c', title: null, updatedAt: 9 },
      { worktreeId: 'no-separator', title: 'x', updatedAt: 9 },
      { worktreeId: 'r3::/d', title: 'chat', updatedAt: 2 }
    ]
  }
})

test('CLI agents are tied to a folder by the path in their worktree id, the newest title wins', () => {
  assert.deepEqual([...latestByPath(parseCliAgents(cli))], [['/a/b', 'new'], ['/d', 'chat']])
})

test('unreadable CLI output gives no agents', () => {
  assert.deepEqual(parseCliAgents('not json'), [])
  assert.deepEqual(parseCliAgents('{}'), [])
})
