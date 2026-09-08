import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './src/adapter.ts'

const pluginRoot = fileURLToPath(new URL('./', import.meta.url))
const executable = `worker${process.platform === 'win32' ? '.exe' : ''}`

export async function buildWorker(destination: string, go = 'go'): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true })
  await run(go, ['build', '-mod=readonly', '-trimpath', '-ldflags=-buildid=', '-o', destination, '.'],
    path.join(pluginRoot, 'worker'), { ...process.env, GOTOOLCHAIN: 'local', CGO_ENABLED: '0' })
}

/** Build for the maintainer's host. Consumers receive compiled code and need no install scripts. */
export async function buildPackage(destination: string, go = 'go'): Promise<void> {
  await mkdir(destination, { recursive: true })
  await buildWorker(path.join(destination, 'dist', executable), go)
  const built = await Bun.build({ entrypoints: [path.join(pluginRoot, 'src/index.ts')],
    outdir: path.join(destination, 'src'), target: 'bun', format: 'esm', naming: 'index.js' })
  if (!built.success) throw new Error(built.logs.join('\n'))
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'package.json'), 'utf8'))
  await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
    name: manifest.name, version: manifest.version, private: true, type: 'module', license: 'MIT',
    os: [process.platform], cpu: [process.arch],
    groma: { scanner: { id: 'go', entry: './src/index.js' } },
  }, null, 2)}\n`)
  await cp(path.join(pluginRoot, '../../../LICENSE'), path.join(destination, 'LICENSE'))
  const goRoot = (await run(go, ['env', 'GOROOT'], pluginRoot)).trim()
  await cp(path.join(goRoot, 'LICENSE'), path.join(destination, 'GO-LICENSE'))
  const moduleCache = (await run(go, ['env', 'GOMODCACHE'], pluginRoot)).trim()
  await cp(path.join(moduleCache, 'golang.org/x/tools@v0.49.0/LICENSE'), path.join(destination, 'GO-TOOLS-LICENSE'))
  await cp(path.join(moduleCache, 'golang.org/x/sync@v0.22.0/LICENSE'), path.join(destination, 'GO-SYNC-LICENSE'))
  await cp(path.join(moduleCache, 'golang.org/x/mod@v0.39.0/LICENSE'), path.join(destination, 'GO-MOD-LICENSE'))
}

if (import.meta.main) {
  const destination = path.join(pluginRoot, 'dist/package')
  await rm(destination, { recursive: true, force: true })
  await buildPackage(destination)
  await cp(path.join(destination, 'dist', executable), path.join(pluginRoot, 'dist', executable))
  console.log(destination)
}
