// What a row shows after its name. Pure: the choice, its stored form and the text it gives.
import type { AgentText, TreeNode } from '../types'

export const DETAIL_MODES = ['none', 'branch', 'title', 'message'] as const
export type DetailMode = (typeof DETAIL_MODES)[number]

export const DEFAULT_DETAIL: DetailMode = 'branch'

/** The short words on the segments, and the full ones for screen readers and tooltips. */
export const DETAIL_LABELS: Record<DetailMode, { short: string; full: string }> = {
  none: { short: 'None', full: 'Nothing' },
  branch: { short: 'Branch', full: 'Git branch' },
  title: { short: 'Title', full: 'Active tab or agent title' },
  message: { short: 'Message', full: 'Last agent message' }
}

export type DisplayOptions = { detail: DetailMode }

export const DEFAULT_DISPLAY: DisplayOptions = { detail: DEFAULT_DETAIL }

/** The saved choice; anything unreadable gives the default. */
export function parseDisplay(stored: unknown): DisplayOptions {
  const detail = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>).detail : undefined
  return { detail: DETAIL_MODES.find((mode) => mode === detail) ?? DEFAULT_DETAIL }
}

/** Whether a mode reads the agents' words, which costs a CLI call. */
export const needsAgentText = (mode: DetailMode): boolean => mode === 'title' || mode === 'message'

/** What the latest agent of each workspace says. */
export type WorkspaceTexts = Map<string, AgentText>

/** The parts of an `agent.status.changed` payload this module reads. */
export type TitleEvent = { workspaceListId?: string; title?: string }

export function recordTitle(texts: WorkspaceTexts, event: TitleEvent): void {
  const title = event.title?.trim()
  if (event.workspaceListId && title) texts.set(event.workspaceListId, { ...texts.get(event.workspaceListId), title })
}

/** Forgets workspaces that are no longer in the tree. */
export function pruneTitles(texts: WorkspaceTexts, present: ReadonlySet<string>): void {
  for (const id of texts.keys()) if (!present.has(id)) texts.delete(id)
}

/** The text after a row's name; only a workspace has one. */
export function detailFor(node: TreeNode, mode: DetailMode, texts: ReadonlyMap<string, AgentText>): string | undefined {
  if (node.kind !== 'workspace') return undefined
  switch (mode) {
    case 'none':
      return undefined
    case 'branch':
      return node.detail
    case 'title':
      return texts.get(node.workspaceId)?.title
    case 'message':
      return texts.get(node.workspaceId)?.message
    default: {
      const unreachable: never = mode
      return unreachable
    }
  }
}
