import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadProjectProfile, parseProjectProfile } from '../src/project-profile.ts'

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

test('the marked project concept owns title, description, and body overview', async () => {
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

test('the project body cannot duplicate its canonical title', async () => {
  await assert.rejects(
    parseProjectProfile(source.replace('Shows **supply**', '# Supply map\n\nShows **supply**')),
    /must not duplicate title/,
  )
})

test('loads the project profile from groma/project.md', async () => {
  const fixtureRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures',
    'validate',
  )
  const profile = await loadProjectProfile(fixtureRoot)

  assert.equal(profile?.title, 'Example architecture')
  assert.match(profile?.overview ?? '', /small shop/)
})
