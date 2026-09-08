import { existsSync } from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'

import { detectDuplicatedLogic, rememberArchitectureFindings } from './architecture-findings.ts'
import { isReservedDocument } from './architecture-path.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { architectureElementPath } from './architecture-path.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  renderArchitectureDocument,
  upsertCode,
  writeDocument,
} from './markdown-emitter.ts'
import { displayName, kebabCase } from './naming.ts'
import { c4Kind, requireGromaMapping } from './okf-profile.ts'
import { refreshDerivedRelationships } from './relationship-inference.ts'
import type { ScanFile, ScanObservation, ScanScope } from '@groma/scanner'
import type {
  ArchitectureDocument,
  ArchitectureRecords,
  C4Kind,
  CodeReference,
  ElementStatus,
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

interface WorldRecord {
  id: string
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
    status: 'stable',
    sourceFilename: architectureElementPath({
      root: GromaFileSystem.open(repositoryRoot).sourceFilename(),
      kind: input.kind,
      id,
      parentSourceFilename: input.parent?.sourceFilename,
    }),
    code: input.code ?? [],
  }
  const name = isReservedDocument(`${kebabCase(input.name)}.md`)
    ? displayName(id)
    : input.name
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
): Promise<void> {
  const evidence = new Map<string, ScanFile>()
  const activeScanners = new Set(observations.map(observation => observation.scanner.language))
  for (const observation of observations) {
    for (const file of observation.files) {
      evidence.set(codeFileKey(observation.scanner.language, file.file), file)
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
      const missing = activeScanners.has(reference.scanner)
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
  scope: ScanScope,
): WorldRecord | undefined {
  const containers = observation.placements.flatMap(placement => {
    if (placement.scope !== scope.id) return []
    const owner = world.byCodeFile.get(placement.file)
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
): CodeReference {
  const symbol = file.symbols.length === 1 ? file.symbols[0]?.name : undefined
  return {
    scanner: observation.scanner.language,
    file: file.file,
    ...(symbol === undefined ? {} : { symbol }),
  }
}

async function reconcileFiles(
  repositoryRoot: string,
  world: World,
  observation: ScanObservation,
  containers: Map<string, WorldRecord>,
  summary: ScanSummary,
): Promise<void> {
  const placementByFile = new Map(observation.placements.map(placement => [
    placement.file,
    placement.scope,
  ]))
  const pending: Promise<unknown>[] = []
  for (const file of observation.files) {
    const owner = world.byCodeFile.get(file.file)
    if (owner !== undefined) {
      if (!owner.code.some(reference => reference.file === file.file && reference.scanner === observation.scanner.language)) {
        await attachReference(repositoryRoot, world, owner, scanReference(observation, file))
      }
      continue
    }
    const scope = placementByFile.get(file.file)
    const parent = scope === undefined ? undefined : containers.get(scope)
    if (parent === undefined) continue
    const reference = scanReference(observation, file)
    const name = fileDisplayName(file.file)
    const named = existingChild(world, 'component', name, parent)
    if (named?.status === 'draft' && named.code.length === 0) {
      pending.push(attachReference(repositoryRoot, world, named, reference))
      summary.matched += 1
    } else {
      pending.push(createRecord(repositoryRoot, world, {
        kind: 'component',
        name,
        parent,
        code: [reference],
      }))
      summary.created += 1
    }
    if (pending.length === 16) {
      await Promise.all(pending)
      pending.length = 0
    }
  }
  await Promise.all(pending)
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
  const owners = new Map([...world.byId.values()].flatMap(record => record.code.map(reference => [reference.file, record.id] as const)))
  const conflicts = await refreshDerivedRelationships(repositoryRoot, observations, owners)
  if (conflicts.length > 0) summary.evidenceConflicts = conflicts
  const findings = detectDuplicatedLogic(observations, owners)
  rememberArchitectureFindings(repositoryRoot, findings)
  if (findings.length > 0) summary.findings = findings.length
  return summary
}
