import { assert, test } from 'orca/testing'
import { defaultAgents, parseAgentOverride, parseStoredAgents } from './agents'

test('parseAgentOverride returns null for empty or non-string setting', () => {
  assert.equal(parseAgentOverride(''), null)
  assert.equal(parseAgentOverride('   '), null)
  assert.equal(parseAgentOverride(undefined), null)
  assert.equal(parseAgentOverride(null), null)
  assert.equal(parseAgentOverride('!!!, bad id'), null)
})

test('parseAgentOverride normalizes, deduplicates, and labels known ids', () => {
  assert.deepEqual(parseAgentOverride(' Gemini , claude, gemini, custom-bot '), [
    { id: 'gemini', name: 'Gemini' },
    { id: 'claude', name: 'Claude' },
    { id: 'custom-bot', name: 'custom-bot' }
  ])
})

test('parseStoredAgents keeps valid entries, fills missing names, and rejects corrupt cache', () => {
  assert.equal(parseStoredAgents(null), null)
  assert.equal(parseStoredAgents('gemini'), null)
  assert.equal(parseStoredAgents([]), null)
  assert.equal(parseStoredAgents([{ id: 'bad id' }]), null)
  assert.deepEqual(
    parseStoredAgents([
      { id: 'gemini', name: '  Gemini Custom  ' },
      { id: 'opencode2', name: '' },
      { id: 'bad id!', name: 'Skip' },
      null
    ]),
    [
      { id: 'gemini', name: 'Gemini Custom' },
      { id: 'opencode2', name: 'OpenCode 2' }
    ]
  )
})

test('defaultAgents returns the built-in fallback list', () => {
  assert.deepEqual(
    defaultAgents().map((agent) => agent.id),
    ['claude', 'codex', 'opencode2', 'pi', 'cursor']
  )
})
