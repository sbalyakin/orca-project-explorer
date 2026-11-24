import { assert, test } from 'orca/testing'
import type { GroupNode, WorkspaceNode } from '../types'
import {
  FAVORITES_SECTION_KEY,
  addFavorite,
  buildFavoritesSection,
  canonicalKey,
  excludeFavorites,
  isFavoriteCopy,
  parseFavorites,
  pruneFavorites,
  removeFavorite,
  reorderFavorites,
  toggleFavorite
} from './favorites'

function ws(key: string, label: string, extra: Partial<WorkspaceNode> = {}): WorkspaceNode {
  return { kind: 'workspace', key, workspaceId: key, label, linked: false, attention: 'none', children: [], ...extra }
}

function folder(key: string, label: string, children: (GroupNode | WorkspaceNode)[]): GroupNode {
  return { kind: 'group', key, label, children }
}

test('parseFavorites filters invalid entries and deduplicates canonical keys', () => {
  assert.deepEqual(parseFavorites(null), [])
  assert.deepEqual(parseFavorites(['a', '', 42, 'fav:a', 'b']), ['a', 'b'])
})

test('toggleFavorite appends new keys to the end and removes existing ones', () => {
  assert.deepEqual(toggleFavorite(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(toggleFavorite(['a', 'b'], 'fav:a'), ['b'])
})

test('addFavorite and removeFavorite are idempotent and normalize fav: prefix', () => {
  assert.deepEqual(addFavorite(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(addFavorite(['a'], 'fav:a'), ['a'])
  assert.deepEqual(removeFavorite(['a', 'b'], 'fav:a'), ['b'])
  assert.deepEqual(removeFavorite(['a', 'b'], 'c'), ['a', 'b'])
})

test('addFavorite inserts at start, middle, or end when given a target and position', () => {
  assert.deepEqual(addFavorite(['a', 'b', 'c'], 'd', 'fav:a', 'before'), ['d', 'a', 'b', 'c'])
  assert.deepEqual(addFavorite(['a', 'b', 'c'], 'd', 'fav:a', 'after'), ['a', 'd', 'b', 'c'])
  assert.deepEqual(addFavorite(['a', 'b', 'c'], 'd', 'fav:b', 'before'), ['a', 'd', 'b', 'c'])
  assert.deepEqual(addFavorite(['a', 'b', 'c'], 'd', 'fav:c', 'after'), ['a', 'b', 'c', 'd'])
  assert.deepEqual(addFavorite(['a', 'b'], 'd', 'fav:missing', 'before'), ['a', 'b', 'd'])
  assert.deepEqual(addFavorite(['a', 'b'], 'a', 'fav:b', 'after'), ['a', 'b'])
})

test('canonicalKey and isFavoriteCopy handle fav: prefix', () => {
  assert.equal(isFavoriteCopy('fav:ws:1'), true)
  assert.equal(isFavoriteCopy('ws:1'), false)
  assert.equal(canonicalKey('fav:ws:1'), 'ws:1')
  assert.equal(canonicalKey('ws:1'), 'ws:1')
})

test('pruneFavorites drops missing keys and returns null when all exist', () => {
  const tree = [folder('f', 'work', [ws('p1', 'alpha', { children: [ws('wt1', 'feat', { linked: true })] })])]
  assert.equal(pruneFavorites(['p1', 'wt1'], tree), null)
  assert.deepEqual(pruneFavorites(['p1', 'gone', 'wt1'], tree), ['p1', 'wt1'])
})

test('reorderFavorites moves an item before or after another item', () => {
  assert.deepEqual(reorderFavorites(['a', 'b', 'c'], 'fav:c', 'fav:a', 'before'), ['c', 'a', 'b'])
  assert.deepEqual(reorderFavorites(['a', 'b', 'c'], 'a', 'b', 'after'), ['b', 'a', 'c'])
  assert.deepEqual(reorderFavorites(['a', 'b'], 'a', 'a', 'before'), ['a', 'b'])
  assert.deepEqual(reorderFavorites(['a', 'b'], 'x', 'a', 'before'), ['a', 'b'])
})

test('buildFavoritesSection preserves order, prefixes keys, and attaches parent project info to worktrees', () => {
  const wt = ws('wt1', 'fix-bug', { linked: true, detail: 'fix/bug' })
  const primary = ws('p1:main', 'main', { primary: true })
  const proj = ws('p1', 'alpha', { icon: { type: 'emoji', emoji: '🚀' }, color: '#ff0000', children: [primary, wt] })
  const proj2 = ws('p2', 'beta')
  const tree = [folder('f', 'work', [proj, proj2])]

  const section = buildFavoritesSection(tree, ['wt1', 'p1', 'missing'])
  assert.ok(section)
  if (!section) return
  assert.equal(section.key, FAVORITES_SECTION_KEY)
  assert.equal(section.label, 'Favorites')
  assert.equal(section.section, true)
  assert.equal(section.children.length, 2)

  const favWt = section.children[0] as WorkspaceNode
  assert.equal(favWt.key, 'fav:wt1')
  assert.equal(favWt.projectLabel, 'alpha')
  assert.deepEqual(favWt.icon, { type: 'emoji', emoji: '🚀' })
  assert.equal(favWt.color, '#ff0000')

  const favProj = section.children[1] as WorkspaceNode
  assert.equal(favProj.key, 'fav:p1')
  assert.equal(favProj.projectLabel, undefined)
  // `wt1` is already a top-level favorite, so it must not be duplicated under `fav:p1`.
  assert.deepEqual(
    favProj.children.map((c) => c.key),
    ['fav:p1:main']
  )

  assert.equal(buildFavoritesSection(tree, ['missing']), null)
})

test('excludeFavorites removes favorited projects and worktrees and drops empty folders', () => {
  const wt = ws('wt1', 'fix-bug', { linked: true })
  const proj1 = ws('p1', 'alpha', { children: [ws('p1:main', 'main', { primary: true }), wt] })
  const proj2 = ws('p2', 'beta')
  const tree = [folder('f1', 'work', [proj1]), folder('f2', 'other', [proj2])]

  const withoutWorktree = excludeFavorites(tree, new Set(['wt1']))
  assert.equal(withoutWorktree.length, 2)
  assert.deepEqual(
    (withoutWorktree[0].children[0] as WorkspaceNode).children.map((c) => c.key),
    ['p1:main']
  )

  const withoutProject = excludeFavorites(tree, new Set(['p2']))
  assert.deepEqual(
    withoutProject.map((n) => n.key),
    ['f1']
  )

  const nested = [
    folder('g/JetBrains', 'JetBrains', [
      folder('g/JetBrains/repos', 'repos', [ws('p3', 'ultimate')]),
      folder('g/JetBrains/youtrack', 'youtrack', [ws('p4', 'YouTrack Issues')])
    ])
  ]
  const compacted = excludeFavorites(nested, new Set(['p3']))
  assert.equal(compacted.length, 1)
  assert.equal(compacted[0].kind, 'group')
  assert.equal(compacted[0].label, 'JetBrains/youtrack')
  assert.deepEqual(
    compacted[0].children.map((c) => c.key),
    ['p4']
  )
})
