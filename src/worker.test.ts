import { assert, mockHost, mountWorker, test } from 'orca/testing'
import * as main from './worker'

const project = { id: 'p1', name: 'app', kind: 'git', hostId: 'local', path: '/Users/me/Space/app' }
const workspace = { id: 'w1', kind: 'worktree', name: 'main', project: 'app', projectId: 'p1', path: project.path, branch: 'main', hostId: 'local' }

function host() {
  return mockHost({
    capabilities: ['workspace:read', 'workspace:write', 'terminal:send', 'storage:own'],
    results: {
      'project.list': { projects: [project], truncated: false },
      'workspace.list': { workspaces: [workspace], truncated: false },
      'terminal.create': { terminalId: 't1' },
      'terminal.focus': { focused: true },
      'workspace.open': { opened: true }
    }
  })
}

test('loads projects and workspaces as one tree', async () => {
  const worker = await mountWorker(main, { host: host() })
  const tree = await worker.request('tree.load')
  assert.equal(tree.nodes.length, 1)
  assert.deepEqual(worker.refusals, [])
  await worker.deactivate()
})

test('a terminal starts in the workspace and is brought to the front', async () => {
  const h = host()
  const worker = await mountWorker(main, { host: h })
  await worker.request('terminal.launch', { workspaceId: 'w1' })
  assert.deepEqual(h.callsOf('terminal.create'), [{ workspaceId: 'w1' }])
  assert.deepEqual(h.callsOf('terminal.focus'), [{ terminalId: 't1' }])
  await worker.deactivate()
})

test('models of an agent that cannot list them come back empty and unsupported', async () => {
  const worker = await mountWorker(main, { host: host() })
  const catalog = await worker.request('models.get', { agent: 'gemini' })
  assert.deepEqual(catalog, { agent: 'gemini', models: [], fetchedAt: 0, supported: false })
  await assert.rejects(() => worker.request('models.get', { agent: 'Bad Agent' }))
  await worker.deactivate()
})

test('refuses a request without a workspace id', async () => {
  const worker = await mountWorker(main, { host: host() })
  await assert.rejects(() => worker.request('workspace.open', { workspaceId: '' }))
  await worker.deactivate()
})
