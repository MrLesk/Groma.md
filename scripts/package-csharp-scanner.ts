import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '../plugins/scanners/csharp/src/process.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path.join(root, 'plugins/scanners/csharp')
const dist = path.join(source, 'dist')
const destination = path.resolve(process.argv[2] ?? path.join(root, 'dist/csharp-scanner-package'))
if (destination === root || destination === source || destination === dist) throw new Error('Choose a separate package output directory')
await mkdir(dist, { recursive: true })
await run(process.env.DOTNET_HOST_PATH || 'dotnet', [
  'publish', path.join(source, 'dotnet/Groma.CSharpScanner.csproj'), '-c', 'Release',
  '--no-restore', '--self-contained', 'false', '-p:UseAppHost=false', '-o', path.join(dist, 'worker'),
], { cwd: root, timeoutSeconds: 120 })
const build = await Bun.build({ entrypoints: [path.join(source, 'src/index.ts')], target: 'bun', outdir: dist })
if (!build.success) throw new AggregateError(build.logs, 'C# adapter build failed')
// A staging directory is explicit output, not a published npm release.
await mkdir(destination, { recursive: true })
await rm(path.join(destination, 'dist'), { recursive: true, force: true })
await cp(dist, path.join(destination, 'dist'), { recursive: true })
await cp(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'))
const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'))
await writeFile(path.join(destination, 'package.json'), `${JSON.stringify({
  name: manifest.name, version: manifest.version, private: manifest.private, type: 'module', license: 'MIT',
  description: manifest.description,
  exports: './dist/index.js', files: ['dist', 'LICENSE', 'README.md'],
  groma: { scanner: { ...manifest.groma.scanner, entry: './dist/index.js' } },
}, null, 2)}\n`)
await writeFile(path.join(destination, 'README.md'), await readFile(path.join(root, 'docs/scanners/dotnet-csharp/index.md'), 'utf8'))
console.log(destination)
