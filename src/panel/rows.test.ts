import { assert, test } from 'orca/testing'
import type { Attention, TreeNode, WorkspaceNode } from '../types'
import { allCollapsed, canRename, containerKeys, keepLooks, navigate, pathTo, projectOf, projectsOf, rowDescription, visibleRows } from './rows'

function ws(id: string, label: string, attention: Attention = 'none', children: TreeNode[] = []): TreeNode {
  return { kind: 'workspace', key: `ws:${id}`, workspaceId: id, label, linked: false, attention, children }
}
function group(key: string, children: TreeNode[]): TreeNode {
  return { kind: 'group', key, label: key, children }
}

const tree = [group('g1', [group('g2', [ws('a', 'alpha', 'unread'), ws('b', 'beta')]), ws('c', 'gamma')])]
const keys = (rows: ReturnType<typeof visibleRows>): string[] => rows.map((row) => row.node.key)

test('rows follow what is expanded, with their depth', () => {
  const rows = visibleRows(tree, new Set(), '')
  assert.deepEqual(keys(rows), ['g1', 'g2', 'ws:a', 'ws:b', 'ws:c'])
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 2, 2, 1])
  assert.deepEqual(keys(visibleRows(tree, new Set(['g2']), '')), ['g1', 'g2', 'ws:c'])
})

test('a folded folder shows the strongest status below it', () => {
  const rows = visibleRows(tree, new Set(['g2']), '')
  assert.equal(rows[1].attention, 'unread')
  assert.equal(visibleRows(tree, new Set(), '')[1].attention, 'none')
})

test('a filter keeps matches and the folders above them, even folded ones', () => {
  assert.deepEqual(keys(visibleRows(tree, new Set(['g1']), 'BET')), ['g1', 'g2', 'ws:b'])
  assert.deepEqual(keys(visibleRows(tree, new Set(), 'nothing')), [])
  assert.deepEqual(keys(visibleRows(tree, new Set(), 'g2')), ['g1', 'g2', 'ws:a', 'ws:b'])
})

test('a row describes itself with its branch and status in words', () => {
  const branched: TreeNode = { ...ws('d', 'delta', 'permission'), detail: 'main' } as TreeNode
  assert.equal(rowDescription(visibleRows([branched], new Set(), '')[0]), 'delta · main · Waiting for permission')
  const rows = visibleRows(tree, new Set(['g2']), '')
  assert.equal(rowDescription(rows[1]), 'g2 · Unread inside')
  assert.equal(rowDescription(rows[2]), 'gamma')
})

test('container keys and the path to a workspace', () => {
  assert.deepEqual(containerKeys(tree), ['g1', 'g2'])
  assert.deepEqual(pathTo(tree, (node) => node.kind === 'workspace' && node.workspaceId === 'b'), ['g1', 'g2'])
  assert.equal(pathTo(tree, (node) => node.key === 'missing'), null)
})

test('all collapsed only when every folder is folded', () => {
  assert.equal(allCollapsed(tree, new Set()), false)
  assert.equal(allCollapsed(tree, new Set(['g1'])), false)
  assert.equal(allCollapsed(tree, new Set(['g1', 'g2'])), true)
  assert.equal(allCollapsed([ws('a', 'A')], new Set()), false)
})

test('a tree without looks takes them from the earlier tree by row key', () => {
  const earlier = [group('g', [{ ...ws('a', 'alpha'), icon: { type: 'emoji', emoji: '📚' }, color: '#8b5cf6' } as TreeNode])]
  const fresh = [group('g', [ws('a', 'alpha', 'unread'), ws('b', 'beta')])]
  keepLooks(fresh, earlier)
  const [a, b] = fresh[0].children
  assert.deepEqual(a, { ...ws('a', 'alpha', 'unread'), icon: { type: 'emoji', emoji: '📚' }, color: '#8b5cf6' })
  assert.deepEqual(b, ws('b', 'beta'))
})

test('arrow keys move, fold and unfold', () => {
  const rows = visibleRows(tree, new Set(), '')
  assert.equal(navigate(rows, null, 'down').selectedKey, 'g1')
  assert.equal(navigate(rows, 'ws:b', 'down').selectedKey, 'ws:c')
  assert.equal(navigate(rows, 'ws:c', 'down').selectedKey, 'ws:c')
  assert.equal(navigate(rows, 'g1', 'up').selectedKey, 'g1')
  assert.equal(navigate(rows, 'ws:c', 'home').selectedKey, 'g1')
  assert.equal(navigate(rows, 'g1', 'end').selectedKey, 'ws:c')
  assert.deepEqual(navigate(rows, 'g2', 'left').toggle, { key: 'g2', expanded: false })
  assert.equal(navigate(rows, 'ws:a', 'left').selectedKey, 'g2')
  assert.equal(navigate(rows, 'g2', 'right').selectedKey, 'ws:a')
  const folded = visibleRows(tree, new Set(['g2']), '')
  assert.deepEqual(navigate(folded, 'g2', 'right').toggle, { key: 'g2', expanded: true })
})

test('projects are main checkouts; a worktree belongs to the project above it', () => {
  const linked: TreeNode = { ...ws('w', 'feature'), linked: true } as TreeNode
  const nested = [group('g', [ws('p', 'proj', 'none', [linked]), ws('q', 'other')])]
  assert.deepEqual(projectsOf(nested).map((node) => node.workspaceId), ['p', 'q'])
  assert.equal(projectOf(nested, 'w')?.workspaceId, 'p')
  assert.equal(projectOf(nested, 'q')?.workspaceId, 'q')
  assert.equal(projectOf(nested, 'missing'), null)
  assert.equal(projectOf(nested, null), null)
})

test('only a linked worktree row can be renamed', () => {
  const project = { ...(ws('p', 'project') as WorkspaceNode) }
  const primary = { ...project, primary: true as const, linked: true }
  const linked = { ...project, linked: true }
  assert.equal(canRename(project), false)
  assert.equal(canRename(primary), false)
  assert.equal(canRename(linked), true)
})

test('filter matches a favorited worktree by its projectLabel', () => {
  const favWorktree: WorkspaceNode = { ...(ws('w', 'fix-login') as WorkspaceNode), linked: true, projectLabel: 'alpha' }
  const rows = visibleRows([favWorktree], new Set(), 'alpha')
  assert.deepEqual(rows.map((row) => row.node.key), ['ws:w'])
})
