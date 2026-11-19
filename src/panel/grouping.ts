// Regroups and sorts the worker's folder tree for the "Group by" and "Sort by" options. Pure: no DOM.
import { ATTENTION_LEVELS, type Attention, type TreeNode, type WorkspaceNode } from '../types'
import { defaultSortDirection, type GroupMode, type SortDirection, type SortMode } from './display'
import { strongestBelow } from './rows'

const SECTION_LABELS: Record<Attention, string> = {
  permission: 'Permission',
  unread: 'Unread',
  working: 'Working',
  monitoring: 'Monitoring',
  none: 'Idle'
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

function attentionRank(level: Attention): number {
  return ATTENTION_LEVELS.indexOf(level)
}

/** Latest activity timestamp across a workspace and all of its nested worktrees; 0 when none is recorded. */
function latestActivity(node: TreeNode): number {
  let latest = node.kind === 'workspace' ? (node.activeAt ?? 0) : 0
  for (const child of node.children) latest = Math.max(latest, latestActivity(child))
  return latest
}

/** Compares two workspaces by `activeAt`; rows without a timestamp always stay last, even in ascending order. */
function compareRecent(a: WorkspaceNode, b: WorkspaceNode, dir: SortDirection): number {
  const aTime = latestActivity(a)
  const bTime = latestActivity(b)
  if (aTime === 0 && bTime === 0) return collator.compare(a.label, b.label)
  if (aTime === 0) return 1
  if (bTime === 0) return -1
  const diff = dir === 'desc' ? bTime - aTime : aTime - bTime
  return diff !== 0 ? diff : collator.compare(a.label, b.label)
}

function compareWorkspaces(a: WorkspaceNode, b: WorkspaceNode, sort: SortMode, dir: SortDirection): number {
  switch (sort) {
    case 'name': {
      const diff = collator.compare(a.label, b.label)
      return dir === 'asc' ? diff : -diff
    }
    case 'recent':
      return compareRecent(a, b, dir)
    case 'status': {
      const rankA = attentionRank(strongestBelow(a))
      const rankB = attentionRank(strongestBelow(b))
      const rankDiff = dir === 'desc' ? rankB - rankA : rankA - rankB
      return rankDiff !== 0 ? rankDiff : compareRecent(a, b, 'desc')
    }
    default: {
      const unreachable: never = sort
      return unreachable
    }
  }
}

/** Sorts a project's worktrees (including `primary`) using the active sort mode and direction. */
function sortWorktrees(node: WorkspaceNode, sort: SortMode, dir: SortDirection): WorkspaceNode {
  if (node.children.length === 0) return node
  const children = [...node.children]
  children.sort((a, b) => (a.kind === 'workspace' && b.kind === 'workspace' ? compareWorkspaces(a, b, sort, dir) : collator.compare(a.label, b.label)))
  return { ...node, children }
}

/** Sorts projects within each folder while keeping folders above projects and in alphabetical order. */
function sortFolderTree(nodes: readonly TreeNode[], sort: SortMode, dir: SortDirection): TreeNode[] {
  const groups: TreeNode[] = []
  const projects: WorkspaceNode[] = []
  for (const node of nodes) {
    if (node.kind === 'group') groups.push({ ...node, children: sortFolderTree(node.children, sort, dir) })
    else projects.push(sortWorktrees(node, sort, dir))
  }
  groups.sort((a, b) => collator.compare(a.label, b.label))
  projects.sort((a, b) => compareWorkspaces(a, b, sort, dir))
  return [...groups, ...projects]
}

/** Every project with the folders above it as one path (`~/work/apps`), in tree order. */
function flatten(nodes: readonly TreeNode[], above: readonly string[], found: WorkspaceNode[]): void {
  for (const node of nodes) {
    if (node.kind === 'workspace') {
      found.push(above.length > 0 ? { ...node, folder: above[0] === '/' ? `/${above.slice(1).join('/')}` : above.join('/') } : node)
    } else {
      flatten(node.children, [...above, node.label], found)
    }
  }
}

/** The tree as it is drawn: folders as built, one list, or sections by the strongest agent status of each project. */
export function groupTree(nodes: TreeNode[], mode: GroupMode, sort: SortMode = 'name', dir: SortDirection = defaultSortDirection(sort)): TreeNode[] {
  if (mode === 'folder') return sortFolderTree(nodes, sort, dir)
  const projects: WorkspaceNode[] = []
  flatten(nodes, [], projects)
  const sorted = projects.map((project) => sortWorktrees(project, sort, dir))
  sorted.sort((a, b) => compareWorkspaces(a, b, sort, dir))
  switch (mode) {
    case 'none':
      return sorted
    case 'status':
      return [...ATTENTION_LEVELS]
        .reverse()
        .map((level): TreeNode => ({
          kind: 'group',
          key: `status:${level}`,
          label: SECTION_LABELS[level],
          section: true,
          children: sorted.filter((project) => strongestBelow(project) === level)
        }))
        .filter((section) => section.children.length > 0)
    default: {
      const unreachable: never = mode
      return unreachable
    }
  }
}
