import { assert, test } from 'orca/testing'
import type { Attention, TreeNode } from '../types'
import { groupTree } from './grouping'
import { allCollapsed, containerKeys, pathTo, rowDescription, visibleRows } from './rows'

function ws(id: string, label: string, attention: Attention = 'none', children: TreeNode[] = [], activeAt?: number, primary?: boolean): TreeNode {
  return {
    kind: 'workspace',
    key: `ws:${id}`,
    workspaceId: id,
    label,
    linked: Boolean(primary),
    ...(primary ? { primary: true } : {}),
    attention,
    ...(activeAt !== undefined ? { activeAt } : {}),
    children
  }
}
function folder(label: string, children: TreeNode[]): TreeNode {
  return { kind: 'group', key: `g/${label}`, label, children }
}

const tree: TreeNode[] = [
  folder('~/work', [ws('b', 'beta', 'working'), folder('apps', [ws('a', 'alpha')])]),
  folder('~/play', [ws('c', 'Charlie', 'permission'), ws('d', 'delta', 'none', [ws('d1', 'wt', 'unread')])])
]

test('folder mode keeps folders above projects and in alphabetical order', () => {
  const result = groupTree(tree, 'folder')
  assert.deepEqual(result.map((node) => node.label), ['~/play', '~/work'])
  assert.deepEqual(result[1].children.map((node) => node.label), ['apps', 'beta'])
})

test('none mode lists every project by name, with its folder for the tooltip', () => {
  const list = groupTree(tree, 'none')
  assert.deepEqual(list.map((node) => node.label), ['alpha', 'beta', 'Charlie', 'delta'])
  const rows = visibleRows(list, new Set(), '')
  assert.equal(rowDescription(rows[0]), 'alpha · ~/work/apps')
  assert.equal(rowDescription(rows[1]), 'beta · ~/work · Agent working')
})

test('status mode makes a section per used status, strongest first, projects by name', () => {
  const sections = groupTree(tree, 'status')
  assert.deepEqual(sections.map((section) => section.label), ['Permission', 'Unread', 'Working', 'Idle'])
  assert.deepEqual(sections.map((section) => section.children.map((node) => node.label)), [['Charlie'], ['delta'], ['beta'], ['alpha']])
  assert.deepEqual(sections.map((section) => section.key), ['status:permission', 'status:unread', 'status:working', 'status:none'])
})

test('a folded section hides its projects, and a project with worktrees takes the strongest status below it', () => {
  const rows = visibleRows(groupTree(tree, 'status'), new Set(['status:permission']), '')
  assert.deepEqual(rows.map((row) => row.node.label), ['Permission', 'Unread', 'delta', 'wt', 'Working', 'beta', 'Idle', 'alpha'])
  assert.equal(rows[0].expanded, false)
})

test('the filter does not match a section by its title', () => {
  const sections = groupTree(tree, 'status')
  assert.deepEqual(visibleRows(sections, new Set(), 'work').map((row) => row.node.label), [])
  assert.deepEqual(visibleRows(sections, new Set(), 'idle').map((row) => row.node.label), [])
  assert.deepEqual(visibleRows(sections, new Set(), 'beta').map((row) => row.node.label), ['Working', 'beta'])
})

test('fold all and reveal work on sections', () => {
  const sections = groupTree(tree, 'status')
  assert.equal(allCollapsed(sections, new Set()), false)
  assert.equal(allCollapsed(sections, new Set(containerKeys(sections))), true)
  assert.deepEqual(pathTo(sections, (node) => node.kind === 'workspace' && node.workspaceId === 'b'), ['status:working'])
})

test('no projects gives no sections', () => {
  assert.deepEqual(groupTree([], 'status'), [])
  assert.deepEqual(groupTree([], 'none'), [])
})

test('recent sort orders by latest activeAt across worktrees and puts missing timestamps last by name', () => {
  const dated: TreeNode[] = [
    folder('~/work', [
      ws('a', 'alpha', 'none', [], 100),
      ws('b', 'beta', 'none', []),
      ws('c', 'charlie', 'none', [ws('c0', 'charlie', 'none', [], 50, true), ws('c1', 'feat', 'none', [], 300), ws('c2', 'bug', 'none', [], 150)]),
      ws('d', 'delta', 'none', [])
    ])
  ]
  const flat = groupTree(dated, 'none', 'recent')
  assert.deepEqual(flat.map((node) => node.label), ['charlie', 'alpha', 'beta', 'delta'])
  // Primary stays first; other worktrees follow the active sort rule.
  assert.deepEqual(flat[0].children.map((node) => node.label), ['charlie', 'feat', 'bug'])

  const grouped = groupTree(dated, 'folder', 'recent')
  assert.deepEqual(grouped[0].children.map((node) => node.label), ['charlie', 'alpha', 'beta', 'delta'])
})

test('status sort orders by strongest attention, then recent, then name', () => {
  const active: TreeNode[] = [
    folder('~/work', [
      ws('a', 'alpha', 'working', [], 100),
      ws('b', 'beta', 'working', [], 200),
      ws('c', 'charlie', 'permission', [], 50),
      ws('d', 'delta', 'none', [ws('d0', 'delta', 'none', [], 500, true), ws('d1', 'fix', 'unread', [], 10)])
    ])
  ]
  const flat = groupTree(active, 'none', 'status')
  assert.deepEqual(flat.map((node) => node.label), ['charlie', 'delta', 'beta', 'alpha'])
  assert.deepEqual(flat[1].children.map((node) => node.label), ['delta', 'fix'])

  const reversed = groupTree(active, 'none', 'status', 'asc')
  assert.deepEqual(reversed.map((node) => node.label), ['beta', 'alpha', 'delta', 'charlie'])
})

test('reverse direction flips name and recent while keeping missing timestamps last', () => {
  const dated: TreeNode[] = [
    folder('~/work', [
      ws('a', 'alpha', 'none', [], 100),
      ws('b', 'beta', 'none', []),
      ws('c', 'charlie', 'none', [], 300),
      ws('d', 'delta', 'none', [])
    ])
  ]
  assert.deepEqual(
    groupTree(dated, 'none', 'name', 'desc').map((node) => node.label),
    ['delta', 'charlie', 'beta', 'alpha']
  )
  assert.deepEqual(
    groupTree(dated, 'none', 'recent', 'asc').map((node) => node.label),
    ['alpha', 'charlie', 'beta', 'delta']
  )
})

test('manual sort follows saved project keys, puts unseen projects last alphabetically, and keeps worktrees alphabetical', () => {
  const dated: TreeNode[] = [
    folder('~/work', [
      ws('a', 'alpha', 'none', [], 100),
      ws('b', 'beta', 'none', []),
      ws('c', 'charlie', 'none', [ws('c1', 'zeta', 'none', [], 300), ws('c0', 'charlie', 'none', [], 50, true)]),
      ws('d', 'delta', 'none', [])
    ])
  ]
  const flat = groupTree(dated, 'none', 'manual', 'asc', ['ws:d', 'ws:b'])
  assert.deepEqual(flat.map((node) => node.label), ['delta', 'beta', 'alpha', 'charlie'])
  assert.deepEqual(flat[3].children.map((node) => node.label), ['charlie', 'zeta'])

  const grouped = groupTree(dated, 'folder', 'manual', 'asc', ['ws:c', 'ws:a'])
  assert.deepEqual(grouped[0].children.map((node) => node.label), ['charlie', 'alpha', 'beta', 'delta'])
})

test('primary worktree always stays first regardless of sort mode and direction', () => {
  const projectTree: TreeNode[] = [
    folder('~/work', [
      ws('p', 'mid', 'none', [
        ws('w1', 'alpha', 'permission', [], 300),
        ws('p0', 'mid', 'none', [], 10, true),
        ws('w2', 'zeta', 'working', [], 200)
      ])
    ])
  ]
  assert.deepEqual(groupTree(projectTree, 'none', 'name', 'asc')[0].children.map((n) => n.label), ['mid', 'alpha', 'zeta'])
  assert.deepEqual(groupTree(projectTree, 'none', 'name', 'desc')[0].children.map((n) => n.label), ['mid', 'zeta', 'alpha'])
  assert.deepEqual(groupTree(projectTree, 'none', 'recent', 'desc')[0].children.map((n) => n.label), ['mid', 'alpha', 'zeta'])
  assert.deepEqual(groupTree(projectTree, 'none', 'recent', 'asc')[0].children.map((n) => n.label), ['mid', 'zeta', 'alpha'])
  assert.deepEqual(groupTree(projectTree, 'none', 'status', 'desc')[0].children.map((n) => n.label), ['mid', 'alpha', 'zeta'])
  assert.deepEqual(groupTree(projectTree, 'none', 'status', 'asc')[0].children.map((n) => n.label), ['mid', 'zeta', 'alpha'])
  assert.deepEqual(groupTree(projectTree, 'none', 'manual', 'asc')[0].children.map((n) => n.label), ['mid', 'alpha', 'zeta'])
})
