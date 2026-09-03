import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { test } from 'bun:test'

import { repositoryRoot } from './helpers.ts'

/** A core write module or the file layer under it, reached from a viewer by climbing out of src/viewers. */
const coreWriteImport = /from '(?:\.\.\/)+(?:add|draft|edit|remove|curate|relation|accept|markdown-emitter|groma-filesystem)\.ts'/
/** Writers a read module re-exports beside its reads. */
const writerNames = /saveProjectProfile|acceptGhost/

test.concurrent('viewers reach every write through the authoring table', async () => {
  const viewers = path.join(repositoryRoot, 'src', 'viewers')
  const offenders: string[] = []
  for (const name of await readdir(viewers, { recursive: true })) {
    if (!name.endsWith('.ts')) continue
    const source = await readFile(path.join(viewers, name), 'utf8')
    if (coreWriteImport.test(source) || writerNames.test(source)) offenders.push(name)
  }
  assert.deepEqual(offenders, [])
})
