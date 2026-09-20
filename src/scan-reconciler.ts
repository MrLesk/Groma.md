import { existsSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { detectDuplicatedLogic, rememberArchitectureFindings } from './architecture-findings.ts'
import { buildArchitectureModel } from './architecture-model.ts'
import { storedConnections } from './relationship-markdown.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { architectureElementPath, isExternalPath } from './architecture-path.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  renderArchitectureDocument,
  upsertCode,
  writeDocument,
} from './markdown-emitter.ts'
import { isReservedId, kebabCase } from './naming.ts'
import { componentNames, sourceStem } from './scan-component-naming.ts'
import { sourceUnitGroups } from './scan-source-units.ts'
import { loadProjectProfile } from './project-profile.ts'
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

/** The IDs a record of this name may take, in order: plain, qualified by its parent, then numbered. */
function candidateId(name: string, parent: WorldRecord | undefined, index: number): string {
  const base = kebabCase(name) || 'source'
  if (index === 0) return base
  const qualified = `${parent?.id ?? 'source'}-${base}`
  return index === 1 ? qualified : `${qualified}-${index}`
}

function isFree(world: World, id: string): boolean {
  return !world.byId.has(id) && !isReservedId(id)
}

/** The first candidate ID no record holds. */
function availableId(world: World, name: string, parent?: WorldRecord): string {
  let index = 0
  while (!isFree(world, candidateId(name, parent, index))) index += 1
  return candidateId(name, parent, index)
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
  const name = input.name
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

function onlyRecord(records: WorldRecord[]): WorldRecord | undefined {
  return records.every(record => record === records[0]) ? records[0] : undefined
}

function sourceParents(
  world: World,
  observation: ScanObservation,
  root: ScanRoot,
): WorldRecord[] {
  return observation.files.flatMap(file => {
    if (!file.roots.includes(root.id)) return []
    const owner = world.byCodeFile.get(file.file)
    if (owner?.kind === 'container' || owner?.kind === 'system') return [owner]
    const parent = owner?.parent === undefined ? undefined : world.byId.get(owner.parent ?? '')
    return parent === undefined ? [] : [parent]
  })
}

function systemFor(world: World, container?: WorldRecord): WorldRecord | undefined {
  if (container?.kind === 'system') return container
  if (container?.parent === undefined || container.parent === null) return undefined
  const system = world.byId.get(container.parent)
  return system?.kind === 'system' ? system : undefined
}

/** Conflicting containers can establish their common system, never a winning container. */
function commonParent(world: World, parents: WorldRecord[]): WorldRecord | undefined {
  return onlyRecord(parents) ?? onlyRecord(parents.flatMap(parent => systemFor(world, parent) ?? []))
}

function internalSystems(world: World): WorldRecord[] {
  return [...world.byId.values()].filter(record => record.kind === 'system' && !isExternalPath(record.sourceFilename))
}

/** The record availableId named for this name and parent: its candidates up to the first free one. */
function existingChild(
  world: World,
  kind: C4Kind,
  name: string,
  parent?: WorldRecord,
): WorldRecord | undefined {
  for (let index = 0; ; index += 1) {
    const id = candidateId(name, parent, index)
    if (isFree(world, id)) return undefined
    const record = world.byId.get(id)
    if (record?.kind === kind && record.parent === parent?.id) return record
  }
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

async function createInitialSystem(
  repositoryRoot: string,
  world: World,
  observations: ScanObservation[],
  summary: ScanSummary,
): Promise<void> {
  if (internalSystems(world).length > 0 || !observations.some(observation => observation.files.length > 0)) return
  // loadArchitecture has already validated the required project profile.
  const project = (await loadProjectProfile(repositoryRoot))!
  await createRecord(repositoryRoot, world, { kind: 'system', name: project.title })
  summary.created += 1
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
  parents: WorldRecord[]
  references: CodeReference[]
  owner?: WorldRecord
}

function associateCandidates(
  candidates: Map<string, FileCandidate>,
  observations: ScanObservation[],
  world: World,
) {
  const { units, diagnostics } = sourceUnitGroups(observations, world.byCodeFile)
  for (const { unit, owner } of units) {
    const members = unit.files.map(file => candidates.get(file))
    const primary = candidates.get(unit.primary)
    if (!primary || members.some(member => member === undefined)) continue
    const references = members.flatMap(member => member!.references)
    for (const file of unit.files) candidates.delete(file)
    candidates.set(unit.primary, { ...primary, parents: members.flatMap(member => member!.parents), references, owner })
  }
  return diagnostics
}

function collectFiles(
  candidates: Map<string, FileCandidate>,
  observation: ScanObservation,
  placements: Map<string, WorldRecord[]>,
): void {
  for (const file of observation.files) {
    const candidate = candidates.get(file.file) ?? { file: file.file, parents: [], references: [] }
    candidate.parents.push(...file.roots.flatMap(id => placements.get(id) ?? []))
    const reference = scanReference(observation, file)
    if (!candidate.references.some(item => item.scanner === reference.scanner)) candidate.references.push(reference)
    candidates.set(file.file, candidate)
  }
}

function requirePlacement(file: string, parent: WorldRecord | undefined): WorldRecord {
  if (parent === undefined) throw new Error(`Cannot determine a system for ${file}; existing systems do not establish its ownership`)
  return parent
}

async function reconcileFiles(
  repositoryRoot: string,
  world: World,
  candidates: Map<string, FileCandidate>,
  summary: ScanSummary,
): Promise<void> {
  const unowned: Array<FileCandidate & { parent: WorldRecord }> = []
  for (const candidate of [...candidates.values()].sort((a, b) => a.file.localeCompare(b.file))) {
    const parent = commonParent(world, candidate.parents)
    const named = existingChild(world, 'component', sourceStem(candidate.file), parent)
    const draft = named?.status === 'draft' && named.code.length === 0 ? named : undefined
    const owner = candidate.owner ?? world.byCodeFile.get(candidate.file) ?? draft
    if (owner === undefined) {
      unowned.push({ ...candidate, parent: requirePlacement(candidate.file, parent) })
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

function sourceRootGroups(observation: ScanObservation): Map<ScanRoot, ScanRoot[]> {
  const byId = new Map(observation.roots.map(root => [root.id, root]))
  const memberships = new Set(observation.files.flatMap(file => file.roots))
  const groups = new Map<ScanRoot, ScanRoot[]>()
  for (const root of observation.roots.filter(root => memberships.has(root.id))) {
    let top = root
    while (top.parent !== undefined) top = byId.get(top.parent)!
    const members = groups.get(top) ?? []
    members.push(root)
    groups.set(top, members)
  }
  return groups
}

function namedPlacement(world: World, root: ScanRoot, system: WorldRecord | undefined): WorldRecord[] {
  if (system === undefined) return []
  return [existingChild(world, 'container', root.name, system) ?? system]
}

function observationPlacements(world: World, observation: ScanObservation): Map<string, WorldRecord[]> {
  const placements = new Map<string, WorldRecord[]>()
  for (const [top, roots] of sourceRootGroups(observation)) {
    const parents = new Map(roots.map(root => [root.id, sourceParents(world, observation, root)]))
    const systems = [...parents.values()].flat().flatMap(parent => systemFor(world, parent) ?? [])
    const system = systems.length > 0 ? onlyRecord(systems)
      : existingChild(world, 'system', top.name) ?? onlyRecord(internalSystems(world))
    for (const root of roots) {
      // Source groups can reuse an established boundary, but cannot establish a new one.
      const known = parents.get(root.id)!
      placements.set(root.id, known.length > 0 ? known : namedPlacement(world, root, system))
    }
  }
  return placements
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
  await createInitialSystem(repositoryRoot, world, observations, summary)
  const candidates = new Map<string, FileCandidate>()
  for (const observation of observations) {
    const placements = observationPlacements(world, observation)
    collectFiles(candidates, observation, placements)
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
