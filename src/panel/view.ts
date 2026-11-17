// Draws rows into the tree element. Text only ever goes in through textContent.
import { icon, projectIcon } from './icons'
import type { Row } from './rows'
import { setTip } from './tooltip'

const INDENT = 14
const GUTTER = 8

export type ViewState = {
  selectedKey: string | null
  currentWorkspaceId: string | null
}

function glyphName(row: Row): 'folder' | 'folderOpen' | 'repo' | 'branch' {
  if (row.node.kind === 'group') return row.expanded ? 'folderOpen' : 'folder'
  return row.node.linked ? 'branch' : 'repo'
}

function renderRow(row: Row, state: ViewState): HTMLElement {
  const { node } = row
  const el = document.createElement('div')
  el.className = `row ${node.kind}`
  el.dataset.key = node.key
  el.setAttribute('role', 'treeitem')
  el.setAttribute('aria-level', String(row.depth + 1))
  if (row.expandable) el.setAttribute('aria-expanded', String(row.expanded))
  if (node.key === state.selectedKey) el.classList.add('selected')
  if (node.kind === 'workspace' && node.workspaceId === state.currentWorkspaceId) el.classList.add('current')
  el.style.paddingLeft = `${GUTTER + row.depth * INDENT}px`
  setTip(el, node.kind === 'workspace' && node.detail ? `${node.label} · ${node.detail}` : node.label)

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

  if (row.attention !== 'none') {
    const dot = document.createElement('span')
    dot.className = `dot ${row.attention}`
    el.appendChild(dot)
  }
  if (node.kind === 'workspace') {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'tool more'
    setTip(more, 'Open in…')
    more.setAttribute('aria-label', 'Open in…')
    more.tabIndex = -1
    more.appendChild(icon('more'))
    el.appendChild(more)
  }
  return el
}

export function renderRows(container: HTMLElement, rows: readonly Row[], state: ViewState): void {
  container.replaceChildren(...rows.map((row) => renderRow(row, state)))
}

export function renderMessage(container: HTMLElement, text: string, isError = false): void {
  const message = document.createElement('div')
  message.className = isError ? 'message error' : 'message'
  message.textContent = text
  container.replaceChildren(message)
}
