import { assert, test } from 'orca/testing'
import type { Attention, TreeNode } from '../types'
import { applyMonitoring, prunePanes, recordPane, workspaceIds, type PaneStates } from './monitoring'

function ws(id: string, attention: Attention): TreeNode {
  return { kind: 'workspace', key: `ws:${id}`, workspaceId: id, label: id, linked: false, attention, children: [] }
}
const attentionOf = (nodes: TreeNode[]): Attention[] => nodes.map((node) => (node.kind === 'workspace' ? node.attention : 'none'))

test('a working workspace whose only agent waits on background work is monitoring', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'working', mainAgent: { state: 'done' } })
  assert.deepEqual(attentionOf(applyMonitoring([ws('a', 'working')], panes)), ['monitoring'])
})

test('one agent that really works keeps the workspace working', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'working', mainAgent: { state: 'done' } })
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p2', state: 'working', mainAgent: { state: 'working' } })
  assert.deepEqual(attentionOf(applyMonitoring([ws('a', 'working')], panes)), ['working'])
})

test('a workspace the panel has heard nothing about stays working', () => {
  assert.deepEqual(attentionOf(applyMonitoring([ws('a', 'working')], new Map())), ['working'])
})

test('a finished pane is forgotten, and other statuses are left alone', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'working', mainAgent: { state: 'done' } })
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'done', mainAgent: { state: 'done' } })
  assert.equal(panes.size, 0)
  recordPane(panes, { workspaceListId: 'b', paneKey: 'p2', state: 'working', mainAgent: { state: 'done' } })
  assert.deepEqual(attentionOf(applyMonitoring([ws('b', 'permission'), ws('c', 'unread')], panes)), ['permission', 'unread'])
})

test('without mainAgent the pane counts as working', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'working' })
  assert.deepEqual(attentionOf(applyMonitoring([ws('a', 'working')], panes)), ['working'])
})

test('a workspace inside a folder is marked too', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'a', paneKey: 'p1', state: 'working', mainAgent: { state: 'done' } })
  const folder: TreeNode = { kind: 'group', key: 'g', label: 'g', children: [ws('a', 'working')] }
  const [marked] = applyMonitoring([folder], panes)
  assert.deepEqual(attentionOf(marked.children), ['monitoring'])
})

test('panes of workspaces that left the tree are dropped, those not yet listed are kept', () => {
  const panes: PaneStates = new Map()
  recordPane(panes, { workspaceListId: 'gone', paneKey: 'p1', state: 'working', mainAgent: { state: 'done' } })
  recordPane(panes, { workspaceListId: 'new', paneKey: 'p2', state: 'working', mainAgent: { state: 'done' } })
  const folder: TreeNode = { kind: 'group', key: 'g', label: 'g', children: [ws('a', 'none'), ws('gone', 'none')] }
  prunePanes(panes, workspaceIds([folder]), new Set(['a']))
  assert.deepEqual([...panes.keys()], ['p2'])
})
