// The "Display options" window under the gear: drawn like Orca's "Workspace options" popover.
import { DENSITY_LABELS, DENSITY_MODES, DETAIL_LABELS, DETAIL_MODES, FOLDER_MARKS, FOLDER_MARK_LABELS, GROUP_LABELS, GROUP_MODES, GUIDE_LABELS, GUIDE_MODES, SETTING_TITLES, SORT_LABELS, SORT_MODES, defaultSortDirection, hasSortDirection, type DensityMode, type DetailMode, type FolderMark, type GroupMode, type GuideMode, type SortDirection, type SortMode, type TimeMode } from './display'
import { icon, type IconName } from './icons'
import { closePopover } from './menu'
import { setTip } from './tooltip'

export type OptionsMenuOptions = {
  group: GroupMode
  onGroup: (mode: GroupMode) => void
  detail: DetailMode
  onDetail: (mode: DetailMode) => void
  folders: FolderMark
  onFolders: (mark: FolderMark) => void
  guides: GuideMode
  onGuides: (mode: GuideMode) => void
  density: DensityMode
  onDensity: (mode: DensityMode) => void
  time: TimeMode
  onTime: (mode: TimeMode) => void
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

/** One switch row, as Orca's Filters in "Workspace options": icon and label on the left, pill toggle on the right. */
function toggleRow(title: string, tip: string, glyph: IconName, checked: boolean, onToggle: (next: boolean) => void): HTMLElement {
  let on = checked
  const button = el('button', 'options-toggle')
  button.type = 'button'
  button.setAttribute('role', 'switch')
  setTip(button, tip)
  const main = el('span', 'options-toggle-main')
  const mark = el('span', 'options-toggle-icon')
  mark.appendChild(icon(glyph))
  const label = el('span', 'options-toggle-label')
  label.textContent = title
  main.append(mark, label)
  const track = el('span', 'switch')
  track.setAttribute('aria-hidden', 'true')
  track.appendChild(el('span', 'switch-thumb'))
  button.append(main, track)
  const sync = (): void => {
    button.setAttribute('aria-checked', String(on))
    button.classList.toggle('on', on)
  }
  sync()
  button.addEventListener('click', () => {
    on = !on
    sync()
    onToggle(on)
  })
  return button
}

export function buildOptionsMenu(options: OptionsMenuOptions): HTMLElement {
  const root = el('div', 'menu options')
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Display options')
  const title = el('div', 'options-title')
  title.textContent = 'Display options'
  // The folder marks and tree guides describe the folder tree, so they show only while it is drawn.
  const folderOptions = el('div', 'options-folder')
  folderOptions.hidden = options.group !== 'folder'
  folderOptions.append(
    ...segmented(SETTING_TITLES.folders, FOLDER_MARKS, FOLDER_MARK_LABELS, options.folders, options.onFolders),
    ...segmented(SETTING_TITLES.guides, GUIDE_MODES, GUIDE_LABELS, options.guides, options.onGuides)
  )
  const separator = el('div', 'menu-separator')
  separator.setAttribute('role', 'separator')
  const projectsHeading = el('div', 'options-subtitle')
  projectsHeading.textContent = 'Projects'
  root.append(
    title,
    ...segmented(SETTING_TITLES.density, DENSITY_MODES, DENSITY_LABELS, options.density, options.onDensity),
    ...segmented(SETTING_TITLES.detail, DETAIL_MODES, DETAIL_LABELS, options.detail, options.onDetail),
    toggleRow(SETTING_TITLES.time, 'Time since last activity', 'clock', options.time === 'show', (on) => options.onTime(on ? 'show' : 'hide')),
    separator,
    projectsHeading,
    ...segmented(SETTING_TITLES.group, GROUP_MODES, GROUP_LABELS, options.group, (mode) => {
      folderOptions.hidden = mode !== 'folder'
      options.onGroup(mode)
    }),
    folderOptions
  )
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') closePopover()
  })
  return root
}

export type SortMenuOptions = {
  sort: SortMode
  dir: SortDirection
  canReset: boolean
  onPick: (sort: SortMode, dir: SortDirection) => void
  onReset: () => void
}

/** Compact menu under the header's sort button: picking an inactive mode applies its default order; clicking the active one reverses it. */
export function buildSortMenu(options: SortMenuOptions): HTMLElement {
  let currentSort = options.sort
  let currentDir = options.dir
  let canReset = options.canReset
  const root = el('div', 'menu')
  root.setAttribute('role', 'menu')
  root.setAttribute('aria-label', 'Sort by')
  const heading = el('div', 'options-section')
  heading.textContent = 'Sort by'
  root.appendChild(heading)

  const items = SORT_MODES.map((mode) => {
    const button = el('button', 'menu-item')
    button.type = 'button'
    button.setAttribute('role', 'menuitemradio')
    const radio = el('span', 'sort-radio')
    radio.setAttribute('aria-hidden', 'true')
    const label = el('span', 'launch-label')
    label.textContent = SORT_LABELS[mode]
    button.append(radio, label)
    button.addEventListener('click', () => {
      if (mode === currentSort) {
        if (!hasSortDirection(mode)) return
        currentDir = currentDir === 'asc' ? 'desc' : 'asc'
      } else {
        currentSort = mode
        currentDir = defaultSortDirection(mode)
      }
      sync()
      options.onPick(currentSort, currentDir)
    })
    root.appendChild(button)
    return { mode, button, radio, label }
  })

  const resetSeparator = el('div', 'menu-separator')
  resetSeparator.setAttribute('role', 'separator')
  const resetButton = el('button', 'menu-item')
  resetButton.type = 'button'
  resetButton.tabIndex = -1
  resetButton.setAttribute('role', 'menuitem')
  const resetIcon = el('span', 'sort-radio')
  resetIcon.setAttribute('aria-hidden', 'true')
  resetIcon.appendChild(icon('reset'))
  const resetLabel = el('span', 'launch-label')
  resetLabel.textContent = 'Reset manual order'
  resetButton.append(resetIcon, resetLabel)
  resetButton.addEventListener('click', () => {
    if (!canReset) return
    canReset = false
    sync()
    options.onReset()
  })
  root.append(resetSeparator, resetButton)

  const sync = (): void => {
    for (const { mode, button, radio, label } of items) {
      const active = mode === currentSort
      button.setAttribute('aria-checked', String(active))
      button.tabIndex = active ? 0 : -1
      radio.classList.toggle('on', active)
      button.replaceChildren(...(active && hasSortDirection(mode) ? [radio, label, icon(currentDir === 'asc' ? 'arrowUp' : 'arrowDown')] : [radio, label]))
    }
    resetButton.disabled = !canReset
  }
  sync()
  const active = items.find(({ mode }) => mode === currentSort)
  if (active) active.button.dataset.autofocus = ''

  root.addEventListener('keydown', (event) => {
    const focusable = [...items.map(({ button }) => button), ...(resetButton.disabled ? [] : [resetButton])]
    const at = focusable.findIndex((button) => button === document.activeElement)
    const go = (index: number): void => {
      focusable[(index + focusable.length) % focusable.length].focus()
      event.preventDefault()
    }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at - 1)
    else if (event.key === 'Tab') closePopover()
  })
  return root
}
