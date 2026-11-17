import { assert, test } from 'orca/testing'
import { buildAppFontFamily, readAppFont } from './appfont'

test('the chosen font comes first, quoted, and the default stack follows', () => {
  assert.equal(
    buildAppFontFamily('SF Mono'),
    '"SF Mono", "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  )
})

test('the default font is not repeated', () => {
  assert.equal(buildAppFontFamily('Geist'), '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
})

test('an empty or missing font gives the default stack', () => {
  assert.equal(buildAppFontFamily(''), buildAppFontFamily('Geist'))
  assert.equal(buildAppFontFamily(null), buildAppFontFamily('Geist'))
})

test('keywords stay unquoted and structural characters are dropped', () => {
  assert.ok(buildAppFontFamily('system-ui').startsWith('system-ui, "Geist"'))
  assert.ok(buildAppFontFamily('A;} body{x').startsWith('"A bodyx", "Geist"'))
})

test('an unreadable database gives the default stack', async () => {
  assert.equal(await readAppFont('/nonexistent/profile-state.db'), buildAppFontFamily('Geist'))
})
