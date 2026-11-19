import { assert, test } from 'orca/testing'
import { longAge, shortAge } from './age'

const MIN = 60_000
const HOUR = 60 * MIN

test('age steps through now, minutes, hours and days', () => {
  const now = 10_000_000_000
  assert.equal(shortAge(now - 59_000, now), 'now')
  assert.equal(shortAge(now - MIN, now), '1m')
  assert.equal(shortAge(now - 59 * MIN, now), '59m')
  assert.equal(shortAge(now - HOUR, now), '1h')
  assert.equal(shortAge(now - 23 * HOUR - 59 * MIN, now), '23h')
  assert.equal(shortAge(now - 24 * HOUR, now), '1d')
  assert.equal(shortAge(now - 40 * 24 * HOUR, now), '40d')
})

test('a time ahead of the clock reads as now', () => {
  assert.equal(shortAge(2_000, 1_000), 'now')
})

test('longAge adds ago and uses just now under one minute', () => {
  const now = 10_000_000_000
  assert.equal(longAge(now - 30_000, now), 'just now')
  assert.equal(longAge(now - 5 * MIN, now), '5m ago')
  assert.equal(longAge(now - 3 * HOUR, now), '3h ago')
  assert.equal(longAge(now - 48 * HOUR, now), '2d ago')
})
