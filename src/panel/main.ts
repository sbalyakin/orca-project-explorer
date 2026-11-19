// The panel: your projects as a folder tree, and a right-click menu to start a terminal or an
// agent in a workspace. Orca wraps this module in a page; there is no build step.
import type {} from 'orca/frame'
import '../protocol'
import { isOpenable, type InstalledAgent, type ModelCatalog, type ProjectTree, type SidebarLooks, type TreeNode, type WorkspaceNode } from '../types'
import { DEFAULT_DISPLAY, parseDisplay, needsAgentText, parseTexts, pruneTitles, recordTitle, type DisplayOptions, type WorkspaceTexts } from './display'
import { agentLabel, defaultAgents, parseStoredAgents } from './agents'
import { agentIcon, icon, projectIcon, type IconName } from './icons'
import { readPluginFontCache, restorePluginFont, syncPluginFont } from './fontload'
import { buildLauncher, type LauncherChoice } from './launcher'
import { buildDeleteConfirm, buildEditForm, buildMainMenu, buildRowMenu, closePopover, openPopover, type Popover } from './menu'
import { buildOptionsMenu, buildSortMenu } from './options-menu'
import { buildProjectPicker } from './project-picker'
import { groupTree } from './grouping'
import { FAVORITES_SECTION_KEY, buildFavoritesSection, canonicalKey, excludeFavorites, isFavoriteCopy, parseFavorites, pruneFavorites, reorderFavorites, toggleFavorite } from './favorites'
import { EMPTY_MANUAL_ORDER, manualOrderBucket, parseManualOrder, pruneManualOrder, reorderProjects, type ManualOrder } from './manual-order'
import { allCollapsed, canRename, containerKeys, filterNodes, keepLooks, navigate, pathTo, projectOf, projectsOf, visibleRows, type NavKey, type Row } from './rows'
import { applyMonitoring, prunePanes, recordPane, workspaceIds, type PaneStates } from './monitoring'
import { lookFor, parseLooks } from './sidebar'
import { CSS } from './style'
import { shrinkImages } from './thumbs'
import { installTooltips, setTip } from './tooltip'
import { refreshAges, renderMessage, renderRows } from './view'

const COLLAPSED_KEY = 'collapsed'
/** Bump the version when `ProjectTree` changes shape, so an old cache is not drawn. */
const TREE_KEY = 'tree:v2' // v1 had no primary child under a project with worktrees
const SIDEBAR_KEY = 'sidebar:v1'
/** The last titles and replies, so the title and message modes have text on the first frame. */
const TEXTS_KEY = 'texts:v1'
const INSTALLED_AGENTS_KEY = 'agents:v1'
const DISPLAY_KEY = 'display:v1'
const MANUAL_ORDER_KEY = 'manualOrder:v1'
const FAVORITES_KEY = 'favorites:v1'
const RELOAD_DEBOUNCE_MS = 300
const LOOK_RELOAD_MIN_MS = 5000

type State = {
  tree: ProjectTree | null
  treeSignature: string
  error: string | null
  collapsed: ReadonlySet<string>
  filter: string
  selectedKey: string | null
  currentWorkspaceId: string | null
  menuKey: string | null
  agents: readonly InstalledAgent[]
  display: DisplayOptions
  manualOrder: ManualOrder
  favorites: readonly string[]
}

let state: State = {
  tree: null,
  treeSignature: '',
  error: null,
  collapsed: new Set(),
  filter: '',
  selectedKey: null,
  currentWorkspaceId: null,
  menuKey: null,
  agents: defaultAgents(),
  display: DEFAULT_DISPLAY,
  manualOrder: EMPTY_MANUAL_ORDER,
  favorites: []
}
let rows: Row[] = []
let pendingReveal: string | null = null
/** What each workspace's latest agent says; shown after the name when the options ask for it. */
const titles: WorkspaceTexts = new Map()

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
const footerText = document.createElement('span')
footerText.className = 'footer-text'
const footerClose = toolButton('close', 'Dismiss', () => clearFooter())
footer.append(footerText, footerClose)
// Shown only while there is a message, so an idle panel gives the tree its full height.
footer.hidden = true

function toolButton(name: IconName, label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = 'tool'
  button.type = 'button'
  setTip(button, label)
  button.setAttribute('aria-label', label)
  button.appendChild(icon(name))
  button.addEventListener('click', onPress)
  return button
}

/** One button for both directions; its label and icon name what a press will do (see `syncFoldButton`). */
const foldButton = toolButton('collapseAll', 'Collapse all', () => {
  const nodes = shownNodes()
  setCollapsed(allCollapsed(nodes, state.collapsed) ? new Set() : new Set(containerKeys(nodes)))
})

/** The tree as drawn: the worker's folders, one list, or status sections, per the Group by and Sort by options. */
function shownNodes(): TreeNode[] {
  const bucket = manualOrderBucket(state.display.group)
  return groupTree(state.tree?.nodes ?? [], state.display.group, state.display.sort, state.display.sortDir, state.manualOrder[bucket])
}

function syncFoldButton(): void {
  const expand = allCollapsed(shownNodes(), state.collapsed)
  const label = expand ? 'Expand all' : 'Collapse all'
  setTip(foldButton, label)
  foldButton.setAttribute('aria-label', label)
  foldButton.replaceChildren(icon(expand ? 'expandAll' : 'collapseAll'))
}

const toolbar = document.createElement('div')
toolbar.className = 'toolbar'
// The field is drawn like the left sidebar's Search button (`SidebarNav.tsx`): a Lucide magnifier inside.
const searchBox = document.createElement('label')
searchBox.className = 'search-box'
const searchIcon = icon('filter')
searchIcon.setAttribute('stroke-width', '1.75')
// The native cancel button is hidden by the stylesheet (it ignores the theme), so the field draws its own.
const clearButton = document.createElement('button')
clearButton.className = 'search-clear'
clearButton.type = 'button'
clearButton.hidden = true
setTip(clearButton, 'Clear filter')
clearButton.setAttribute('aria-label', 'Clear filter')
clearButton.appendChild(icon('close'))
clearButton.addEventListener('click', () => {
  setFilter('')
  search.focus()
})
searchBox.append(searchIcon, search, clearButton)
const settingsButton = document.createElement('button')
settingsButton.className = 'tool'
settingsButton.type = 'button'
settingsButton.setAttribute('aria-label', 'Display options')
settingsButton.setAttribute('aria-haspopup', 'dialog')
setTip(settingsButton, 'Display options')
settingsButton.appendChild(icon('settings'))
settingsButton.addEventListener('click', () => showOptions(settingsButton))
toolbar.append(searchBox, settingsButton)

// The header under the filter, as Orca's sidebar header: the fold button appears only while the pointer is over it.
const header = document.createElement('div')
header.className = 'header'
const headerTitle = document.createElement('span')
headerTitle.className = 'header-title'
headerTitle.textContent = 'Projects'
foldButton.classList.add('header-fold')
const headerActions = document.createElement('div')
headerActions.className = 'header-actions'
// Sort opens the sort menu; `+` opens the create menu.
for (const [name, label] of [['sort', 'Sort'], ['add', 'Create…']] as const) {
  const button = document.createElement('button')
  button.className = 'tool'
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.setAttribute('aria-haspopup', 'menu')
  setTip(button, label)
  button.appendChild(icon(name))
  if (name === 'add') {
    button.addEventListener('click', () => showAddMenu(button))
  } else {
    button.addEventListener('click', () => showSortMenu(button))
  }
  headerActions.appendChild(button)
}
header.append(headerTitle, foldButton, headerActions)

const favSectionEl = document.createElement('div')
favSectionEl.className = 'fav-section'
favSectionEl.hidden = true
const favHeader = document.createElement('div')
favHeader.className = 'header fav-header'
const favTitle = document.createElement('span')
favTitle.className = 'header-title'
favTitle.textContent = 'Favorites'
const favCount = document.createElement('span')
favCount.className = 'section-count'
const favChevron = document.createElement('span')
favChevron.className = 'worktrees-mark'
favHeader.append(favTitle, favCount, favChevron)
favHeader.addEventListener('click', () => toggle(FAVORITES_SECTION_KEY, state.collapsed.has(FAVORITES_SECTION_KEY)))
const favListEl = document.createElement('div')
favListEl.className = 'tree fav-tree'
favListEl.setAttribute('role', 'tree')
favListEl.setAttribute('aria-label', 'Favorites')
favSectionEl.append(favHeader, favListEl)

const scrollEl = document.createElement('div')
scrollEl.className = 'scroll'
scrollEl.append(favSectionEl, header, treeEl)
document.body.append(toolbar, scrollEl, footer)
installTooltips()
// ---------------------------------------------------------------- state

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Each message under the tree gets a number, so a finished action clears only its own. */
let footerOwner = 0
/** The failed reload on screen, cleared by the next good one. */
let loadErrorOwner: number | null = null

function showFooter(text: string, isError: boolean): number {
  footerText.textContent = text
  footer.classList.toggle('error', isError)
  footer.hidden = text === ''
  loadErrorOwner = null
  return ++footerOwner
}

function clearFooter(owner = footerOwner): void {
  if (owner === footerOwner) showFooter('', false)
}

/** Shows a failure under the tree until it is dismissed or the next action starts; the tree itself stays as it was. */
function flash(error: unknown): number {
  return showFooter(errorText(error), true)
}

/** Runs a host request, saying what is going on under the tree while it takes. */
async function run(action: () => Promise<unknown>, pending = ''): Promise<void> {
  const owner = showFooter(pending, false)
  try {
    await action()
    clearFooter(owner)
  } catch (error: unknown) {
    flash(error)
  }
}

function render(scrollToSelected = false): void {
  syncFoldButton()
  treeEl.dataset.density = state.display.density
  favListEl.dataset.density = state.display.density
  treeEl.removeAttribute('aria-activedescendant')
  if (!state.tree) {
    favSectionEl.hidden = true
    renderMessage(treeEl, state.error ? `Could not load projects: ${state.error}` : 'Loading…', state.error !== null)
    return
  }
  const grouped = shownNodes()
  const favoritesSet = new Set(state.favorites)
  const needle = state.filter.trim().toLowerCase()
  const filtering = needle !== ''
  const favoritesDraggable = !filtering
  const favSection = buildFavoritesSection(grouped, state.favorites)
  const favNodes = favSection ? (filtering ? filterNodes(favSection.children, needle) : favSection.children) : []
  let favRows: Row[] = []
  if (favNodes.length > 0) {
    favSectionEl.hidden = false
    const favExpanded = filtering || !state.collapsed.has(FAVORITES_SECTION_KEY)
    favCount.textContent = String(favNodes.length)
    favChevron.replaceChildren(icon(favExpanded ? 'chevronDown' : 'chevron'))
    favListEl.hidden = !favExpanded
    if (favExpanded) {
      favRows = visibleRows(favNodes, filtering ? new Set() : state.collapsed, '')
      renderRows(
        favListEl,
        favRows,
        {
          ...state,
          detailMode: state.display.detail,
          folderMark: state.display.folders,
          guides: 'none',
          flat: true,
          showTime: state.display.time === 'show',
          draggable: false,
          favorites: favoritesSet,
          favoritesDraggable,
          titles
        },
        'fav-row'
      )
    } else {
      favListEl.replaceChildren()
    }
  } else {
    favSectionEl.hidden = true
    favListEl.replaceChildren()
  }

  const mainNodes = favSection ? excludeFavorites(grouped, favoritesSet) : grouped
  const treeRows = visibleRows(mainNodes, state.collapsed, state.filter)
  rows = [...favRows, ...treeRows]
  if (treeRows.length === 0) {
    renderMessage(treeEl, filtering ? (favRows.length > 0 ? 'No other matching projects' : 'No matching projects') : favSection ? 'All projects are in Favorites' : 'No projects yet')
  } else {
    renderRows(treeEl, treeRows, {
      ...state,
      detailMode: state.display.detail,
      folderMark: state.display.folders,
      guides: state.display.group === 'folder' ? state.display.guides : 'none',
      flat: state.display.group === 'none',
      showTime: state.display.time === 'show',
      draggable: state.display.sort === 'manual' && state.filter.trim() === '',
      favorites: favoritesSet,
      favoritesDraggable,
      titles
    })
  }
  const selected = scrollEl.querySelector('.row.selected')
  if (!selected) return
  treeEl.setAttribute('aria-activedescendant', selected.id)
  if (scrollToSelected) selected.scrollIntoView({ block: 'nearest' })
}

function setFilter(filter: string): void {
  search.value = filter
  clearButton.hidden = filter === ''
  setState({ filter })
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
  const isIt = (node: TreeNode): boolean => isOpenable(node) && node.workspaceId === workspaceId
  const grouped = shownNodes()
  const favSection = buildFavoritesSection(grouped, state.favorites)
  const favAbove = favSection ? pathTo([favSection], isIt) : null
  const above = favAbove ?? pathTo(grouped, isIt) ?? []
  const collapsed = new Set([...state.collapsed].filter((key) => !above.includes(key)))
  const found = favAbove && favSection ? findKeyIn([favSection], workspaceId) : findKey(workspaceId)
  // A workspace that is not in the tree yet (just created) is revealed after the next load.
  pendingReveal = found ? null : workspaceId
  setState({ currentWorkspaceId: workspaceId, collapsed, selectedKey: found ?? state.selectedKey }, found !== null)
}

function findKeyIn(nodes: readonly TreeNode[], workspaceId: string): string | null {
  for (const node of nodes) {
    if (isOpenable(node) && node.workspaceId === workspaceId) return node.key
    const below = findKeyIn(node.children, workspaceId)
    if (below) return below
  }
  return null
}

function findKey(workspaceId: string): string | null {
  return state.tree ? findKeyIn(state.tree.nodes, workspaceId) : null
}

/** What the agent events say per pane; Orca's workspace list cannot tell "works" from "waits for background work". */
const panes: PaneStates = new Map()
let knownWorkspaceIds = new Set<string>()
let loadSeq = 0

const TITLES_MIN_MS = 3000
let titleSeq = 0
let titlesAt = 0
let titlesTimer: ReturnType<typeof setTimeout> | undefined
// What `TEXTS_KEY` holds now. A busy agent's text rarely changes between reads, so the same bytes are not written again.
let textsSignature = ''

/**
 * Reads each workspace's agent title and last reply from the host; only the title and message modes show them, so only then is it asked for.
 * The read starts a CLI, so a busy agent's stream of events gets at most one read per `TITLES_MIN_MS` (the last
 * request is not lost: it runs when the pause ends). `now` skips the pause, for a change of mode.
 */
function loadTitles(now = false): void {
  clearTimeout(titlesTimer)
  const wait = titlesAt + TITLES_MIN_MS - Date.now()
  if (!now && wait > 0) {
    titlesTimer = setTimeout(() => loadTitles(), wait)
    return
  }
  titlesAt = Date.now()
  const seq = ++titleSeq
  orca.plugin.request('agents.text').then(
    (found) => {
      // A newer read has started; this answer may be older than what is on screen.
      if (seq !== titleSeq) return
      const signature = JSON.stringify(found)
      if (signature === textsSignature) return
      titles.clear()
      for (const [id, text] of Object.entries(found)) titles.set(id, text)
      render()
      textsSignature = signature
      orca.storage.set(TEXTS_KEY, found).catch(() => {
        // Nothing (or the old value) is stored: write again at the next read.
        textsSignature = ''
        orca.storage.delete(TEXTS_KEY).catch(() => {})
      })
    },
    () => {
      // Keep the titles the events gave.
    }
  )
}

async function reload(): Promise<void> {
  const seq = ++loadSeq
  try {
    const { looksPending, ...loaded } = await orca.plugin.request('tree.load')
    const ids = workspaceIds(loaded.nodes)
    prunePanes(panes, knownWorkspaceIds, ids)
    knownWorkspaceIds = ids
    pruneTitles(titles, ids)
    const prunedOrder = pruneManualOrder(state.manualOrder, new Set(projectsOf(loaded.nodes).map((project) => project.key)))
    if (prunedOrder) setManualOrder(prunedOrder)
    const prunedFavorites = pruneFavorites(state.favorites, loaded.nodes)
    if (prunedFavorites) setFavorites(prunedFavorites)
    loadTitles()
    const tree = { ...loaded, nodes: applyMonitoring(loaded.nodes, panes) }
    await shrinkImages(tree.nodes)
    // A newer load has started; this answer may be older than what is on screen.
    if (seq !== loadSeq) return
    if (loadErrorOwner !== null) clearFooter(loadErrorOwner)
    // A worker just started has no icons yet; keep the ones on screen until `tree.changed`.
    if (looksPending) keepLooks(tree.nodes, state.tree?.nodes ?? [])
    const signature = JSON.stringify(tree.nodes)
    if (signature === state.treeSignature) return
    setState({ tree, treeSignature: signature, error: null })
    // The cache is optional: a tree past the 256 KiB storage limit is not kept, nor is an older one.
    if (!looksPending) orca.storage.set(TREE_KEY, tree).catch(() => orca.storage.delete(TREE_KEY).catch(() => {}))
    if (pendingReveal) reveal(pendingReveal)
    else if (state.currentWorkspaceId && !state.selectedKey) reveal(state.currentWorkspaceId)
  } catch (error: unknown) {
    if (state.tree) loadErrorOwner = flash(error)
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
  if (isOpenable(row.node)) void openWorkspace(row.node.workspaceId)
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

/** Counts menus opened, so closing an older one (when a new one replaces it) does not unmark the new row. */
let menuCount = 0

/** The menu for a row, opened at a screen point: a project gets New tab / New workspace, a worktree New tab only. */
function showMenu(row: Row, x: number, y: number): void {
  const { node } = row
  if (node.kind !== 'workspace') return
  showRowMenu(node, x, y)
}

/** New tab opens the workspace menu in its place; New workspace (projects only) opens Orca's window. */
function showRowMenu(node: WorkspaceNode, x: number, y: number): void {
  const menu = buildRowMenu({
    onNewTab: () => {
      popover.close()
      showWorkspaceMenu(node, x, y)
    },
    favorite: {
      active: state.favorites.includes(canonicalKey(node.key)),
      onToggle: () => {
        popover.close()
        toggleFavoriteKey(node.key)
      }
    },
    ...(isOpenable(node)
      ? {
          markRead: {
            unread: Boolean(node.unread),
            onToggle: () => {
              popover.close()
              const next = !node.unread
              void run(
                () => orca.plugin.request('workspace.setUnread', { workspaceId: node.workspaceId, unread: next }),
                next ? 'Marking unread…' : 'Marking read…'
              ).then(reloadSoon)
            }
          }
        }
      : {}),
    ...(canRename(node)
      ? {
          onEdit: () => {
            popover.close()
            showEditDetails(node, x, y)
          },
          onDelete: () => {
            popover.close()
            showDeleteConfirm(node, x, y)
          }
        }
      : {}),
    ...(node.linked
      ? {}
      : {
          onNewWorkspace: () => {
            popover.close()
            void run(() => orca.plugin.request('worktree.new', { workspaceId: node.workspaceId }))
          }
        })
  })
  const popover = openRowMenu(node, x, y, menu)
}

/** `Edit Details…`: a name field in place of the row menu; saving renames the workspace and reloads the tree. */
function showEditDetails(node: WorkspaceNode, x: number, y: number): void {
  const form = buildEditForm({
    name: node.label,
    onSave: (name) => {
      popover.close()
      if (name === node.label) return
      void run(() => orca.plugin.request('workspace.rename', { workspaceId: node.workspaceId, name }), 'Renaming…').then(reloadSoon)
    }
  })
  const popover = openRowMenu(node, x, y, form)
}

/** Confirmation popover before deleting a linked worktree or non-root folder workspace. */
function showDeleteConfirm(node: WorkspaceNode, x: number, y: number): void {
  const dialog = buildDeleteConfirm({
    name: node.label,
    onCancel: () => popover.close(),
    onConfirm: () => {
      popover.close()
      void run(() => orca.plugin.request('workspace.delete', { workspaceId: node.workspaceId }), 'Deleting…').then(reloadSoon)
    }
  })
  const popover = openRowMenu(node, x, y, dialog)
}

/** The `+` menu, under its button: a new workspace (Orca's window, which picks the project itself) or a new tab. */
function showAddMenu(anchor: HTMLElement): void {
  const box = anchor.getBoundingClientRect()
  const x = box.left
  const y = box.bottom + 2
  const menu = buildRowMenu({
    labels: { tab: 'Create new tab', workspace: 'Create new workspace' },
    onNewTab: () => {
      popover.close()
      showWorkspaceMenu(null, x, y, true)
    },
    onNewWorkspace: () => {
      popover.close()
      void run(() => orca.plugin.request('worktree.new', {}))
    }
  })
  const popover = openRowMenu(null, x, y, menu)
}

/** Applies a display choice and saves it. */
function setDisplay(patch: Partial<DisplayOptions>): void {
  const display = { ...state.display, ...patch }
  setState({ display })
  orca.storage.set(DISPLAY_KEY, display).catch(flash)
}

/** Saves the manual project order for the current or updated buckets. */
function setManualOrder(manualOrder: ManualOrder): void {
  setState({ manualOrder })
  orca.storage.set(MANUAL_ORDER_KEY, manualOrder).catch(flash)
}

function setFavorites(favorites: readonly string[]): void {
  setState({ favorites })
  orca.storage.set(FAVORITES_KEY, [...favorites]).catch(flash)
}

function toggleFavoriteKey(key: string): void {
  setFavorites(toggleFavorite(state.favorites, key))
}

/** The sort menu under the header's sort button; stays open so clicking the active mode reverses direction. */
function showSortMenu(anchor: HTMLElement): void {
  const box = anchor.getBoundingClientRect()
  const bucket = manualOrderBucket(state.display.group)
  const menu = buildSortMenu({
    sort: state.display.sort,
    dir: state.display.sortDir,
    canReset: state.manualOrder[bucket].length > 0,
    onPick: (sort, sortDir) => setDisplay({ sort, sortDir }),
    onReset: () => setManualOrder({ ...state.manualOrder, [bucket]: [] })
  })
  openRowMenu(null, box.right, box.bottom + 2, menu)
}

/** The display options window, under the gear; a choice applies and is saved at once, and the window stays open as Orca's does. */
function showOptions(anchor: HTMLElement): void {
  const box = anchor.getBoundingClientRect()
  const menu = buildOptionsMenu({
    group: state.display.group,
    onGroup: (group) => setDisplay({ group }),
    detail: state.display.detail,
    folders: state.display.folders,
    guides: state.display.guides,
    onGuides: (guides) => setDisplay({ guides }),
    density: state.display.density,
    onDensity: (density) => setDisplay({ density }),
    time: state.display.time,
    onTime: (time) => setDisplay({ time }),
    onFolders: (folders) => setDisplay({ folders }),
    onDetail: (detail) => {
      setDisplay({ detail })
      if (needsAgentText(detail)) loadTitles(true)
    }
  })
  openRowMenu(null, box.right, box.bottom + 2, menu)
}

/** The project a new tab starts on: the open workspace's, else the selected row's, else none. */
function defaultProject(): WorkspaceNode | null {
  const nodes = state.tree?.nodes ?? []
  const selected = rowFor(state.selectedKey)?.node
  return projectOf(nodes, state.currentWorkspaceId) ?? (selected?.kind === 'workspace' ? projectOf(nodes, selected.workspaceId) : null)
}

/**
 * Opens a menu for a row: marks the row as the menu's target and clears the mark on close, unless a newer menu has
 * taken over (so New tab, which closes one menu and opens the next, keeps the row marked). A menu with no row
 * (the `+` one) marks nothing. Returns the popover.
 */
function openRowMenu(node: WorkspaceNode | null, x: number, y: number, content: HTMLElement, onClose: () => void = () => {}): Popover {
  const menuSeq = ++menuCount
  if (node) setState({ selectedKey: node.key, menuKey: node.key })
  const popover = openPopover(
    {
      x,
      y,
      onClose: () => {
        onClose()
        if (menuSeq === menuCount) setState({ menuKey: null })
        treeEl.focus({ preventScroll: true })
      }
    },
    content
  )
  content.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  return popover
}

/**
 * The menu to start a terminal or an agent, opened at a screen point. A row's menu has its workspace fixed; with
 * `withProject` (the `+` menu, `node` is then null) a field on top picks the project, whose main workspace is used.
 */
function showWorkspaceMenu(node: WorkspaceNode | null, x: number, y: number, withProject = false): void {
  let target: WorkspaceNode | null = node ?? (withProject ? defaultProject() : null)
  /** Runs `action` on the target's workspace after closing the menu; nothing while no project is chosen. */
  const onTarget = (action: (workspaceId: string) => void): void => {
    if (!target) return
    popover.close()
    action(target.workspaceId)
  }
  let openAgent: string | null = null
  let disposeSetup: (() => void) | null = null
  // A later request replaces an earlier one still reading the saved choice.
  let setupRequest = 0

  const menu = buildMainMenu({
    ...(withProject ? { project: { onPress: (anchor: HTMLElement) => openProjects(anchor) } } : {}),
    agents: state.agents.map((agent) => ({ id: agent.id, label: agent.name, glyph: () => agentIcon(agent.id, agent.name) })),
    onOpen: () => onTarget((workspaceId) => void openWorkspace(workspaceId)),
    onTerminal: () => onTarget((workspaceId) => void run(() => orca.plugin.request('terminal.launch', { workspaceId }), 'Opening terminal…')),
    onLaunch: (agent) => onTarget((workspaceId) => void loadLast(agent).then((last) => launchAgent(workspaceId, agent, { prompt: '', ...last }))),
    onSetup: (agent, anchor) => void openSetup(agent, anchor),
    onHover: (agent) => {
      if (agent === undefined || agent !== openAgent) popover.closeFlyout()
    },
    hoverOpensSetup: () => !popover.flyoutCovers()
  })
  const popover = openRowMenu(node, x, y, menu.element, () => disposeSetup?.())
  const showTarget = (): void => menu.setProject(target ? { label: target.label, glyph: projectIcon(target.icon, target.color) } : null)
  if (withProject) showTarget()

  /** The project list beside the field; picking one retargets the menu. */
  function openProjects(anchor: HTMLElement): void {
    // An agent flyout still being prepared must not open over the list.
    setupRequest++
    openAgent = null
    menu.markOpen(null)
    const projects = projectsOf(state.tree?.nodes ?? [])
    const picker = buildProjectPicker({
      projects: projects.map((project) => ({ id: project.workspaceId, label: project.label, glyph: () => projectIcon(project.icon, project.color) })),
      current: target?.workspaceId ?? null,
      showBack: popover.flyoutCovers(),
      onBack: () => popover.closeFlyout(true),
      onPick: (id) => {
        target = projects.find((project) => project.workspaceId === id) ?? target
        showTarget()
        popover.closeFlyout(true)
      }
    })
    popover.flyout(anchor, picker, () => {})
  }

  async function openSetup(agent: string, anchor: HTMLElement): Promise<void> {
    if (openAgent === agent) return
    const request = ++setupRequest
    openAgent = agent
    menu.markOpen(agent)
    const initial = await loadLast(agent)
    if (request !== setupRequest) return
    const launcher = buildLauncher({
      agentLabel: agentName(agent),
      initial,
      load: (refresh) => orca.plugin.request('models.get', { agent, refresh }),
      subscribe: (listener) => {
        const subscription = orca.plugin.on('models.updated', (catalog: ModelCatalog) => {
          if (catalog.agent === agent) listener(catalog)
        })
        return () => subscription.dispose()
      },
      onBack: () => popover.closeFlyout(true),
      showBack: popover.flyoutCovers(),
      onLaunch: (choice) => onTarget((workspaceId) => void launchAgent(workspaceId, agent, choice))
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

function agentName(id: string): string {
  return state.agents.find((agent) => agent.id === id)?.name ?? agentLabel(id)
}

async function launchAgent(workspaceId: string, agent: string, choice: LauncherChoice): Promise<void> {
  const remembered: LastChoice = { ...(choice.model ? { model: choice.model } : {}), ...(choice.effort ? { effort: choice.effort } : {}) }
  orca.storage.set(lastKey(agent), remembered).catch(flash)
  await run(() => orca.plugin.request('agent.launch', { workspaceId, agent, ...choice }), `Launching ${agentName(agent)}…`)
}

// ---------------------------------------------------------------- input

scrollEl.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null
  const rowEl = target?.closest<HTMLElement>('.row')
  const row = rowFor(rowEl?.dataset.key)
  if (!rowEl || !row) return
  if (target?.closest('.fav')) {
    toggleFavoriteKey(row.node.key)
    return
  }
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

scrollEl.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  const rowEl = event.target instanceof Element ? event.target.closest<HTMLElement>('.row') : null
  const row = rowFor(rowEl?.dataset.key)
  if (row) showMenu(row, event.clientX, event.clientY)
})

type DragState = { key: string; container: string; sourceEl: HTMLElement }
type DropTarget = { key: string; el: HTMLElement; position: 'before' | 'after' }
let dragState: DragState | null = null
let dropTarget: DropTarget | null = null

function clearDropIndicator(): void {
  if (!dropTarget) return
  dropTarget.el.classList.remove('drop-before', 'drop-after')
  dropTarget = null
}

function clearDrag(): void {
  clearDropIndicator()
  dragState?.sourceEl.classList.remove('dragging')
  dragState = null
}

scrollEl.addEventListener('dragstart', (event) => {
  const rowEl = event.target instanceof Element ? event.target.closest<HTMLElement>('.row[data-draggable="true"]') : null
  const key = rowEl?.dataset.key
  if (!rowEl || !key) {
    event.preventDefault()
    return
  }
  dragState = { key, container: rowEl.dataset.container ?? '', sourceEl: rowEl }
  event.dataTransfer?.setData('text/plain', key)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    // Render the drag image on its own composited layer with no outer shadow, so the panel background does not bleed past rounded corners.
    const rect = rowEl.getBoundingClientRect()
    const ghost = rowEl.cloneNode(true) as HTMLElement
    ghost.classList.add('drag-ghost')
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top)
    requestAnimationFrame(() => ghost.remove())
  }
  requestAnimationFrame(() => rowEl.classList.add('dragging'))
})

scrollEl.addEventListener('dragover', (event) => {
  if (!dragState) return
  const rowEl = event.target instanceof Element ? event.target.closest<HTMLElement>('.row') : null
  const key = rowEl?.dataset.key
  if (!rowEl || !key || rowEl.dataset.draggable !== 'true' || (rowEl.dataset.container ?? '') !== dragState.container || key === dragState.key) {
    clearDropIndicator()
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const rect = rowEl.getBoundingClientRect()
  const position: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  if (dropTarget?.el === rowEl && dropTarget.position === position) return
  clearDropIndicator()
  rowEl.classList.add(position === 'before' ? 'drop-before' : 'drop-after')
  dropTarget = { key, el: rowEl, position }
})

scrollEl.addEventListener('dragleave', (event) => {
  if (!dragState) return
  const related = event.relatedTarget instanceof Node ? event.relatedTarget : null
  if (!related || !scrollEl.contains(related)) clearDropIndicator()
})

scrollEl.addEventListener('drop', (event) => {
  if (!dragState) return
  event.preventDefault()
  const activeDrag = dragState
  const activeDrop = dropTarget
  clearDrag()
  if (!activeDrop) return
  if (activeDrag.container === FAVORITES_SECTION_KEY) {
    setFavorites(reorderFavorites(state.favorites, activeDrag.key, activeDrop.key, activeDrop.position))
    return
  }
  const bucket = manualOrderBucket(state.display.group)
  const visibleContainerKeys = rows
    .filter((row) => row.node.kind === 'workspace' && !row.node.linked && !isFavoriteCopy(row.node.key) && (row.parentKey ?? '') === activeDrag.container)
    .map((row) => row.node.key)
  const nextBucket = reorderProjects(state.manualOrder[bucket], visibleContainerKeys, activeDrag.key, activeDrop.key, activeDrop.position)
  setManualOrder({ ...state.manualOrder, [bucket]: nextBucket })
})

scrollEl.addEventListener('dragend', () => clearDrag())

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
    const box = scrollEl.querySelector('.row.selected')?.getBoundingClientRect()
    showMenu(row, box ? box.left + 24 : 8, box ? box.bottom : 8)
  }
})

search.addEventListener('input', () => setFilter(search.value))
search.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    treeEl.focus()
    setState({ selectedKey: state.selectedKey ?? rows[0]?.node.key ?? null }, true)
  } else if (event.key === 'Escape') {
    setFilter('')
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
orca.on('agent.status.changed', (event) => {
  recordPane(panes, event)
  recordTitle(titles, event)
  if (needsAgentText(state.display.detail)) render()
  reloadSoon()
})
orca.plugin.on('tree.changed', reloadSoon)
// Orca sends no event when a project is added, renamed or recoloured (see docs/platform.md), so a look at
// the panel is the trigger: the pointer entering it, the window regaining focus, or the panel being shown.
// All three share one throttle, since they often fire together.
let lastLookAt = 0
function reloadOnLook(): void {
  const now = Date.now()
  if (now - lastLookAt < LOOK_RELOAD_MIN_MS) return
  lastLookAt = now
  void loadSidebar()
  void loadAgents()
  void syncPluginFont()
  reloadSoon()
}
// Ages are drawn at render time, so a panel left open needs a tick, as Orca's sidebar has.
const AGE_TICK_MS = 30_000
setInterval(() => refreshAges(scrollEl), AGE_TICK_MS)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshAges(scrollEl)
    reloadOnLook()
  }
})
document.documentElement.addEventListener('pointerenter', reloadOnLook)
window.addEventListener('focus', reloadOnLook)
orca.on('theme', () => {
  closePopover()
  // The base has changed: the cached looks cover both, so the colours switch at once; then they are read again.
  applySidebar()
  void loadSidebar()
  void syncPluginFont()
})

let sidebarLooks: SidebarLooks | null = null

/** Paints the panel in the left sidebar's colours for the theme base on screen; without them the stylesheet's estimate stays. */
function applySidebar(): void {
  const look = lookFor(sidebarLooks, document.documentElement.classList.contains('dark'))
  const style = document.documentElement.style
  if (look) {
    style.setProperty('--panel-bg', look.background)
    style.setProperty('--panel-accent', look.accent)
    for (const [name, value] of [['--panel-active', look.active], ['--panel-active-border', look.activeBorder]] as const) {
      if (value) style.setProperty(name, value)
      else style.removeProperty(name)
    }
  } else {
    for (const name of ['--panel-bg', '--panel-accent', '--panel-active', '--panel-active-border']) style.removeProperty(name)
  }
}

/** Orca sends no event when the app theme changes in settings, so the colours are read at start and on each look. */
async function loadSidebar(): Promise<void> {
  try {
    sidebarLooks = await orca.plugin.request('theme.get')
    applySidebar()
    orca.storage.set(SIDEBAR_KEY, sidebarLooks).catch(() => {})
  } catch {
    // Keep the colours on screen.
  }
}

async function loadAgents(): Promise<void> {
  try {
    const installed = await orca.plugin.request('agents.installed')
    if (installed && installed.length > 0) {
      setState({ agents: installed })
      orca.storage.set(INSTALLED_AGENTS_KEY, installed).catch(() => {})
    }
  } catch (error: unknown) {
    flash(error)
  }
}

/** The tree from the last session. Orca stops an idle worker after 5 minutes, and a cold `tree.load` takes about 2 s. */
function cachedTree(stored: unknown): Partial<State> {
  const nodes = (stored as Partial<ProjectTree> | null)?.nodes
  return Array.isArray(nodes) ? { tree: { nodes }, treeSignature: JSON.stringify(nodes) } : {}
}

async function start(): Promise<void> {
  render()
  // At once, beside the storage reads: the worker's answer is the slow part when the cache is empty.
  void syncPluginFont()
  try {
    const [stored, tree, sidebar, pluginFont, display, texts, manualOrder, storedFavorites, storedAgents] = await Promise.all([
      orca.storage.get(COLLAPSED_KEY),
      orca.storage.get(TREE_KEY),
      orca.storage.get(SIDEBAR_KEY),
      readPluginFontCache(),
      orca.storage.get(DISPLAY_KEY),
      orca.storage.get(TEXTS_KEY),
      orca.storage.get(MANUAL_ORDER_KEY),
      orca.storage.get(FAVORITES_KEY),
      orca.storage.get(INSTALLED_AGENTS_KEY)
    ])
    // Before the cached tree is drawn: a later change of font would reflow every row.
    restorePluginFont(pluginFont)
    for (const [id, text] of parseTexts(texts)) if (!titles.has(id)) titles.set(id, text)
    sidebarLooks = parseLooks(sidebar)
    applySidebar()
    const keys = Array.isArray(stored) ? stored.filter((key): key is string => typeof key === 'string') : []
    const cachedAgents = parseStoredAgents(storedAgents)
    setState({
      collapsed: new Set(keys),
      display: parseDisplay(display),
      manualOrder: parseManualOrder(manualOrder),
      favorites: parseFavorites(storedFavorites),
      ...(cachedAgents ? { agents: cachedAgents } : {}),
      ...cachedTree(tree)
    })
    // `reload` reveals only when the tree changes, and a fresh tree usually equals the cached one.
    if (state.currentWorkspaceId && !state.selectedKey) reveal(state.currentWorkspaceId)
  } catch (error: unknown) {
    flash(error)
  }
  await Promise.all([loadAgents(), reload(), loadSidebar()])
}

void start()
