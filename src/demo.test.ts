import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assert, test } from 'orca/testing'
import { demoConfig, demoTexts, demoTree, isDemoMode } from './demo'
import { isOpenable, type TreeNode, type WorkspaceNode } from './types'

function collectOpenable(nodes: TreeNode[]): WorkspaceNode[] {
  const out: WorkspaceNode[] = []
  for (const node of nodes) {
    if (isOpenable(node)) out.push(node)
    if (node.children.length > 0) out.push(...collectOpenable(node.children))
  }
  return out
}

test('demoConfig parses empty flag, no-favorites, valid JSON, and invalid JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orca-demo-'))
  try {
    const flag = join(dir, 'demo')
    assert.equal(isDemoMode(flag), false)
    assert.equal(demoConfig(flag), null)

    await writeFile(flag, '')
    assert.equal(isDemoMode(flag), true)
    assert.deepEqual(demoConfig(flag), { favorites: true })

    await writeFile(flag, 'no-favorites\n')
    assert.deepEqual(demoConfig(flag), { favorites: false })
    assert.deepEqual(demoTree(1_700_000_000_000, { favorites: false }).demoFavorites, [])

    const jsonCfg = { favorites: false, display: { group: 'none' as const, detail: 'branch' as const, time: 'show' as const } }
    await writeFile(flag, JSON.stringify(jsonCfg))
    assert.deepEqual(demoConfig(flag), jsonCfg)
    const tree = demoTree(1_700_000_000_000, jsonCfg)
    assert.deepEqual(tree.demoFavorites, [])
    assert.deepEqual(tree.demoDisplay, jsonCfg.display)

    await writeFile(flag, '{not valid json')
    assert.equal(demoConfig(flag), null)
    assert.equal(isDemoMode(flag), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('demoTree and demoTexts cover all openable workspaces with relative timestamps', () => {
  const now = 1_700_000_000_000
  const tree = demoTree(now)
  const texts = demoTexts()
  const openable = collectOpenable(tree.nodes)

  assert.ok(openable.length >= 5)
  for (const ws of openable) {
    assert.ok(texts[ws.workspaceId]?.title, `missing title for ${ws.workspaceId}`)
    assert.ok(texts[ws.workspaceId]?.message, `missing message for ${ws.workspaceId}`)
    assert.ok(typeof ws.activeAt === 'number' && ws.activeAt <= now)
  }
})
