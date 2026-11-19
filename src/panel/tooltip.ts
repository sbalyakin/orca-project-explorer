// Tooltips in Orca's style (ui/tooltip.tsx): an inverted bubble with an arrow, opened after a 600 ms
// hover or by keyboard focus. One bubble serves the whole page; an element opts in with `data-tip`.
const DELAY_MS = 600
const GAP = 8 // distance between the target and the bubble, room for the arrow
const EDGE = 4 // minimum distance from the page edge

let bubble: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let current: HTMLElement | null = null
const richTips = new WeakMap<HTMLElement, () => HTMLElement>()

/** Sets the text a tooltip shows for `element`; the accessible name stays the caller's job. */
export function setTip(element: HTMLElement, text: string): void {
  richTips.delete(element)
  delete element.dataset.richTip
  element.dataset.tip = text
}

/** Sets a popover-styled rich tooltip for `element`, built lazily when shown. */
export function setRichTip(element: HTMLElement, build: () => HTMLElement): void {
  delete element.dataset.tip
  element.dataset.richTip = ''
  richTips.set(element, build)
}

function tipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>('[data-tip], [data-rich-tip]') : null
}

function hide(): void {
  clearTimeout(timer)
  current = null
  bubble?.remove()
  bubble = null
}

function show(target: HTMLElement): void {
  if (!target.isConnected) return
  const buildRich = richTips.get(target)
  if (!buildRich && !target.dataset.tip) return
  bubble?.remove()
  const node = document.createElement('div')
  node.className = buildRich ? 'tooltip rich' : 'tooltip'
  node.setAttribute('role', 'tooltip')
  if (buildRich) node.appendChild(buildRich())
  else node.textContent = target.dataset.tip ?? ''
  const arrow = document.createElement('span')
  arrow.className = 'tooltip-arrow'
  node.appendChild(arrow)
  document.body.appendChild(node)
  bubble = node

  const anchor = target.getBoundingClientRect()
  const size = node.getBoundingClientRect()
  const spaceAbove = anchor.top - GAP - EDGE
  const spaceBelow = window.innerHeight - anchor.bottom - GAP - EDGE
  const above = spaceAbove >= size.height || spaceAbove > spaceBelow
  const rawTop = above ? anchor.top - GAP - size.height : anchor.bottom + GAP
  const top = Math.max(EDGE, Math.min(rawTop, Math.max(EDGE, window.innerHeight - size.height - EDGE)))
  const center = anchor.left + anchor.width / 2
  const left = Math.max(EDGE, Math.min(center - size.width / 2, window.innerWidth - size.width - EDGE))
  node.style.top = `${top}px`
  node.style.left = `${left}px`
  arrow.style.left = `${Math.max(8, Math.min(center - left, size.width - 8))}px`
  arrow.classList.add(above ? 'below-bubble' : 'above-bubble')
}

function sameRow(a: HTMLElement | null, b: HTMLElement | null): boolean {
  const key = a?.dataset.key
  return Boolean(key) && key === b?.dataset.key
}

function schedule(target: HTMLElement | null, delay: number): void {
  if (target === current) return
  // Rebuilding rows replaces the DOM element under the pointer; keep the pending timer or open bubble for the same row.
  if (sameRow(current, target)) {
    current = target
    return
  }
  hide()
  if (!target) return
  current = target
  timer = setTimeout(() => {
    if (current) show(current)
  }, delay)
}

/** Listens once on the document, so rows redrawn by a reload keep their tooltips. */
export function installTooltips(): void {
  document.addEventListener('mouseover', (event) => schedule(tipTarget(event.target), DELAY_MS))
  document.addEventListener('mouseleave', hide)
  document.addEventListener('focusin', (event) => {
    const target = tipTarget(event.target)
    if (target?.matches(':focus-visible')) schedule(target, 0)
  })
  document.addEventListener('focusout', hide)
  for (const type of ['mousedown', 'keydown', 'wheel', 'scroll'] as const) document.addEventListener(type, hide, true)
  window.addEventListener('blur', hide)
}
