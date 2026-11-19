import { readFile } from 'node:fs/promises'
import { assert, test } from 'orca/testing'
import { SETTING_TITLES } from './display'

// A setting added to the Display options window must be described for the next agent; `SETTING_TITLES` lists them all.
test('docs/display-options.md has a heading for every Display options setting', async () => {
  const doc = await readFile(decodeURIComponent(new URL('../../docs/display-options.md', import.meta.url).pathname), 'utf8')
  for (const title of Object.values(SETTING_TITLES)) {
    assert.ok(doc.includes(`\n### \`${title}\`\n`), `docs/display-options.md has no "### \`${title}\`" heading`)
  }
})
