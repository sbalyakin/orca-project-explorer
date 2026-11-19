// Data shared by the worker, which builds the tree, and the panel, which draws it.

/** How much a row needs the person; later entries win when a collapsed folder sums its rows. */
export const ATTENTION_LEVELS = ['none', 'monitoring', 'working', 'unread', 'permission'] as const
export type Attention = (typeof ATTENTION_LEVELS)[number]

/** A folder on the way to a project. */
export type GroupNode = {
  kind: 'group'
  key: string
  label: string
  children: TreeNode[]
  /** A section of the "Group by Status" view, drawn as `title count chevron`. Set by the panel, never by the worker. */
  section?: true
}

/** A project's own icon, as Orca shows it; an absent icon means Orca's default folder. */
export type ProjectIcon =
  | { type: 'lucide'; name: string }
  | { type: 'emoji'; emoji: string }
  | { type: 'image'; src: string }

/** A workspace Orca can open: a project's main checkout, or a linked worktree under it. */
export type WorkspaceNode = {
  kind: 'workspace'
  key: string
  workspaceId: string
  label: string
  /** The branch, shown dimmed after the label. */
  detail?: string
  /** A linked worktree rather than the project's main checkout. */
  linked: boolean
  /** The project's main checkout listed as the first child of a project that has other worktrees. */
  primary?: true
  /** The project's icon and badge colour; set on a main checkout only. */
  icon?: ProjectIcon
  color?: string
  /** The folders above a project, for its tooltip when the tree is not grouped by folder. Set by the panel. */
  folder?: string
  attention: Attention
  /** True when Orca's unread dot is set (tracked separately so `permission` does not hide it). */
  unread?: true
  /** Orca's `lastActivityAt` (ms since the epoch); absent when Orca has none. */
  activeAt?: number
  /** Live terminals in this workspace (`status.terminalCount`). */
  terminals?: number
  children: TreeNode[]
}

export type TreeNode = GroupNode | WorkspaceNode

/**
 * A project with worktrees besides its main checkout: it only folds and unfolds its children (the main checkout
 * first, as `primary`). It keeps the main checkout's id for the menus, but opens nothing and shows no status or text.
 */
export function isProjectFolder(node: TreeNode): boolean {
  return node.kind === 'workspace' && !node.linked && node.children.length > 0
}

/** A workspace a click can open: every workspace row except a project that only folds. Look workspaces up by id with this. */
export function isOpenable(node: TreeNode): node is WorkspaceNode {
  return node.kind === 'workspace' && !isProjectFolder(node)
}

export type ProjectTree = {
  nodes: TreeNode[]
  /** The worker has not loaded project icons and colours yet; `tree.changed` follows when it has. */
  looksPending?: true
}

/** One model an agent offers, as its own CLI lists it. */
export type AgentModel = {
  /** What `orca agent launch --model` takes. */
  id: string
  label: string
  /** Reasoning levels the model accepts, weakest first; empty when it has no such control. */
  efforts: string[]
  defaultEffort?: string
  isDefault?: boolean
}

/** The models of one agent, cached between runs. */
export type ModelCatalog = {
  agent: string
  models: AgentModel[]
  /** Epoch ms of the last successful listing; 0 when there was none. */
  fetchedAt: number
  /** False for agents whose CLI has no way to list models. */
  supported: boolean
  /** Why the latest listing failed; any models shown are from an earlier one. */
  error?: string
}

export type LaunchSurface = 'chat' | 'terminal'

export type AgentLaunch = {
  workspaceId: string
  agent: string
  model?: string
  effort?: string
  prompt?: string
  /** Left out: Orca uses the person's Chat | CLI choice for the agent. */
  surface?: LaunchSurface
}

/**
 * Colours of Orca's left sidebar, as CSS values the panel can use: its fill, its hover fill, and the fill and
 * border of the open workspace's card. `null` for the last two means the theme sets none (Orca then derives them).
 */
export type SidebarLook = { background: string; accent: string; active: string | null; activeBorder: string | null }

/** The look for each theme base; `null` where it cannot be known and the panel estimates. */
export type SidebarLooks = { light: SidebarLook | null; dark: SidebarLook | null }

/** One upright face of a plugin's font, as base64 data for a panel `@font-face`. */
export type FontFace = { weight: string; mime: string; data: string }

/** What a workspace's latest agent says of itself: its title, and its last reply. */
export type AgentText = { title?: string; message?: string; messageAt?: number; chats?: number }
