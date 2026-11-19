// Pure helpers for the "Manual" sort mode: parsing, pruning and reordering saved project keys.
import type { GroupMode } from './display'

export type ManualOrder = {
  /** Saved project order for `Group by: Folder` (keyed by project's `TreeNode.key`). */
  folder: string[]
  /** Saved project order shared by `Group by: None` and `Group by: Status`. */
  flat: string[]
}

export const EMPTY_MANUAL_ORDER: ManualOrder = { folder: [], flat: [] }

export function manualOrderBucket(group: GroupMode): keyof ManualOrder {
  switch (group) {
    case 'folder':
      return 'folder'
    case 'none':
    case 'status':
      return 'flat'
    default: {
      const unreachable: never = group
      return unreachable
    }
  }
}

function parseKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item !== '' && !seen.has(item)) {
      seen.add(item)
      result.push(item)
    }
  }
  return result
}

export function parseManualOrder(stored: unknown): ManualOrder {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return { folder: [], flat: [] }
  const saved = stored as Record<string, unknown>
  return {
    folder: parseKeys(saved.folder),
    flat: parseKeys(saved.flat)
  }
}

/** Drops project keys that are no longer in the tree; returns `null` when nothing changed. */
export function pruneManualOrder(order: ManualOrder, presentProjectKeys: ReadonlySet<string>): ManualOrder | null {
  const folder = order.folder.filter((key) => presentProjectKeys.has(key))
  const flat = order.flat.filter((key) => presentProjectKeys.has(key))
  if (folder.length === order.folder.length && flat.length === order.flat.length) return null
  return { folder, flat }
}

/**
 * Moves `draggedKey` before or after `targetKey` within `containerKeys`, preserving the relative
 * positions of projects belonging to other containers in `currentOrder`.
 */
export function reorderProjects(
  currentOrder: readonly string[],
  containerKeys: readonly string[],
  draggedKey: string,
  targetKey: string,
  position: 'before' | 'after'
): string[] {
  if (draggedKey === targetKey) return [...currentOrder]
  if (!containerKeys.includes(draggedKey) || !containerKeys.includes(targetKey)) return [...currentOrder]

  const withoutDragged = containerKeys.filter((key) => key !== draggedKey)
  const targetIndex = withoutDragged.indexOf(targetKey)
  const insertAt = position === 'before' ? targetIndex : targetIndex + 1
  const nextContainer = [...withoutDragged.slice(0, insertAt), draggedKey, ...withoutDragged.slice(insertAt)]

  const containerSet = new Set(containerKeys)
  const result: string[] = []
  let nextIndex = 0
  for (const key of currentOrder) {
    if (containerSet.has(key)) {
      if (nextIndex < nextContainer.length) result.push(nextContainer[nextIndex++])
    } else {
      result.push(key)
    }
  }
  while (nextIndex < nextContainer.length) result.push(nextContainer[nextIndex++])
  return result
}
