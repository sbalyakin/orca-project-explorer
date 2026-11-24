// Pure drag-and-drop classification and drop-action resolution for the project tree. No DOM.
import type { TreeNode } from '../types'
import { FAVORITES_SECTION_KEY, canonicalKey, isFavoriteCopy } from './favorites'

export type DragSection = 'favorites' | 'projects'
export type DropZone = 'favorites' | 'outside-favorites'
export type DropPosition = 'before' | 'after'

export type DraggableMeta = {
  section: DragSection
  /** True for a project's main row (not a folder, section header, primary child, or linked worktree). */
  isProject: boolean
  /** True when the row can be reordered within its container. */
  canReorder: boolean
  /** True when drag-and-drop may add or remove this row in Favorites. */
  canFavorite: boolean
}

export type DragSource = DraggableMeta & {
  key: string
  container: string
}

export type DropRowInfo = {
  key: string
  container: string
  canReorder: boolean
  position: DropPosition
}

export type DropTargetInfo = {
  zone: DropZone
  row?: DropRowInfo
}

export type DropAction =
  | { kind: 'reorder-favorites'; draggedKey: string; targetKey: string; position: DropPosition }
  | { kind: 'reorder-projects'; draggedKey: string; targetKey: string; position: DropPosition }
  | { kind: 'add-favorite'; key: string; targetKey?: string; position?: DropPosition }
  | { kind: 'remove-favorite'; key: string }
  | { kind: 'none' }

/** True for a project's main row: a workspace that is neither a linked worktree nor a primary child. */
export function isProjectRow(node: TreeNode): boolean {
  return node.kind === 'workspace' && !node.linked && !node.primary
}

/**
 * Classifies whether a tree row is draggable and what drag operations it supports.
 * Returns null when the row cannot be dragged.
 */
export function classifyDraggable(
  node: TreeNode,
  depth: number,
  options: { manualReorder: boolean; favoritesEnabled: boolean }
): DraggableMeta | null {
  if (isFavoriteCopy(node.key)) {
    if (depth !== 0 || !options.favoritesEnabled || node.kind !== 'workspace') return null
    return { section: 'favorites', isProject: isProjectRow(node), canReorder: true, canFavorite: true }
  }
  if (!isProjectRow(node)) return null
  if (!options.favoritesEnabled && !options.manualReorder) return null
  return { section: 'projects', isProject: true, canReorder: options.manualReorder, canFavorite: options.favoritesEnabled }
}

/**
 * Resolves the drop action for a drag source and drop target.
 * - Dragging a project from Projects onto Favorites adds it to Favorites.
 * - Dragging a project from Favorites outside Favorites removes it from Favorites.
 * - Dragging within the same section reorders when allowed, otherwise no-op.
 * - Non-project rows are never added to or removed from Favorites.
 */
export function resolveDropAction(source: DragSource, target: DropTargetInfo): DropAction {
  if (source.section === 'projects') {
    if (!source.isProject) return { kind: 'none' }
    if (target.zone === 'favorites') {
      if (!source.canFavorite) return { kind: 'none' }
      const row = target.row
      if (row && row.canReorder && row.container === FAVORITES_SECTION_KEY) {
        return { kind: 'add-favorite', key: canonicalKey(source.key), targetKey: row.key, position: row.position }
      }
      return { kind: 'add-favorite', key: canonicalKey(source.key) }
    }
    const row = target.row
    if (source.canReorder && row && row.canReorder && row.container === source.container && row.key !== source.key) {
      return { kind: 'reorder-projects', draggedKey: source.key, targetKey: row.key, position: row.position }
    }
    return { kind: 'none' }
  }

  // source.section === 'favorites'
  if (target.zone === 'favorites') {
    const row = target.row
    if (source.canReorder && row && row.canReorder && row.container === FAVORITES_SECTION_KEY && row.key !== source.key) {
      return { kind: 'reorder-favorites', draggedKey: source.key, targetKey: row.key, position: row.position }
    }
    return { kind: 'none' }
  }

  if (source.isProject) {
    return { kind: 'remove-favorite', key: canonicalKey(source.key) }
  }
  return { kind: 'none' }
}
