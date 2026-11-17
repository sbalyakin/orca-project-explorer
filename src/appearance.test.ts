import { assert, test } from 'orca/testing'
import { createLooksCache, parseLooks } from './appearance'
import type { ProjectLook } from './tree'

const reply = (projects: unknown[]) => JSON.stringify({ ok: true, result: { projects } })

test('a row gives its icon and colour to every repository it covers', () => {
  const looks = parseLooks(
    reply([{ id: 'git:host/a', sourceRepoIds: ['r1', 'r2'], badgeColor: '#8b5cf6', repoIcon: { type: 'emoji', emoji: '📚' } }])
  )
  assert.deepEqual(looks.get('r2'), { icon: { type: 'emoji', emoji: '📚' }, color: '#8b5cf6' })
  assert.equal(looks.get('r1'), looks.get('r2'))
})

test('the `repo:` prefix of a row id is dropped, as the host id has none', () => {
  const looks = parseLooks(reply([{ id: 'repo:abc', sourceRepoIds: ['abc'], repoIcon: { type: 'lucide', name: 'Rocket' } }]))
  assert.deepEqual(looks.get('abc'), { icon: { type: 'lucide', name: 'Rocket' } })
})

test('a project without an icon keeps only its colour, and unknown icon types are ignored', () => {
  const looks = parseLooks(reply([{ id: 'x', badgeColor: '#737373', repoIcon: { type: 'weird' } }]))
  assert.deepEqual(looks.get('x'), { color: '#737373' })
})

test('output that is not JSON gives no looks', () => {
  assert.equal(parseLooks('nope').size, 0)
  assert.equal(parseLooks('{}').size, 0)
})

const lookMap = (color: string): Map<string, ProjectLook> => new Map([['r1', { color }]])

test('looks load once, then come from memory while a refresh runs behind', async () => {
  let calls = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const get = createLooksCache(async () => {
    calls++
    if (calls > 1) await gate
    return lookMap(`#00000${calls}`)
  })
  assert.equal((await get()).get('r1')?.color, '#000001')
  // The second call must not wait for the held refresh.
  assert.equal((await get()).get('r1')?.color, '#000001')
  assert.equal(calls, 2)
  release()
})

test('a refresh that finds nothing keeps the earlier looks', async () => {
  let calls = 0
  const get = createLooksCache(async () => (++calls === 1 ? lookMap('#111111') : new Map()))
  await get()
  await get()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal((await get()).get('r1')?.color, '#111111')
})
