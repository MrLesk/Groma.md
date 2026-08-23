import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import type {
  AnnotatedArchitectureModel,
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureDocument,
  ArchitectureViewModel,
  FilesystemAccessHandler,
  Origin,
  Revision,
  RevisionRecord,
} from './types.ts'

export { acceptGhost, type AcceptResult } from './accept.ts'
export { foldScanResult } from './scan-reconciler.ts'

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
): {
  elements: AnnotatedElement[]
  relationships: Omit<AnnotatedRelationship, 'id'>[]
} {
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
        ...(element.technology === undefined ? {} : { technology: element.technology }),
        code: element.code,
        origin,
        ...(plan ? { plan } : {}),
      })),
    relationships: model.relationships
      .filter(relationship => suppliedIds.has(relationship.sourceId))
      .map<Omit<AnnotatedRelationship, 'id'>>(relationship => ({
        source: ownRepresentation(relationship.sourceId),
        target: resolvedRepresentation(relationship.targetId),
        description: relationship.description,
        technology: relationship.technology,
        origin,
        ...(plan ? { plan } : {}),
      })),
  }
}

export function annotateArchitecture(
  revisions: readonly RevisionRecord[],
): AnnotatedArchitectureModel {
  const observed = revisions.find(record => record.revision.kind === 'observed')
  if (!observed) throw new Error('Observed architecture revision is required')
  const annotated = revisions.map(record => annotateRevision(observed, record))
  const elements = annotated.flatMap(model => model.elements)

  return {
    plans: revisions.flatMap(record => {
      return record.revision.kind === 'plan' ? [record.revision.name] : []
    }),
    elements: withDirectChildren(elements),
    relationships: annotated
      .flatMap(model => model.relationships)
      .map((relationship, index) => ({ id: `relationship:${index}`, ...relationship })),
  }
}

/** Weighs each element by the lines of its code files; an unreadable file counts 0. */
async function attachCodeLines(
  repositoryRoot: string,
  elements: AnnotatedElement[],
): Promise<void> {
  const files = new Set(elements.flatMap(element => element.code.map(ref => ref.file)))
  const lineCounts = new Map<string, number>()
  await Promise.all([...files].map(async file => {
    try {
      const text = await readFile(path.join(repositoryRoot, file), 'utf8')
      lineCounts.set(file, text.split('\n').length)
    } catch {
      lineCounts.set(file, 0)
    }
  }))
  for (const element of elements) {
    const own = new Set(element.code.map(ref => ref.file))
    element.codeLines = [...own].reduce((total, file) => total + (lineCounts.get(file) ?? 0), 0)
  }
}

export async function loadAnnotatedArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<AnnotatedArchitectureModel> {
  const model = annotateArchitecture(await loadArchitecture(repositoryRoot, options))
  await attachCodeLines(repositoryRoot, model.elements)
  return model
}

export async function loadArchitectureViewModel(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<ArchitectureViewModel> {
  const model = await loadAnnotatedArchitecture(repositoryRoot, options)
  const { layoutArchitectureWorld } = await import('./world-layout.ts')
  return {
    ...model,
    world: await layoutArchitectureWorld(model),
  }
}
