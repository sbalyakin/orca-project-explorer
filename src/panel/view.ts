// Draws rows into the tree element. Text only ever goes in through textContent.
import { icon, projectIcon } from './icons'
import { rowDescription, type Row } from './rows'
import { setTip } from './tooltip'

const INDENT = 14
const GUTTER = 8

export type ViewState = {
  selectedKey: string | null
  currentWorkspaceId: string | null
  /** The row whose menu is open, kept marked while the menu covers the tree. */
  menuKey: string | null
}

function glyphName(row: Row): 'folder' | 'folderOpen' | 'repo' | 'branch' {
  if (row.node.kind === 'group') return row.expanded ? 'folderOpen' : 'folder'
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
  if (node.kind === 'workspace' && node.workspaceId === state.currentWorkspaceId) el.classList.add('current')
  el.style.paddingLeft = `${GUTTER + row.depth * INDENT}px`
  const description = rowDescription(row)
  setTip(el, description)
  el.setAttribute('aria-label', description)

  const twistie = document.createElement('span')
  twistie.className = row.expandable ? `twistie${row.expanded ? ' open' : ''}` : 'twistie'
  if (row.expandable) twistie.appendChild(icon('chevron'))
  const glyph = document.createElement('span')
  glyph.className = 'glyph'
  glyph.appendChild(node.kind === 'workspace' && !node.linked ? projectIcon(node.icon, node.color) : icon(glyphName(row)))
  const label = document.createElement('span')
  label.className = 'label'
  label.textContent = node.label
  el.append(twistie, glyph, label)

  if (node.kind === 'workspace' && node.detail) {
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = node.detail
    el.appendChild(detail)
  } else {
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    el.appendChild(spacer)
  }

  // The dot and the menu button share one place, so showing the button on hover moves nothing.
  if (row.attention === 'none' && node.kind !== 'workspace') return el
  const slot = document.createElement('span')
  slot.className = 'slot'
  if (row.attention !== 'none') {
    const dot = document.createElement('span')
    dot.className = `dot ${row.attention}`
    slot.appendChild(dot)
  }
  if (node.kind === 'workspace') {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'tool more'
    setTip(more, 'Open in…')
    more.setAttribute('aria-label', 'Open in…')
    more.tabIndex = -1
    more.appendChild(icon('more'))
    slot.appendChild(more)
  }
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
