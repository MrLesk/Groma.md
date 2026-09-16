import { existsSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { detectDuplicatedLogic, rememberArchitectureFindings } from './architecture-findings.ts'
import { isReservedDocument } from './architecture-path.ts'
import { buildArchitectureModel } from './architecture-model.ts'
import { storedConnections } from './relationship-markdown.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { architectureElementPath } from './architecture-path.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  renderArchitectureDocument,
  upsertCode,
  writeDocument,
} from './markdown-emitter.ts'
import { displayName, kebabCase } from './naming.ts'
import { componentNames, sourceStem } from './scan-component-naming.ts'
import { sourceUnitGroups } from './scan-source-units.ts'
import { c4Kind, requireGromaMapping } from './okf-profile.ts'
import { refreshDerivedRelationships } from './relationship-inference.ts'
import type { ScanFile, ScanObservation, ScanRoot } from '@groma/scanner'
import type {
  ArchitectureDocument,
  ArchitectureRecords,
  C4Kind,
  CodeReference,
  ElementStatus,
  ScanSummary,
} from './types.ts'

export function readCode(value: unknown): CodeReference[] {
  if (!Array.isArray(value)) return []
  return value.map(entry => {
    const reference = entry as CodeReference
    return {
      scanner: reference.scanner,
      file: reference.file,
      ...(Object.hasOwn(reference, 'symbol') ? { symbol: reference.symbol } : {}),
    }
  })
}

function codeFileKey(scanner: string, file: string): string {
  return `${scanner}\0${file}`
}

interface WorldRecord {
  id: string
  title: string
  kind: C4Kind
  parent?: string | null
  status: ElementStatus
  sourceFilename: string
  code: CodeReference[]
}

interface World {
  byId: Map<string, WorldRecord>
  byCodeFile: Map<string, WorldRecord>
}

function worldRecord(document: ArchitectureDocument): WorldRecord | undefined {
  const kind = c4Kind(document.frontmatter.type)
  if (kind === undefined) return undefined
  const groma = requireGromaMapping(document.frontmatter, document.sourceFilename)
  const { id, parent } = groma
  if (typeof id !== 'string') return undefined
  if (parent !== undefined && parent !== null && typeof parent !== 'string') return undefined
  return {
    id,
    title: String(document.frontmatter.title),
    kind,
    parent,
    status: document.frontmatter.status === 'draft' ? 'draft' : 'stable',
    sourceFilename: document.sourceFilename,
    code: readCode(groma.code),
  }
}

function indexWorld(records: ArchitectureRecords): World {
  const world: World = { byId: new Map(), byCodeFile: new Map() }
  for (const document of records.documents) {
    const record = worldRecord(document)
    if (record === undefined) continue
    world.byId.set(record.id, record)
    for (const reference of record.code) {
      world.byCodeFile.set(reference.file, record)
    }
  }
  return world
}

function availableId(world: World, name: string, parent?: WorldRecord): string {
  const base = kebabCase(name) || 'source'
  const existing = world.byId.get(base)
  if (existing === undefined && !isReservedDocument(`${base}.md`)) return base
  const qualified = `${parent?.id ?? 'source'}-${base}`
  if (!world.byId.has(qualified)) return qualified
  let suffix = 2
  while (world.byId.has(`${qualified}-${suffix}`)) suffix += 1
  return `${qualified}-${suffix}`
}

async function createRecord(
  repositoryRoot: string,
  world: World,
  input: {
    kind: C4Kind
    id?: string
    name: string
    parent?: WorldRecord
    code?: CodeReference[]
  },
): Promise<WorldRecord> {
  const id = input.id ?? availableId(world, input.name, input.parent)
  const name = isReservedDocument(`${kebabCase(input.name)}.md`)
    ? displayName(id)
    : input.name
  const record: WorldRecord = {
    id,
    title: name,
    kind: input.kind,
    parent: input.parent?.id,
    status: 'stable',
    sourceFilename: architectureElementPath({
      root: GromaFileSystem.open(repositoryRoot).sourceFilename(),
      kind: input.kind,
      id,
      parentSourceFilename: input.parent?.sourceFilename,
    }),
    code: input.code ?? [],
  }
  // Reserve identity before yielding so independent file writes keep scan order.
  world.byId.set(id, record)
  for (const reference of record.code) {
    world.byCodeFile.set(reference.file, record)
  }
  await writeDocument(
    repositoryRoot,
    record.sourceFilename,
    renderArchitectureDocument({
      id,
      kind: input.kind,
      parent: input.parent?.id,
      name,
      overview: '',
      status: 'stable',
      code: record.code,
    }),
  )
  return record
}

function refreshedReference(
  reference: CodeReference,
  evidence: ScanFile,
): CodeReference {
  const exact = evidence.symbols.find(symbol => {
    return symbol.id === reference.symbol || symbol.name === reference.symbol
  })
  const symbol = exact ?? (evidence.symbols.length === 1 ? evidence.symbols[0] : undefined)
  return {
    scanner: reference.scanner,
    file: reference.file,
    ...(symbol === undefined ? {} : { symbol: symbol.name }),
  }
}

async function refreshCuratedCode(
  repositoryRoot: string,
  world: World,
  observations: ScanObservation[],
  summary: ScanSummary,
  protectedFiles: ReadonlySet<string>,
): Promise<void> {
  const evidence = new Map<string, ScanFile>()
  const activeScanners = new Set(observations.map(observation => observation.scanner.id))
  for (const observation of observations) {
    for (const file of observation.files) {
      evidence.set(codeFileKey(observation.scanner.id, file.file), file)
    }
  }

  const records = [...new Set(world.byCodeFile.values())]
  for (const record of records) {
    let touched = false
    const code = record.code.flatMap(reference => {
      const found = evidence.get(codeFileKey(reference.scanner, reference.file))
      if (found !== undefined) {
        touched = true
        return [refreshedReference(reference, found)]
      }
      const missing = !protectedFiles.has(reference.file) && activeScanners.has(reference.scanner)
        && !existsSync(path.join(repositoryRoot, reference.file))
      if (missing) touched = true
      return missing ? [] : [reference]
    })
    if (!touched) continue
    const changed = !isDeepStrictEqual(record.code, code)
    record.code = code
    if (changed) await upsertCode(repositoryRoot, record.sourceFilename, record.code)
    if (record.status === 'draft') summary.matched += 1
    else summary.refreshed += 1
  }
}

function mostFrequent(records: WorldRecord[]): WorldRecord | undefined {
  const counts = new Map<WorldRecord, number>()
  for (const record of records) counts.set(record, (counts.get(record) ?? 0) + 1)
  return [...counts].sort((left, right) => {
    return right[1] - left[1] || left[0].id.localeCompare(right[0].id)
  })[0]?.[0]
}

function inferredContainer(
  world: World,
  observation: ScanObservation,
  root: ScanRoot,
  candidates: Map<string, FileCandidate>,
): WorldRecord | undefined {
  const containers = observation.files.flatMap(file => {
    if (!file.roots.includes(root.id)) return []
    const owner = world.byCodeFile.get(file.file)
      ?? candidates.get(file.file)?.parent
    if (owner?.kind === 'container') return [owner]
    const parent = owner?.parent === undefined ? undefined : world.byId.get(owner.parent ?? '')
    return parent?.kind === 'container' ? [parent] : []
  })
  return mostFrequent(containers)
}

function systemFor(world: World, container?: WorldRecord): WorldRecord | undefined {
  if (container?.parent === undefined || container.parent === null) return undefined
  const system = world.byId.get(container.parent)
  return system?.kind === 'system' ? system : undefined
}

function existingChild(
  world: World,
  kind: C4Kind,
  name: string,
  parent?: WorldRecord,
): WorldRecord | undefined {
  const base = kebabCase(name)
  const ids = parent === undefined ? [base] : [base, `${parent.id}-${base}`]
  return ids.map(id => world.byId.get(id)).find(record => {
    return record?.kind === kind && record.parent === parent?.id
  })
}

async function attachReference(
  repositoryRoot: string,
  world: World,
  record: WorldRecord,
  reference: CodeReference,
): Promise<void> {
  record.code = [...record.code, reference].sort((left, right) => {
    return `${left.file}\0${left.scanner}`.localeCompare(`${right.file}\0${right.scanner}`)
  })
  world.byCodeFile.set(reference.file, record)
  await upsertCode(repositoryRoot, record.sourceFilename, record.code)
}

async function observationSystem(
  repositoryRoot: string,
  world: World,
  root: ScanRoot,
  inferred: Map<string, WorldRecord | undefined>,
  summary: ScanSummary,
): Promise<WorldRecord> {
  let system = mostFrequent([...inferred.values()].flatMap(record => {
    const candidate = systemFor(world, record)
    return candidate === undefined ? [] : [candidate]
  }))
  system ??= existingChild(world, 'system', root.name)
  if (system === undefined) {
    system = await createRecord(repositoryRoot, world, {
      kind: 'system',
      name: root.name,
    })
    summary.created += 1
  }
  return system
}

async function observationContainers(
  repositoryRoot: string,
  world: World,
  roots: ScanRoot[],
  system: WorldRecord,
  inferred: Map<string, WorldRecord | undefined>,
  summary: ScanSummary,
): Promise<Map<string, WorldRecord>> {
  const containers = new Map<string, WorldRecord>()
  for (const root of roots) {
    let container = inferred.get(root.id)
      ?? existingChild(world, 'container', root.name, system)
    if (container === undefined) {
      container = await createRecord(repositoryRoot, world, {
        kind: 'container',
        name: root.name,
        parent: system,
      })
      summary.created += 1
    }
    containers.set(root.id, container)
  }
  return containers
}

function scanReference(
  observation: ScanObservation,
  file: ScanFile,
): CodeReference {
  const symbol = file.symbols.length === 1 ? file.symbols[0]?.name : undefined
  return {
    scanner: observation.scanner.id,
    file: file.file,
    ...(symbol === undefined ? {} : { symbol }),
  }
}

interface FileCandidate {
  file: string
  parent: WorldRecord
  references: CodeReference[]
  owner?: WorldRecord
}

function associateCandidates(
  candidates: Map<string, FileCandidate>,
  observations: ScanObservation[],
  world: World,
) {
  const { units, diagnostics } = sourceUnitGroups(observations, world.byCodeFile)
  for (const unit of units) {
    const members = unit.files.map(file => candidates.get(file))
    const primary = candidates.get(unit.primary)
    if (!primary || members.some(member => member === undefined)) continue
    const owner = unit.files.flatMap(file => world.byCodeFile.get(file) ?? [])[0]
    const references = members.flatMap(member => member!.references)
    for (const file of unit.files) candidates.delete(file)
    candidates.set(unit.primary, { ...primary, references, owner })
  }
  return diagnostics
}

function collectFiles(
  candidates: Map<string, FileCandidate>,
  observation: ScanObservation,
  containers: Map<string, WorldRecord>,
): void {
  for (const file of observation.files) {
    const parent = file.roots.flatMap(id => containers.get(id) ?? []).sort((a, b) => a.id.localeCompare(b.id))[0]
    if (parent === undefined) continue
    const candidate = candidates.get(file.file) ?? { file: file.file, parent, references: [] }
    if (parent.id < candidate.parent.id) candidate.parent = parent
    const reference = scanReference(observation, file)
    if (!candidate.references.some(item => item.scanner === reference.scanner)) candidate.references.push(reference)
    candidates.set(file.file, candidate)
  }
}

async function reconcileFiles(
  repositoryRoot: string,
  world: World,
  candidates: Map<string, FileCandidate>,
  summary: ScanSummary,
): Promise<void> {
  const unowned: FileCandidate[] = []
  for (const candidate of [...candidates.values()].sort((a, b) => a.file.localeCompare(b.file))) {
    const named = existingChild(world, 'component', sourceStem(candidate.file), candidate.parent)
    const draft = named?.status === 'draft' && named.code.length === 0 ? named : undefined
    const owner = candidate.owner ?? world.byCodeFile.get(candidate.file) ?? draft
    if (owner === undefined) {
      unowned.push(candidate)
      continue
    }
    if (owner === draft) summary.matched += 1
    for (const reference of candidate.references) {
      if (!owner.code.some(item => item.file === reference.file && item.scanner === reference.scanner)) {
        await attachReference(repositoryRoot, world, owner, reference)
      }
    }
  }
  const names = componentNames(unowned.map(candidate => ({
    file: candidate.file, parent: candidate.parent.id,
  })), new Set([...world.byId.values()].flatMap(record => [record.id, kebabCase(record.title)])))
  for (let offset = 0; offset < unowned.length; offset += 16) {
    await Promise.all(unowned.slice(offset, offset + 16).map(candidate => createRecord(repositoryRoot, world, {
      kind: 'component',
      ...names.get(candidate.file)!,
      parent: candidate.parent,
      code: candidate.references.sort((a, b) => a.scanner.localeCompare(b.scanner)),
    })))
    summary.created += unowned.slice(offset, offset + 16).length
  }
}

async function prepareObservation(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  summary: ScanSummary,
  candidates: Map<string, FileCandidate>,
): Promise<Map<string, WorldRecord>> {
  const byId = new Map(observation.roots.map(root => [root.id, root]))
  const memberships = new Set(observation.files.flatMap(file => file.roots))
  const groups = new Map<ScanRoot, ScanRoot[]>()
  const parents = new Set(observation.roots.map(root => root.parent))
  for (const root of observation.roots.filter(root => memberships.has(root.id) || !parents.has(root.id))) {
    let top = root
    while (top.parent !== undefined) top = byId.get(top.parent)!
    const members = groups.get(top) ?? []
    members.push(root)
    groups.set(top, members)
  }
  const containers = new Map<string, WorldRecord>()
  for (const [top, roots] of groups) {
    const inferred = new Map(roots.map(root => [root.id, inferredContainer(world, observation, root, candidates)]))
    const system = await observationSystem(repositoryRoot, world, top, inferred, summary)
    const found = await observationContainers(repositoryRoot, world, roots, system, inferred, summary)
    for (const [id, container] of found) containers.set(id, container)
  }
  return containers
}

export async function reconcileScanObservations(
  repositoryRoot: string,
  observations: ScanObservation[],
): Promise<ScanSummary> {
  const summary: ScanSummary = { created: 0, refreshed: 0, matched: 0 }
  if (!observations.length) return summary
  const records = await loadArchitecture(repositoryRoot)
  const model = buildArchitectureModel(records.documents)
  const connections = storedConnections(records.documents, model.elements, (_code, file, message) => {
    throw new Error(`${file}: ${message}`)
  })
  const active = new Set(observations.map(observation => observation.scanner.id))
  // Derived technology lists the contributing scanner IDs. Incomplete evidence cannot replace that pair.
  const retained = connections.filter(row => !row.authored && row.technology.split(', ').some(id => !active.has(id)))
  const protectedFiles = new Set([...retained, ...connections.filter(row => row.authored)]
    .flatMap(row => [row.source, row.target]))
  const world = indexWorld(records)
  const diagnostics = observations.flatMap(observation => observation.diagnostics.map(diagnostic => ({
    scanner: observation.scanner, diagnostic,
  })))
  if (diagnostics.length > 0) summary.scannerDiagnostics = diagnostics
  await refreshCuratedCode(repositoryRoot, world, observations, summary, protectedFiles)
  const candidates = new Map<string, FileCandidate>()
  const ordered = [...observations].sort((a, b) => {
    const key = (observation: ScanObservation) => JSON.stringify([
      observation.roots.map(root => [root.file, root.name, root.id, root.parent]).sort(),
    ])
    return key(a).localeCompare(key(b))
  })
  for (const observation of ordered) {
    const containers = await prepareObservation(repositoryRoot, world, observation, summary, candidates)
    collectFiles(candidates, observation, containers)
  }
  const unitConflicts = associateCandidates(candidates, observations, world)
  await reconcileFiles(repositoryRoot, world, candidates, summary)
  const owners = new Map([...world.byId.values()].flatMap(record => record.code.map(reference => [reference.file, record.id] as const)))
  const conflicts = [...unitConflicts, ...await refreshDerivedRelationships(repositoryRoot, observations, owners, retained)]
  if (conflicts.length > 0) summary.evidenceConflicts = conflicts
  const findings = detectDuplicatedLogic(observations, owners)
  rememberArchitectureFindings(repositoryRoot, findings)
  if (findings.length > 0) summary.findings = findings.length
  return summary
}
