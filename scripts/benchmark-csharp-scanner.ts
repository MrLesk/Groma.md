import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseScanObservation } from '@groma/scanner'
import { run } from '../plugins/scanners/csharp/src/process.ts'

const [repositoryArg, projectArg, packageArg = 'dist/csharp-scanner-package'] = process.argv.slice(2)
if (!repositoryArg || !projectArg) throw new Error('usage: bun scripts/benchmark-csharp-scanner.ts <cloned repository> <relative project> [package]')
const root = path.resolve(repositoryArg)
const worker = path.resolve(packageArg, 'dist/worker/Groma.CSharpScanner.dll')
const host = process.env.DOTNET_HOST_PATH || 'dotnet'
const args = [worker, path.resolve(root, projectArg), '--root', root]
const samples: number[] = []
const observations = []
for (let index = 0; index < 3; index++) {
  const start = performance.now()
  const result = await run(host, args, { cwd: path.dirname(path.resolve(root, projectArg)), timeoutSeconds: 120 })
  samples.push((performance.now() - start) / 1000)
  observations.push(parseScanObservation(result.stdout))
}
assert.deepEqual(observations[0], observations[1]); assert.deepEqual(observations[1], observations[2])
const observation = observations[0]!
const git = await run('git', ['rev-parse', 'HEAD'], { cwd: root })
const status = await run('git', ['status', '--porcelain'], { cwd: root })
const manifest = observation.files.map(file => file.file).join('\n')
const report = {
  repository: root, commit: git.stdout.trim(), trackedSourceClean: status.stdout.trim() === '', project: projectArg,
  worker: pathToFileURL(worker).href, scanner: observation.scanner, elapsedSeconds: samples,
  files: observation.files.length, scopes: observation.scopes.length, sourceRelationships: observation.relationships.length,
  operations: observation.operations?.length, invocations: observation.invocations?.length,
  resolvedInvocations: observation.invocations?.filter(invocation => !invocation.unresolved).length,
  unresolvedInvocations: observation.invocations?.filter(invocation => invocation.unresolved).length,
  manifestSha256: createHash('sha256').update(manifest).digest('hex'), deterministic: true,
  diagnostics: observation.diagnostics,
}
await mkdir('dist', { recursive: true })
await writeFile('dist/csharp-benchmark.json', `${JSON.stringify(report, null, 2)}\n`)
await writeFile('dist/csharp-benchmark-files.txt', manifest + '\n')
await writeFile('dist/csharp-benchmark-observation.json', `${JSON.stringify(observation)}\n`)
console.log(JSON.stringify(report, null, 2))
