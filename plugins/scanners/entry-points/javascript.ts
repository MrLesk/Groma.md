import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createScanObservation, type ScanEntryPoint, type ScanObservation } from '@groma/scanner'
import { projectFiles } from '../projects.ts'
import type { EntrySources } from './source.ts'

export type SourceEntry = Omit<ScanEntryPoint, 'files'>

function packageFor(file: string, packages: ReadonlySet<string>): string {
  let directory = path.posix.dirname(file)
  while (directory !== '.' && !packages.has(directory)) directory = path.posix.dirname(directory)
  return directory
}

function declaredBins(declaration: string, manifest: Record<string, unknown>): SourceEntry[] {
  const bins = typeof manifest.bin === 'string' ? { [String(manifest.name ?? 'main')]: manifest.bin } : manifest.bin
  if (!bins || typeof bins !== 'object') return []
  return Object.entries(bins).flatMap(([name, target]) => typeof target === 'string'
    ? [{ declaration, name, file: path.posix.join(path.posix.dirname(declaration), target) }] : [])
}

function declaredScripts(declaration: string, scripts: Record<string, unknown> | undefined): SourceEntry[] {
  return Object.entries(scripts ?? {}).flatMap(([name, script]) => {
    if (typeof script !== 'string') return []
    const match = /^(?:node|bun|tsx|ts-node)\s+(?:run\s+)?([\w./-]+\.(?:[cm]?[jt]sx?))(?:\s|$)/.exec(script)
    return match ? [{ declaration, name, file: path.posix.join(path.posix.dirname(declaration), match[1]!) }] : []
  })
}

function angularEntries(declaration: string, source: string): SourceEntry[] {
  const workspace = JSON.parse(source)
  return Object.entries(workspace.projects ?? {}).flatMap(([name, value]) => {
    const project = value as { architect?: { build?: { options?: Record<string, unknown> } }; targets?: { build?: { options?: Record<string, unknown> } } }
    const options = (project.architect ?? project.targets)?.build?.options
    const main = options?.browser ?? options?.main
    return typeof main === 'string' ? [{ declaration, name, file: path.posix.join(path.posix.dirname(declaration), main) }] : []
  })
}

function browserEntries(declaration: string, source: string, packages: ReadonlySet<string>): SourceEntry[] {
  const scripts = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)]
  return scripts.flatMap(match => {
    const src = match[1]!
    if (/^(?:[a-z]+:|\/\/)/i.test(src)) return []
    const base = src.startsWith('/') ? packageFor(declaration, packages) : path.posix.dirname(declaration)
    return [{ file: path.posix.join(base, src.replace(/^\//, '')), declaration,
      name: path.posix.basename(declaration, '.html') }]
  })
}

function entryFiles(entry: string, imports: ReadonlyMap<string, string[]>, packages: ReadonlySet<string>): Set<string> {
  const owner = packageFor(entry, packages), found = new Set<string>()
  const pending = [entry]
  while (pending.length) {
    const file = pending.pop()!
    if (found.has(file) || packageFor(file, packages) !== owner) continue
    found.add(file)
    pending.push(...imports.get(file) ?? [])
  }
  return found
}

/** Shared source facts for JS/TS and framework observers; each contributes only the files it analyzed. */
export async function withJavaScriptEntries(
  root: string, observation: ScanObservation | undefined, inputs: EntrySources,
): Promise<ScanObservation | undefined> {
  if (!observation) return undefined
  const inventory = await projectFiles(root, file => ['package.json', 'angular.json'].includes(path.posix.basename(file)) || file.endsWith('.html'))
  const packages = new Set(inventory.filter(file => path.posix.basename(file) === 'package.json').map(file => path.posix.dirname(file)))
  const active = new Set(observation.files.map(file => packageFor(file.file, packages)))
  const declarations = inventory.filter(file => active.has(packageFor(file, packages)))
  const entries = [...inputs.entries]
  for (const file of declarations) {
    const text = await readFile(path.join(root, file), 'utf8')
    if (path.posix.basename(file) === 'package.json') {
      const manifest = JSON.parse(text)
      entries.push(...declaredBins(file, manifest), ...declaredScripts(file, manifest.scripts))
    } else if (path.posix.basename(file) === 'angular.json') entries.push(...angularEntries(file, text))
    else entries.push(...browserEntries(file, text, packages))
  }
  const inventoryFiles = [...observation.files]
  const visible = new Set(inventoryFiles.map(file => file.file))
  const entryPoints = entries.flatMap(entry => {
    if (!inputs.imports.has(entry.file)) return []
    const reached = entryFiles(entry.file, inputs.imports, packages)
    for (const unit of observation.sourceUnits ?? []) if (reached.has(unit.primary)) for (const file of unit.files) reached.add(file)
    const members = observation.files.filter(file => reached.has(file.file))
    if (!members.length) return []
    if (!visible.has(entry.file)) {
      // Frameworks analyze the launcher as well as its components. Keep that physical identity explicit.
      inventoryFiles.push({ file: entry.file, symbols: [], roots: [...new Set(members.flatMap(file => file.roots))] })
      visible.add(entry.file)
    }
    return [{ ...entry, files: [...new Set([entry.file, ...members.map(file => file.file)])] }]
  })
  return createScanObservation({ ...observation, files: inventoryFiles, entryPoints })
}
