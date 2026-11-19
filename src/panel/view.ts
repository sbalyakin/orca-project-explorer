// Draws rows into the tree element. Text only ever goes in through textContent.
import { isOpenable, isProjectFolder, type AgentText } from '../types'
import { detailFor, type DetailMode, type FolderMark, type GuideMode } from './display'
import { icon, projectIcon } from './icons'
import { rowLayout } from './layout'
import { rowDescription, type Row } from './rows'
import { setTip } from './tooltip'

export type ViewState = {
  selectedKey: string | null
  currentWorkspaceId: string | null
  /** The row whose menu is open, kept marked while the menu covers the tree. */
  menuKey: string | null
  /** What follows a row's name, and what the agents say, which it may come from. */
  detailMode: DetailMode
  /** What marks a folder: its arrow, its icon, both or neither. A hidden mark leaves no cell, so the name moves left. */
  folderMark: FolderMark
  /** Vertical lines through the indent of each ancestor level. */
  guides: GuideMode
  /** `Group by: None`: the list is flat, so its first level gets room for the status mark. */
  flat: boolean
  titles: ReadonlyMap<string, AgentText>
}

function glyphName(row: Row): 'folder' | 'folderOpen' | 'repo' | 'branch' | 'home' {
  if (row.node.kind === 'group') return row.expanded ? 'folderOpen' : 'folder'
  if (row.node.primary) return 'home'
  return row.node.linked ? 'branch' : 'repo'
}

function renderRow(row: Row, index: number, state: ViewState): HTMLElement {
  const { node } = row
  const el = document.createElement('div')
  el.className = `row ${node.kind}`
  el.id = `row-${index}`
  el.dataset.key = node.key
  el.setAttribute('role', 'treeitem')
  el.setAttribute('aria-level', String(row.depth + 1))
  el.setAttribute('aria-selected', String(node.key === state.selectedKey))
  if (row.expandable) el.setAttribute('aria-expanded', String(row.expanded))
  if (node.key === state.selectedKey) el.classList.add('selected')
  if (node.key === state.menuKey) el.classList.add('menu-target')
  if (row.attention === 'unread') el.classList.add('unread')
  if (isOpenable(node) && node.workspaceId === state.currentWorkspaceId) el.classList.add('current')
  const layout = rowLayout(row.depth, state.flat)
  el.style.paddingLeft = `${layout.pad}px`
  if (state.guides !== 'none') {
    // One line per ancestor level, centred under that ancestor's first mark; rows touch, so the lines join up.
    for (const left of layout.guides) {
      const guide = document.createElement('span')
      guide.className = `guide ${state.guides}`
      guide.style.left = `${left}px`
      el.appendChild(guide)
    }
  }
  const description = rowDescription(row)
  setTip(el, description)
  el.setAttribute('aria-label', description)

  const twistie = document.createElement('span')
  twistie.className = row.expandable ? `twistie${row.expanded ? ' open' : ''}` : 'twistie'
  const isFolder = node.kind === 'group'
  const showArrow = !isFolder || state.folderMark === 'arrows' || state.folderMark === 'both'
  const showGlyph = !isFolder || state.folderMark === 'icons' || state.folderMark === 'both'
  if (row.expandable && showArrow) twistie.appendChild(icon('chevron'))
  const glyph = document.createElement('span')
  glyph.className = 'glyph'
  glyph.appendChild(node.kind === 'workspace' && !node.linked ? projectIcon(node.icon, node.color) : icon(glyphName(row)))
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = node.label
  if (node.kind === 'group' && node.section) {
    el.classList.add('section')
    // A status section reads `title count chevron`; it has no folder mark and no status of its own.
    const count = document.createElement('span')
    count.className = 'section-count'
    count.textContent = String(node.children.length)
    const chevron = document.createElement('span')
    chevron.className = 'worktrees-mark'
    chevron.appendChild(icon(row.expanded ? 'chevronDown' : 'chevron'))
    const rest = document.createElement('span')
    rest.className = 'spacer'
    el.append(label, count, chevron, rest)
    return el
  }
  const statusMark = (): Element => {
    if (row.attention === 'permission') {
      const mark = icon('permission')
      mark.classList.add('permission-mark')
      return mark
    }
    if (row.attention === 'monitoring') {
      const pulse = icon('monitoring')
      pulse.classList.add('monitoring-mark')
      return pulse
    }
    const dot = document.createElement('span')
    dot.className = `dot ${row.attention}`
    return dot
  }
  // The status (a workspace's own, or what a folded row sums up) sits in the indent left of the row's first mark,
  // out of the layout, so no row's text moves for it.
  if (row.attention !== 'none') {
    const status = document.createElement('span')
    status.className = 'status'
    status.style.left = `${layout.status.left}px`
    status.style.width = `${layout.status.width}px`
    status.appendChild(statusMark())
    el.appendChild(status)
  }
  // A folder drops the cells it does not show; a workspace never has an arrow cell, even with worktrees under it, and always keeps its icon.
  el.append(...(isFolder && showArrow ? [twistie] : []), ...(showGlyph ? [glyph] : []), label)
  // A project with worktrees says so right after its name: a chevron down when open, right when folded.
  if (isProjectFolder(node)) {
    const mark = document.createElement('span')
    mark.className = 'worktrees-mark'
    mark.appendChild(icon(row.expanded ? 'chevronDown' : 'chevron'))
    el.appendChild(mark)
  }

  const detailText = detailFor(node, state.detailMode, state.titles)
  if (detailText) {
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = detailText
    el.appendChild(detail)
  } else {
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    el.appendChild(spacer)
  }

  if (node.kind !== 'workspace') return el
  const slot = document.createElement('span')
  slot.className = 'slot'
  const more = document.createElement('button')
  more.type = 'button'
  more.className = 'tool more'
  setTip(more, 'Open in…')
  more.setAttribute('aria-label', 'Open in…')
  more.tabIndex = -1
  more.appendChild(icon('more'))
  slot.appendChild(more)
  el.appendChild(slot)
  return el
}

export function renderRows(container: HTMLElement, rows: readonly Row[], state: ViewState): void {
  container.replaceChildren(...rows.map((row, index) => renderRow(row, index, state)))
}

export function renderMessage(container: HTMLElement, text: string, isError = false): void {
  const message = document.createElement('div')
  message.className = isError ? 'message error' : 'message'
  message.textContent = text
  container.replaceChildren(message)
}
