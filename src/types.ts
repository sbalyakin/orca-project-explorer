// Data shared by the worker, which builds the tree, and the panel, which draws it.

/** How much a row needs the person; later entries win when a collapsed folder sums its rows. */
export const ATTENTION_LEVELS = ['none', 'working', 'unread', 'permission'] as const
export type Attention = (typeof ATTENTION_LEVELS)[number]

/** A folder on the way to a project. */
export type GroupNode = {
  kind: 'group'
  key: string
  label: string
  children: TreeNode[]
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
  /** The project's icon and badge colour; set on a main checkout only. */
  icon?: ProjectIcon
  color?: string
  attention: Attention
  children: TreeNode[]
}

export type TreeNode = GroupNode | WorkspaceNode

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
