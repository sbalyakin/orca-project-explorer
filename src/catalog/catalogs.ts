// Model lists cached in the plugin's storage: shown at once, refreshed in the background when old.
import type { OrcaWorkerApi } from 'orca/worker'
import '../protocol'
import type { AgentModel, ModelCatalog } from '../types'
import { canListModels, probeModels } from './probe'

const MAX_AGE_MS = 6 * 60 * 60 * 1000
const storageKey = (agent: string): string => `models-v2:${agent}`

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isCatalog(value: unknown): value is ModelCatalog {
  return typeof value === 'object' && value !== null && Array.isArray((value as ModelCatalog).models)
}

export function createCatalogs(orca: OrcaWorkerApi, now: () => number = Date.now, probe: (agent: string) => Promise<AgentModel[]> = probeModels) {
  const inFlight = new Map<string, Promise<ModelCatalog>>()

  async function cached(agent: string): Promise<ModelCatalog | null> {
    const value = await orca.storage.get(storageKey(agent))
    return isCatalog(value) ? value : null
  }

  /** One listing per agent at a time; a failure keeps the earlier models and says why it failed. */
  function refresh(agent: string): Promise<ModelCatalog> {
    const running = inFlight.get(agent)
    if (running) return running
    const run = (async (): Promise<ModelCatalog> => {
      try {
        const catalog: ModelCatalog = { agent, models: await probe(agent), fetchedAt: now(), supported: true }
        await orca.storage.set(storageKey(agent), catalog)
        return catalog
      } catch (error: unknown) {
        const earlier = await cached(agent)
        return { agent, models: earlier?.models ?? [], fetchedAt: earlier?.fetchedAt ?? 0, supported: true, error: errorText(error) }
      } finally {
        inFlight.delete(agent)
      }
    })()
    inFlight.set(agent, run)
    return run
  }

  return {
    async get(agent: string, forceRefresh = false): Promise<ModelCatalog> {
      if (!canListModels(agent)) return { agent, models: [], fetchedAt: 0, supported: false }
      const earlier = await cached(agent)
      if (earlier && !forceRefresh) {
        if (now() - earlier.fetchedAt > MAX_AGE_MS) {
          void refresh(agent).then((catalog) => orca.panels.post('models.updated', catalog))
        }
        return earlier
      }
      return refresh(agent)
    }
  }
}
