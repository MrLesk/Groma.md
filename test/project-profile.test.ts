import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  loadProjectProfile,
  parseProjectProfile,
  saveProjectProfile,
} from '../src/project-profile.ts'

test('the project profile is the H1 and its Markdown body', async () => {
  const profile = await parseProjectProfile('# Supply map\n\nShows **supply** responsibilities with `code`.\n\nAcross the whole repo.\n\n## Notes\n\nNot part of the profile.\n')
  assert.equal(profile.name, 'Supply map')
  assert.equal(profile.description, 'Shows **supply** responsibilities with `code`.\n\nAcross the whole repo.\n\n## Notes\n\nNot part of the profile.')
  assert.deepEqual(profile.descriptionBlocks[0], {
    spans: [
      { text: 'Shows ', styles: [] },
      { text: 'supply', styles: ['strong'] },
      { text: ' responsibilities with ', styles: [] },
      { text: 'code', styles: ['code'] },
      { text: '.', styles: [] },
    ],
  })
  assert.deepEqual(profile.descriptionBlocks[2], {
    spans: [{ text: 'Notes', styles: ['strong'] }],
  })
  assert.equal(profile.descriptionBlocks[3]!.spans[0]!.text, 'Not part of the profile.')
  await assert.rejects(() => parseProjectProfile('No heading\n'), /project name heading/)
  await assert.rejects(() => parseProjectProfile('# Nameless description\n'), /description is required/)
})

test('saving a project profile replaces its document in the supported shape', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-project-profile-'))
  try {
    await mkdir(path.join(root, 'groma'))
    await writeFile(path.join(root, 'groma', 'README.md'), '# Incomplete\n')
    assert.equal(await loadProjectProfile(root), undefined)
    const saved = await saveProjectProfile(root, {
      name: ' Supply map ',
      description: ' ## Scope\n\nShows the current supply architecture. ',
    })
    assert.equal(saved.name, 'Supply map')
    assert.equal(saved.description, '## Scope\n\nShows the current supply architecture.')
    assert.equal(saved.descriptionBlocks[0]!.spans[0]!.text, 'Scope')
    assert.equal(
      await readFile(path.join(root, 'groma', 'README.md'), 'utf8'),
      '# Supply map\n\n## Scope\n\nShows the current supply architecture.\n',
    )
    assert.deepEqual(await loadProjectProfile(root), saved)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
