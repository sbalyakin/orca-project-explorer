import { assert, test } from 'orca/testing'
import { rowLayout } from './layout'

test('padding grows by one indent per level', () => {
  assert.deepEqual([0, 1, 2, 3].map((depth) => rowLayout(depth).pad), [8, 28, 48, 68])
})

test('a row has one guide per ancestor, each one indent apart', () => {
  assert.deepEqual(rowLayout(0).guides, [])
  assert.deepEqual(rowLayout(3).guides, [16, 36, 56])
})

test('a top-level status mark stays inside the row and never goes negative', () => {
  const { status } = rowLayout(0)
  assert.equal(status.width, 8)
  assert.equal(status.left, 0)
})

test('a nested status mark is centred on its parent guide', () => {
  for (const depth of [1, 2, 5]) {
    const { guides, status } = rowLayout(depth)
    assert.equal(status.left + status.width / 2, guides[depth - 1] + 0.5)
    assert.equal(status.width, 12)
  }
})
