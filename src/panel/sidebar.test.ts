import { assert, test } from 'orca/testing'
import { lookFor, parseLooks } from './sidebar'

const look = { background: '#20201E', accent: '#2E2E2B' }

test('a cached answer is kept only when its looks have the right shape', () => {
  assert.deepEqual(parseLooks({ light: null, dark: look }), { light: null, dark: look })
  assert.deepEqual(parseLooks({ light: { background: 1, accent: '#fff' }, dark: look }), { light: null, dark: look })
  assert.equal(parseLooks(null), null)
  assert.equal(parseLooks('x'), null)
})

test('the look follows the theme base, and no look means the estimate', () => {
  const looks = { light: null, dark: look }
  assert.deepEqual(lookFor(looks, true), look)
  assert.equal(lookFor(looks, false), null)
  assert.equal(lookFor(null, true), null)
})
