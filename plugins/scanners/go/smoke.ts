import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { run } from './src/adapter.ts'

const [binaryArgument, packageArgument] = process.argv.slice(2)
if (!binaryArgument || !packageArgument) throw new Error('Usage: bun plugins/scanners/go/smoke.ts <compiled-groma> <built-package>')
const binary = path.resolve(binaryArgument)
const scannerPackage = path.resolve(packageArgument)
const root = await mkdtemp(path.join(os.tmpdir(), 'groma-go-consumer-'))

async function snapshot(directory: string): Promise<string> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  const contents: string[] = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    contents.push(entry.name, entry.isDirectory() ? await snapshot(file) : await readFile(file, 'utf8'))
  }
  return contents.join('\n')
}

async function view(file: string) { return run(binary, ['--plain', 'view', file], root) }

try {
  await cp(path.resolve(import.meta.dir, '../../../test/fixtures/go-module'), root, { recursive: true })
  await cp(scannerPackage, path.join(root, 'plugin'), { recursive: true })
  await cp(path.resolve(import.meta.dir, '../../../test/fixtures/operation-wiring/provider.ts'), path.join(root, 'frontend.ts'))
  await run('git', ['init', '--quiet'], root)
  await run(binary, ['init', 'Go consumer', '--directory', 'groma'], root)
  await run(binary, ['scanner', 'add', './plugin'], root)
  assert.match(await run(binary, ['scanner', 'setup'], root), /go\s+package found\s+project ready/)
  await run(binary, ['scan'], root)
  const record = await view('caller.go')
  const id = record.match(/^ {2}id: (.+)$/m)?.[1]
  assert.ok(id, 'compiled Groma owns Go source')
  assert.match(await view('frontend.ts'), /frontend.ts/, 'both scanners contribute to one map')
  await run(binary, ['edit', id, '--title', 'Dispatch', '--overview', 'Coordinates typed work.'], root)
  const curated = await snapshot(path.join(root, 'groma'))
  await run(binary, ['scan'], root)
  await run(binary, ['scan'], root)
  assert.equal(await snapshot(path.join(root, 'groma')), curated, 'repeat scans preserve curated architecture')
  const provider = path.join(root, 'provider/provider.go')
  await writeFile(provider, `${await readFile(provider, 'utf8')}\nfunc Additional() {}\n`)
  await run(binary, ['scan'], root)
  assert.equal((await view('caller.go')).match(/^ {2}id: (.+)$/m)?.[1], id, 'source edits preserve the curated owner')
  assert.match(await view('caller.go'), /Coordinates typed work/)
  const beforeFailure = await snapshot(path.join(root, 'groma'))
  await writeFile(provider, 'package provider\nfunc Broken() { absent() }\n')
  await assert.rejects(run(binary, ['scan'], root), /GO_COMPILATION_FAILED/)
  assert.equal(await snapshot(path.join(root, 'groma')), beforeFailure, 'failed scan leaves the complete map unchanged')
  console.log(`Go compiled consumer passed on ${process.platform}-${process.arch}`)
} finally { await rm(root, { recursive: true, force: true }) }
