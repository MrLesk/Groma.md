import { loadArchitecture } from './architecture-reader.ts'
import { architectureElementPath } from './architecture-path.ts'
import {
  renderArchitectureDocument,
  upsertCode,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { displayName, kebabCase } from './naming.ts'
import { c4Kind, requireGromaMapping } from './okf-profile.ts'
import type { ScanFile, ScanObservation, ScanScope } from './scanner/observation.ts'
import type {
  C4Kind,
  CodeReference,
  Origin,
  RevisionRecord,
  ScanSummary,
} from './types.ts'

function fileDisplayName(filename: string): string {
  const stem = filename.split('/').at(-1)?.replace(/\.[^.]+$/, '') ?? filename
  return displayName(kebabCase(stem))
}

export function readCode(value: unknown): CodeReference[] {
  if (!Array.isArray(value)) return []
  return value.map(entry => {
    const reference = entry as CodeReference
    return {
      scanner: reference.scanner,
      file: reference.file,
      ...(Object.hasOwn(reference, 'symbol') ? { symbol: reference.symbol } : {}),
      ...(Object.hasOwn(reference, 'dependencies') ? { dependencies: reference.dependencies } : {}),
      ...(Object.hasOwn(reference, 'dependents') ? { dependents: reference.dependents } : {}),
    }
  })
}

interface SourceCounts {
  dependencies: number
  dependents: number
}

function sourceCounts(observation: ScanObservation): Map<string, SourceCounts> {
  const counts = new Map(observation.files.map(file => [
    file.file,
    { dependencies: 0, dependents: 0 },
  ]))
  for (const relationship of observation.relationships) {
    if (relationship.kind !== 'source-dependency') continue
    const source = counts.get(relationship.source)
    const target = counts.get(relationship.target)
    if (source === undefined || target === undefined) continue
    source.dependencies += 1
    target.dependents += 1
  }
  return counts
}

function codeFileKey(scanner: string, file: string): string {
  return `${scanner}\0${file}`
}

interface WorldRecord {
  id: string
  kind: C4Kind
  parent?: string | null
  origin: Origin
  sourceFilename: string
  code: CodeReference[]
}

interface World {
  byId: Map<string, WorldRecord>
  byCodeFile: Map<string, WorldRecord>
}

function worldRecord(
  document: RevisionRecord['documents'][number],
  origin: Origin,
): WorldRecord | undefined {
  const groma = requireGromaMapping(document.frontmatter, document.sourceFilename)
  const { id, parent } = groma
  const kind = c4Kind(document.frontmatter.type)
  if (typeof id !== 'string' || kind === undefined) return undefined
  if (parent !== undefined && parent !== null && typeof parent !== 'string') return undefined
  return {
    id,
    kind,
    parent,
    origin,
    sourceFilename: document.sourceFilename,
    code: readCode(groma.code),
  }
}

function indexRevision(revision: RevisionRecord, world: World): void {
  if (revision.revision.kind === 'missing') return
  const origin: Origin = revision.revision.kind === 'plan' ? 'planned' : 'observed'
  for (const document of revision.documents) {
    const record = worldRecord(document, origin)
    if (record === undefined) continue
    const existing = world.byId.get(record.id)
    if (existing === undefined || origin === 'planned') world.byId.set(record.id, record)
    for (const reference of record.code) {
      world.byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
    }
  }
}

function indexWorld(revisions: RevisionRecord[]): World {
  const world: World = { byId: new Map(), byCodeFile: new Map() }
  for (const revision of revisions) indexRevision(revision, world)
  return world
}

function availableId(world: World, name: string, parent?: WorldRecord): string {
  const base = kebabCase(name) || 'source'
  const existing = world.byId.get(base)
  if (existing === undefined) return base
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
    name: string
    parent?: WorldRecord
    code?: CodeReference[]
  },
): Promise<WorldRecord> {
  const id = availableId(world, input.name, input.parent)
  const record: WorldRecord = {
    id,
    kind: input.kind,
    parent: input.parent?.id,
    origin: 'observed',
    sourceFilename: architectureElementPath({
      root: 'groma/observed',
      kind: input.kind,
      id,
      parentSourceFilename: input.parent?.sourceFilename,
    }),
    code: input.code ?? [],
  }
  await writeObservedDocument(
    repositoryRoot,
    record.sourceFilename,
    renderArchitectureDocument({
      id,
      kind: input.kind,
      parent: input.parent?.id,
      name: input.name,
      overview: '',
      status: 'stable',
      code: record.code,
    }),
  )
  world.byId.set(id, record)
  for (const reference of record.code) {
    world.byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
  }
  return record
}

function refreshedReference(
  reference: CodeReference,
  evidence: ScanFile,
  counts: SourceCounts,
): CodeReference {
  const exact = evidence.symbols.find(symbol => {
    return symbol.id === reference.symbol || symbol.name === reference.symbol
  })
  const symbol = exact ?? (evidence.symbols.length === 1 ? evidence.symbols[0] : undefined)
  return {
    scanner: reference.scanner,
    file: reference.file,
    ...(symbol === undefined ? {} : { symbol: symbol.name }),
    ...counts,
  }
}

async function refreshCuratedCode(
  repositoryRoot: string,
  world: World,
  observations: ScanObservation[],
  summary: ScanSummary,
): Promise<void> {
  const evidence = new Map<string, { file: ScanFile; counts: SourceCounts }>()
  for (const observation of observations) {
    const counts = sourceCounts(observation)
    for (const file of observation.files) {
      evidence.set(codeFileKey(observation.scanner.language, file.file), {
        file,
        counts: counts.get(file.file)!,
      })
    }
  }

  const records = [...new Set(world.byCodeFile.values())]
  for (const record of records) {
    if (!record.code.some(reference => evidence.has(codeFileKey(reference.scanner, reference.file)))) {
      continue
    }
    record.code = record.code.map(reference => {
      const found = evidence.get(codeFileKey(reference.scanner, reference.file))
      return found === undefined ? reference : refreshedReference(reference, found.file, found.counts)
    })
    await upsertCode(
      repositoryRoot,
      record.sourceFilename,
      record.code,
      record.origin === 'planned' ? 'draft' : 'stable',
    )
    if (record.origin === 'planned') summary.matched += 1
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
  scope: ScanScope,
): WorldRecord | undefined {
  const containers = observation.placements.flatMap(placement => {
    if (placement.scope !== scope.id) return []
    const owner = world.byCodeFile.get(codeFileKey(observation.scanner.language, placement.file))
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
  record.code = [...record.code, reference]
  await upsertCode(
    repositoryRoot,
    record.sourceFilename,
    record.code,
    record.origin === 'planned' ? 'draft' : 'stable',
  )
  world.byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
}

async function observationSystem(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  inferred: Map<string, WorldRecord | undefined>,
  summary: ScanSummary,
): Promise<WorldRecord> {
  let system = mostFrequent([...inferred.values()].flatMap(record => {
    const candidate = systemFor(world, record)
    return candidate === undefined ? [] : [candidate]
  }))
  system ??= existingChild(world, 'system', observation.root.name)
  if (system === undefined) {
    system = await createRecord(repositoryRoot, world, {
      kind: 'system',
      name: observation.root.name,
    })
    summary.created += 1
  }
  return system
}

async function observationContainers(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  system: WorldRecord,
  inferred: Map<string, WorldRecord | undefined>,
  summary: ScanSummary,
): Promise<Map<string, WorldRecord>> {
  const containers = new Map<string, WorldRecord>()
  for (const scope of observation.scopes) {
    let container = inferred.get(scope.id)
      ?? existingChild(world, 'container', scope.name, system)
    if (container === undefined) {
      container = await createRecord(repositoryRoot, world, {
        kind: 'container',
        name: scope.name,
        parent: system,
      })
      summary.created += 1
    }
    containers.set(scope.id, container)
  }
  return containers
}

function scanReference(
  observation: ScanObservation,
  file: ScanFile,
  counts: Map<string, SourceCounts>,
): CodeReference {
  const symbol = file.symbols.length === 1 ? file.symbols[0]?.name : undefined
  return {
    scanner: observation.scanner.language,
    file: file.file,
    ...(symbol === undefined ? {} : { symbol }),
    ...counts.get(file.file)!,
  }
}

async function reconcileFiles(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  containers: Map<string, WorldRecord>,
  summary: ScanSummary,
): Promise<void> {
  const counts = sourceCounts(observation)
  const placementByFile = new Map(observation.placements.map(placement => [
    placement.file,
    placement.scope,
  ]))
  for (const file of observation.files) {
    const key = codeFileKey(observation.scanner.language, file.file)
    if (world.byCodeFile.has(key)) continue
    const scope = placementByFile.get(file.file)
    const parent = scope === undefined ? undefined : containers.get(scope)
    if (parent === undefined) continue
    const reference = scanReference(observation, file, counts)
    const name = fileDisplayName(file.file)
    const named = existingChild(world, 'component', name, parent)
    if (named?.origin === 'planned' && named.code.length === 0) {
      await attachReference(repositoryRoot, world, named, reference)
      summary.matched += 1
      continue
    }
    await createRecord(repositoryRoot, world, {
      kind: 'component',
      name,
      parent,
      code: [reference],
    })
    summary.created += 1
  }
}

async function reconcileObservation(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  summary: ScanSummary,
): Promise<void> {
  const inferred = new Map(observation.scopes.map(scope => [
    scope.id,
    inferredContainer(world, observation, scope),
  ]))
  const system = await observationSystem(
    repositoryRoot,
    world,
    observation,
    inferred,
    summary,
  )
  const containers = await observationContainers(
    repositoryRoot,
    world,
    observation,
    system,
    inferred,
    summary,
  )
  await reconcileFiles(repositoryRoot, world, observation, containers, summary)
}

export async function reconcileScanObservations(
  repositoryRoot: string,
  observations: ScanObservation[],
): Promise<ScanSummary> {
  const world = indexWorld(await loadArchitecture(repositoryRoot))
  const summary: ScanSummary = { created: 0, refreshed: 0, matched: 0 }
  await refreshCuratedCode(repositoryRoot, world, observations, summary)
  for (const observation of observations) {
    await reconcileObservation(repositoryRoot, world, observation, summary)
  }
  return summary
}
