// The right-click menu, drawn the way Orca draws its new-tab menu: a search field, a row of icon
// buttons, agent rows with a chevron segment, and a flyout for the chosen agent. A plugin cannot
// draw outside its frame, so both live inside the panel and are kept in view.
import { icon } from './icons'
import { setTip } from './tooltip'

export type AgentEntry = { id: string; label: string; glyph: () => Element }

export type Popover = {
  close: () => void
  /** Shows `content` beside the menu, level with `anchor`; at most one at a time. */
  flyout: (anchor: HTMLElement, content: HTMLElement, onClosed: () => void) => void
  /** `restoreFocus` returns the keyboard to the agent row the flyout belonged to. */
  closeFlyout: (restoreFocus?: boolean) => void
  /** True when the panel is too narrow for a flyout beside the menu, so it would be drawn over it. */
  flyoutCovers: () => boolean
}

const EDGE = 8
const FLYOUT_WIDTH = 416
let closeCurrent: (() => void) | null = null

export function closePopover(): void {
  closeCurrent?.()
}

/** Opens the menu at a point, kept inside the panel; one at a time. */
export function openPopover(options: { x: number; y: number; onClose: () => void }, content: HTMLElement): Popover {
  closePopover()
  const frame = document.createElement('div')
  frame.className = 'popover'
  frame.appendChild(content)
  document.body.appendChild(frame)

  const place = (): void => {
    const { width, height } = frame.getBoundingClientRect()
    frame.style.left = `${Math.max(EDGE, Math.min(options.x, window.innerWidth - width - EDGE))}px`
    frame.style.top = `${Math.max(EDGE, Math.min(options.y, window.innerHeight - height - EDGE))}px`
  }
  place()

  let flyoutFrame: HTMLElement | null = null
  let flyoutAnchor: HTMLElement | null = null
  let flyoutClosed: (() => void) | null = null
  let observer: ResizeObserver | null = null

  const closeFlyout = (restoreFocus = false): void => {
    if (!flyoutFrame) return
    observer?.disconnect()
    flyoutFrame.remove()
    flyoutFrame = null
    const closed = flyoutClosed
    const anchor = flyoutAnchor
    flyoutClosed = null
    flyoutAnchor = null
    closed?.()
    if (restoreFocus) anchor?.querySelector('button')?.focus()
  }

  const flyoutWidth = (): number => Math.min(FLYOUT_WIDTH, window.innerWidth - 2 * EDGE)
  const flyoutCovers = (): boolean => {
    const main = frame.getBoundingClientRect()
    const width = flyoutWidth()
    return main.right + 4 + width > window.innerWidth - EDGE && main.left - width - 4 < EDGE
  }

  const flyout: Popover['flyout'] = (anchor, body, onClosed) => {
    closeFlyout()
    const element = document.createElement('div')
    element.className = 'popover picker'
    element.style.width = `${flyoutWidth()}px`
    element.appendChild(body)
    document.body.appendChild(element)
    flyoutFrame = element
    flyoutAnchor = anchor
    flyoutClosed = onClosed
    const placeFlyout = (): void => {
      const main = frame.getBoundingClientRect()
      const row = anchor.getBoundingClientRect()
      const { width, height } = element.getBoundingClientRect()
      // Beside the menu when there is room, else over it, as Orca's submenu does in a narrow window.
      let left = main.right + 4
      if (left + width > window.innerWidth - EDGE) left = main.left - width - 4
      if (left < EDGE) left = Math.max(EDGE, window.innerWidth - width - EDGE)
      element.style.left = `${left}px`
      element.style.top = `${Math.max(EDGE, Math.min(row.top - 5, window.innerHeight - height - EDGE))}px`
    }
    placeFlyout()
    // Its height follows the model list as it loads and filters.
    observer = new ResizeObserver(placeFlyout)
    observer.observe(element)
    element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (flyoutFrame?.contains(target)) return
    if (frame.contains(target)) return
    close()
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (flyoutFrame) closeFlyout(true)
    else close()
  }
  const close = (): void => {
    if (closeCurrent !== close) return
    closeCurrent = null
    closeFlyout()
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('blur', close)
    window.removeEventListener('resize', close)
    frame.remove()
    options.onClose()
  }
  closeCurrent = close
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('blur', close)
  window.addEventListener('resize', close)
  return { close, flyout, closeFlyout: (restoreFocus) => closeFlyout(restoreFocus), flyoutCovers }
}

/** `onNewWorkspace` is absent for a linked worktree, whose menu has New tab only. */
export type RowMenuOptions = {
  onNewTab: () => void
  onNewWorkspace?: () => void
  /** The item texts; the `+` button's menu says "Create new …". */
  labels?: { tab: string; workspace: string }
}

/** The menu of a project or worktree row: plain items, laid out like the agent rows of the main menu. */
export function buildRowMenu(options: RowMenuOptions): HTMLElement {
  const menu = el('div', 'menu')
  menu.setAttribute('role', 'menu')
  const { onNewWorkspace } = options
  const labels = options.labels ?? { tab: 'New tab', workspace: 'New workspace' }
  const entries: (readonly ['add' | 'branch', string, () => void])[] = [['add', labels.tab, options.onNewTab]]
  if (onNewWorkspace) entries.push(['branch', labels.workspace, onNewWorkspace])
  const items = entries.map(([name, text, onPress]) => {
    const item = el('button', 'menu-item')
    item.type = 'button'
    item.setAttribute('role', 'menuitem')
    const label = el('span', 'launch-label')
    label.textContent = text
    item.append(icon(name), label)
    item.addEventListener('click', onPress)
    return item
  })
  items[0].dataset.autofocus = ''
  menu.append(...items)
  menu.addEventListener('keydown', (event) => {
    const at = items.findIndex((item) => item === document.activeElement)
    const go = (target: HTMLElement | undefined): void => {
      target?.focus()
      event.preventDefault()
    }
    switch (event.key) {
      case 'ArrowDown':
        return go(items[Math.min(items.length - 1, at + 1)])
      case 'ArrowUp':
        return go(items[Math.max(0, at - 1)])
      case 'Tab':
        closePopover()
        return
    }
  })
  return menu
}

/** The project field above the search: shows the project a new tab goes to; pressing it opens the project list. */
export type ProjectField = { onPress: (anchor: HTMLElement) => void }

export type MainMenuOptions = {
  /** Absent for a workspace's own menu, whose target is fixed. */
  project?: ProjectField
  agents: readonly AgentEntry[]
  onOpen: () => void
  onTerminal: () => void
  /** Pressing an agent row: launch it as it was last launched. */
  onLaunch: (agent: string) => void
  /** The chevron, hovering it, or ArrowRight: the agent's setup flyout. */
  onSetup: (agent: string, row: HTMLElement) => void
  /** The pointer reached `agent`'s row, or (no agent) a part of the menu that is not an agent row. */
  onHover: (agent?: string) => void
  /** False when a flyout would cover the menu: hovering the chevron must not hide the menu under the pointer. */
  hoverOpensSetup: () => boolean
}

export type MainMenu = {
  element: HTMLElement
  markOpen: (agent: string | null) => void
  /** Shows the chosen project in the field; `null` means none, and the terminal, open and agent items stay off. */
  setProject: (project: { label: string; glyph: Element } | null) => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function iconButton(name: 'squareTerminal' | 'open', label: string, onPress: () => void): HTMLButtonElement {
  const button = el('button', 'icon-button')
  button.type = 'button'
  setTip(button, label)
  button.setAttribute('aria-label', label)
  button.appendChild(icon(name))
  button.addEventListener('click', onPress)
  return button
}

export function buildMainMenu(options: MainMenuOptions): MainMenu {
  const menu = el('div', 'menu')
  menu.setAttribute('role', 'menu')

  const projectField = options.project ? buildProjectField(options.project) : null
  const omnibox = el('div', projectField ? 'omnibox after-field' : 'omnibox')
  const search = el('input', 'omnibox-input')
  search.type = 'text'
  search.placeholder = 'Search agents…'
  search.setAttribute('aria-label', 'Search agents')
  search.dataset.autofocus = ''
  omnibox.appendChild(search)

  const iconRow = el('div', 'icon-row')
  const iconButtons = [iconButton('squareTerminal', 'Terminal', options.onTerminal), iconButton('open', 'Open workspace', options.onOpen)]
  iconRow.append(...iconButtons)

  const list = el('div', 'agent-list')
  const empty = el('div', 'menu-empty')
  empty.textContent = 'No agents match your search.'
  empty.hidden = true
  const segments: HTMLButtonElement[] = []
  const rows = options.agents.map((agent) => {
    const row = el('div', 'launch-row')
    row.dataset.agent = agent.id
    const main = el('button', 'launch-main')
    main.type = 'button'
    main.setAttribute('role', 'menuitem')
    const label = el('span', 'launch-label')
    label.textContent = agent.label
    main.append(agent.glyph(), label)
    const segment = el('button', 'launch-segment')
    segment.type = 'button'
    segment.tabIndex = -1
    segment.setAttribute('aria-label', `${agent.label} setup`)
    segment.setAttribute('aria-haspopup', 'menu')
    segment.appendChild(icon('chevron'))
    segments.push(segment)
    main.addEventListener('click', () => options.onLaunch(agent.id))
    main.addEventListener('pointerenter', () => options.onHover(agent.id))
    segment.addEventListener('click', (event) => {
      event.stopPropagation()
      options.onSetup(agent.id, row)
    })
    // Moving, not entering: rows sliding under a resting pointer must not open a flyout.
    segment.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse' && !row.classList.contains('open') && options.hoverOpensSetup()) options.onSetup(agent.id, row)
    })
    row.append(main, segment)
    return { agent, row, main, label: agent.label }
  })
  list.append(...rows.map(({ row }) => row))
  for (const target of [omnibox, iconRow]) target.addEventListener('pointerenter', () => options.onHover())

  const separator = (className: string): HTMLElement => {
    const node = el('div', className)
    node.setAttribute('role', 'separator')
    return node
  }
  if (projectField) menu.append(projectField.element, separator('menu-separator'))
  menu.append(omnibox, separator('menu-separator flush'), iconRow, separator('menu-separator'), list, empty)

  const visibleRows = () => rows.filter(({ row }) => !row.hidden)
  const stops = (): HTMLElement[] =>
    [...(projectField ? [projectField.button] : []), search, iconButtons[0], ...visibleRows().map(({ main }) => main)].filter(
      (stop) => !(stop instanceof HTMLButtonElement && stop.disabled)
    )

  search.addEventListener('input', () => {
    const needle = search.value.trim().toLowerCase()
    for (const { row, label } of rows) row.hidden = needle !== '' && !label.toLowerCase().includes(needle)
    empty.hidden = visibleRows().length > 0
  })

  menu.addEventListener('keydown', (event) => {
    const active = document.activeElement as HTMLElement | null
    const all = stops()
    const inIcons = active instanceof HTMLButtonElement && iconButtons.includes(active)
    const index = inIcons ? all.indexOf(iconButtons[0]) : active ? all.indexOf(active) : -1
    const go = (target: HTMLElement | undefined): void => {
      target?.focus()
      event.preventDefault()
    }
    switch (event.key) {
      case 'ArrowDown':
        return go(all[Math.min(all.length - 1, index + 1)])
      case 'ArrowUp':
        return go(all[Math.max(0, index - 1)])
      case 'Home':
        if (active === search) return
        return go(all[0])
      case 'End':
        if (active === search) return
        return go(all[all.length - 1])
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (inIcons) {
          const at = iconButtons.indexOf(active)
          return go(iconButtons[Math.max(0, Math.min(iconButtons.length - 1, at + (event.key === 'ArrowRight' ? 1 : -1)))])
        }
        const found = rows.find(({ main }) => main === active)
        if (found && event.key === 'ArrowRight') {
          options.onSetup(found.agent.id, found.row)
          event.preventDefault()
        }
        if (projectField && active === projectField.button && event.key === 'ArrowRight') {
          projectField.press()
          event.preventDefault()
        }
        return
      }
      case 'Enter':
        if (active === search) {
          visibleRows()[0]?.main.click()
          event.preventDefault()
        }
        return
      case 'Tab':
        closePopover()
        return
    }
  })

  return {
    element: menu,
    markOpen: (agent) => {
      for (const { agent: entry, row } of rows) row.classList.toggle('open', entry.id === agent)
    },
    setProject: (project) => {
      projectField?.show(project)
      const off = projectField !== null && project === null
      menu.classList.toggle('no-project', off)
      for (const button of [...iconButtons, ...segments, ...rows.map(({ main }) => main)]) button.disabled = off
    }
  }
}

/** The field's button: the project's mark and name on the left, a chevron on the right. */
function buildProjectField(field: ProjectField): { element: HTMLElement; button: HTMLButtonElement; press: () => void; show: MainMenu['setProject'] } {
  // The wrapper is the flyout's anchor: closing the flyout with Escape returns focus to the button inside it.
  const element = el('div', 'project-field')
  const button = el('button', 'menu-item')
  button.type = 'button'
  button.setAttribute('role', 'menuitem')
  button.setAttribute('aria-haspopup', 'menu')
  const mark = el('span', 'project-mark')
  const label = el('span', 'launch-label')
  button.append(mark, label, icon('chevron'))
  const press = (): void => field.onPress(element)
  button.addEventListener('click', press)
  element.appendChild(button)
  const show: MainMenu['setProject'] = (project) => {
    label.textContent = project?.label ?? 'Select project…'
    label.classList.toggle('placeholder', project === null)
    mark.replaceChildren(...(project ? [project.glyph] : []))
    button.setAttribute('aria-label', `Project: ${label.textContent}`)
  }
  show(null)
  return { element, button, press, show }
}
