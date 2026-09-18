import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { watchObservations } from '../src/scanner/source-watch.ts'

test.concurrent('an edit during the initial scan is collected after the initial batch', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-source-start-'))
  const file = path.join(root, 'source.fixture')
  const batches: string[] = []
  let scans = 0
  let folded = 0
  let changedFiles: readonly string[] | undefined
  const complete = Promise.withResolvers<void>()
  let watcher: Awaited<ReturnType<typeof watchObservations>> | undefined
  try {
    await writeFile(file, 'before')
    watcher = await watchObservations(root, {
      scannerIds: ['fixture'],
      watchesFile: file => file === 'source.fixture',
      readersOfFile: async () => [],
      async collectObservations(_root, files) {
        // The next scan must wait until the previous batch has been applied.
        expect(scans).toBe(folded)
        scans++
        batches.push(await readFile(file, 'utf8'))
        if (scans === 1) await writeFile(file, 'after')
        else changedFiles = files
        return { observations: [], failures: [] }
      },
    }, {
      scan: true,
      onObservations() {
        folded++
        if (folded === 2) complete.resolve()
      },
      onError: complete.reject,
    })
    await complete.promise
    expect(batches).toEqual(['before', 'after'])
    expect(changedFiles).toEqual(['source.fixture'])
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})
