import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from '../plugins/scanners/csharp/src/process.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = path.join(root, 'plugins/scanners/csharp')
const dist = path.join(source, 'dist')
const repository = { type: 'git', url: 'git+https://github.com/MrLesk/Groma.md.git' }

async function manifest(directory: string) {
  return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
}

async function writeManifest(directory: string, value: unknown) {
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify(value, null, 2)}\n`)
}

/** Build the adapter and install its host runtime locally for source and staged-package use. */
export async function buildPackage(destination: string): Promise<void> {
  if (destination === root || destination === source || destination === dist) throw new Error('Choose a separate package output directory')
  const value = await manifest(source)
  const platform = `${process.platform}-${process.arch}`
  const name = `${value.name}-${platform}`
  const runtime = path.join(source, 'node_modules', name)
  await rm(dist, { recursive: true, force: true })
  await rm(runtime, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await mkdir(runtime, { recursive: true })
  const rid = `${process.platform === 'darwin' ? 'osx' : process.platform === 'win32' ? 'win' : 'linux'}-${process.arch}`
  // Runtime-specific restore state belongs to build output, not the shared source lockfile.
  const runtimeLock = path.join(dist, 'runtime.packages.lock.json')
  await cp(path.join(source, 'dotnet/packages.lock.json'), runtimeLock)
  await run(process.env.DOTNET_HOST_PATH || 'dotnet', [
    'publish', path.join(source, 'dotnet/Groma.CSharpScanner.csproj'), '-c', 'Release',
    '--self-contained', 'true', '-r', rid, '-p:UseAppHost=true', `-p:NuGetLockFilePath=${runtimeLock}`,
    '-o', path.join(runtime, 'worker'),
  ], { cwd: root, timeoutSeconds: 120 })
  await rm(runtimeLock)
  await cp(path.join(root, 'LICENSE'), path.join(runtime, 'LICENSE'))
  await writeManifest(runtime, { name, version: value.version, license: 'MIT', repository,
    description: `Self-contained C# scanner runtime for ${platform}`,
    os: [process.platform], cpu: [process.arch], files: ['worker', 'LICENSE'], publishConfig: { access: 'public' } })
  const build = await Bun.build({ entrypoints: [path.join(source, 'src/index.ts')], target: 'bun', outdir: dist })
  if (!build.success) throw new AggregateError(build.logs, 'C# adapter build failed')
  await mkdir(destination, { recursive: true })
  await rm(path.join(destination, 'dist'), { recursive: true, force: true })
  await rm(path.join(destination, 'node_modules'), { recursive: true, force: true })
  await cp(dist, path.join(destination, 'dist'), { recursive: true })
  await cp(runtime, path.join(destination, 'node_modules', name), { recursive: true })
  await cp(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'))
  await writeManifest(destination, {
    name: value.name, version: value.version, private: value.private, type: 'module', license: 'MIT', repository,
    description: value.description, publishConfig: { access: 'public' },
    exports: './dist/index.js', files: ['dist', 'LICENSE', 'README.md'], os: [process.platform], cpu: [process.arch],
    optionalDependencies: { [name]: value.version },
    groma: { scanner: { ...value.groma.scanner, entry: './dist/index.js' } },
  })
  await writeFile(path.join(destination, 'README.md'), await readFile(path.join(root, 'docs/scanners/dotnet-csharp/index.md'), 'utf8'))
}

/** Keep each complete runtime below npm's upload limit instead of combining five runtimes. */
export async function assembleCSharpPackages(hosts: string[], output: string): Promise<void> {
  const directory = path.join(output, 'csharp')
  const value = await manifest(directory)
  const dependencies: Record<string, string> = {}
  const systems = new Set<string>()
  const architectures = new Set<string>()
  for (const host of hosts) {
    const staged = await manifest(path.join(host, 'csharp'))
    for (const [name, version] of Object.entries(staged.optionalDependencies)) {
      const runtime = path.join(host, 'csharp', 'node_modules', name)
      const packaged = await manifest(runtime)
      const platform = `${packaged.os[0]}-${packaged.cpu[0]}`
      const destination = path.join(output, 'csharp-runtimes', platform)
      await cp(runtime, destination, { recursive: true })
      await chmod(path.join(destination, 'worker', `Groma.CSharpScanner${packaged.os[0] === 'win32' ? '.exe' : ''}`), 0o755)
      dependencies[name] = version as string
      systems.add(packaged.os[0])
      architectures.add(packaged.cpu[0])
    }
  }
  await rm(path.join(directory, 'node_modules'), { recursive: true, force: true })
  await writeManifest(directory, { ...value, optionalDependencies: dependencies, os: [...systems], cpu: [...architectures] })
}

if (import.meta.main) {
  const destination = path.resolve(process.argv[2] ?? path.join(root, 'dist/csharp-scanner-package'))
  await buildPackage(destination)
  console.log(destination)
}
