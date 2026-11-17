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

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

test('the first call answers null at once; looks come from memory after the load', async () => {
  let changes = 0
  const get = createLooksCache(async () => lookMap('#000001'), () => changes++)
  assert.equal(get(), null)
  await settle()
  assert.equal(changes, 1)
  assert.equal(get()?.get('r1')?.color, '#000001')
})

test('a refresh tells only when the looks differ', async () => {
  let calls = 0
  let changes = 0
  const get = createLooksCache(async () => lookMap(++calls < 3 ? '#000001' : '#000002'), () => changes++)
  get()
  await settle()
  get()
  await settle()
  assert.equal(changes, 1)
  get()
  await settle()
  assert.equal(changes, 2)
  assert.equal(get()?.get('r1')?.color, '#000002')
})

test('one load at a time', async () => {
  let calls = 0
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const get = createLooksCache(async () => {
    calls++
    await gate
    return lookMap('#000001')
  })
  get()
  get()
  assert.equal(calls, 1)
  release()
  await settle()
})

test('a refresh that finds nothing keeps the earlier looks', async () => {
  let calls = 0
  const get = createLooksCache(async () => (++calls === 1 ? lookMap('#111111') : new Map()))
  get()
  await settle()
  get()
  await settle()
  assert.equal(get()?.get('r1')?.color, '#111111')
})

test('a failed first load still ends the wait, with no looks', async () => {
  let changes = 0
  const get = createLooksCache(async () => Promise.reject(new Error('no cli')), () => changes++)
  get()
  await settle()
  assert.equal(changes, 1)
  assert.equal(get()?.size, 0)
})
