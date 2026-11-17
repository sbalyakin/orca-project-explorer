import { assert, test } from 'orca/testing'
import type { OrcaWorkerApi } from 'orca/worker'
import type { AgentModel, ModelCatalog } from '../types'
import { createCatalogs } from './catalogs'

const HOUR = 60 * 60 * 1000
const model = (id: string): AgentModel => ({ id, label: id, efforts: [] })

/** The two parts of the worker API the cache touches. */
function fakeOrca(stored: Record<string, unknown> = {}) {
  const posted: unknown[] = []
  const orca = {
    storage: {
      get: async (key: string) => stored[key],
      set: async (key: string, value: unknown) => void (stored[key] = value)
    },
    panels: { post: async (_name: string, payload: unknown) => void posted.push(payload) }
  } as unknown as OrcaWorkerApi
  return { orca, posted, stored }
}

const catalog = (fetchedAt: number): ModelCatalog => ({ agent: 'claude', models: [model('old')], fetchedAt, supported: true })

test('a fresh cache answers without a probe', async () => {
  const { orca } = fakeOrca({ 'models-v2:claude': catalog(1000) })
  let probes = 0
  const catalogs = createCatalogs(orca, () => 1000 + HOUR, async () => (probes++, [model('new')]))
  assert.deepEqual(await catalogs.get('claude'), catalog(1000))
  assert.equal(probes, 0)
})

test('a stale cache answers at once and refreshes in the background', async () => {
  const { orca, posted, stored } = fakeOrca({ 'models-v2:claude': catalog(1000) })
  const catalogs = createCatalogs(orca, () => 1000 + 7 * HOUR, async () => [model('new')])
  assert.deepEqual((await catalogs.get('claude')).models, [model('old')])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(posted.length, 1)
  assert.deepEqual((posted[0] as ModelCatalog).models, [model('new')])
  assert.deepEqual((stored['models-v2:claude'] as ModelCatalog).models, [model('new')])
})

test('a failed probe keeps the earlier models and reports why', async () => {
  const { orca } = fakeOrca({ 'models-v2:claude': catalog(1000) })
  const catalogs = createCatalogs(orca, () => 5000, async () => {
    throw new Error('boom')
  })
  const result = await catalogs.get('claude', true)
  assert.deepEqual(result.models, [model('old')])
  assert.equal(result.fetchedAt, 1000)
  assert.equal(result.error, 'boom')
})
