import { assert, test } from 'orca/testing'
import type { TreeNode } from '../types'
import { detailFor, parseDisplay, pruneTitles, recordTitle, type WorkspaceTexts } from './display'

const node: TreeNode = { kind: 'workspace', key: 'ws:a', workspaceId: 'a', label: 'a', linked: false, attention: 'none', detail: 'main', children: [] }

test('the saved choice is read, and anything else gives the branch', () => {
  assert.equal(parseDisplay({ detail: 'title' }).detail, 'title')
  assert.equal(parseDisplay({ detail: 'none' }).detail, 'none')
  assert.equal(parseDisplay({ detail: 'other' }).detail, 'branch')
  assert.equal(parseDisplay(null).detail, 'branch')
  assert.equal(parseDisplay('title').detail, 'branch')
})

test('each mode shows its own text', () => {
  const titles = new Map([['a', { title: 'Fix tests', message: 'All green.' }]])
  assert.equal(detailFor(node, 'none', titles), undefined)
  assert.equal(detailFor(node, 'branch', titles), 'main')
  assert.equal(detailFor(node, 'title', titles), 'Fix tests')
  assert.equal(detailFor(node, 'message', titles), 'All green.')
  assert.equal(detailFor(node, 'title', new Map()), undefined)
})

test('a folder shows nothing', () => {
  const folder: TreeNode = { kind: 'group', key: 'g', label: 'g', children: [] }
  assert.equal(detailFor(folder, 'branch', new Map()), undefined)
})

test('the latest title wins, an empty one is ignored, gone workspaces are dropped', () => {
  const titles: WorkspaceTexts = new Map()
  recordTitle(titles, { workspaceListId: 'a', title: 'one' })
  recordTitle(titles, { workspaceListId: 'a', title: ' two ' })
  recordTitle(titles, { workspaceListId: 'a', title: '  ' })
  recordTitle(titles, { workspaceListId: 'b', title: 'x' })
  recordTitle(titles, { title: 'no workspace' })
  assert.deepEqual([...titles], [['a', { title: 'two' }], ['b', { title: 'x' }]])
  pruneTitles(titles, new Set(['a']))
  assert.deepEqual([...titles.keys()], ['a'])
})
