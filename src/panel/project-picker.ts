// The project list that opens from the project field of the "Create new tab" menu: a search over a list,
// laid out like the model list of the agent flyout (same classes), one project per row.
import { icon } from './icons'
import { setTip } from './tooltip'

export type ProjectChoice = { id: string; label: string; glyph: () => Element }

export type ProjectPickerOptions = {
  projects: readonly ProjectChoice[]
  /** The id of the project the field shows now; it carries the check mark. */
  current: string | null
  /** ArrowLeft out of the list, or its back button: back to the field. */
  onBack: () => void
  /** The list covers the menu, so a mouse needs a visible way back to it. */
  showBack: boolean
  onPick: (id: string) => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Projects whose name has every typed word, in the order given. */
export function matchProjects<T extends { label: string }>(projects: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return projects.filter((project) => words.every((word) => project.label.toLowerCase().includes(word)))
}

export function buildProjectPicker(options: ProjectPickerOptions): HTMLElement {
  const root = el('div', 'setup')
  const field = el('div', 'cmd-input')
  const search = el('input', 'cmd-field')
  search.type = 'text'
  search.placeholder = 'Search projects…'
  search.setAttribute('aria-label', 'Search projects')
  search.dataset.autofocus = ''
  if (options.showBack) {
    const back = el('button', 'cmd-back')
    back.type = 'button'
    back.tabIndex = -1
    back.setAttribute('aria-label', 'Back to menu')
    setTip(back, 'Back to menu')
    back.appendChild(icon('back'))
    back.addEventListener('click', () => options.onBack())
    field.append(back, search)
  } else {
    field.append(icon('search'), search)
  }

  const list = el('div', 'cmd-list')
  list.setAttribute('role', 'listbox')
  const empty = el('div', 'setup-note')
  empty.hidden = true
  root.append(field, list, empty)

  let visible: { id: string; row: HTMLElement }[] = []
  let active: string | undefined

  const setActive = (id: string | undefined, scroll: boolean): void => {
    active = id
    for (const entry of visible) entry.row.classList.toggle('active', entry.id === id)
    if (scroll) visible.find((entry) => entry.id === id)?.row.scrollIntoView({ block: 'nearest' })
  }

  const render = (): void => {
    const query = search.value.trim()
    visible = matchProjects(options.projects, query).map((project) => {
      const row = el('div', 'cmd-item')
      row.setAttribute('role', 'option')
      row.setAttribute('aria-selected', String(project.id === options.current))
      const mark = el('span', 'project-mark')
      mark.appendChild(project.glyph())
      const check = el('span', 'cmd-check')
      if (project.id === options.current) check.appendChild(icon('check'))
      row.append(mark, el('span', 'cmd-label', project.label), check)
      row.addEventListener('pointermove', () => active !== project.id && setActive(project.id, false))
      row.addEventListener('click', () => options.onPick(project.id))
      return { id: project.id, row }
    })
    list.replaceChildren(...visible.map((entry) => entry.row))
    list.hidden = visible.length === 0
    empty.textContent = query ? 'No projects match your search.' : 'No projects.'
    empty.hidden = visible.length > 0
    // Typing starts on the first match; otherwise the current project carries the highlight.
    setActive(query ? visible[0]?.id : (visible.find((entry) => entry.id === options.current) ?? visible[0])?.id, false)
  }

  const move = (step: number): void => {
    if (visible.length === 0) return
    const at = visible.findIndex((entry) => entry.id === active)
    setActive(visible[Math.max(0, Math.min(visible.length - 1, at + step))].id, true)
  }

  search.addEventListener('input', render)
  root.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Enter': {
        if (active !== undefined) options.onPick(active)
        break
      }
      case 'ArrowLeft':
        // In the text field the arrow moves the caret; only an empty field leaves.
        if (search.value !== '') return
        options.onBack()
        break
      default:
        return
    }
    event.preventDefault()
  })
  render()
  return root
}
