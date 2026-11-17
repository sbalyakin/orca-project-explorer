// The setup flyout for one agent, laid out as in Orca: a model search over a list, the reasoning
// levels, an optional prompt, and Launch terminal / Launch chat. Models come from the agent itself.
import { icon } from './icons'
import { setTip } from './tooltip'
import type { AgentModel, LaunchSurface, ModelCatalog } from '../types'

export type LauncherChoice = { model?: string; effort?: string; prompt: string; surface?: LaunchSurface }

export type LauncherOptions = {
  agentLabel: string
  initial: { model?: string; effort?: string }
  load: (refresh: boolean) => Promise<ModelCatalog>
  /** Hears a background refresh of this agent's models; returns a function that stops listening. */
  subscribe: (listener: (catalog: ModelCatalog) => void) => () => void
  /** ArrowLeft out of the flyout, or its back button: back to the agent row. */
  onBack: () => void
  /** The flyout covers the menu, so a mouse needs a visible way back to it. */
  showBack: boolean
  onLaunch: (choice: LauncherChoice) => void
}

const EFFORT_LABELS: Record<string, string> = { off: 'off', minimal: 'Min', low: 'Low', medium: 'Med', high: 'High', xhigh: 'XHigh', max: 'Max', ultra: 'Ultra' }

export function effortLabel(effort: string): string {
  return EFFORT_LABELS[effort] ?? effort.charAt(0).toUpperCase() + effort.slice(1)
}

/** The effort a model starts on: its own default, else Medium, else the first it lists. */
export function startEffort(model: AgentModel): string | undefined {
  if (model.efforts.length === 0) return undefined
  return model.defaultEffort ?? (model.efforts.includes('medium') ? 'medium' : model.efforts[0])
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const IS_MAC = navigator.platform.toLowerCase().includes('mac')

function surfaceButton(label: string, glyph: 'chat' | 'squareTerminal', primary: boolean, keys: Node[], onPress: () => void): HTMLButtonElement {
  const button = el('button', `btn${primary ? ' primary' : ''}`)
  button.type = 'button'
  button.setAttribute('aria-label', label)
  const hint = el('span', 'keys')
  hint.setAttribute('aria-hidden', 'true')
  hint.append(...keys)
  button.append(icon(glyph), el('span', 'btn-label', label), hint)
  button.addEventListener('click', onPress)
  return button
}

export function buildLauncher(options: LauncherOptions): { element: HTMLElement; dispose: () => void } {
  let catalog: ModelCatalog | null = null
  let loading = true
  let selected: AgentModel | null = null
  let effort: string | undefined = options.initial.effort
  let query = ''
  /** Id of the highlighted list row: the keyboard cursor, which is not the chosen model. */
  let active: string | undefined
  let visible: { id: string; model: AgentModel; row: HTMLElement }[] = []

  const root = el('div', 'setup')

  const field = el('div', 'cmd-input')
  const search = el('input', 'cmd-field')
  search.type = 'text'
  search.placeholder = `Search ${options.agentLabel} models…`
  search.setAttribute('aria-label', 'Search models')
  search.dataset.autofocus = ''
  if (options.showBack) {
    const back = el('button', 'cmd-back')
    back.type = 'button'
    back.tabIndex = -1
    back.setAttribute('aria-label', 'Back to agents')
    setTip(back, 'Back to agents')
    back.appendChild(icon('back'))
    back.addEventListener('click', () => options.onBack())
    field.append(back, search)
  } else {
    field.append(icon('search'), search)
  }

  const list = el('div', 'cmd-list')
  list.setAttribute('role', 'listbox')
  const note = el('div', 'setup-note')
  const efforts = el('div', 'setup-efforts')
  efforts.setAttribute('role', 'radiogroup')
  efforts.setAttribute('aria-label', 'Reasoning effort')
  const composer = el('div', 'composer')
  const prompt = el('textarea', 'composer-input')
  prompt.rows = 1
  prompt.placeholder = 'Add a prompt (optional)'
  prompt.setAttribute('aria-label', 'Prompt')
  composer.appendChild(prompt)
  const promptBox = el('div', 'setup-prompt')
  promptBox.appendChild(composer)

  const launch = (surface?: LaunchSurface): void => {
    const choice: LauncherChoice = { prompt: prompt.value, ...(surface ? { surface } : {}) }
    if (selected) {
      choice.model = selected.id
      if (effort && selected.efforts.includes(effort)) choice.effort = effort
    }
    options.onLaunch(choice)
  }
  const mod = IS_MAC ? '⌘' : 'Ctrl'
  const terminalButton = surfaceButton('Launch terminal', 'squareTerminal', false, [document.createTextNode(`${mod} `), icon('enter')], () => launch('terminal'))
  const chatButton = surfaceButton('Launch chat', 'chat', true, [icon('enter')], () => launch('chat'))
  const actions = el('div', 'setup-actions')
  actions.append(terminalButton, chatButton)
  root.append(field, list, note, efforts, promptBox, actions)

  function select(model: AgentModel | null): void {
    selected = model
    if (!model || !model.efforts.includes(effort ?? '')) effort = model ? startEffort(model) : undefined
    renderList()
    renderEfforts()
  }

  function setActive(id: string | undefined, scroll: boolean): void {
    active = id
    for (const entry of visible) entry.row.classList.toggle('active', entry.id === id)
    if (scroll) visible.find((entry) => entry.id === id)?.row.scrollIntoView({ block: 'nearest' })
  }

  function renderList(): void {
    const needle = query.trim().toLowerCase()
    const models = (catalog?.models ?? []).filter((m) => !needle || `${m.label} ${m.id}`.toLowerCase().includes(needle))
    // A typed id that no model has is offered as it was typed.
    const entries: { model: AgentModel; title: string }[] = models.map((model) => ({ model, title: model.label }))
    const custom = query.trim()
    if (custom && !(catalog?.models ?? []).some((m) => m.id === custom)) {
      entries.unshift({ model: { id: custom, label: custom, efforts: [] }, title: `Use “${custom}”` })
    }
    visible = entries.map(({ model, title }) => {
      const row = el('div', 'cmd-item')
      row.setAttribute('role', 'option')
      row.setAttribute('aria-selected', String(selected?.id === model.id))
      const mark = el('span', 'cmd-check')
      if (selected?.id === model.id) mark.appendChild(icon('check'))
      row.append(el('span', 'cmd-label', title), mark)
      row.addEventListener('pointermove', () => active !== model.id && setActive(model.id, false))
      row.addEventListener('click', () => {
        select(model)
        setActive(model.id, false)
        search.focus({ preventScroll: true })
      })
      return { id: model.id, model, row }
    })
    list.replaceChildren(...visible.map((entry) => entry.row))
    list.hidden = visible.length === 0
    // Typing starts on the first match; otherwise the chosen model carries the highlight.
    const keep = active !== undefined && visible.some((entry) => entry.id === active)
    setActive(keep ? active : needle ? visible[0]?.id : (selected?.id ?? visible[0]?.id), false)
  }

  function renderEfforts(): void {
    const levels = selected?.efforts ?? []
    efforts.hidden = levels.length === 0
    efforts.replaceChildren(
      ...levels.map((level) => {
        const button = el('button', `seg${level === effort ? ' on' : ''}`, effortLabel(level))
        button.type = 'button'
        button.setAttribute('role', 'radio')
        button.setAttribute('aria-checked', String(level === effort))
        button.addEventListener('click', () => {
          effort = level
          renderEfforts()
        })
        return button
      })
    )
  }

  function renderNote(): void {
    if (loading && !catalog?.models.length) note.textContent = 'Loading models…'
    else if (catalog?.error) note.textContent = `Could not list models: ${catalog.error}`
    else if (catalog && !catalog.supported) note.textContent = 'This agent cannot list models. Type a model id to use one.'
    else note.textContent = ''
    note.hidden = note.textContent === ''
  }

  /** The model the flyout starts on: the last one used, else the agent's default. */
  function pickInitial(models: readonly AgentModel[]): AgentModel | null {
    const saved = options.initial.model
    const wanted = (saved ? models.find((m) => m.id === saved) : undefined) ?? models.find((m) => m.isDefault)
    if (wanted) return wanted
    return saved ? { id: saved, label: saved, efforts: [] } : null
  }

  function accept(next: ModelCatalog): void {
    const first = catalog === null
    catalog = next
    loading = false
    if (first && !selected) select(pickInitial(next.models))
    else if (selected) {
      // A refreshed list can change a model's levels; keep the choice, update what it offers.
      const fresh = next.models.find((m) => m.id === selected?.id)
      if (fresh) select(fresh)
    }
    renderList()
    renderNote()
    // The list opens on the chosen model, however far down it is.
    if (first) setActive(active, true)
  }

  async function load(refresh: boolean): Promise<void> {
    loading = true
    renderNote()
    try {
      accept(await options.load(refresh))
    } catch (error: unknown) {
      loading = false
      accept({ agent: '', models: catalog?.models ?? [], fetchedAt: 0, supported: true, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const alternate = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey
  search.addEventListener('input', () => {
    query = search.value
    renderList()
  })
  search.addEventListener('keydown', (event) => {
    if (event.isComposing) return
    const index = visible.findIndex((entry) => entry.id === active)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = event.key === 'ArrowDown' ? Math.min(visible.length - 1, index + 1) : Math.max(0, index - 1)
      setActive(visible[next]?.id, true)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (alternate(event)) return launch('terminal')
      const entry = visible[index]
      // Enter on a model that is not chosen yet chooses it; on the chosen one it launches.
      if (entry && entry.id !== selected?.id) select(entry.model)
      else launch('chat')
    } else if (event.key === 'ArrowLeft' && search.value === '') {
      event.preventDefault()
      options.onBack()
    }
  })
  prompt.addEventListener('input', () => {
    prompt.style.height = 'auto'
    prompt.style.height = `${prompt.scrollHeight}px`
  })
  prompt.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    launch(alternate(event) ? 'terminal' : 'chat')
  })

  const unsubscribe = options.subscribe((updated) => {
    if (catalog) accept(updated)
  })
  renderList()
  renderEfforts()
  renderNote()
  void load(false)
  return { element: root, dispose: unsubscribe }
}
