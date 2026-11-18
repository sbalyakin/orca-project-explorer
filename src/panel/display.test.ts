import { assert, test } from 'orca/testing'
import type { TreeNode } from '../types'
import { detailFor, parseDisplay, parseTexts, pruneTitles, recordTitle, type WorkspaceTexts } from './display'

const node: TreeNode = { kind: 'workspace', key: 'ws:a', workspaceId: 'a', label: 'a', linked: false, attention: 'none', detail: 'main', children: [] }

test('the saved choice is read, and anything else gives the branch', () => {
  assert.equal(parseDisplay({ detail: 'title' }).detail, 'title')
  assert.equal(parseDisplay({ detail: 'none' }).detail, 'none')
  assert.equal(parseDisplay({ detail: 'other' }).detail, 'branch')
  assert.equal(parseDisplay(null).detail, 'branch')
  assert.equal(parseDisplay('title').detail, 'branch')
})

test('the folder mark is read, and anything else gives arrows', () => {
  assert.equal(parseDisplay({ folders: 'icons' }).folders, 'icons')
  assert.equal(parseDisplay({ folders: 'both' }).folders, 'both')
  assert.equal(parseDisplay({ folders: 'none' }).folders, 'none')
  assert.equal(parseDisplay({ folders: 'x' }).folders, 'arrows')
  assert.equal(parseDisplay({ detail: 'title' }).folders, 'arrows')
  assert.equal(parseDisplay(null).folders, 'arrows')
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

test('saved texts keep only well-formed entries', () => {
  const stored = { a: { title: 'T', message: 'M' }, b: { title: 5 }, c: null, d: { message: 'only' } }
  assert.deepEqual(parseTexts(stored), [['a', { title: 'T', message: 'M' }], ['d', { message: 'only' }]])
  assert.deepEqual(parseTexts([1]), [])
  assert.deepEqual(parseTexts('x'), [])
})

test('a project that only folds shows no text, the primary child shows it', () => {
  const primary: TreeNode = { ...node, key: 'ws:a:primary', linked: true, primary: true }
  const project: TreeNode = { ...node, children: [primary] }
  const titles = new Map([['a', { title: 'Fix tests' }]])
  assert.equal(detailFor(project, 'branch', titles), undefined)
  assert.equal(detailFor(project, 'title', titles), undefined)
  assert.equal(detailFor(primary, 'title', titles), 'Fix tests')
  assert.equal(detailFor(primary, 'branch', titles), 'main')
})

test('parseDisplay reads the tree guides and defaults to none', () => {
  assert.equal(parseDisplay({ guides: 'visible' }).guides, 'visible')
  assert.equal(parseDisplay({ guides: 'subtle' }).guides, 'subtle')
  assert.equal(parseDisplay({ guides: 'x' }).guides, 'none')
  assert.equal(parseDisplay(null).guides, 'none')
})

test('parseDisplay reads the density and defaults to comfort', () => {
  assert.equal(parseDisplay({ density: 'compact' }).density, 'compact')
  assert.equal(parseDisplay({ density: 'spacious' }).density, 'spacious')
  assert.equal(parseDisplay({ density: 'x' }).density, 'comfort')
  assert.equal(parseDisplay(null).density, 'comfort')
})
