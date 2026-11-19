// Turns Orca's flat project and workspace lists into the folder tree the panel draws.
// Pure: no Orca calls, so the layout rules are testable in Node.
import type { Attention, GroupNode, ProjectIcon, TreeNode, WorkspaceNode } from './types'

export type ProjectRow = { id: string; name: string; path: string; hidden?: boolean }
export type ProjectLook = { icon?: ProjectIcon; color?: string }
export type WorkspaceRow = {
  id: string
  name: string
  projectId?: string | null
  path: string
  branch: string | null
  status?: { state: string; unread: boolean; terminalCount?: number; lastActivityAt?: number | null }
}

function attentionOf(workspace: WorkspaceRow): Attention {
  const status = workspace.status
  if (!status) return 'none'
  if (status.state === 'permission') return 'permission'
  if (status.unread) return 'unread'
  if (status.state === 'working') return 'working'
  return 'none'
}

/**
 * Where a project sits in the tree: the first folder under the home directory (shown as `~/Name`),
 * then every folder down to the project. A project outside home hangs straight off its parent folder.
 */
export function folderPath(projectPath: string, home: string | null): string[] {
  const path = projectPath.replace(/\/+$/, '')
  if (home && path.startsWith(`${home}/`)) {
    const parts = path.slice(home.length + 1).split('/')
    if (parts.length === 1) return ['~']
    return [`~/${parts[0]}`, ...parts.slice(1, -1)]
  }
  const cut = path.lastIndexOf('/')
  return [cut <= 0 ? '/' : path.slice(0, cut)]
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'group' ? -1 : 1
    if (a.kind === 'workspace' && b.kind === 'workspace' && a.primary !== b.primary) return a.primary ? -1 : 1
    return collator.compare(a.label, b.label)
  })
  for (const node of nodes) sortNodes(node.children)
}

function workspaceNode(workspace: WorkspaceRow, label: string, linked: boolean): WorkspaceNode {
  const node: WorkspaceNode = {
    kind: 'workspace',
    key: `ws:${workspace.id}`,
    workspaceId: workspace.id,
    label,
    linked,
    attention: attentionOf(workspace),
    children: []
  }
  // The tree travels as JSON, so an absent detail is a missing key, never `undefined`.
  if (workspace.branch && workspace.branch !== label) node.detail = workspace.branch
  if (workspace.status?.unread) node.unread = true
  const activeAt = workspace.status?.lastActivityAt
  if (activeAt) node.activeAt = activeAt
  const terminals = workspace.status?.terminalCount
  if (terminals) node.terminals = terminals
  return node
}

/** One row per visible project (its main checkout), with linked worktrees nested under it. */
export function buildTree(
  projects: readonly ProjectRow[],
  workspaces: readonly WorkspaceRow[],
  home: string | null,
  looks: ReadonlyMap<string, ProjectLook> = new Map()
): TreeNode[] {
  const byProject = new Map<string, WorkspaceRow[]>()
  for (const workspace of workspaces) {
    if (!workspace.projectId) continue
    const list = byProject.get(workspace.projectId)
    if (list) list.push(workspace)
    else byProject.set(workspace.projectId, [workspace])
  }

  const roots: TreeNode[] = []
  const groups = new Map<string, GroupNode>()
  const groupAt = (segments: readonly string[]): TreeNode[] => {
    let siblings = roots
    let key = 'g'
    for (const segment of segments) {
      key = `${key}/${segment}`
      let group = groups.get(key)
      if (!group) {
        group = { kind: 'group', key, label: segment, children: [] }
        groups.set(key, group)
        siblings.push(group)
      }
      siblings = group.children
    }
    return siblings
  }

  for (const project of projects) {
    if (project.hidden) continue
    const rows = byProject.get(project.id) ?? []
    const main = rows.find((row) => row.path === project.path) ?? rows[0]
    if (!main) continue
    const node = workspaceNode(main, project.name, false)
    // The main checkout shows its branch even when it matches the project name.
    if (main.branch) node.detail = main.branch
    const look = looks.get(project.id)
    if (look?.icon) node.icon = look.icon
    if (look?.color) node.color = look.color
    const others = rows.filter((row) => row !== main)
    if (others.length > 0) {
      // The project row only folds; the main checkout moves into the first child and takes the status and the branch.
      const primary = workspaceNode(main, project.name, true)
      primary.primary = true
      primary.key = `${primary.key}:primary`
      if (main.branch) primary.detail = main.branch
      node.attention = 'none'
      delete node.detail
      node.children = [primary, ...others.map((row) => workspaceNode(row, row.name, true))]
    }
    groupAt(folderPath(project.path, home)).push(node)
  }
  sortNodes(roots)
  return roots
}
