import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import type { ScannerPlugin } from '@groma/scanner'
import { scannerFiles } from '../src/scanner/modules/selection.ts'

const execute = promisify(execFile)
const [source, packageDirectory] = process.argv.slice(2)
if (!source || !packageDirectory) throw new Error('Usage: bun scripts/benchmark-swift-scanner.ts <checkout> <scanner-package>')
const root = path.resolve(source)
const artifact = path.resolve(packageDirectory)
const tracked = (await execute('git', ['-C', root, 'ls-files', '-z'], { maxBuffer: 64 * 1024 * 1024 })).stdout
  .split('\0').filter(Boolean).sort()
const sourceExtensions = ['.swift', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.m', '.mm', '.c', '.cpp', '.h', '.rs', '.sh', '.rb']
const extensionOf = (file: string) => sourceExtensions.find(extension => file.endsWith(extension))
const sources = tracked.filter(file => extensionOf(file))
const languages: Record<string, { files: number; bytes: number }> = {}

async function fingerprint(): Promise<string> {
  const hash = createHash('sha256')
  for (const file of sources) {
    const content = await readFile(path.join(root, file))
    hash.update(file).update('\0').update(content)
  }
  return hash.digest('hex')
}

for (const file of sources) {
  const extension = extensionOf(file)!
  languages[extension] ??= { files: 0, bytes: 0 }
  const entry = languages[extension]!
  entry.files++
  entry.bytes += (await readFile(path.join(root, file))).length
}
const before = await fingerprint()
const manifest = JSON.parse(await readFile(path.join(artifact, 'package.json'), 'utf8'))
const scanner: ScannerPlugin = (await import(pathToFileURL(path.join(artifact, manifest.groma.scanner.entry)).href)).default
const files = await scannerFiles(root, manifest.groma.scanner)
await scanner.checkReadiness?.(root, {}, files)
const observations = []
const seconds = []
for (let run = 0; run < 2; run++) {
  const start = performance.now()
  observations.push((await scanner.scan(root, {}, files))!)
  seconds.push(Number(((performance.now() - start) / 1000).toFixed(3)))
}
const [first, second] = observations
const identical = JSON.stringify(first) === JSON.stringify(second)
const unchanged = before === await fingerprint()
if (!identical || !unchanged) throw new Error('Benchmark changed evidence or source files')
const references = first!.files.map(file => ({ file: file.file, symbols: file.symbols.map(symbol => symbol.name) }))
const outlineStart = performance.now()
const outlines = await scanner.readCodeStructure!(root, references)
console.log(JSON.stringify({
  repository: (await execute('git', ['-C', root, 'remote', 'get-url', 'origin'])).stdout.trim(),
  commit: (await execute('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim(),
  host: `${process.platform}-${process.arch}`, engine: first!.scanner, languages,
  scanSeconds: seconds, files: first!.files.length,
  excludedSwiftFiles: tracked.filter(file => file.endsWith('.swift') && !first!.files.some(source => source.file === file)),
  symbols: first!.files.reduce((count, file) => count + file.symbols.length, 0),
  operations: first!.operations!.length, comparableBodies: first!.operations!.filter(operation => operation.tokens).length,
  calls: first!.invocations!.length, certainCalls: first!.invocations!.filter(call => !call.unresolved).length,
  outlineSeconds: Number(((performance.now() - outlineStart) / 1000).toFixed(3)),
  outlinedFiles: outlines.length, declarations: outlines.reduce((count, file) => count + file.declarations.length, 0),
  diagnostics: first!.diagnostics, identicalObservations: identical, sourceUnchanged: unchanged, sourceSha256: before,
}, null, 2))
