// What a row shows after its name. Pure: the choice, its stored form and the text it gives.
import { isProjectFolder, type AgentText, type TreeNode } from '../types'

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

export const FOLDER_MARKS = ['arrows', 'icons', 'both', 'none'] as const
export type FolderMark = (typeof FOLDER_MARKS)[number]

export const DEFAULT_FOLDER_MARK: FolderMark = 'arrows'

export const FOLDER_MARK_LABELS: Record<FolderMark, { short: string; full: string }> = {
  arrows: { short: 'Arrows', full: 'Arrows only' },
  icons: { short: 'Icons', full: 'Folder icons only' },
  both: { short: 'Both', full: 'Arrows and folder icons' },
  none: { short: 'None', full: 'Neither arrows nor icons' }
}

export const GUIDE_MODES = ['none', 'visible', 'subtle'] as const
export type GuideMode = (typeof GUIDE_MODES)[number]

export const DEFAULT_GUIDES: GuideMode = 'none'

export const GUIDE_LABELS: Record<GuideMode, { short: string; full: string }> = {
  none: { short: 'None', full: 'No tree guides' },
  visible: { short: 'Visible', full: 'Visible tree guides' },
  subtle: { short: 'Subtle', full: 'Barely visible tree guides' }
}

export const DENSITY_MODES = ['compact', 'comfort', 'spacious'] as const
export type DensityMode = (typeof DENSITY_MODES)[number]

export const DEFAULT_DENSITY: DensityMode = 'comfort'

export const DENSITY_LABELS: Record<DensityMode, { short: string; full: string }> = {
  compact: { short: 'Compact', full: 'Compact rows' },
  comfort: { short: 'Comfort', full: 'Comfortable rows' },
  spacious: { short: 'Spacious', full: 'Spacious rows' }
}

export type DisplayOptions = { detail: DetailMode; folders: FolderMark; guides: GuideMode; density: DensityMode }

export const DEFAULT_DISPLAY: DisplayOptions = {
  detail: DEFAULT_DETAIL,
  folders: DEFAULT_FOLDER_MARK,
  guides: DEFAULT_GUIDES,
  density: DEFAULT_DENSITY
}

/** The saved choice; anything unreadable gives the default. */
export function parseDisplay(stored: unknown): DisplayOptions {
  const saved = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  return {
    detail: DETAIL_MODES.find((mode) => mode === saved.detail) ?? DEFAULT_DETAIL,
    folders: FOLDER_MARKS.find((mark) => mark === saved.folders) ?? DEFAULT_FOLDER_MARK,
    guides: GUIDE_MODES.find((mode) => mode === saved.guides) ?? DEFAULT_GUIDES,
    density: DENSITY_MODES.find((mode) => mode === saved.density) ?? DEFAULT_DENSITY
  }
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
  if (node.kind !== 'workspace' || isProjectFolder(node)) return undefined
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

/** The texts saved from the last session; entries that are not a title or a reply are dropped. */
export function parseTexts(stored: unknown): [string, AgentText][] {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return []
  const texts: [string, AgentText][] = []
  for (const [id, value] of Object.entries(stored)) {
    if (typeof value !== 'object' || value === null) continue
    const { title, message } = value as Record<string, unknown>
    const text: AgentText = { ...(typeof title === 'string' && title ? { title } : {}), ...(typeof message === 'string' && message ? { message } : {}) }
    if (text.title !== undefined || text.message !== undefined) texts.push([id, text])
  }
  return texts
}
