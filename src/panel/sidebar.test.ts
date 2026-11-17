import { assert, test } from 'orca/testing'
import { lookFor, parseLooks } from './sidebar'

const look = { background: '#20201E', accent: '#2E2E2B', active: '#2D2C28', activeBorder: null }

test('a cached answer is kept only when its looks have the right shape', () => {
  assert.deepEqual(parseLooks({ light: null, dark: look }), { light: null, dark: look })
  assert.deepEqual(parseLooks({ light: { background: 1, accent: '#fff' }, dark: look }), { light: null, dark: look })
  // A cache from before the card colours existed still parses; the card colours read as none.
  assert.deepEqual(parseLooks({ light: null, dark: { background: '#20201E', accent: '#2E2E2B' } }), { light: null, dark: { background: '#20201E', accent: '#2E2E2B', active: null, activeBorder: null } })
  assert.equal(parseLooks(null), null)
  assert.equal(parseLooks('x'), null)
})

test('the look follows the theme base, and no look means the estimate', () => {
  const looks = { light: null, dark: look }
  assert.deepEqual(lookFor(looks, true), look)
  assert.equal(lookFor(looks, false), null)
  assert.equal(lookFor(null, true), null)
})
