import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const pluginRoot = fileURLToPath(new URL('./', import.meta.url))

function tool(name: string): string {
  const executable = process.platform === 'win32' ? `${name}.exe` : name
  return process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', executable) : executable
}

export async function buildWorker(destination: string): Promise<void> {
  const classes = await mkdtemp(path.join(os.tmpdir(), 'groma-java-classes-'))
  try {
    const sources = path.join(pluginRoot, 'java/md/groma/scanner')
    const files = (await readdir(sources)).filter(file => file.endsWith('.java')).sort()
    await execute(tool('javac'), ['--release', '21', '-encoding', 'UTF-8', '-d', classes,
      ...files.map(file => path.join(sources, file))])
    await mkdir(path.dirname(destination), { recursive: true })
    await execute(tool('jar'), ['--create', '--file', destination, '--date=2026-01-01T00:00:00Z',
      '--main-class', 'md.groma.scanner.Main', '-C', classes, '.'])
  } finally { await rm(classes, { recursive: true, force: true }) }
}

/** Maintainer build; consumers receive the worker and bundled module without install scripts. */
export async function buildPackage(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
  await buildWorker(path.join(destination, 'dist/worker.jar'))
  const built = await Bun.build({ entrypoints: [path.join(pluginRoot, 'src/index.ts')],
    outdir: path.join(destination, 'src'), target: 'bun', format: 'esm', naming: 'index.js' })
  if (!built.success) throw new Error(built.logs.join('\n'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name, version: manifest.version, type: 'module', license: 'MIT',
    groma: { scanner: { id: 'java', entry: './src/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(pluginRoot, '../../../LICENSE'), path.join(destination, 'LICENSE'))
}

if (import.meta.main) {
  const output = path.join(pluginRoot, 'dist/package')
  await rm(output, { recursive: true, force: true })
  await buildPackage(output)
  await cp(path.join(output, 'dist/worker.jar'), path.join(pluginRoot, 'dist/worker.jar'))
  console.log(output)
}
