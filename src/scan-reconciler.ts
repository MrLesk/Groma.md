import { loadArchitecture } from './architecture-reader.ts'
import {
  renderObservedDocument,
  upsertCode,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { displayName, kebabCase } from './naming.ts'
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
    }
  })
}

function codeFileKey(scanner: string, file: string): string {
  return `${scanner}\0${file}`
}

export function architectureRelative(sourceFilename: string): string {
  if (sourceFilename.startsWith('groma/plans/')) {
    const slash = sourceFilename.indexOf('/', 'groma/plans/'.length)
    return sourceFilename.slice(slash + 1)
  }
  if (sourceFilename.startsWith('groma/observed/')) {
    return sourceFilename.slice('groma/observed/'.length)
  }
  return sourceFilename
}

function posixDirname(filename: string): string {
  const separator = filename.lastIndexOf('/')
  return separator === -1 ? '' : filename.slice(0, separator)
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

function indexWorld(revisions: RevisionRecord[]): World {
  const byId = new Map<string, WorldRecord>()
  const byCodeFile = new Map<string, WorldRecord>()

  for (const revision of revisions) {
    if (revision.revision.kind === 'missing') continue
    const origin: Origin = revision.revision.kind === 'plan' ? 'planned' : 'observed'
    for (const document of revision.documents) {
      const { id, kind, parent } = document.frontmatter
      if (typeof id !== 'string' || typeof kind !== 'string') continue
      if (!['actor', 'system', 'container', 'component'].includes(kind)) continue
      const record: WorldRecord = {
        id,
        kind: kind as C4Kind,
        parent,
        origin,
        sourceFilename: document.sourceFilename,
        code: readCode(document.frontmatter.code),
      }
      const existing = byId.get(id)
      if (existing === undefined || origin === 'planned') byId.set(id, record)
      for (const reference of record.code) {
        byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
      }
    }
  }
  return { byId, byCodeFile }
}

function observedPathFor(
  kind: C4Kind,
  id: string,
  parent?: WorldRecord,
): string {
  if (kind === 'actor') return `groma/observed/actors/${id}.md`
  if (kind === 'system') return `groma/observed/systems/${id}/system.md`
  if (parent === undefined) throw new Error(`missing parent for ${id}`)
  const parentDir = posixDirname(architectureRelative(parent.sourceFilename))
  if (kind === 'container') {
    return `groma/observed/${parentDir}/containers/${id}/container.md`
  }
  return `groma/observed/${parentDir}/components/${id}.md`
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
    sourceFilename: observedPathFor(input.kind, id, input.parent),
    code: input.code ?? [],
  }
  await writeObservedDocument(
    repositoryRoot,
    record.sourceFilename,
    renderObservedDocument({
      id,
      kind: input.kind,
      parent: input.parent?.id,
      name: input.name,
      responsibility: '',
      code: record.code,
    }),
  )
  world.byId.set(id, record)
  for (const reference of record.code) {
    world.byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
  }
  return record
}

function refreshedReference(reference: CodeReference, evidence: ScanFile): CodeReference {
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
): Promise<void> {
  const evidence = new Map<string, ScanFile>()
  for (const observation of observations) {
    for (const file of observation.files) {
      evidence.set(codeFileKey(observation.scanner.language, file.file), file)
    }
  }

  const records = [...new Set(world.byCodeFile.values())]
  for (const record of records) {
    if (!record.code.some(reference => evidence.has(codeFileKey(reference.scanner, reference.file)))) {
      continue
    }
    record.code = record.code.map(reference => {
      const file = evidence.get(codeFileKey(reference.scanner, reference.file))
      return file === undefined ? reference : refreshedReference(reference, file)
    })
    await upsertCode(repositoryRoot, record.sourceFilename, record.code)
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
  await upsertCode(repositoryRoot, record.sourceFilename, record.code)
  world.byCodeFile.set(codeFileKey(reference.scanner, reference.file), record)
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
    const symbol = file.symbols.length === 1 ? file.symbols[0]?.name : undefined
    const reference: CodeReference = {
      scanner: observation.scanner.language,
      file: file.file,
      ...(symbol === undefined ? {} : { symbol }),
    }
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
