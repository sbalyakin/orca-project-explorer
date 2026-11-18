// The "Display options" window under the gear: drawn like Orca's "Workspace options" popover.
import { DETAIL_LABELS, DETAIL_MODES, FOLDER_MARKS, FOLDER_MARK_LABELS, GUIDE_LABELS, GUIDE_MODES, type DetailMode, type FolderMark, type GuideMode } from './display'
import { closePopover } from './menu'
import { setTip } from './tooltip'

export type OptionsMenuOptions = {
  detail: DetailMode
  onDetail: (mode: DetailMode) => void
  folders: FolderMark
  onFolders: (mark: FolderMark) => void
  guides: GuideMode
  onGuides: (mode: GuideMode) => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}

type Labels<T extends string> = Record<T, { short: string; full: string }>

/** One titled row of segments, as Orca's "Group by": one choice, arrows move it, a click applies it. */
function segmented<T extends string>(title: string, values: readonly T[], labels: Labels<T>, selected: T, onPick: (value: T) => void): HTMLElement[] {
  const section = el('div', 'options-section')
  section.textContent = title
  const group = el('div', 'options-group')
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-label', title)

  const items = values.map((value) => {
    const item = el('button', 'segment')
    item.type = 'button'
    item.setAttribute('role', 'radio')
    item.setAttribute('aria-label', labels[value].full)
    setTip(item, labels[value].full)
    item.textContent = labels[value].short
    item.addEventListener('click', () => {
      onPick(value)
      mark(value)
    })
    return { value, item }
  })
  const mark = (picked: T): void => {
    for (const { value, item } of items) {
      item.setAttribute('aria-checked', String(value === picked))
      item.tabIndex = value === picked ? 0 : -1
      item.classList.toggle('on', value === picked)
    }
  }
  mark(selected)
  const current = items.find(({ value }) => value === selected)
  if (current) current.item.dataset.autofocus = ''
  group.append(...items.map(({ item }) => item))

  group.addEventListener('keydown', (event) => {
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
    }
  })
  return [section, group]
}

export function buildOptionsMenu(options: OptionsMenuOptions): HTMLElement {
  const root = el('div', 'menu options')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Display options')
  const title = el('div', 'options-title')
  title.textContent = 'Display options'
  root.append(
    title,
    ...segmented('After project name', DETAIL_MODES, DETAIL_LABELS, options.detail, options.onDetail),
    ...segmented('Folders', FOLDER_MARKS, FOLDER_MARK_LABELS, options.folders, options.onFolders),
    ...segmented('Tree guides', GUIDE_MODES, GUIDE_LABELS, options.guides, options.onGuides)
  )
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') closePopover()
  })
  return root
}
