import { AGENT_PNGS, AGENT_SVGS } from './agent-icon-data'
import { LUCIDE } from './lucide-data'
import type { ProjectIcon } from '../types'

// Panel icon name -> the Lucide component Orca imports for it. Shapes are generated into lucide-data.ts.
const PANEL_ICONS = {
  chevron: 'ChevronRight',
  folder: 'Folder',
  folderOpen: 'FolderOpen',
  repo: 'Book',
  branch: 'GitBranch',
  home: 'House',
  chevronDown: 'ChevronDown',
  terminal: 'Terminal',
  open: 'ExternalLink',
  collapseAll: 'ChevronsDownUp',
  expandAll: 'ChevronsUpDown',
  more: 'Ellipsis',
  back: 'ArrowLeft',
  check: 'Check',
  chat: 'MessageSquare',
  search: 'Search',
  filter: 'ListFilter',
  squareTerminal: 'SquareTerminal',
  enter: 'CornerDownLeft',
  close: 'X',
  settings: 'SlidersHorizontal',
  add: 'Plus',
  edit: 'Pencil',
  permission: 'MessageCircleQuestion',
  monitoring: 'Activity',
  clock: 'Clock',
  bell: 'Bell',
  bellOff: 'BellOff',
  trash: 'Trash2'
} as const

export type IconName = keyof typeof PANEL_ICONS

const SVG_NS = 'http://www.w3.org/2000/svg'

/** A Lucide icon as an SVG node built from shapes, so no markup is parsed from strings. */
function lucideSvg(name: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  for (const [tag, attributes] of LUCIDE[name]) {
    const shape = document.createElementNS(SVG_NS, tag)
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value)
    svg.appendChild(shape)
  }
  return svg
}

export function icon(name: IconName): SVGSVGElement {
  return lucideSvg(PANEL_ICONS[name])
}

// ---------------------------------------------------------------- agents

/** The mark for an agent, drawn as Orca draws it: its own glyph, its bundled favicon, or a letter. */
export function agentIcon(agent: string, label: string): Element {
  const svg = AGENT_SVGS[agent]
  if (svg) {
    // The strings are Orca's own static icons (build.py), parsed as XML, never built from user input.
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
    const node = document.importNode(parsed, true)
    node.setAttribute('class', 'agent-icon')
    return node
  }
  const png = AGENT_PNGS[agent]
  if (png) {
    const image = document.createElement('img')
    image.className = 'agent-icon'
    image.src = png
    image.alt = ''
    return image
  }
  const letter = document.createElementNS(SVG_NS, 'svg')
  letter.setAttribute('viewBox', '0 0 14 14')
  letter.setAttribute('class', 'agent-icon')
  letter.setAttribute('aria-hidden', 'true')
  const box = document.createElementNS(SVG_NS, 'rect')
  for (const [name, value] of Object.entries({ width: '14', height: '14', rx: '3', fill: 'currentColor', 'fill-opacity': '0.2' })) box.setAttribute(name, value)
  const text = document.createElementNS(SVG_NS, 'text')
  for (const [name, value] of Object.entries({ x: '7', y: '10.5', 'text-anchor': 'middle', 'font-size': '8.5', 'font-weight': '700', fill: 'currentColor' })) text.setAttribute(name, value)
  text.textContent = (label.charAt(0) || '?').toUpperCase()
  letter.append(box, text)
  return letter
}

// ---------------------------------------------------------------- projects

/** Orca shows a plain folder for a project without an icon; here it looks too much like a group folder, so a box stands in. */
const DEFAULT_PROJECT_ICON = 'Box'

function lucideIcon(name: string, color: string | undefined): SVGSVGElement {
  // Orca falls back to its Folder for a name it does not know.
  const svg = lucideSvg(name in LUCIDE ? name : 'Folder')
  svg.setAttribute('class', 'project-icon')
  if (color) svg.style.color = color
  return svg
}

/**
 * A project's icon as Orca draws it: its own picture, emoji or Lucide shape, else the default box in
 * the badge colour. A picture that cannot be loaded falls back to that box.
 */
export function projectIcon(chosen: ProjectIcon | undefined, color: string | undefined): Element {
  if (chosen?.type === 'emoji') {
    const emoji = document.createElement('span')
    emoji.className = 'project-emoji'
    emoji.textContent = chosen.emoji
    return emoji
  }
  if (chosen?.type === 'image') {
    const image = document.createElement('img')
    image.className = 'project-image'
    image.alt = ''
    image.draggable = false
    image.addEventListener('error', () => image.replaceWith(lucideIcon(DEFAULT_PROJECT_ICON, color)), { once: true })
    image.src = chosen.src
    return image
  }
  return lucideIcon(chosen?.type === 'lucide' ? chosen.name : DEFAULT_PROJECT_ICON, color)
}
