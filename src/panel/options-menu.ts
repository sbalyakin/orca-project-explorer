// The "Display options" window under the gear: drawn like Orca's "Workspace options" popover.
import { DETAIL_LABELS, DETAIL_MODES, type DetailMode } from './display'
import { closePopover } from './menu'
import { setTip } from './tooltip'

export type OptionsMenuOptions = {
  detail: DetailMode
  onDetail: (mode: DetailMode) => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}

export function buildOptionsMenu(options: OptionsMenuOptions): HTMLElement {
  const root = el('div', 'menu options')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Display options')
  const title = el('div', 'options-title')
  title.textContent = 'Display options'
  const section = el('div', 'options-section')
  section.textContent = 'After project name'
  const group = el('div', 'options-group')
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-label', 'After project name')

  const items = DETAIL_MODES.map((mode) => {
    const item = el('button', 'segment')
    item.type = 'button'
    item.setAttribute('role', 'radio')
    item.setAttribute('aria-label', DETAIL_LABELS[mode].full)
    setTip(item, DETAIL_LABELS[mode].full)
    item.textContent = DETAIL_LABELS[mode].short
    item.addEventListener('click', () => {
      options.onDetail(mode)
      mark(mode)
    })
    return { mode, item }
  })
  const mark = (selected: DetailMode): void => {
    for (const { mode, item } of items) {
      item.setAttribute('aria-checked', String(mode === selected))
      item.tabIndex = mode === selected ? 0 : -1
      item.classList.toggle('on', mode === selected)
    }
  }
  mark(options.detail)
  const current = items.find(({ mode }) => mode === options.detail)
  if (current) current.item.dataset.autofocus = ''
  group.append(...items.map(({ item }) => item))
  root.append(title, section, group)

  root.addEventListener('keydown', (event) => {
    const at = items.findIndex(({ item }) => item === document.activeElement)
    const go = (target: (typeof items)[number] | undefined): void => {
      if (!target) return
      target.item.focus()
      target.item.click()
      event.preventDefault()
    }
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return go(items[Math.min(items.length - 1, at + 1)])
      case 'ArrowLeft':
      case 'ArrowUp':
        return go(items[Math.max(0, at - 1)])
      case 'Tab':
        closePopover()
        return
    }
  })
  return root
}
