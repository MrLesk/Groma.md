import { parseScannerDiscovery, type ScannerDiscoveryMetadata } from '@groma/scanner'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { stringArray } from './config.ts'
import { isNpmPackageName } from './published.ts'

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

export interface GitScannerSource {
  kind: 'git'
  repository: string
  revision: string
  source: string
}

export type ScannerSource = NpmScannerSource | LocalScannerSource | GitScannerSource

export interface ResolvedScannerPackage {
  discovery?: ScannerDiscoveryMetadata
  entry: string
  /** Default Git ignore patterns, written into the scanner's configuration when it is added. */
  exclude?: string[]
  id: string
  name: string
  version: string
}

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const scannerId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function defaultScannerCacheRoot(): string {
  return path.join(homedir(), '.groma', 'cache', 'scanners')
}

function npmSource(source: string): NpmScannerSource | undefined {
  const separator = source.lastIndexOf('@')
  if (separator <= 0) return undefined
  const name = source.slice(0, separator)
  const version = source.slice(separator + 1)
  if (!isNpmPackageName(name) || !exactVersion.test(version)) return undefined
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
  if (source.startsWith('git+')) {
    const url = new URL(source.slice(4))
    const revision = url.hash.slice(1)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || !revision) {
      throw new Error('Git scanner source must be git+https://repository#tag-or-commit')
    }
    url.hash = ''
    return { kind: 'git', repository: url.href, revision, source: `git+${url.href}#${revision}` }
  }
  const npm = npmSource(source)
  if (npm !== undefined) return npm
  if (!source.startsWith('.') && !path.isAbsolute(source)) {
    throw new Error('scanner source must be an exact package@version, git+https://repository#tag-or-commit, or a local ./path')
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
  if (Object.keys(scanner).some(field => !['id', 'entry', 'discovery', 'exclude'].includes(field))) {
    throw new Error('scanner package.json groma.scanner may contain only id, entry, discovery and exclude')
  }
  if (scanner.exclude !== undefined && !stringArray(scanner.exclude)) {
    throw new Error('scanner package.json groma.scanner.exclude must be an array of strings')
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
    ...(scanner.discovery === undefined ? {} : { discovery: parseScannerDiscovery(scanner.discovery) }),
    ...(scanner.exclude === undefined ? {} : { exclude: scanner.exclude }),
  }
}

export async function resolveScannerPackage(
  source: ScannerSource,
  cacheRoot = defaultScannerCacheRoot(),
): Promise<ResolvedScannerPackage | undefined> {
  const packageRoot = source.kind === 'local'
    ? source.packageRoot
    : source.kind === 'git'
      ? installDirectory(cacheRoot, source.source)
      : npmPackageRoot(cacheRoot, source)
  const resolved = await scannerPackage(packageRoot)
  if (resolved !== undefined && source.kind === 'npm') {
    if (resolved.name !== source.name || resolved.version !== source.version) {
      throw new Error(`installed scanner does not match ${source.source}`)
    }
  }
  return resolved
}

async function installNpmScanner(
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
  await installDependencies(directory, source.source, registry)
  const resolved = await resolveScannerPackage(source, cacheRoot)
  if (resolved === undefined) throw new Error(`installed scanner is missing: ${source.source}`)
  return resolved
}

async function installDependencies(directory: string, source: string, registry?: string): Promise<void> {
  const command = [process.execPath, 'install', '--ignore-scripts']
  if (registry !== undefined) command.push(`--registry=${registry}`)
  const child = Bun.spawn(command, {
    cwd: directory,
    env: { ...process.env, BUN_BE_BUN: '1' },
    stderr: 'pipe', stdout: 'ignore',
  })
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  if (exitCode !== 0) {
    throw new Error(`Could not download ${source}. Check your connection and registry access, then retry.\n${stderr.trim() || `exit ${exitCode}`}`)
  }
}

async function git(directory: string, ...args: string[]): Promise<string> {
  const child = Bun.spawn(['git', ...args], {
    cwd: directory, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdout: 'pipe', stderr: 'pipe', stdin: 'ignore',
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`could not install Git scanner: ${stderr.trim()}`)
  return stdout.trim()
}

async function installGitScanner(
  source: GitScannerSource,
  cacheRoot: string,
  registry?: string,
): Promise<{ source: string; package: ResolvedScannerPackage }> {
  await mkdir(cacheRoot, { recursive: true })
  const temporary = await mkdtemp(path.join(cacheRoot, 'checkout-'))
  try {
    await git(temporary, 'init', '--quiet')
    const revision = /^[0-9a-f]{40}$/i.test(source.revision)
      ? source.revision : `refs/tags/${source.revision}`
    await git(temporary, 'fetch', '--depth=1', source.repository, revision)
    const commit = await git(temporary, 'rev-parse', 'FETCH_HEAD^{commit}')
    await git(temporary, 'checkout', '--quiet', '--detach', commit)
    const pinned = { ...source, revision: commit, source: `git+${source.repository}#${commit}` }
    const existing = await resolveScannerPackage(pinned, cacheRoot)
    if (existing !== undefined) return { source: pinned.source, package: existing }
    const resolved = await scannerPackage(temporary)
    if (resolved === undefined) throw new Error('Git repository must contain a runnable scanner package at its root')
    await installDependencies(temporary, pinned.source, registry)
    const destination = installDirectory(cacheRoot, pinned.source)
    await rename(temporary, destination)
    return { source: pinned.source, package: { ...resolved, entry: path.join(destination, path.relative(temporary, resolved.entry)) } }
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

/** Installation is explicit; registry loading only resolves already installed packages. */
export async function installScannerPackage(
  source: ScannerSource,
  cacheRoot = defaultScannerCacheRoot(),
  registry?: string,
): Promise<{ source: string; package: ResolvedScannerPackage }> {
  if (source.kind === 'git') return installGitScanner(source, cacheRoot, registry)
  const resolved = source.kind === 'npm'
    ? await installNpmScanner(source, cacheRoot, registry)
    : await resolveScannerPackage(source, cacheRoot)
  if (resolved === undefined) throw new Error(`scanner package not found: ${source.source}`)
  return { source: source.source, package: resolved }
}
