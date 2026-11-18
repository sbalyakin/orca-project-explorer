import { assert, test } from 'orca/testing'
import { isMeta, joinFaces, splitFaces } from './fontcache'

const faces = [
  { weight: '400', mime: 'font/woff2', data: 'a'.repeat(25) },
  { weight: '700', mime: 'font/woff2', data: 'b'.repeat(17) }
]

test('faces survive a cut into pieces, also when a piece ends inside a face', () => {
  for (const chunk of [1, 7, 10, 25, 26, 42, 100]) {
    const { meta, parts } = splitFaces('Plex (a.b)', faces, chunk)
    assert.ok(parts.every((part) => part.length <= chunk))
    assert.equal(meta.parts, parts.length)
    assert.deepEqual(joinFaces(meta, parts), faces)
  }
})

test('pieces that do not add up give null', () => {
  const { meta, parts } = splitFaces('Plex (a.b)', faces, 10)
  assert.equal(joinFaces(meta, parts.slice(1)), null)
  assert.equal(joinFaces(meta, [...parts.slice(0, -1), parts[parts.length - 1].slice(1)]), null)
})

test('no faces make no pieces', () => {
  const { meta, parts } = splitFaces('Plex (a.b)', [])
  assert.equal(parts.length, 0)
  assert.deepEqual(joinFaces(meta, parts), [])
})

test('only a description with the right fields passes', () => {
  assert.ok(isMeta(splitFaces('Plex (a.b)', faces).meta))
  assert.equal(isMeta(null), false)
  assert.equal(isMeta({ family: 'x', parts: 1, faces: [{ weight: 400 }] }), false)
})
