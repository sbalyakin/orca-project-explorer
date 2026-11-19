import { assert, test } from 'orca/testing'
import { manualOrderBucket, parseManualOrder, pruneManualOrder, reorderProjects } from './manual-order'

test('manualOrderBucket separates folder from none and status', () => {
  assert.equal(manualOrderBucket('folder'), 'folder')
  assert.equal(manualOrderBucket('none'), 'flat')
  assert.equal(manualOrderBucket('status'), 'flat')
})

test('parseManualOrder keeps unique non-empty strings and defaults to empty', () => {
  assert.deepEqual(parseManualOrder(null), { folder: [], flat: [] })
  assert.deepEqual(parseManualOrder(['a']), { folder: [], flat: [] })
  assert.deepEqual(parseManualOrder({ folder: ['a', '', 'b', 'a', 42], flat: ['c'] }), { folder: ['a', 'b'], flat: ['c'] })
})

test('pruneManualOrder drops gone projects and returns null when unchanged', () => {
  const order = { folder: ['a', 'b'], flat: ['b', 'c'] }
  assert.equal(pruneManualOrder(order, new Set(['a', 'b', 'c'])), null)
  assert.deepEqual(pruneManualOrder(order, new Set(['a', 'c'])), { folder: ['a'], flat: ['c'] })
})

test('reorderProjects seeds an empty order from the visible container', () => {
  assert.deepEqual(reorderProjects([], ['a', 'b', 'c'], 'c', 'a', 'before'), ['c', 'a', 'b'])
  assert.deepEqual(reorderProjects([], ['a', 'b', 'c'], 'a', 'b', 'after'), ['b', 'a', 'c'])
})

test('reorderProjects preserves projects from other containers in their slots', () => {
  // p1 and p3 are in the current container; p2 and p4 belong to another container.
  assert.deepEqual(reorderProjects(['p1', 'p2', 'p3', 'p4'], ['p1', 'p3'], 'p3', 'p1', 'before'), ['p3', 'p2', 'p1', 'p4'])
})

test('reorderProjects appends newly added projects into the order when dragged', () => {
  assert.deepEqual(reorderProjects(['a', 'b'], ['a', 'b', 'c'], 'c', 'a', 'before'), ['c', 'a', 'b'])
})

test('reorderProjects ignores invalid or no-op moves', () => {
  assert.deepEqual(reorderProjects(['a', 'b'], ['a', 'b'], 'a', 'a', 'before'), ['a', 'b'])
  assert.deepEqual(reorderProjects(['a', 'b'], ['a', 'b'], 'x', 'a', 'before'), ['a', 'b'])
})
