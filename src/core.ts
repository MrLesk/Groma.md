import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import {
  renderObservedDocument,
  upsertCode,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { layoutArchitectureWorld } from './world-layout.ts'
import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureDocument,
  ArchitectureViewModel,
  CodeReference,
  FilesystemAccessHandler,
  Origin,
  Revision,
  RevisionRecord,
  ScanCandidate,
  ScanResult,
  ScanSummary,
} from './types.ts'

function originFor(revision: Revision): Origin {
  return revision.kind === 'plan' ? 'planned' : revision.kind
}

function representationId(
  origin: Origin,
  plan: string | undefined,
  elementId: string,
): string {
  return plan
    ? `${origin}:${plan}:${elementId}`
    : `${origin}:${elementId}`
}

function relativeElementFilename(
  document: ArchitectureDocument,
  revision: Revision,
): string {
  return path.posix.relative(
    revision.sourceDirectory,
    document.sourceFilename,
  )
}

function documentsResolvedAgainstObserved(
  observed: RevisionRecord,
  revisionRecord: RevisionRecord,
): ArchitectureDocument[] {
  if (revisionRecord.revision.kind === 'observed') {
    return revisionRecord.documents
  }

  const suppliedIds = new Set(
    revisionRecord.documents.map(document => document.frontmatter.id),
  )
  const fallbackDocuments = observed.documents
    .filter(document => !suppliedIds.has(document.frontmatter.id))
    .map(document => ({
      ...document,
      sourceFilename: path.posix.join(
        revisionRecord.revision.sourceDirectory,
        relativeElementFilename(document, observed.revision),
      ),
    }))

  return [...fallbackDocuments, ...revisionRecord.documents]
}

function withDirectChildren(elements: AnnotatedElement[]): AnnotatedElement[] {
  const childrenByParent = new Map<string, string[]>()

  for (const element of elements) {
    if (element.parent === null) continue
    const children = childrenByParent.get(element.parent) ?? []
    children.push(element.representationId)
    childrenByParent.set(element.parent, children)
  }

  return elements.map(element => ({
    ...element,
    children: (childrenByParent.get(element.representationId) ?? []).sort(),
  }))
}

function annotateRevision(
  observed: RevisionRecord,
  revisionRecord: RevisionRecord,
): Pick<AnnotatedArchitectureModel, 'elements' | 'relationships'> {
  const origin = originFor(revisionRecord.revision)
  const plan = revisionRecord.revision.kind === 'plan'
    ? revisionRecord.revision.name
    : undefined
  const suppliedIds = new Set(
    revisionRecord.documents.map(document => document.frontmatter.id),
  )
  const model = buildArchitectureModel({
    revision: revisionRecord.revision,
    documents: documentsResolvedAgainstObserved(observed, revisionRecord),
  })
  const ownRepresentation = (elementId: string) => {
    return representationId(origin, plan, elementId)
  }
  const resolvedRepresentation = (elementId: string) => suppliedIds.has(elementId)
    ? ownRepresentation(elementId)
    : representationId('observed', undefined, elementId)

  return {
    elements: model.elements
      .filter(element => suppliedIds.has(element.id))
      .map<AnnotatedElement>(element => ({
        representationId: ownRepresentation(element.id),
        id: element.id,
        kind: element.kind,
        name: element.name,
        description: element.description,
        parent: element.parentId === null
          ? null
          : resolvedRepresentation(element.parentId),
        children: [],
        external: element.external,
        ...(element.group === undefined ? {} : { group: element.group }),
        code: element.code,
        origin,
        ...(plan ? { plan } : {}),
      })),
    relationships: model.relationships
      .filter(relationship => suppliedIds.has(relationship.sourceId))
      .map<AnnotatedRelationship>(relationship => ({
        source: ownRepresentation(relationship.sourceId),
        target: resolvedRepresentation(relationship.targetId),
        description: relationship.description,
        technology: relationship.technology,
        origin,
        ...(plan ? { plan } : {}),
      })),
  }
}

function kebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readCode(value: unknown): CodeReference[] {
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

function codeKey(reference: CodeReference): string {
  return `${reference.scanner}\0${reference.file}\0${reference.symbol ?? ''}`
}

function codeFileKey(reference: CodeReference): string {
  return `${reference.scanner}\0${reference.file}`
}

function architectureRelative(sourceFilename: string): string {
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
  origin: Origin
  sourceFilename: string
  code: CodeReference[]
}

function observedPathFor(
  candidate: ScanCandidate,
  id: string,
  parent: WorldRecord | undefined,
): string {
  if (candidate.kind === 'person') {
    return `groma/observed/people/${id}.md`
  }
  if (candidate.kind === 'system') {
    return `groma/observed/systems/${id}/system.md`
  }
  if (parent === undefined) {
    throw new Error(`missing parent for ${id}`)
  }
  const parentDir = posixDirname(architectureRelative(parent.sourceFilename))
  if (candidate.kind === 'container') {
    return `groma/observed/${parentDir}/containers/${id}/container.md`
  }
  return `groma/observed/${parentDir}/components/${id}.md`
}

function indexWorld(revisions: RevisionRecord[]) {
  const byId = new Map<string, WorldRecord>()
  const byCode = new Map<string, string>()
  const byCodeFile = new Map<string, string>()

  for (const record of revisions) {
    if (record.revision.kind === 'missing') continue
    const origin: Origin = record.revision.kind === 'plan' ? 'planned' : 'observed'
    for (const document of record.documents) {
      const id = document.frontmatter.id
      if (typeof id !== 'string') continue
      const worldRecord: WorldRecord = {
        id,
        origin,
        sourceFilename: document.sourceFilename,
        code: readCode(document.frontmatter.code),
      }
      const existing = byId.get(id)
      if (existing === undefined || origin === 'planned') {
        byId.set(id, worldRecord)
      }
      for (const reference of worldRecord.code) {
        byCode.set(codeKey(reference), id)
        byCodeFile.set(codeFileKey(reference), id)
      }
    }
  }

  return { byId, byCode, byCodeFile }
}

function matchCandidate(
  world: ReturnType<typeof indexWorld>,
  candidate: ScanCandidate,
): WorldRecord | undefined {
  for (const reference of candidate.code ?? []) {
    const id = world.byCode.get(codeKey(reference))
      ?? world.byCodeFile.get(codeFileKey(reference))
    if (id !== undefined) return world.byId.get(id)
  }
  return world.byId.get(kebabCase(candidate.name))
}

export async function foldScanResult(
  repositoryRoot: string,
  scanResult: ScanResult,
): Promise<ScanSummary> {
  const world = indexWorld(await loadArchitecture(repositoryRoot))
  const summary: ScanSummary = { created: 0, refreshed: 0, matched: 0 }

  for (const candidate of scanResult.candidates) {
    const match = matchCandidate(world, candidate)
    const code = candidate.code ?? []
    if (match !== undefined) {
      await upsertCode(repositoryRoot, match.sourceFilename, code)
      if (match.origin === 'planned') summary.matched += 1
      else summary.refreshed += 1
      continue
    }

    const id = kebabCase(candidate.name)
    const parentId = candidate.parent === undefined
      ? undefined
      : kebabCase(candidate.parent)
    const parent = parentId === undefined ? undefined : world.byId.get(parentId)
    const sourceFilename = observedPathFor(candidate, id, parent)
    await writeObservedDocument(
      repositoryRoot,
      sourceFilename,
      renderObservedDocument({
        id,
        kind: candidate.kind,
        parent: parent?.id ?? parentId,
        name: candidate.name,
        responsibility: candidate.responsibility,
        code,
      }),
    )
    const created: WorldRecord = {
      id,
      origin: 'observed',
      sourceFilename,
      code,
    }
    world.byId.set(id, created)
    for (const reference of code) {
      world.byCode.set(codeKey(reference), id)
      world.byCodeFile.set(codeFileKey(reference), id)
    }
    summary.created += 1
  }

  return summary
}

export async function loadArchitectureViewModel(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<ArchitectureViewModel> {
  const revisions = await loadArchitecture(repositoryRoot, options)
  const observed = revisions.find(record => record.revision.kind === 'observed')
  if (!observed) throw new Error('Observed architecture revision is required')
  const annotated = revisions.map(record => annotateRevision(observed, record))
  const elements = annotated.flatMap(model => model.elements)

  const model = {
    plans: revisions.flatMap(record => {
      return record.revision.kind === 'plan' ? [record.revision.name] : []
    }),
    elements: withDirectChildren(elements),
    relationships: annotated.flatMap(model => model.relationships),
  }

  return {
    ...model,
    world: await layoutArchitectureWorld(model),
  }
}
