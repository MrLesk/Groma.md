import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { run } from '../plugins/scanners/csharp/src/process.ts'

const [rootArg, project, binaryArg, packageArg, outputArg] = process.argv.slice(2)
if (!rootArg || !project || !binaryArg || !packageArg || !outputArg) {
  throw new Error('usage: bun scripts/validate-csharp-repository.ts <disposable clone> <project> <binary> <package> <output>')
}
const root = path.resolve(rootArg)
const binary = path.resolve(binaryArg)
const output = path.resolve(outputArg)
const map = path.join(root, 'groma')
const config = path.join(root, 'groma.csharp.json')
const broken = path.join(root, path.dirname(project), '__GromaBrokenProbe.cs')
const frontend = path.join(root, '__groma_frontend_probe.ts')
const created = [map, config, broken, frontend]
for (const file of created) {
  await assert.rejects(access(file), { code: 'ENOENT' }, `research must not overwrite ${file}`)
}
const invoke = (args: string[]) => run(binary, args, { cwd: root, timeoutSeconds: 180 })

async function markdownHash(): Promise<string> {
  const hash = createHash('sha256')
  for (const file of (await readdir(map, { recursive: true })).filter(file => file.endsWith('.md')).sort()) {
    hash.update(file); hash.update(await readFile(path.join(map, file)))
  }
  return hash.digest('hex')
}

try {
  await mkdir(output, { recursive: true })
  await writeFile(config, JSON.stringify({ input: project }))
  await invoke(['init', '--directory', 'groma', 'CSharp repository research'])
  await invoke(['scanner', 'add', path.resolve(packageArg)])
  await invoke(['scanner', 'setup', 'csharp', '--'])
  const start = performance.now()
  const first = await invoke(['scan'])
  const firstScanSeconds = (performance.now() - start) / 1000
  const before = await markdownHash()
  await invoke(['scan'])
  assert.equal(await markdownHash(), before, 'repeated scan changed architecture')
  // A valid TypeScript edit must not reconcile when the enabled C# scanner fails.
  await writeFile(frontend, 'export function frontendProbe() { return 42 }\n')
  await writeFile(broken, 'public class __GromaBrokenProbe { __MissingResearchType field = new(); }\n')
  let failure = ''
  await assert.rejects(invoke(['scan']), error => {
    failure = String(error)
    return failure.includes('Compilation failed')
  })
  assert.equal(await markdownHash(), before, 'one scanner failure altered the complete map')
  await writeFile(path.join(output, 'cli-first-scan.log'), first.stdout)
  await writeFile(path.join(output, 'cli-failure.log'), failure)
  await writeFile(path.join(output, 'cli-validation.json'), JSON.stringify({
    project, firstScanSeconds, repeatedMapEqual: true, mixedLanguageFailurePreservedMap: true,
    markdownSha256: before,
  }, null, 2) + '\n')
} finally {
  for (const file of created) await rm(file, { recursive: true, force: true })
}
