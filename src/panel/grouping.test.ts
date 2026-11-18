import { assert, test } from 'orca/testing'
import type { Attention, TreeNode } from '../types'
import { groupTree } from './grouping'
import { allCollapsed, containerKeys, pathTo, rowDescription, visibleRows } from './rows'

function ws(id: string, label: string, attention: Attention = 'none', children: TreeNode[] = []): TreeNode {
  return { kind: 'workspace', key: `ws:${id}`, workspaceId: id, label, linked: false, attention, children }
}
function folder(label: string, children: TreeNode[]): TreeNode {
  return { kind: 'group', key: `g/${label}`, label, children }
}

const tree: TreeNode[] = [
  folder('~/work', [ws('b', 'beta', 'working'), folder('apps', [ws('a', 'alpha')])]),
  folder('~/play', [ws('c', 'Charlie', 'permission'), ws('d', 'delta', 'none', [ws('d1', 'wt', 'unread')])])
]

test('folder mode leaves the tree as it is', () => {
  assert.equal(groupTree(tree, 'folder'), tree)
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
