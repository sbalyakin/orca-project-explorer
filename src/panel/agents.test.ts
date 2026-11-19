import { assert, test } from 'orca/testing'
import { defaultAgents, parseStoredAgents } from './agents'

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
