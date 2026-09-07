import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { parseScanObservation } from '@groma/scanner'
import { execute, executable } from './test/helpers.ts'

const input = process.argv[2]
if (!input) throw new Error('usage: bun plugins/scanners/rust/benchmark.ts REPOSITORY_ROOT')
if (process.platform !== 'linux') throw new Error('Peak RSS collection in this benchmark requires Linux /usr/bin/time')
const root = path.resolve(input)
const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-rust-benchmark-'))
try {
  const runs: Array<{ seconds: number, peakRssKiB: number }> = []
  let first: string | undefined
  for (let index = 0; index < 3; index++) {
    const report = path.join(temporary, `${index}.json`)
    const { stdout } = await execute('/usr/bin/time', [
      '-f', '{"seconds":%e,"peakRssKiB":%M}', '-o', report, executable, root,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 })
    if (first === undefined) first = stdout
    else assert.equal(stdout, first, 'Native output changed across identical scans')
    runs.push(JSON.parse(await readFile(report, 'utf8')))
  }
  const observation = parseScanObservation(first!)
  const sourceBytes = (await Promise.all(observation.files.map(file => stat(path.join(root, file.file)))))
    .reduce((sum, file) => sum + file.size, 0)
  console.log(JSON.stringify({
    engine: observation.scanner,
    profile: 'release; three fresh processes; filesystem caches not flushed',
    nativeSha256: createHash('sha256').update(await readFile(executable)).digest('hex'),
    outputSha256: createHash('sha256').update(first!).digest('hex'),
    nativeBytes: (await stat(executable)).size,
    sourceBytes,
    scopes: observation.scopes.length,
    files: observation.files.length,
    operations: observation.operations?.length ?? 0,
    invocations: observation.invocations?.length ?? 0,
    resolvedInvocationSets: observation.invocations?.filter(call => !call.unresolved).length ?? 0,
    unresolvedInvocationSets: observation.invocations?.filter(call => call.unresolved).length ?? 0,
    callbackBindings: observation.invocations?.filter(call => call.binding).length ?? 0,
    sourceRelationships: observation.relationships.length,
    diagnostics: observation.diagnostics.length,
    runs,
  }, null, 2))
} finally {
  await rm(temporary, { recursive: true, force: true })
}
