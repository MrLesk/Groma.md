import assert from 'node:assert/strict'
import test from 'node:test'

import { parseProjectProfile } from '../src/project-profile.ts'

const source = `---
type: Groma Project
title: Supply map
description: The standard short description.
groma:
  profile: architecture
audience: developers
---

Shows **supply** responsibilities with \`code\`.

Across the whole repo.

## Notes

More detail stays in the body.
`

test('the marked project concept owns title, description, and body overview', { concurrency: true }, async () => {
  const profile = await parseProjectProfile(source)

  assert.equal(profile.title, 'Supply map')
  assert.equal(profile.description, 'The standard short description.')
  assert.match(profile.overview, /^Shows \*\*supply\*\*/)
  assert.deepEqual(profile.overviewBlocks[0], {
    spans: [
      { text: 'Shows ', styles: [] },
      { text: 'supply', styles: ['strong'] },
      { text: ' responsibilities with ', styles: [] },
      { text: 'code', styles: ['code'] },
      { text: '.', styles: [] },
    ],
  })
  assert.equal(profile.overviewBlocks.at(-1)?.spans[0]?.text, 'More detail stays in the body.')
})

test('the project body cannot duplicate its canonical title', { concurrency: true }, async () => {
  await assert.rejects(
    parseProjectProfile(source.replace('Shows **supply**', '# Supply map\n\nShows **supply**')),
    /must not duplicate title/,
  )
})
