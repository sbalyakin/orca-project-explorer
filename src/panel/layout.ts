// Where a row puts its indent, tree guides and status mark. Pure, so the arithmetic is tested without a DOM.
export const INDENT = 20 // per level, for folders and projects alike
export const STATUS_GAP = 4 // between the status mark's cell and the row's first mark
export const GUTTER = 8 // the row's own 4px margin makes up the rest, so the open workspace's card has room for its border
const GUIDE_CENTER = 8 // a guide sits under the middle of the 16px cell an ancestor's first mark would take
const GUIDE_WIDTH = 1
const STATUS_WIDTH = 12

export type RowLayout = {
  /** The row's left padding. */
  pad: number
  /** `left` of the guide line for each ancestor level, outermost first. */
  guides: number[]
  /** The status mark's cell, placed in the indent left of the row's first mark. */
  status: { left: number; width: number }
}

/**
 * `flat` is the `None` grouping: projects sit at depth 0 with no folder above to leave room, so the whole list
 * starts one status cell further in, or the status mark would be squeezed into the 8px gutter.
 */
export function rowLayout(depth: number, flat = false): RowLayout {
  const origin = flat ? GUTTER + STATUS_WIDTH + STATUS_GAP : GUTTER
  const pad = origin + depth * INDENT
  const guides = Array.from({ length: depth }, (_, level) => origin + level * INDENT + GUIDE_CENTER)
  const width = Math.min(STATUS_WIDTH, pad)
  // Nested rows centre the mark on the parent's guide line, so guides and marks line up when both show.
  const left = depth > 0 ? pad - INDENT + GUIDE_CENTER + GUIDE_WIDTH / 2 - width / 2 : pad - width - STATUS_GAP
  return { pad, guides, status: { left: Math.max(0, left), width } }
}
