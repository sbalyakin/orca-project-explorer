// Regroups the worker's folder tree for the "Group by" option. Pure: no DOM.
import { ATTENTION_LEVELS, type Attention, type TreeNode, type WorkspaceNode } from '../types'
import type { GroupMode } from './display'
import { strongestBelow } from './rows'

const SECTION_LABELS: Record<Attention, string> = {
  permission: 'Permission',
  unread: 'Unread',
  working: 'Working',
  monitoring: 'Monitoring',
  none: 'Idle'
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

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
export function groupTree(nodes: TreeNode[], mode: GroupMode): TreeNode[] {
  if (mode === 'folder') return nodes
  const projects: WorkspaceNode[] = []
  flatten(nodes, [], projects)
  projects.sort((a, b) => collator.compare(a.label, b.label))
  switch (mode) {
    case 'none':
      return projects
    case 'status':
      return [...ATTENTION_LEVELS]
        .reverse()
        .map((level): TreeNode => ({
          kind: 'group',
          key: `status:${level}`,
          label: SECTION_LABELS[level],
          section: true,
          children: projects.filter((project) => strongestBelow(project) === level)
        }))
        .filter((section) => section.children.length > 0)
    default: {
      const unreachable: never = mode
      return unreachable
    }
  }
}
