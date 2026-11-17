// The panel <-> worker contract, declared once: both sides read it.
import type { AgentLaunch, ModelCatalog, ProjectTree } from './types'

declare module 'orca' {
  interface PluginRequests {
    /** Projects and workspaces as a folder tree. */
    'tree.load': { output: ProjectTree }
    /** Shows a workspace, as clicking it in Orca's own sidebar does. */
    'workspace.open': { input: { workspaceId: string }; output: { opened: true } }
    /** Opens a terminal in a workspace and brings it to the front. */
    'terminal.launch': { input: { workspaceId: string }; output: { terminalId: string } }
    /** Starts an agent in a workspace, with a model, effort and prompt, as a chat or a terminal. */
    'agent.launch': { input: AgentLaunch; output: { launched: true } }
    /** An agent's models: the cached list at once, or a fresh one with `refresh`. */
    'models.get': { input: { agent: string; refresh?: boolean }; output: ModelCatalog }
  }
  interface PluginPanelEvents {
    /** A background refresh finished for one agent. */
    'models.updated': ModelCatalog
  }
}
