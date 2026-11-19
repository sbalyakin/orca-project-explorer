import { assert, test } from 'orca/testing'
import { parseInstalledAgents } from './agents'

test('parses agents from `orca agent installed --json` in order', () => {
  const stdout = JSON.stringify({
    ok: true,
    result: {
      agents: [
        { id: 'claude', name: 'Claude', default: false },
        { id: 'gemini', name: 'Gemini', default: true },
        { id: 'opencode2', name: 'OpenCode 2', default: false }
      ]
    }
  })
  assert.deepEqual(parseInstalledAgents(stdout), [
    { id: 'claude', name: 'Claude' },
    { id: 'gemini', name: 'Gemini' },
    { id: 'opencode2', name: 'OpenCode 2' }
  ])
})

test('normalizes ids, deduplicates, drops invalid entries, and falls back to id for missing name', () => {
  const stdout = JSON.stringify({
    ok: true,
    result: {
      agents: [
        { id: ' Gemini ', name: '  Gemini  ' },
        { id: 'gemini', name: 'Duplicate' },
        { id: 'bad id!', name: 'Bad' },
        { id: 'pi', name: '' },
        null
      ]
    }
  })
  assert.deepEqual(parseInstalledAgents(stdout), [
    { id: 'gemini', name: 'Gemini' },
    { id: 'pi', name: 'pi' }
  ])
})

test('returns null for invalid JSON, ok: false, or missing agents array', () => {
  assert.equal(parseInstalledAgents('not json'), null)
  assert.equal(parseInstalledAgents(JSON.stringify({ ok: false, error: { message: 'boom' } })), null)
  assert.equal(parseInstalledAgents(JSON.stringify({ ok: true, result: {} })), null)
})
