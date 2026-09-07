import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
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

async function bundleRuntime(destination: string): Promise<void> {
  const { stderr } = await execute(tool('java'), ['-XshowSettings:properties', '-version'])
  const home = stderr.match(/java\.home = (.+)/)?.[1]?.trim()
  if (!home) throw new Error('Cannot locate the build JDK')
  const jdk = await realpath(home)
  const jlink = path.join(jdk, 'bin', process.platform === 'win32' ? 'jlink.exe' : 'jlink')
  await execute(jlink, ['--add-modules', 'java.se,jdk.compiler,jdk.zipfs', '--strip-debug',
    '--no-header-files', '--no-man-pages', '--output', destination], { maxBuffer: 4 * 1024 * 1024 })
  // jlink omits historical API signatures; javac --release needs these.
  await cp(path.join(jdk, 'lib/ct.sym'), path.join(destination, 'lib/ct.sym'))
  // npm does not preserve symlinks. Keep every per-module runtime license in the tarball.
  const legal = path.join(destination, 'legal')
  const materialized = path.join(destination, 'legal-materialized')
  await cp(legal, materialized, { recursive: true, dereference: true })
  await rm(legal, { recursive: true })
  await rename(materialized, legal)
}

/** Maintainer-only build. Installation and scans never invoke this function. */
export async function buildPackage(destination: string, runtime: boolean): Promise<void> {
  await mkdir(destination, { recursive: true })
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
  await buildWorker(path.join(destination, 'dist/worker.jar'))
  const built = await Bun.build({ entrypoints: [path.join(pluginRoot, 'src/index.ts')],
    outdir: path.join(destination, 'src'), target: 'bun', format: 'esm', naming: 'index.js' })
  if (!built.success) throw new Error(built.logs.join('\n'))
  if (runtime) await bundleRuntime(path.join(destination, 'dist/runtime'))
  const suffix = runtime ? `-${process.platform}-${process.arch}` : ''
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: `@groma/scanner-java${suffix}`, version: manifest.version, private: true,
    type: 'module', license: runtime ? 'SEE LICENSE IN THIRD_PARTY_NOTICES.md' : 'MIT',
    ...(runtime ? { os: [process.platform], cpu: [process.arch] } : {}),
    groma: { scanner: { id: 'java', entry: './src/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(pluginRoot, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  if (runtime) await writeFile(path.join(destination, 'THIRD_PARTY_NOTICES.md'),
    '# Third-party notices\n\nGroma scanner code is MIT-licensed (LICENSE). The bundled OpenJDK image has separate licenses and notices under dist/runtime/legal, including its GPLv2 with Classpath Exception terms. Those runtime files are not relicensed under MIT. This development package is not an approved public release.\n')
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--runtime')) throw new Error('Usage: bun plugins/scanners/java/build.ts [--runtime]')
  await buildWorker(path.join(pluginRoot, 'dist/worker.jar'))
  const output = path.join(pluginRoot, 'dist/package')
  await rm(output, { recursive: true, force: true })
  await buildPackage(output, args.includes('--runtime'))
  console.log(output)
}
