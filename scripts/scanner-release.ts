import { chmod, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readPublishedScanners } from '../src/scanner/modules/published.ts'

const repository = { type: 'git', url: 'https://github.com/MrLesk/Groma.md.git' }
const scannerIds = ['java', 'go', 'rust', 'csharp', 'angular', 'vue', 'react', 'typescript', 'python', 'php', 'swift', 'javascript']

async function manifest(directory: string) {
  return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'))
}

async function writeManifest(directory: string, value: unknown) {
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify(value, null, 2)}\n`)
}

async function run(command: string[]) {
  const child = Bun.spawn(command, { stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited !== 0) throw new Error(`Failed: ${command.join(' ')}`)
}

/** Finish every started operation before reporting failure or advancing the release. */
async function completeTogether(operations: Promise<void>[]) {
  const results = await Promise.allSettled(operations)
  const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (failures.length > 0) throw new AggregateError(failures, 'Scanner release operations failed')
}

/** Stage runnable packages for this host; publishing is a separate explicit action. */
async function stage(output: string) {
  await mkdir(output, { recursive: true })
  const contract = path.join(output, 'contract')
  await mkdir(contract, { recursive: true })
  await cp('packages/scanner/src', path.join(contract, 'src'), { recursive: true })
  await cp('LICENSE', path.join(contract, 'LICENSE'))
  await writeManifest(contract, { ...await manifest('packages/scanner'), license: 'MIT', repository,
    files: ['src', 'LICENSE'], publishConfig: { access: 'public' } })
  const builders = {
    php: (await import('../plugins/scanners/php/build.ts')).buildPackage,
    python: (await import('../plugins/scanners/python/build.ts')).buildPackage,
    typescript: (await import('../plugins/scanners/typescript/build.ts')).buildPackage,
    java: (await import('../plugins/scanners/java/build.ts')).buildPackage,
    go: (await import('../plugins/scanners/go/build.ts')).buildPackage,
    rust: (await import('../plugins/scanners/rust/build.ts')).buildPackage,
    angular: (await import('../plugins/scanners/angular/build.ts')).buildPackage,
    vue: (await import('../plugins/scanners/vue/build.ts')).buildPackage,
    react: (await import('../plugins/scanners/react/build.ts')).buildPackage,
    javascript: (await import('../plugins/scanners/javascript/build.ts')).buildPackage,
    swift: (await import('../plugins/scanners/swift/build.ts')).buildPackage,
  }
  await completeTogether([
    ...Object.entries(builders).map(([id, build]) => build(path.join(output, id))),
    run([process.execPath, 'scripts/package-csharp-scanner.ts', path.join(output, 'csharp')]),
  ])
  for (const id of scannerIds) {
    const directory = path.join(output, id)
    await writeManifest(directory, { ...await manifest(directory), repository, publishConfig: { access: 'public' } })
  }
}

/** Combine the host artifacts into one package per scanner, with all built workers. */
async function assemble(input: string, output: string) {
  const hosts = (await readdir(input)).sort()
  if (hosts.length === 0) throw new Error('No scanner build artifacts')
  await cp(path.join(input, hosts[0]!), output, { recursive: true })
  for (const host of hosts.slice(1)) {
    for (const id of ['go', 'rust', 'typescript', 'java', 'csharp', 'swift']) {
      await cp(path.join(input, host, id, 'dist'), path.join(output, id, 'dist'), { recursive: true })
    }
  }
  for (const [id, worker] of Object.entries({ go: 'worker', rust: 'groma-rust-scanner', typescript: 'tsc', java: 'runtime/bin/java', csharp: 'worker/Groma.CSharpScanner', swift: 'worker' })) {
    await prepareWorkers(path.join(output, id), id === 'rust' ? 'dist/bin' : 'dist', worker)
  }
}

async function prepareWorkers(directory: string, relative: string, worker: string) {
  const value = await manifest(directory)
  const platforms = (await readdir(path.join(directory, relative), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^(darwin|linux|win32)-(arm64|x64)$/.test(entry.name)).map(entry => entry.name)
  for (const platform of platforms) {
    await chmod(path.join(directory, relative, platform,
      `${worker}${platform.startsWith('win32-') ? '.exe' : ''}`), 0o755)
  }
  value.os = [...new Set(platforms.map(platform => platform.split('-')[0]))]
  value.cpu = [...new Set(platforms.map(platform => platform.split('-')[1]))]
  await writeManifest(directory, value)
}

/** Use this only after the staged packages have been published successfully. */
async function catalog(input: string) {
  for (const id of scannerIds) {
    const staged = await manifest(path.join(input, id))
    const published = (await readPublishedScanners(staged.name))[staged.version]
    if (!published) throw new Error(`${staged.name}@${staged.version}: publish this release before embedding its metadata`)
    if (!published.groma?.scanner?.discovery?.compatibility) {
      throw new Error(`${id}: public release metadata is not ready`)
    }
    const directory = path.join('plugins/scanners', id)
    const current = await manifest(directory)
    await writeManifest(directory, { ...current, name: published.name, version: published.version,
      private: false, groma: { scanner: { ...current.groma.scanner, discovery: published.groma.scanner.discovery } } })
  }
}

/** Existing exact versions are reused; a release may change only some packages. */
async function isPublished(directory: string): Promise<boolean> {
  const value = await manifest(directory)
  const source = `${value.name}@${value.version}`
  const child = Bun.spawn(['npm', 'view', source, 'version', '--json'], { stdout: 'pipe', stderr: 'pipe' })
  const [output, error, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  const result = JSON.parse(output)
  if (code === 0 && result === value.version) return true
  if (result.error?.code === 'E404') return false
  throw new Error(`Cannot check ${source}: ${error || output}`)
}

/** Publish only explicitly prepared public manifests, using the caller's npm authentication. */
async function publish(input: string) {
  for (const id of scannerIds) {
    const value = await manifest(path.join(input, id))
    if (value.private || !value.groma.scanner.discovery.compatibility) {
      throw new Error(`${id}: confirm public names, versions and compatibility before publishing`)
    }
  }
  await publishPackage(path.join(input, 'contract'))
  await completeTogether(scannerIds.map(id => publishPackage(path.join(input, id))))
}

async function publishPackage(directory: string) {
  if (await isPublished(directory)) console.log(`${path.basename(directory)}: exact version already published`)
  else await run(['npm', 'publish', directory, '--access', 'public'])
}

const [command, input, output] = process.argv.slice(2)
if (!input) throw new Error('Usage: scanner-release.ts stage <output> | assemble <artifacts> <output> | publish <packages> | catalog <published-packages>')
if (command === 'stage') await stage(path.resolve(input))
else if (command === 'assemble' && output) await assemble(path.resolve(input), path.resolve(output))
else if (command === 'publish') await publish(path.resolve(input))
else if (command === 'catalog') await catalog(input)
else throw new Error('Unknown scanner release command')
