import { assert, test } from 'orca/testing'
import type { GroupNode, WorkspaceNode } from '../types'
import { classifyDraggable, isProjectRow, resolveDropAction, type DragSource } from './drag-drop'
import { FAVORITES_SECTION_KEY } from './favorites'

function workspace(overrides: Partial<WorkspaceNode> & { key: string }): WorkspaceNode {
  return {
    kind: 'workspace',
    workspaceId: `ws-${overrides.key}`,
    label: overrides.key,
    linked: false,
    attention: 'none',
    children: [],
    ...overrides
  }
}

function group(overrides: Partial<GroupNode> & { key: string }): GroupNode {
  return {
    kind: 'group',
    label: overrides.key,
    children: [],
    ...overrides
  }
}

test('isProjectRow is true only for main project rows', () => {
  assert.equal(isProjectRow(workspace({ key: 'p1' })), true)
  assert.equal(isProjectRow(workspace({ key: 'p2', children: [workspace({ key: 'w1', linked: true })] })), true)
  assert.equal(isProjectRow(workspace({ key: 'w1', linked: true })), false)
  assert.equal(isProjectRow(workspace({ key: 'p1-main', primary: true })), false)
  assert.equal(isProjectRow(group({ key: 'dir:a' })), false)
  assert.equal(isProjectRow(group({ key: 'section:working', section: true })), false)
})

test('classifyDraggable allows dragging projects in Projects even when manual reorder is off', () => {
  const project = workspace({ key: 'p1' })
  assert.deepEqual(classifyDraggable(project, 1, { manualReorder: false, favoritesEnabled: true }), {
    section: 'projects',
    isProject: true,
    canReorder: false,
    canFavorite: true
  })
  assert.deepEqual(classifyDraggable(project, 1, { manualReorder: true, favoritesEnabled: true }), {
    section: 'projects',
    isProject: true,
    canReorder: true,
    canFavorite: true
  })
  assert.equal(classifyDraggable(project, 1, { manualReorder: false, favoritesEnabled: false }), null)
})

test('classifyDraggable respects favoritesEnabled: false when manualReorder is true', () => {
  const project = workspace({ key: 'p1' })
  const meta = classifyDraggable(project, 1, { manualReorder: true, favoritesEnabled: false })
  assert.deepEqual(meta, {
    section: 'projects',
    isProject: true,
    canReorder: true,
    canFavorite: false
  })
  const source: DragSource = { key: 'p1', container: 'dir:a', ...meta }
  assert.deepEqual(resolveDropAction(source, { zone: 'favorites' }), { kind: 'none' })
  assert.deepEqual(
    resolveDropAction(source, {
      zone: 'outside-favorites',
      row: { key: 'p2', container: 'dir:a', canReorder: true, position: 'before' }
    }),
    { kind: 'reorder-projects', draggedKey: 'p1', targetKey: 'p2', position: 'before' }
  )
})

test('classifyDraggable rejects non-project rows in Projects', () => {
  const opts = { manualReorder: true, favoritesEnabled: true }
  assert.equal(classifyDraggable(workspace({ key: 'w1', linked: true }), 2, opts), null)
  assert.equal(classifyDraggable(workspace({ key: 'p1-main', primary: true }), 2, opts), null)
  assert.equal(classifyDraggable(group({ key: 'dir:a' }), 0, opts), null)
  assert.equal(classifyDraggable(group({ key: 'section:working', section: true }), 0, opts), null)
})

test('classifyDraggable distinguishes project and linked worktree rows in Favorites', () => {
  const opts = { manualReorder: false, favoritesEnabled: true }
  assert.deepEqual(classifyDraggable(workspace({ key: 'fav:p1' }), 0, opts), {
    section: 'favorites',
    isProject: true,
    canReorder: true,
    canFavorite: true
  })
  assert.deepEqual(classifyDraggable(workspace({ key: 'fav:w1', linked: true }), 0, opts), {
    section: 'favorites',
    isProject: false,
    canReorder: true,
    canFavorite: true
  })
  assert.equal(classifyDraggable(workspace({ key: 'fav:p1' }), 1, opts), null)
  assert.equal(classifyDraggable(workspace({ key: 'fav:p1' }), 0, { manualReorder: false, favoritesEnabled: false }), null)
})

test('resolveDropAction adds a project dragged from Projects onto Favorites', () => {
  const source: DragSource = {
    key: 'p1',
    container: 'dir:a',
    section: 'projects',
    isProject: true,
    canReorder: false,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(source, { zone: 'favorites' }), {
    kind: 'add-favorite',
    key: 'p1'
  })
  assert.deepEqual(
    resolveDropAction(source, {
      zone: 'favorites',
      row: { key: 'fav:p2', container: FAVORITES_SECTION_KEY, canReorder: true, position: 'before' }
    }),
    { kind: 'add-favorite', key: 'p1' }
  )
})

test('resolveDropAction removes a project dragged from Favorites outside Favorites', () => {
  const source: DragSource = {
    key: 'fav:p1',
    container: FAVORITES_SECTION_KEY,
    section: 'favorites',
    isProject: true,
    canReorder: true,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(source, { zone: 'outside-favorites' }), {
    kind: 'remove-favorite',
    key: 'p1'
  })
  assert.deepEqual(
    resolveDropAction(source, {
      zone: 'outside-favorites',
      row: { key: 'p2', container: 'dir:a', canReorder: false, position: 'after' }
    }),
    { kind: 'remove-favorite', key: 'p1' }
  )
})

test('resolveDropAction is a no-op when dropping on the same section without a valid reorder', () => {
  const favProject: DragSource = {
    key: 'fav:p1',
    container: FAVORITES_SECTION_KEY,
    section: 'favorites',
    isProject: true,
    canReorder: true,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(favProject, { zone: 'favorites' }), { kind: 'none' })
  assert.deepEqual(
    resolveDropAction(favProject, {
      zone: 'favorites',
      row: { key: 'fav:p1', container: FAVORITES_SECTION_KEY, canReorder: true, position: 'before' }
    }),
    { kind: 'none' }
  )

  const project: DragSource = {
    key: 'p1',
    container: 'dir:a',
    section: 'projects',
    isProject: true,
    canReorder: false,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(project, { zone: 'outside-favorites' }), { kind: 'none' })
  assert.deepEqual(
    resolveDropAction(project, {
      zone: 'outside-favorites',
      row: { key: 'p2', container: 'dir:a', canReorder: false, position: 'after' }
    }),
    { kind: 'none' }
  )
})

test('resolveDropAction preserves reordering within Favorites and within Projects', () => {
  const favProject: DragSource = {
    key: 'fav:p1',
    container: FAVORITES_SECTION_KEY,
    section: 'favorites',
    isProject: true,
    canReorder: true,
    canFavorite: true
  }
  assert.deepEqual(
    resolveDropAction(favProject, {
      zone: 'favorites',
      row: { key: 'fav:p2', container: FAVORITES_SECTION_KEY, canReorder: true, position: 'after' }
    }),
    { kind: 'reorder-favorites', draggedKey: 'fav:p1', targetKey: 'fav:p2', position: 'after' }
  )

  const manualProject: DragSource = {
    key: 'p1',
    container: 'dir:a',
    section: 'projects',
    isProject: true,
    canReorder: true,
    canFavorite: true
  }
  assert.deepEqual(
    resolveDropAction(manualProject, {
      zone: 'outside-favorites',
      row: { key: 'p2', container: 'dir:a', canReorder: true, position: 'before' }
    }),
    { kind: 'reorder-projects', draggedKey: 'p1', targetKey: 'p2', position: 'before' }
  )
})

test('resolveDropAction does not add or remove non-project rows from Favorites', () => {
  const favWorktree: DragSource = {
    key: 'fav:w1',
    container: FAVORITES_SECTION_KEY,
    section: 'favorites',
    isProject: false,
    canReorder: true,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(favWorktree, { zone: 'outside-favorites' }), { kind: 'none' })
  assert.deepEqual(
    resolveDropAction(favWorktree, {
      zone: 'favorites',
      row: { key: 'fav:p1', container: FAVORITES_SECTION_KEY, canReorder: true, position: 'before' }
    }),
    { kind: 'reorder-favorites', draggedKey: 'fav:w1', targetKey: 'fav:p1', position: 'before' }
  )

  const nonProject: DragSource = {
    key: 'w1',
    container: 'p1',
    section: 'projects',
    isProject: false,
    canReorder: false,
    canFavorite: true
  }
  assert.deepEqual(resolveDropAction(nonProject, { zone: 'favorites' }), { kind: 'none' })
})
