// The panel: your projects as a folder tree, and a right-click menu to start a terminal or an
// agent in a workspace. Orca wraps this module in a page; there is no build step.
import type {} from 'orca/frame'
import '../protocol'
import type { ModelCatalog, ProjectTree } from '../types'
import { agentLabel, DEFAULT_AGENTS, parseAgents } from './agents'
import { agentIcon, icon, type IconName } from './icons'
import { buildLauncher, type LauncherChoice } from './launcher'
import { buildMainMenu, closePopover, openPopover } from './menu'
import { containerKeys, navigate, pathTo, visibleRows, type NavKey, type Row } from './rows'
import { CSS } from './style'
import { renderMessage, renderRows } from './view'

const COLLAPSED_KEY = 'collapsed'
const AGENTS_KEY = 'agents'
const RELOAD_DEBOUNCE_MS = 300
const ERROR_SHOW_MS = 5000

type State = {
  tree: ProjectTree | null
  treeSignature: string
  error: string | null
  collapsed: ReadonlySet<string>
  filter: string
  selectedKey: string | null
  currentWorkspaceId: string | null
  agents: readonly string[]
}

let state: State = {
  tree: null,
  treeSignature: '',
  error: null,
  collapsed: new Set(),
  filter: '',
  selectedKey: null,
  currentWorkspaceId: null,
  agents: parseAgents(DEFAULT_AGENTS)
}
let rows: Row[] = []
let pendingReveal: string | null = null

// ---------------------------------------------------------------- page

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

const search = document.createElement('input')
search.className = 'search'
search.type = 'search'
search.placeholder = 'Filter projects'
search.setAttribute('aria-label', 'Filter projects')
const treeEl = document.createElement('div')
treeEl.className = 'tree'
treeEl.tabIndex = 0
treeEl.setAttribute('role', 'tree')
treeEl.setAttribute('aria-label', 'Projects')
const footer = document.createElement('div')
footer.className = 'footer'
footer.setAttribute('role', 'status')

function toolButton(name: IconName, label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'tool'
  button.type = 'button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.appendChild(icon(name))
  button.addEventListener('click', onPress)
  return button
}

const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
toolbar.append(
  search,
  toolButton('refresh', 'Refresh', () => void reload()),
  toolButton('collapseAll', 'Collapse all', () => setCollapsed(new Set(containerKeys(state.tree?.nodes ?? [])))),
  toolButton('expandAll', 'Expand all', () => setCollapsed(new Set())),
  toolButton('sidebar', 'Toggle left sidebar', () => void run(() => orca.plugin.request('sidebar.toggle')))
)
document.body.append(toolbar, treeEl, footer)

// ---------------------------------------------------------------- state

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let errorTimer: ReturnType<typeof setTimeout> | undefined
/** Shows a failure under the tree for a few seconds; the tree itself stays as it was. */
function flash(error: unknown): void {
  footer.textContent = errorText(error)
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => (footer.textContent = ''), ERROR_SHOW_MS)
}

async function run(action: () => Promise<unknown>): Promise<void> {
  try {
    await action()
  } catch (error: unknown) {
    flash(error)
  }
}

function render(scrollToSelected = false): void {
  if (!state.tree) {
    renderMessage(treeEl, state.error ? `Could not load projects: ${state.error}` : 'Loading…', state.error !== null)
    return
  }
  rows = visibleRows(state.tree.nodes, state.collapsed, state.filter)
  if (rows.length === 0) {
    renderMessage(treeEl, state.filter ? 'No matching projects' : 'No projects yet')
    return
  }
  renderRows(treeEl, rows, state)
  if (scrollToSelected) treeEl.querySelector('.row.selected')?.scrollIntoView({ block: 'nearest' })
}

function setState(next: Partial<State>, scrollToSelected = false): void {
  state = { ...state, ...next }
  render(scrollToSelected)
}

function setCollapsed(collapsed: ReadonlySet<string>): void {
  setState({ collapsed })
  orca.storage.set(COLLAPSED_KEY, [...collapsed]).catch(flash)
}

function toggle(key: string, expanded: boolean): void {
  const next = new Set(state.collapsed)
  if (expanded) next.delete(key)
  else next.add(key)
  setCollapsed(next)
}

/** Selects Orca's focused workspace and opens the folders above it, as an editor reveals a file. */
function reveal(workspaceId: string | null): void {
  if (!state.tree || !workspaceId) return setState({ currentWorkspaceId: workspaceId })
  const isIt = (node: { kind: string; workspaceId?: string }): boolean => node.kind === 'workspace' && node.workspaceId === workspaceId
  const above = pathTo(state.tree.nodes, isIt) ?? []
  const collapsed = new Set([...state.collapsed].filter((key) => !above.includes(key)))
  const found = findKey(workspaceId)
  // A workspace that is not in the tree yet (just created) is revealed after the next load.
  pendingReveal = found ? null : workspaceId
  setState({ currentWorkspaceId: workspaceId, collapsed, selectedKey: found ?? state.selectedKey }, found !== null)
}

function findKey(workspaceId: string): string | null {
  const walk = (nodes: ProjectTree['nodes']): string | null => {
    for (const node of nodes) {
      if (node.kind === 'workspace' && node.workspaceId === workspaceId) return node.key
      const below = walk(node.children)
      if (below) return below
    }
    return null
  }
  return state.tree ? walk(state.tree.nodes) : null
}

let loadSeq = 0
async function reload(): Promise<void> {
  const seq = ++loadSeq
  try {
    const tree = await orca.plugin.request('tree.load')
    // A newer load has started; this answer may be older than what is on screen.
    if (seq !== loadSeq) return
    const signature = JSON.stringify(tree.nodes)
    if (signature === state.treeSignature) return
    setState({ tree, treeSignature: signature, error: null })
    if (pendingReveal) reveal(pendingReveal)
    else if (state.currentWorkspaceId && !state.selectedKey) reveal(state.currentWorkspaceId)
  } catch (error: unknown) {
    if (state.tree) flash(error)
    else setState({ error: errorText(error) })
  }
}

let reloadTimer: ReturnType<typeof setTimeout> | undefined
function reloadSoon(): void {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => void reload(), RELOAD_DEBOUNCE_MS)
}

// ---------------------------------------------------------------- actions

function rowFor(key: string | null | undefined): Row | undefined {
  return key ? rows.find((row) => row.node.key === key) : undefined
}

async function openWorkspace(workspaceId: string): Promise<void> {
  pendingReveal = null
  setState({ currentWorkspaceId: workspaceId })
  await run(() => orca.plugin.request('workspace.open', { workspaceId }))
}

/** Pressing a row: open its workspace, or open/close a folder. */
function activate(row: Row): void {
  setState({ selectedKey: row.node.key })
  if (row.node.kind === 'workspace') void openWorkspace(row.node.workspaceId)
  else toggle(row.node.key, !row.expanded)
}

type LastChoice = { model?: string; effort?: string }
const lastKey = (agent: string): string => `last:${agent}`

/** The model and effort an agent was last launched with, to start the launcher on them again. */
async function loadLast(agent: string): Promise<LastChoice> {
  try {
    const stored = await orca.storage.get(lastKey(agent))
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {}
    const { model, effort } = stored as Record<string, unknown>
    return { ...(typeof model === 'string' ? { model } : {}), ...(typeof effort === 'string' ? { effort } : {}) }
  } catch {
    return {}
  }
}

/** The right-click menu for a workspace row, opened at a screen point. */
function showMenu(row: Row, x: number, y: number): void {
  const { node } = row
  if (node.kind !== 'workspace') return
  setState({ selectedKey: node.key })
  const { workspaceId } = node
  let openAgent: string | null = null
  let disposeSetup: (() => void) | null = null
  // A later request replaces an earlier one still reading the saved choice.
  let setupRequest = 0

  const menu = buildMainMenu({
    agents: state.agents.map((agent) => ({ id: agent, label: agentLabel(agent), glyph: () => agentIcon(agent, agentLabel(agent)) })),
    onOpen: () => {
      popover.close()
      void openWorkspace(workspaceId)
    },
    onTerminal: () => {
      popover.close()
      void run(() => orca.plugin.request('terminal.launch', { workspaceId }))
    },
    onLaunch: (agent) => {
      popover.close()
      void loadLast(agent).then((last) => launchAgent(workspaceId, agent, { prompt: '', ...last }))
    },
    onSetup: (agent, anchor) => void openSetup(agent, anchor),
    onHover: (agent) => {
      if (agent === undefined || agent !== openAgent) popover.closeFlyout()
    }
  })
  const popover = openPopover(
    {
      x,
      y,
      onClose: () => {
        disposeSetup?.()
        treeEl.focus({ preventScroll: true })
      }
    },
    menu.element
  )
  menu.element.querySelector<HTMLElement>('[data-autofocus]')?.focus()

  async function openSetup(agent: string, anchor: HTMLElement): Promise<void> {
    if (openAgent === agent) return
    const request = ++setupRequest
    openAgent = agent
    menu.markOpen(agent)
    const initial = await loadLast(agent)
    if (request !== setupRequest) return
    const launcher = buildLauncher({
      agentLabel: agentLabel(agent),
      initial,
      load: (refresh) => orca.plugin.request('models.get', { agent, refresh }),
      subscribe: (listener) => {
        const subscription = orca.plugin.on('models.updated', (catalog: ModelCatalog) => {
          if (catalog.agent === agent) listener(catalog)
        })
        return () => subscription.dispose()
      },
      onBack: () => popover.closeFlyout(),
      onLaunch: (choice) => {
        popover.close()
        void launchAgent(workspaceId, agent, choice)
      }
    })
    const { dispose } = launcher
    // Opening one flyout closes the last; its callback must not undo the new one's state.
    popover.flyout(anchor, launcher.element, () => {
      dispose()
      if (disposeSetup === dispose) disposeSetup = null
      if (openAgent === agent) {
        openAgent = null
        menu.markOpen(null)
      }
    })
    disposeSetup = dispose
  }
}

async function launchAgent(workspaceId: string, agent: string, choice: LauncherChoice): Promise<void> {
  const remembered: LastChoice = { ...(choice.model ? { model: choice.model } : {}), ...(choice.effort ? { effort: choice.effort } : {}) }
  orca.storage.set(lastKey(agent), remembered).catch(flash)
  await run(() => orca.plugin.request('agent.launch', { workspaceId, agent, ...choice }))
}

// ---------------------------------------------------------------- input

treeEl.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null
  const rowEl = target?.closest<HTMLElement>('.row')
  const row = rowFor(rowEl?.dataset.key)
  if (!rowEl || !row) return
  if (target?.closest('.more')) {
    const box = rowEl.querySelector('.more')?.getBoundingClientRect()
    if (box) showMenu(row, box.left, box.bottom + 2)
    return
  }
  if (target?.closest('.twistie') && row.expandable) {
    setState({ selectedKey: row.node.key })
    toggle(row.node.key, !row.expanded)
    return
  }
  activate(row)
})

treeEl.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  const rowEl = event.target instanceof Element ? event.target.closest<HTMLElement>('.row') : null
  const row = rowFor(rowEl?.dataset.key)
  if (row) showMenu(row, event.clientX, event.clientY)
})

const NAV_KEYS: Record<string, NavKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end'
}

treeEl.addEventListener('keydown', (event) => {
  const nav = NAV_KEYS[event.key]
  if (nav) {
    event.preventDefault()
    const result = navigate(rows, state.selectedKey, nav)
    setState({ selectedKey: result.selectedKey }, true)
    if (result.toggle) toggle(result.toggle.key, result.toggle.expanded)
    return
  }
  const row = rowFor(state.selectedKey)
  if (!row) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate(row)
  } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    event.preventDefault()
    const box = treeEl.querySelector('.row.selected')?.getBoundingClientRect()
    showMenu(row, box ? box.left + 24 : 8, box ? box.bottom : 8)
  }
})

search.addEventListener('input', () => setState({ filter: search.value }))
search.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    treeEl.focus()
    setState({ selectedKey: state.selectedKey ?? rows[0]?.node.key ?? null }, true)
  } else if (event.key === 'Escape') {
    search.value = ''
    setState({ filter: '' })
  }
})

// ---------------------------------------------------------------- start

let lastFocusedId: string | null = null
orca.on('workspace.changed', ({ context }) => {
  const id = context?.workspaceId ?? null
  if (id === lastFocusedId) return
  lastFocusedId = id
  reveal(id)
  // Focusing a workspace clears its unread mark, and a new one may not be in the tree yet.
  reloadSoon()
})
orca.on('workspace.created', reloadSoon)
orca.on('workspace.removed', reloadSoon)
orca.on('agent.status.changed', reloadSoon)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadSoon()
})
orca.on('theme', closePopover)

async function loadAgents(): Promise<void> {
  try {
    setState({ agents: parseAgents(await orca.settings.get(AGENTS_KEY)) })
  } catch (error: unknown) {
    flash(error)
  }
}
orca.settings.onDidChange(({ key }) => {
  if (key === AGENTS_KEY) void loadAgents()
})

async function start(): Promise<void> {
  render()
  try {
    const stored = await orca.storage.get(COLLAPSED_KEY)
    const keys = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    state = { ...state, collapsed: new Set(keys) }
  } catch (error: unknown) {
    flash(error)
  }
  await Promise.all([loadAgents(), reload()])
}

void start()
