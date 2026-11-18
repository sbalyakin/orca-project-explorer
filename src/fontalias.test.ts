import { assert, test } from 'orca/testing'
import { firstFamily, parseFontAlias } from './fontalias'

test('a plugin font name splits into family and plugin key', () => {
  assert.deepEqual(parseFontAlias('IBM Plex Mono (gongxliang.claude-paper)'), { family: 'IBM Plex Mono', pluginKey: 'gongxliang.claude-paper' })
  assert.equal(parseFontAlias('Geist'), null)
  assert.equal(parseFontAlias('Menlo (../x)'), null)
})

test('the first family of a stack, quoted or not', () => {
  assert.equal(firstFamily('"IBM Plex Mono (a.b)", "Geist", sans-serif'), 'IBM Plex Mono (a.b)')
  assert.equal(firstFamily("'Geist', sans-serif"), 'Geist')
  assert.equal(firstFamily('Geist, sans-serif'), 'Geist')
  assert.equal(firstFamily('  '), null)
})
