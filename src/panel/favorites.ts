// Favorites section: pure state helpers, cloning, pruning and drag-and-drop reordering. No DOM.
import type { GroupNode, ProjectIcon, TreeNode, WorkspaceNode } from '../types'

export const FAVORITES_SECTION_KEY = 'section:favorites'
export const FAV_PREFIX = 'fav:'

export function canonicalKey(key: string): string {
  return key.startsWith(FAV_PREFIX) ? key.slice(FAV_PREFIX.length) : key
}

export function isFavoriteCopy(key: string): boolean {
  return key.startsWith(FAV_PREFIX)
}

/** Validates stored favorites as an ordered list of unique non-empty canonical keys. */
export function parseFavorites(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of stored) {
    if (typeof item !== 'string' || item.length === 0) continue
    const key = canonicalKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

/** Adds a key to the end of favorites, or removes it if already present. */
export function toggleFavorite(favorites: readonly string[], key: string): string[] {
  const canonical = canonicalKey(key)
  if (favorites.includes(canonical)) return favorites.filter((item) => item !== canonical)
  return [...favorites, canonical]
}

/** Adds a key to the end of favorites if not already present. */
export function addFavorite(favorites: readonly string[], key: string): string[] {
  const canonical = canonicalKey(key)
  if (favorites.includes(canonical)) return [...favorites]
  return [...favorites, canonical]
}

/** Removes a key from favorites if present. */
export function removeFavorite(favorites: readonly string[], key: string): string[] {
  const canonical = canonicalKey(key)
  if (!favorites.includes(canonical)) return [...favorites]
  return favorites.filter((item) => item !== canonical)
}

function collectWorkspaceKeys(nodes: readonly TreeNode[], out: Set<string>): void {
  for (const node of nodes) {
    if (node.kind === 'workspace') out.add(node.key)
    collectWorkspaceKeys(node.children, out)
  }
}

/** Drops keys that no longer exist in the tree. Returns null when nothing changed. */
export function pruneFavorites(favorites: readonly string[], nodes: readonly TreeNode[]): string[] | null {
  if (favorites.length === 0) return null
  const valid = new Set<string>()
  collectWorkspaceKeys(nodes, valid)
  const kept = favorites.filter((key) => valid.has(key))
  return kept.length === favorites.length ? null : kept
}

/** Moves a dragged favorite before or after a target favorite. */
export function reorderFavorites(
  favorites: readonly string[],
  draggedKey: string,
  targetKey: string,
  position: 'before' | 'after'
): string[] {
  const dragged = canonicalKey(draggedKey)
  const target = canonicalKey(targetKey)
  if (dragged === target || !favorites.includes(dragged) || !favorites.includes(target)) return [...favorites]
  const without = favorites.filter((key) => key !== dragged)
  const targetIndex = without.indexOf(target)
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1
  without.splice(insertAt, 0, dragged)
  return without
}

type IndexedWorkspace = {
  node: WorkspaceNode
  parentProject?: { label: string; icon?: ProjectIcon; color?: string }
}

function indexWorkspaces(
  nodes: readonly TreeNode[],
  parentProject: IndexedWorkspace['parentProject'],
  out: Map<string, IndexedWorkspace>
): void {
  for (const node of nodes) {
    if (node.kind === 'workspace') {
      out.set(node.key, { node, parentProject })
      const nextParent = !node.linked ? { label: node.label, icon: node.icon, color: node.color } : parentProject
      indexWorkspaces(node.children, nextParent, out)
    } else {
      indexWorkspaces(node.children, parentProject, out)
    }
  }
}

function cloneWithPrefix(node: WorkspaceNode, skipChildren: ReadonlySet<string>): WorkspaceNode {
  return {
    ...node,
    key: `${FAV_PREFIX}${node.key}`,
    children: node.children
      .filter((child) => !skipChildren.has(child.key))
      .map((child) => (child.kind === 'workspace' ? cloneWithPrefix(child, skipChildren) : child))
  }
}

/** Builds the top-level Favorites section in the user's saved order, or null when empty. */
export function buildFavoritesSection(nodes: readonly TreeNode[], favorites: readonly string[]): GroupNode | null {
  if (favorites.length === 0) return null
  const index = new Map<string, IndexedWorkspace>()
  indexWorkspaces(nodes, undefined, index)
  const favSet = new Set(favorites)
  const children: WorkspaceNode[] = []
  for (const key of favorites) {
    const entry = index.get(key)
    if (!entry) continue
    const cloned = cloneWithPrefix(entry.node, favSet)
    if (entry.parentProject) {
      cloned.icon = entry.parentProject.icon
      cloned.color = entry.parentProject.color
      cloned.projectLabel = entry.parentProject.label
    }
    children.push(cloned)
  }
  if (children.length === 0) return null
  return { kind: 'group', key: FAVORITES_SECTION_KEY, label: 'Favorites', section: true, children }
}

/** Removes favorited projects and worktrees from the main tree, dropping groups that become empty. */
export function excludeFavorites(nodes: readonly TreeNode[], favorites: ReadonlySet<string>): TreeNode[] {
  if (favorites.size === 0) return [...nodes]
  const kept: TreeNode[] = []
  for (const node of nodes) {
    if (node.kind === 'workspace') {
      if (favorites.has(node.key)) continue
      if (node.children.length > 0) {
        const children = excludeFavorites(node.children, favorites)
        kept.push({ ...node, children })
      } else {
        kept.push(node)
      }
    } else {
      const children = excludeFavorites(node.children, favorites)
      if (children.length === 0) continue
      if (!node.section && children.length === 1 && children[0].kind === 'group' && !children[0].section) {
        const only = children[0]
        const label = node.label === '/' ? `/${only.label}` : `${node.label}/${only.label}`
        kept.push({ ...only, label })
      } else {
        kept.push({ ...node, children })
      }
    }
  }
  return kept
}
