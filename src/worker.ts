// The plugin's worker. Orca transpiles this file when it loads: no build step. The panel
// cannot call the workspace APIs itself, so it asks the worker.
import { homedir } from 'node:os'
import type { OrcaWorkerApi } from 'orca/worker'
import './protocol'
import { readSidebarLooks } from './apptheme'
import { createLooksCache, type LooksCache } from './appearance'
import { buildTree } from './tree'
import { createCatalogs } from './catalog/catalogs'
import { launchAgent } from './launch'
import { agentKey, fetchCliAgents, latestByPath, resolveAgentPaths, titleOf, workspaceSuffix, type CliAgent } from './titles'
import { openNewWorktreeDialog } from './newworktree'
import { readFontFace } from './pluginfont'
import type { AgentText, ProjectTree } from './types'

export async function loadTree(orca: OrcaWorkerApi, looks: LooksCache): Promise<ProjectTree> {
  const [projects, workspaces] = await Promise.all([
    orca.host.call('project.list', {}),
    orca.host.call('workspace.list', { includeStatus: true })
  ])
  const known = looks()
  const nodes = buildTree(projects.projects, workspaces.workspaces, homedir() || null, known ?? new Map())
  return known ? { nodes } : { nodes, looksPending: true as const }
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

/**
 * The title and last reply of each workspace's latest agent, by workspace id. The CLI lists chats and terminal agents alike and is asked first;
 * without it, one `agents.list` per workspace gives the terminal agents (a workspace whose list fails is left out).
 */
export async function loadTitles(orca: OrcaWorkerApi, fetchAgents: () => Promise<CliAgent[] | null> = fetchCliAgents): Promise<Record<string, AgentText>> {
  const [{ workspaces }, cli] = await Promise.all([orca.host.call('workspace.list', {}), fetchAgents()])
  const byPath = cli ? latestByPath(await resolveAgentPaths(cli)) : null
  const found = await Promise.all(
    workspaces.map(async ({ id, path }) => {
      if (byPath) return [id, byPath.get(await agentKey(path, workspaceSuffix(id)))] as const
      const { agents } = await orca.host.call('agents.list', { workspaceId: id }).catch(() => ({ agents: [] }))
      const title = titleOf(agents)
      return [id, title ? { title } : undefined] as const
    })
  )
  return Object.fromEntries(found.filter((entry): entry is readonly [string, AgentText] => entry[1] !== undefined))
}

export default function activate(orca: OrcaWorkerApi): void {
  const looks = createLooksCache(undefined, () => orca.panels.post('tree.changed', {}))
  orca.panels.handle('tree.load', () => loadTree(orca, looks))

  orca.panels.handle('font.face', ({ alias, index }) =>
    readFontFace(requireId(alias, 'alias'), Number.isInteger(index) && index >= 0 ? index : 0)
  )
  orca.panels.handle('agents.text', () => loadTitles(orca))
  orca.panels.handle('theme.get', () => readSidebarLooks())

  orca.panels.handle('workspace.open', async ({ workspaceId }) => {
    await orca.host.call('workspace.open', { workspaceId: requireId(workspaceId, 'workspaceId') })
    return { opened: true as const }
  })

  orca.panels.handle('workspace.rename', async ({ workspaceId, name }) => {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (trimmed.length === 0) throw invalidParams('name is required')
    return orca.host.call('workspace.rename', { workspaceId: requireId(workspaceId, 'workspaceId'), name: trimmed })
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

  orca.panels.handle('worktree.new', async ({ workspaceId }) => {
    if (workspaceId !== undefined) await orca.host.call('workspace.open', { workspaceId: requireId(workspaceId, 'workspaceId') })
    await openNewWorktreeDialog()
    return { opened: true as const }
  })

  const catalogs = createCatalogs(orca)
  orca.panels.handle('models.get', ({ agent, refresh }) => catalogs.get(requireAgent(agent), refresh === true))
}
