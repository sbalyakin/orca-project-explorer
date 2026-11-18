// Tells "an agent is working" from "an agent waits for background work".
// Orca's `workspace.list` folds both into `working`; its own sidebar tells them apart with an internal
// `workingMode` the plugin API does not pass. The `agent.status.changed` event is the only trace of it:
// the combined `state` stays `working` while a child or background task runs, but `mainAgent.state` is no
// longer `working` (checked 2026-11-18: `state: working` + `mainAgent: { state: done }` while the agent waited on a timer).
import type { Attention, TreeNode } from '../types'

/** The parts of an `agent.status.changed` payload this module reads. */
export type AgentStatusEvent = {
  workspaceListId?: string
  paneKey: string
  state: string
  mainAgent?: { state: string }
}

/** Per pane: the workspace it belongs to, and whether it only waits for background work. */
export type PaneStates = Map<string, { workspaceId: string; monitoring: boolean }>

export function recordPane(panes: PaneStates, event: AgentStatusEvent): void {
  if (event.state !== 'working' || !event.workspaceListId) {
    panes.delete(event.paneKey)
    return
  }
  const monitoring = event.mainAgent !== undefined && event.mainAgent.state !== 'working'
  panes.set(event.paneKey, { workspaceId: event.workspaceListId, monitoring })
}

/** The ids of every workspace in the tree. */
export function workspaceIds(nodes: readonly TreeNode[]): Set<string> {
  const ids = new Set<string>()
  const walk = (list: readonly TreeNode[]): void => {
    for (const node of list) {
      if (node.kind === 'workspace') ids.add(node.workspaceId)
      walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

/**
 * Forgets panes of workspaces that were in the previous tree and are not in this one (closed or removed while
 * their agent was working). A workspace the panel never saw is kept: its event may come before `tree.load` lists it.
 */
export function prunePanes(panes: PaneStates, before: ReadonlySet<string>, after: ReadonlySet<string>): void {
  for (const [paneKey, pane] of panes) if (before.has(pane.workspaceId) && !after.has(pane.workspaceId)) panes.delete(paneKey)
}

/**
 * Marks a workspace `monitoring` when it is `working` and every pane the panel has heard from only waits.
 * A workspace the panel has heard nothing about stays `working`: the panel may have opened after the event.
 */
export function applyMonitoring(nodes: readonly TreeNode[], panes: PaneStates): TreeNode[] {
  const byWorkspace = new Map<string, boolean[]>()
  for (const pane of panes.values()) byWorkspace.set(pane.workspaceId, [...(byWorkspace.get(pane.workspaceId) ?? []), pane.monitoring])
  return nodes.map((node) => {
    const children = applyMonitoring(node.children, panes)
    if (node.kind === 'group') return { ...node, children }
    const seen = byWorkspace.get(node.workspaceId)
    const attention: Attention = node.attention === 'working' && seen !== undefined && seen.every(Boolean) ? 'monitoring' : node.attention
    return { ...node, attention, children }
  })
}
