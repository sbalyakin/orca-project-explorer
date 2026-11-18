// What a row shows after its name. Pure: the choice, its stored form and the text it gives.
import type { TreeNode } from '../types'

export const DETAIL_MODES = ['none', 'branch', 'title'] as const
export type DetailMode = (typeof DETAIL_MODES)[number]

export const DEFAULT_DETAIL: DetailMode = 'branch'

/** The short words on the segments, and the full ones for screen readers and tooltips. */
export const DETAIL_LABELS: Record<DetailMode, { short: string; full: string }> = {
  none: { short: 'None', full: 'Nothing' },
  branch: { short: 'Branch', full: 'Git branch' },
  title: { short: 'Title', full: 'Active tab or agent title' }
}

export type DisplayOptions = { detail: DetailMode }

export const DEFAULT_DISPLAY: DisplayOptions = { detail: DEFAULT_DETAIL }

/** The saved choice; anything unreadable gives the default. */
export function parseDisplay(stored: unknown): DisplayOptions {
  const detail = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>).detail : undefined
  return { detail: DETAIL_MODES.find((mode) => mode === detail) ?? DEFAULT_DETAIL }
}

/** The latest title an agent reported, per workspace. */
export type WorkspaceTitles = Map<string, string>

/** The parts of an `agent.status.changed` payload this module reads. */
export type TitleEvent = { workspaceListId?: string; title?: string }

export function recordTitle(titles: WorkspaceTitles, event: TitleEvent): void {
  const title = event.title?.trim()
  if (event.workspaceListId && title) titles.set(event.workspaceListId, title)
}

/** Forgets workspaces that are no longer in the tree. */
export function pruneTitles(titles: WorkspaceTitles, present: ReadonlySet<string>): void {
  for (const id of titles.keys()) if (!present.has(id)) titles.delete(id)
}

/** The text after a row's name; only a workspace has one. */
export function detailFor(node: TreeNode, mode: DetailMode, titles: ReadonlyMap<string, string>): string | undefined {
  if (node.kind !== 'workspace') return undefined
  switch (mode) {
    case 'none':
      return undefined
    case 'branch':
      return node.detail
    case 'title':
      return titles.get(node.workspaceId)
    default: {
      const unreachable: never = mode
      return unreachable
    }
  }
}
