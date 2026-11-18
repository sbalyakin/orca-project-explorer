import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, mockHost, mountWorker, test } from 'orca/testing'
import type { OrcaWorkerApi } from 'orca/worker'
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

function titlesHost(agentLists: Record<string, unknown> = {}, firstPath = '/Users/me/app/') {
  const calls: unknown[] = []
  const api = {
    host: {
      call: async (method: string, params: { workspaceId?: string }) => {
        if (method === 'workspace.list') {
          return { workspaces: [{ id: 'w1', path: firstPath }, { id: 'w2', path: '/Users/me/other' }] }
        }
        calls.push(params)
        return agentLists[params.workspaceId ?? ''] ?? { agents: [] }
      }
    }
  }
  return { orca: api as unknown as OrcaWorkerApi, calls }
}

test('titles come from the CLI by folder path, with a trailing slash ignored', async () => {
  const { orca, calls } = titlesHost()
  const agents = [{ path: '/Users/me/app', title: 'Fix tests', updatedAt: 1 }]
  assert.deepEqual(await main.loadTitles(orca, async () => agents), { w1: 'Fix tests' })
  assert.deepEqual(calls, [])
})

test('without the CLI, titles come from agents.list per workspace', async () => {
  const { orca } = titlesHost({ w2: { agents: [{ title: 'Review PR', task: null }] } })
  assert.deepEqual(await main.loadTitles(orca, async () => null), { w2: 'Review PR' })
})

test('a workspace path through a symlink matches the real folder the CLI reports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'titles-'))
  try {
    const real = join(dir, 'real')
    const link = join(dir, 'link')
    await mkdir(real)
    await symlink(real, link)
    const { orca } = titlesHost({}, link)
    const agents = [{ path: await realpath(real), title: 'Fix tests', updatedAt: 1 }]
    assert.deepEqual(await main.loadTitles(orca, async () => agents), { w1: 'Fix tests' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
