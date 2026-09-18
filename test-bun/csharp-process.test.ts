import { expect, test } from 'bun:test'
import path from 'node:path'
import { run } from '../plugins/scanners/csharp/src/process.ts'

test.concurrent('a worker that exits before reading a large input rejects the run', async () => {
  const worker = path.resolve(import.meta.dir, '../test/fixtures/csharp-process/exits-at-once.mjs')
  // Larger than a pipe buffer, so writing it outlives the worker.
  const input = 'x'.repeat(2 * 1024 * 1024)
  await expect(run(worker, [], { cwd: import.meta.dir, input })).rejects.toThrow('exited 3')
})
