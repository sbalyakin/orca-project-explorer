// The plugin's worker. Orca transpiles this file when it loads: no build step. The panel
// cannot call the workspace APIs itself, so it asks the worker.
import { homedir } from 'node:os'
import type { OrcaWorkerApi } from 'orca/worker'
import './protocol'
import { createLooksCache, type LooksLoader } from './appearance'
import { buildTree } from './tree'
import { createCatalogs } from './catalog/catalogs'
import { launchAgent } from './launch'
import type { ProjectTree } from './types'

export async function loadTree(orca: OrcaWorkerApi, loadLooks: LooksLoader): Promise<ProjectTree> {
  const [projects, workspaces, looks] = await Promise.all([
    orca.host.call('project.list', {}),
    orca.host.call('workspace.list', { includeStatus: true }),
    loadLooks()
  ])
  return { nodes: buildTree(projects.projects, workspaces.workspaces, homedir() || null, looks) }
}

function invalidParams(message: string): Error {
  return Object.assign(new Error(message), { code: 'invalid_params' })
}

function requireId(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw invalidParams(`${name} is required`)
  return value
}

/** Agent ids are what `orca agent launch --agent` takes: short lower-case words. */
function requireAgent(value: unknown): string {
  const agent = requireId(value, 'agent')
  if (!/^[a-z0-9-]+$/.test(agent)) throw invalidParams('agent is not a valid id')
  return agent
}

export default function activate(orca: OrcaWorkerApi): void {
  const looks = createLooksCache()
  orca.panels.handle('tree.load', () => loadTree(orca, looks))

  orca.panels.handle('workspace.open', async ({ workspaceId }) => {
    await orca.host.call('workspace.open', { workspaceId: requireId(workspaceId, 'workspaceId') })
    return { opened: true as const }
  })

  orca.panels.handle('terminal.launch', async ({ workspaceId }) => {
    const id = requireId(workspaceId, 'workspaceId')
    const { terminalId } = await orca.host.call('terminal.create', { workspaceId: id })
    // The create call opens the terminal in the background; this brings its pane to the front.
    await orca.host.call('terminal.focus', { terminalId }).catch(() => orca.host.call('workspace.open', { workspaceId: id }))
    return { terminalId }
  })

  orca.panels.handle('agent.launch', async (launch) => {
    const surface = launch.surface === 'terminal' || launch.surface === 'chat' ? { surface: launch.surface } : {}
    await launchAgent({ ...launch, ...surface, workspaceId: requireId(launch.workspaceId, 'workspaceId'), agent: requireAgent(launch.agent) })
    return { launched: true as const }
  })

  const catalogs = createCatalogs(orca)
  orca.panels.handle('models.get', ({ agent, refresh }) => catalogs.get(requireAgent(agent), refresh === true))
}
