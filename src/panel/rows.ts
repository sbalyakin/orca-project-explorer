// Flattens the tree into the rows the panel draws and moves a selection through them.
// Pure: no DOM, so the rules are testable in Node.
import { ATTENTION_LEVELS, type Attention, type TreeNode } from '../types'

export type Row = {
  node: TreeNode
  depth: number
  parentKey: string | null
  expandable: boolean
  expanded: boolean
  /** The node's own status, or the strongest one below it while the node is folded shut. */
  attention: Attention
}

function stronger(a: Attention, b: Attention): Attention {
  return ATTENTION_LEVELS.indexOf(a) >= ATTENTION_LEVELS.indexOf(b) ? a : b
}

function strongestBelow(node: TreeNode): Attention {
  let result: Attention = node.kind === 'workspace' ? node.attention : 'none'
  for (const child of node.children) result = stronger(result, strongestBelow(child))
  return result
}

function ownText(node: TreeNode): string {
  return node.kind === 'workspace' && node.detail ? `${node.label} ${node.detail}` : node.label
}

/** Keeps a node that matches, or has a match below it; a matching node keeps everything under it. */
function filterNodes(nodes: readonly TreeNode[], needle: string): TreeNode[] {
  const kept: TreeNode[] = []
  for (const node of nodes) {
    if (ownText(node).toLowerCase().includes(needle)) {
      kept.push(node)
      continue
    }
    const children = filterNodes(node.children, needle)
    if (children.length > 0) kept.push({ ...node, children })
  }
  return kept
}

export function containerKeys(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => (node.children.length > 0 ? [node.key, ...containerKeys(node.children)] : []))
}

/** While a filter is set every folder opens, so no match hides behind a collapsed one. */
export function visibleRows(nodes: readonly TreeNode[], collapsed: ReadonlySet<string>, filter: string): Row[] {
  const needle = filter.trim().toLowerCase()
  const roots = needle ? filterNodes(nodes, needle) : nodes
  const rows: Row[] = []
  const walk = (level: readonly TreeNode[], depth: number, parentKey: string | null): void => {
    for (const node of level) {
      const expandable = node.children.length > 0
      const expanded = expandable && (needle !== '' || !collapsed.has(node.key))
      const own: Attention = node.kind === 'workspace' ? node.attention : 'none'
      const attention = expandable && !expanded ? strongestBelow(node) : own
      rows.push({ node, depth, parentKey, expandable, expanded, attention })
      if (expanded) walk(node.children, depth + 1, node.key)
    }
  }
  walk(roots, 0, null)
  return rows
}

/** Keys of the folders above a node, for revealing it. */
export function pathTo(nodes: readonly TreeNode[], predicate: (node: TreeNode) => boolean): string[] | null {
  for (const node of nodes) {
    if (predicate(node)) return []
    const below = pathTo(node.children, predicate)
    if (below) return [node.key, ...below]
  }
  return null
}

export type NavKey = 'up' | 'down' | 'left' | 'right' | 'home' | 'end'
export type NavResult = { selectedKey: string | null; toggle?: { key: string; expanded: boolean } }

export function navigate(rows: readonly Row[], selectedKey: string | null, key: NavKey): NavResult {
  if (rows.length === 0) return { selectedKey: null }
  const index = rows.findIndex((row) => row.node.key === selectedKey)
  const row = index >= 0 ? rows[index] : undefined
  const select = (target: number): NavResult => ({ selectedKey: rows[Math.max(0, Math.min(rows.length - 1, target))].node.key })
  switch (key) {
    case 'up':
      return select(index < 0 ? 0 : index - 1)
    case 'down':
      return select(index + 1)
    case 'home':
      return select(0)
    case 'end':
      return select(rows.length - 1)
    case 'left':
      if (!row) return select(0)
      if (row.expanded) return { selectedKey, toggle: { key: row.node.key, expanded: false } }
      return { selectedKey: row.parentKey ?? selectedKey }
    case 'right':
      if (!row) return select(0)
      if (row.expandable && !row.expanded) return { selectedKey, toggle: { key: row.node.key, expanded: true } }
      return row.expanded ? select(index + 1) : { selectedKey }
    default: {
      const unreachable: never = key
      return { selectedKey: String(unreachable) }
    }
  }
}
