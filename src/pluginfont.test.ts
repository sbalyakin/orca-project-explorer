import { assert, test } from 'orca/testing'
import { readFontFace } from './pluginfont'

const root = '/plugins/a.b/abc123'
const files: Record<string, unknown> = {
  '/plugins/plugins.lock.json': { plugins: { 'a.b': { contentHash: 'abc123' } } },
  [`${root}/orca-plugin.json`]: {
    contributes: {
      fonts: [
        {
          family: 'Plex',
          faces: [
            { path: 'fonts/r.woff2', weight: '400', style: 'normal' },
            { path: 'fonts/i.woff2', weight: '400', style: 'italic' },
            { path: 'fonts/b.woff2', weight: '700', style: 'normal' },
            { path: '../../escape.woff2', weight: '400', style: 'normal' }
          ]
        }
      ]
    }
  }
}
const readJson = async (path: string): Promise<unknown> => files[path] ?? Promise.reject(new Error(`missing ${path}`))
const readBytes = (async (path: string) => ({ length: 3, toString: () => `bytes:${path.slice(path.lastIndexOf('/') + 1)}` })) as never

test('upright faces only, with their count and data', async () => {
  const first = await readFontFace('Plex (a.b)', 0, '/plugins', readJson, readBytes)
  assert.deepEqual(first, { total: 3, face: { weight: '400', mime: 'font/woff2', data: 'bytes:r.woff2' } })
  const second = await readFontFace('Plex (a.b)', 1, '/plugins', readJson, readBytes)
  assert.equal(second?.face?.weight, '700')
})

test('a path leaving the plugin folder gives no face but keeps the count', async () => {
  assert.deepEqual(await readFontFace('Plex (a.b)', 2, '/plugins', readJson, readBytes), { total: 3, face: null })
})

test('a file over the size cap gives no face but keeps the count', async () => {
  const big = (async () => ({ length: 1_000_000, toString: () => '' })) as never
  assert.deepEqual(await readFontFace('Plex (a.b)', 0, '/plugins', readJson, big), { total: 3, face: null })
})

test('an unknown font, plugin or index give null', async () => {
  assert.equal(await readFontFace('Plex (a.b)', 9, '/plugins', readJson, readBytes), null)
  assert.equal(await readFontFace('Other (a.b)', 0, '/plugins', readJson, readBytes), null)
  assert.equal(await readFontFace('Plex (x.y)', 0, '/plugins', readJson, readBytes), null)
  assert.equal(await readFontFace('Geist', 0, '/plugins', readJson, readBytes), null)
})
