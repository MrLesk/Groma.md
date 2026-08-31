import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface NpmScannerSource {
  kind: 'npm'
  name: string
  source: string
  version: string
}

export interface LocalScannerSource {
  kind: 'local'
  packageRoot: string
  source: string
}

export type ScannerSource = NpmScannerSource | LocalScannerSource

export interface ResolvedScannerPackage {
  entry: string
  id: string
  name: string
  version: string
}

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const scannerId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function defaultScannerCacheRoot(): string {
  return path.join(homedir(), '.groma', 'cache', 'scanners')
}

function npmSource(source: string): NpmScannerSource | undefined {
  const separator = source.lastIndexOf('@')
  if (separator <= 0) return undefined
  const name = source.slice(0, separator)
  const version = source.slice(separator + 1)
  if (!packageName.test(name) || !exactVersion.test(version)) return undefined
  return { kind: 'npm', name, source: `${name}@${version}`, version }
}

function projectLocalSource(repositoryRoot: string, absolute: string): string {
  const relative = path.relative(repositoryRoot, absolute)
  if (relative === '') return '.'
  if (relative.startsWith('..') || path.isAbsolute(relative)) return absolute
  return `./${relative.split(path.sep).join('/')}`
}

export function parseScannerSource(repositoryRoot: string, input: string): ScannerSource {
  const source = input.trim()
  const npm = npmSource(source)
  if (npm !== undefined) return npm
  if (!source.startsWith('.') && !path.isAbsolute(source)) {
    throw new Error('scanner source must be an exact package@version or a local ./path')
  }
  const packageRoot = path.resolve(repositoryRoot, source)
  return {
    kind: 'local',
    packageRoot,
    source: projectLocalSource(repositoryRoot, packageRoot),
  }
}

function installDirectory(cacheRoot: string, source: string): string {
  const key = createHash('sha256').update(source).digest('hex').slice(0, 16)
  return path.join(cacheRoot, key)
}

function npmPackageRoot(cacheRoot: string, source: NpmScannerSource): string {
  return path.join(installDirectory(cacheRoot, source.source), 'node_modules', ...source.name.split('/'))
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

async function scannerEntry(packageRoot: string, value: unknown): Promise<string | undefined> {
  if (typeof value !== 'string' || !value.startsWith('./')) {
    throw new Error('scanner package.json groma.scanner.entry must be a relative ./path')
  }
  const entry = path.resolve(packageRoot, value)
  const relativeEntry = path.relative(packageRoot, entry)
  if (relativeEntry.startsWith('..') || path.isAbsolute(relativeEntry)) {
    throw new Error('scanner package.json entry must stay inside its package')
  }
  try {
    if (!(await stat(entry)).isFile()) {
      throw new Error(`scanner package entry must be a file: ${value}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  return entry
}

async function scannerPackage(packageRoot: string): Promise<ResolvedScannerPackage | undefined> {
  let source: string
  try {
    source = await readFile(path.join(packageRoot, 'package.json'), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const manifest = object(JSON.parse(source), 'scanner package.json')
  const groma = object(manifest.groma, 'scanner package.json groma')
  const scanner = object(groma.scanner, 'scanner package.json groma.scanner')
  if (Object.keys(scanner).some(field => field !== 'id' && field !== 'entry')) {
    throw new Error('scanner package.json groma.scanner may contain only id and entry')
  }
  if (typeof scanner.id !== 'string' || !scannerId.test(scanner.id)) {
    throw new Error('scanner package.json groma.scanner.id must be lowercase kebab-case')
  }
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    throw new Error('scanner package.json name must be non-empty')
  }
  if (typeof manifest.version !== 'string' || manifest.version.trim() === '') {
    throw new Error('scanner package.json version must be non-empty')
  }
  const entry = await scannerEntry(packageRoot, scanner.entry)
  if (entry === undefined) return undefined
  return {
    entry,
    id: scanner.id,
    name: manifest.name,
    version: manifest.version,
  }
}

export async function resolveScannerPackage(
  source: ScannerSource,
  cacheRoot = defaultScannerCacheRoot(),
): Promise<ResolvedScannerPackage | undefined> {
  const packageRoot = source.kind === 'local'
    ? source.packageRoot
    : npmPackageRoot(cacheRoot, source)
  const resolved = await scannerPackage(packageRoot)
  if (resolved !== undefined && source.kind === 'npm') {
    if (resolved.name !== source.name || resolved.version !== source.version) {
      throw new Error(`installed scanner does not match ${source.source}`)
    }
  }
  return resolved
}

export async function installNpmScanner(
  source: NpmScannerSource,
  cacheRoot = defaultScannerCacheRoot(),
  registry?: string,
): Promise<ResolvedScannerPackage> {
  const directory = installDirectory(cacheRoot, source.source)
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: { [source.name]: source.version },
  }, null, 2)}\n`)
  const command = [globalThis.process.execPath, 'install', '--ignore-scripts']
  if (registry !== undefined) command.push(`--registry=${registry}`)
  const child = Bun.spawn(command, {
    cwd: directory,
    env: { ...globalThis.process.env, BUN_BE_BUN: '1' },
    stderr: 'pipe',
    stdout: 'ignore',
  })
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`could not install ${source.source}: ${stderr.trim() || `exit ${exitCode}`}`)
  }
  const resolved = await resolveScannerPackage(source, cacheRoot)
  if (resolved === undefined) throw new Error(`installed scanner is missing: ${source.source}`)
  return resolved
}
