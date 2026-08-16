import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { layoutArchitectureWorld } from './world-layout.ts'
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
    relationships: annotated.flatMap(model => model.relationships),
  }
}

export async function loadAnnotatedArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<AnnotatedArchitectureModel> {
  return annotateArchitecture(await loadArchitecture(repositoryRoot, options))
}

export async function loadArchitectureViewModel(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<ArchitectureViewModel> {
  const model = await loadAnnotatedArchitecture(repositoryRoot, options)
  return {
    ...model,
    world: await layoutArchitectureWorld(model),
  }
}
