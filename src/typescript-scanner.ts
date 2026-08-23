import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ScanCandidate, ScanResult } from './types.ts'
import {
  defaultTypeScriptScannerConfig,
  type TypeScriptScannerConfig,
} from './typescript-files.ts'
import {
  buildImportGraph,
  displayName,
  fileLabel,
  fileStem,
  kebabCase,
  systemName,
  type ImportGraph,
  type ImportGraphNode,
} from './typescript-graph.ts'

export interface TypeScriptRelationship {
  source: string
  target: string
  description: 'starts' | 'uses'
}

export interface TypeScriptObservation {
  candidates: ScanCandidate[]
  relationships: TypeScriptRelationship[]
}

function isPaintFile(file: string, node: ImportGraphNode | undefined): boolean {
  const segments = file.split('/')
  if (segments.includes('atoms') || segments.includes('molecules') || segments.includes('organisms')) {
    return true
  }
  if (fileStem(file) === 'paint') return true
  if (node?.symbol !== undefined && node.symbol.startsWith('draw')) return true
  return false
}

function containerLabel(file: string, cliFiles: Set<string>): string {
  if (cliFiles.has(file) || fileStem(file) === 'cli') return 'Cli'
  return fileLabel(file)
}

function observationFromGraph(
  graph: ImportGraph,
  system: string,
  binFiles: string[],
): TypeScriptObservation {
  const byFile = new Map(graph.files.map(node => [node.file, node]))
  const presentBins = binFiles.filter(file => byFile.has(file))
  const binSet = new Set(presentBins)

  function structuralImports(file: string, skip: Set<string>): string[] {
    return (byFile.get(file)?.imports ?? []).filter(imported => !skip.has(imported))
  }

  function liveImporters(file: string, skip: Set<string>): string[] {
    return (byFile.get(file)?.importedBy ?? []).filter(importer => !skip.has(importer))
  }

  const skip = new Set<string>()
  for (const node of graph.files) {
    if (fileStem(node.file) === 'types') skip.add(node.file)
    if (isPaintFile(node.file, node)) skip.add(node.file)
  }

  const roots = graph.files.filter(node => node.importedBy.length === 0)
  const rankedRoots = roots
    .filter(node => !skip.has(node.file))
    .sort((left, right) => {
      return structuralImports(right.file, skip).length
        - structuralImports(left.file, skip).length
    })
  const cliFiles = new Set(
    presentBins.length > 0
      ? presentBins
      : rankedRoots.slice(0, 1).map(node => node.file),
  )

  const containers = new Set<string>(cliFiles)
  for (const cli of cliFiles) {
    for (const imported of structuralImports(cli, skip)) {
      if (structuralImports(imported, skip).length === 0) continue
      const others = liveImporters(imported, skip).filter(importer => !cliFiles.has(importer))
      if (others.length === 0) containers.add(imported)
    }
  }
  let grew = true
  while (grew) {
    grew = false
    for (const node of graph.files) {
      if (skip.has(node.file) || containers.has(node.file)) continue
      if (structuralImports(node.file, skip).length === 0) continue
      const containerImporters = liveImporters(node.file, skip).filter(file => {
        return containers.has(file)
      })
      if (containerImporters.length >= 2) {
        containers.add(node.file)
        grew = true
      }
    }
  }

  const skipCrossCutting = new Set<string>()
  for (const node of graph.files) {
    if (skip.has(node.file) || containers.has(node.file)) continue
    if (structuralImports(node.file, skip).length > 0) continue
    const dirs = new Set(liveImporters(node.file, skip).map(file => path.posix.dirname(file)))
    if (dirs.size >= 2) skipCrossCutting.add(node.file)
  }
  for (const file of skipCrossCutting) skip.add(file)

  function nearestContainer(file: string): string | undefined {
    const seen = new Set<string>()
    let frontier = [...(byFile.get(file)?.importedBy ?? [])]
    while (frontier.length > 0) {
      const hits = frontier.filter(candidate => containers.has(candidate))
      if (hits.length === 1) return hits[0]
      if (hits.length > 1) return hits.sort()[0]
      const next: string[] = []
      for (const candidate of frontier) {
        if (seen.has(candidate)) continue
        seen.add(candidate)
        next.push(...(byFile.get(candidate)?.importedBy ?? []))
      }
      frontier = next
    }
    const directory = path.posix.dirname(file)
    const byPrefix = [...containers]
      .filter(container => {
        const home = path.posix.dirname(container)
        if (home === '.' || !home.includes('/')) return false
        return directory === home || directory.startsWith(`${home}/`)
      })
      .sort((left, right) => path.posix.dirname(right).length - path.posix.dirname(left).length)
    return byPrefix[0]
  }

  const usedNames = new Set<string>([system])
  function uniqueName(file: string): string {
    let name = containerLabel(file, binSet)
    if (!usedNames.has(name)) {
      usedNames.add(name)
      return name
    }
    const qualified = displayName(kebabCase(
      `${path.posix.basename(path.posix.dirname(file))}-${fileStem(file)}`,
    ))
    const label = usedNames.has(qualified) ? `${qualified} ${file}` : qualified
    usedNames.add(label)
    return label
  }

  const nameOf = new Map<string, string>()
  for (const file of [...containers].sort()) {
    nameOf.set(file, uniqueName(file))
  }

  const owner = new Map<string, string>()
  for (const file of containers) owner.set(file, file)

  const candidates: ScanCandidate[] = [{
    kind: 'system',
    name: system,
    responsibility: '',
  }]

  for (const file of [...containers].sort()) {
    const node = byFile.get(file)
    candidates.push({
      kind: 'container',
      name: nameOf.get(file) ?? fileLabel(file),
      responsibility: '',
      parent: system,
      code: [{
        scanner: 'typescript',
        file,
        ...(node?.symbol === undefined ? {} : { symbol: node.symbol }),
      }],
    })
  }

  for (const node of graph.files) {
    if (skip.has(node.file) || containers.has(node.file)) continue
    const parentFile = nearestContainer(node.file)
    if (parentFile === undefined) continue
    owner.set(node.file, parentFile)
    candidates.push({
      kind: 'component',
      name: fileLabel(node.file),
      responsibility: '',
      parent: nameOf.get(parentFile) ?? fileLabel(parentFile),
      code: [{
        scanner: 'typescript',
        file: node.file,
        ...(node.symbol === undefined ? {} : { symbol: node.symbol }),
      }],
    })
  }

  const relationships: TypeScriptRelationship[] = []
  const seenEdge = new Set<string>()
  for (const [file, container] of owner) {
    const source = nameOf.get(container)
    if (source === undefined) continue
    for (const imported of byFile.get(file)?.imports ?? []) {
      const targetFile = owner.get(imported)
      if (targetFile === undefined || targetFile === container) continue
      const target = nameOf.get(targetFile)
      if (target === undefined) continue
      const key = `${source}\0${target}`
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      const soleCli =
        cliFiles.has(container)
        && liveImporters(targetFile, skip).every(importer => cliFiles.has(importer))
      relationships.push({
        source,
        target,
        description: soleCli ? 'starts' : 'uses',
      })
    }
  }
  relationships.sort((left, right) => {
    return left.source.localeCompare(right.source)
      || left.target.localeCompare(right.target)
  })

  return { candidates, relationships }
}

function candidateFile(candidate: ScanCandidate): string {
  return candidate.code?.[0]?.file ?? ''
}

function candidateSymbol(candidate: ScanCandidate): string {
  return candidate.code?.[0]?.symbol ?? ''
}

export function formatTypeScriptObservation(result: TypeScriptObservation): string {
  const system = result.candidates.find(candidate => candidate.kind === 'system')
  const containers = result.candidates
    .filter(candidate => candidate.kind === 'container')
    .sort((left, right) => left.name.localeCompare(right.name))
  const components = result.candidates.filter(candidate => candidate.kind === 'component')
  const lines: string[] = []

  function lineFor(prefix: string, candidate: ScanCandidate): string {
    const parts = [prefix + candidate.name, candidate.kind]
    const file = candidateFile(candidate)
    const symbol = candidateSymbol(candidate)
    if (file !== '') parts.push(file)
    if (symbol !== '') parts.push(symbol)
    return parts.join('  ')
  }

  if (system !== undefined) lines.push(lineFor('', system))

  for (const [index, container] of containers.entries()) {
    const lastContainer = index === containers.length - 1
    const children = components
      .filter(component => component.parent === container.name)
      .sort((left, right) => left.name.localeCompare(right.name))
    lines.push(lineFor(lastContainer ? '`-- ' : '|-- ', container))
    for (const [childIndex, component] of children.entries()) {
      const lastChild = childIndex === children.length - 1
      const prefix = `${lastContainer ? '    ' : '|   '}${lastChild ? '`-- ' : '|-- '}`
      lines.push(lineFor(prefix, component))
    }
  }

  if (result.relationships.length > 0) {
    lines.push('')
    lines.push('relationships')
    for (const relationship of result.relationships) {
      lines.push(
        `${relationship.source}  ${relationship.description}  ${relationship.target}`,
      )
    }
  }

  const systems = result.candidates.filter(candidate => candidate.kind === 'system').length
  const containerCount = containers.length
  const componentCount = components.length
  lines.push('')
  lines.push(`${systems} system, ${containerCount} containers, ${componentCount} components`)
  return `${lines.join('\n')}\n`
}

async function packageBins(repositoryRoot: string): Promise<string[]> {
  try {
    const source = await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
    const bin = (JSON.parse(source) as { bin?: unknown }).bin
    if (typeof bin === 'string') return [bin.replace(/^\.\//, '')]
    if (bin !== null && typeof bin === 'object') {
      return Object.values(bin as Record<string, string>).map(value => {
        return value.replace(/^\.\//, '')
      })
    }
  } catch {
    return []
  }
  return []
}

export async function observeTypeScriptSource(
  repositoryRoot: string,
  config: TypeScriptScannerConfig = defaultTypeScriptScannerConfig,
): Promise<TypeScriptObservation> {
  const graph = await buildImportGraph(repositoryRoot, config)
  return observationFromGraph(
    graph,
    await systemName(repositoryRoot),
    await packageBins(repositoryRoot),
  )
}

export async function scanTypeScriptSource(
  repositoryRoot: string,
): Promise<ScanResult> {
  const observation = await observeTypeScriptSource(repositoryRoot)
  return { candidates: observation.candidates }
}

function readFlags(argv: string[]): {
  root: string
  config: TypeScriptScannerConfig
} {
  const globs: string[] = []
  const ignore: string[] = []
  let root: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--glob') {
      const value = argv[index + 1]
      if (value !== undefined) {
        globs.push(value)
        index += 1
      }
      continue
    }
    if (arg === '--ignore') {
      const value = argv[index + 1]
      if (value !== undefined) {
        ignore.push(value)
        index += 1
      }
      continue
    }
    if (arg !== undefined && !arg.startsWith('-') && root === undefined) {
      root = arg
    }
  }
  return {
    root: root ?? process.cwd(),
    config: {
      globs: globs.length > 0 ? globs : defaultTypeScriptScannerConfig.globs,
      ignore: [
        ...defaultTypeScriptScannerConfig.ignore,
        ...ignore,
      ],
    },
  }
}

if (import.meta.main) {
  const { root, config } = readFlags(process.argv.slice(2))
  process.stdout.write(
    formatTypeScriptObservation(await observeTypeScriptSource(root, config)),
  )
}
