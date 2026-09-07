import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { scanJavaSource } from '../plugins/scanners/java/src/adapter.ts'

const execute = promisify(execFile)
const [binaryArg, packageArg] = process.argv.slice(2)
if (!binaryArg || !packageArg) throw new Error('Usage: bun scripts/smoke-java-scanner.ts <groma-binary> <runtime-bundled-package>')
if (process.platform === 'win32') throw new Error('This isolated-PATH smoke currently targets Linux and macOS')
const binary = path.resolve(binaryArg)
const packageRoot = path.resolve(packageArg)
const temporary = await mkdtemp(path.join(os.tmpdir(), 'groma-java-smoke-'))
const root = path.join(temporary, 'repository')
const fixture = (name: string) => fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url))

async function snapshot(directory: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name)
    if (item.isDirectory()) {
      for (const [key, value] of Object.entries(await snapshot(filename))) result[`${item.name}/${key}`] = value
    } else result[item.name] = await readFile(filename, 'utf8')
  }
  return result
}

try {
  await cp(fixture('empty-project'), root, { recursive: true })
  await cp(fixture('java-source-set'), root, { recursive: true })
  await execute('git', ['init', '--quiet'], { cwd: root })
  const expected = await scanJavaSource(root)
  assert.ok(expected?.operations?.length)
  const bin = path.join(temporary, 'bin')
  const home = path.join(temporary, 'home')
  await mkdir(bin)
  await mkdir(home)
  const git = Bun.which('git')
  assert.ok(git)
  await symlink(git, path.join(bin, 'git'))
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: bin, HOME: home }
  for (const key of ['JAVA_HOME', 'GROMA_JAVA_HOME', 'BUN_BE_BUN', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS']) delete env[key]
  const run = (args: string[]) => execute(binary, args, { cwd: root, env, maxBuffer: 64 * 1024 * 1024 })
  const probe = path.join(temporary, 'probe.mjs')
  await writeFile(probe, `import plugin from ${JSON.stringify(pathToFileURL(path.join(packageRoot, 'src/index.js')).href)};\nconsole.log(JSON.stringify(await plugin.scan(${JSON.stringify(root)})));\n`)
  // The standalone executable also hosts Groma's npm installer; exercise that embedded runtime.
  const observed = await execute(binary, [probe], { cwd: root, env: { ...env, BUN_BE_BUN: '1' }, maxBuffer: 64 * 1024 * 1024 })
  assert.deepEqual(JSON.parse(observed.stdout), expected)
  await run(['scanner', 'add', packageRoot])
  const first = await run(['scan'])
  const before = await snapshot(path.join(root, 'groma'))
  for (const file of expected.files) assert.ok(Object.values(before).some(text => text.includes(file.file)), `Unowned source: ${file.file}`)
  await run(['scan'])
  assert.deepEqual(await snapshot(path.join(root, 'groma')), before)
  await writeFile(path.join(root, 'src/Broken.java'), 'class Broken { missing.Library dependency; }')
  await assert.rejects(run(['scan']), /JAVA_SCAN_FAILED/)
  assert.deepEqual(await snapshot(path.join(root, 'groma')), before)
  console.log(JSON.stringify({ result: 'pass', files: expected.files.length, operations: expected.operations.length,
    invocations: expected.invocations!.length, firstScan: first.stdout.trim(),
    checks: ['source/package observation equality in standalone runtime', 'Groma scanner add and scan',
      'no external Java, Node, Bun, Maven or Gradle', 'repeat scan idempotence', 'failed scan preserves architecture'],
  }, null, 2))
} finally { await rm(temporary, { recursive: true, force: true }) }
