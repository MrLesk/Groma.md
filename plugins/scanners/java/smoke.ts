import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import type { WebBootPayload } from '../../../src/viewers/web/payload.ts'
import { mavenCommand, mavenGoals } from './src/maven.ts'
import { mavenInvocation, run } from './src/process.ts'

const [binaryArgument, packageArgument] = process.argv.slice(2)
if (!binaryArgument || !packageArgument) throw new Error('Usage: bun plugins/scanners/java/smoke.ts <compiled-groma> <built-package>')
const binary = path.resolve(binaryArgument)
const scannerPackage = path.resolve(packageArgument)
const root = await mkdtemp(path.join(os.tmpdir(), 'groma-java-consumer-'))

async function snapshot(directory: string): Promise<string> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  const content: string[] = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    content.push(entry.name, entry.isDirectory() ? await snapshot(file) : await readFile(file, 'utf8'))
  }
  return content.join('\n')
}

try {
  await cp(path.resolve(import.meta.dir, '../../../test/fixtures/java-maven'), root, { recursive: true })
  await cp(path.resolve(import.meta.dir, '../../../test/fixtures/operation-wiring/provider.ts'), path.join(root, 'src/provider.ts'))
  await run('git', ['init', '--quiet'], root)
  const maven = await mavenCommand(root)
  await run(...mavenInvocation(maven, ['--batch-mode', '--no-transfer-progress', ...mavenGoals, '-DincludeScope=compile']), root)
  await run(binary, ['init', 'Java consumer', '--directory', 'groma'], root)
  await run(binary, ['scanner', 'add', scannerPackage], root)
  await run(binary, ['scan'], root)
  const source = 'src/main/java/Caller.java'
  const record = await run(binary, ['--plain', 'view', source], root)
  const id = record.match(/^ {2}id: (.+)$/m)?.[1]
  assert.ok(id, 'compiled Groma owns the Java source')
  await run(binary, ['edit', id, '--title', 'Dispatch', '--overview', 'Coordinates typed dispatch.'], root)
  const before = await snapshot(path.join(root, 'groma'))
  await run(binary, ['scan'], root)
  await run(binary, ['scan'], root)
  assert.equal(await snapshot(path.join(root, 'groma')), before, 'repeat scans preserve curated ownership and prose')
  const output = path.join(root, 'export')
  await run(binary, ['export', output], root)
  let published: WebBootPayload | undefined
  runInNewContext(await readFile(path.join(output, 'snapshot.js'), 'utf8'), {
    CustomEvent, dispatchEvent: (event: CustomEvent<WebBootPayload>) => { published = event.detail },
  })
  assert.ok(published?.delivery?.kind === 'published')
  assert.ok(published.delivery.reads.code.some(component =>
    component.files.some(file => file.file === 'src/provider.ts' && file.declarations.some(item => item.kind === 'function'))),
  'compiled export includes parsed TypeScript Code details')
  await writeFile(path.join(root, source), 'class Broken { missing.Library field; }')
  await assert.rejects(run(binary, ['scan'], root), /JAVA_COMPILATION_FAILED/)
  assert.equal(await snapshot(path.join(root, 'groma')), before, 'failure preserves the previous map')
  console.log(`Java compiled consumer passed on ${process.platform}-${process.arch}`)
} finally { await rm(root, { recursive: true, force: true }) }
