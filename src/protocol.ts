// The panel <-> worker contract, declared once: both sides read it.
import type { AgentLaunch, AgentText, FontFace, ModelCatalog, ProjectTree, SidebarLooks } from './types'

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
    /**
     * Opens Orca's own "Create worktree" window (by sending its shortcut). With a workspace, that one is shown
     * first so the window starts on its project.
     */
    'worktree.new': { input: { workspaceId?: string }; output: { opened: true } }
    /** An agent's models: the cached list at once, or a fresh one with `refresh`. */
    'models.get': { input: { agent: string; refresh?: boolean }; output: ModelCatalog }
    /** One face of a plugin's font named `Family (plugin.key)`, and how many there are; null when it cannot be found, `face: null` for a file that cannot be sent. */
    'font.face': { input: { alias: string; index: number }; output: { total: number; face: FontFace | null } | null }
    /** The title and last reply of each workspace's latest agent, by workspace id; a workspace with neither is left out. */
    'agents.text': { output: Record<string, AgentText> }
    /** The left sidebar's colours under the chosen app theme, for both bases. */
    'theme.get': { output: SidebarLooks }
  }
  interface PluginPanelEvents {
    /** A background refresh finished for one agent. */
    'models.updated': ModelCatalog
    /** Project icons or colours changed; the next `tree.load` has them. */
    'tree.changed': Record<string, never>
  }
}
