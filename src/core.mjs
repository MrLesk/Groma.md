import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.mjs'
import { loadArchitecture } from './architecture-reader.mjs'

function originFor(revision) {
  return revision.kind === 'plan' ? 'planned' : revision.kind
}

function representationId(origin, plan, elementId) {
  return plan
    ? `${origin}:${plan}:${elementId}`
    : `${origin}:${elementId}`
}

function relativeElementFilename(document, revision) {
  return path.posix.relative(
    revision.sourceDirectory,
    document.sourceFilename,
  )
}

function documentsResolvedAgainstObserved(observed, revisionRecord) {
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

function withDirectChildren(elements) {
  const childrenByParent = new Map()

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

function annotateRevision(observed, revisionRecord) {
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
  const ownRepresentation = elementId => representationId(origin, plan, elementId)
  const resolvedRepresentation = elementId => suppliedIds.has(elementId)
    ? ownRepresentation(elementId)
    : representationId('observed', undefined, elementId)

  return {
    elements: model.elements
      .filter(element => suppliedIds.has(element.id))
      .map(element => ({
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
        code: element.code,
        origin,
        ...(plan ? { plan } : {}),
      })),
    relationships: model.relationships
      .filter(relationship => suppliedIds.has(relationship.sourceId))
      .map(relationship => ({
        source: ownRepresentation(relationship.sourceId),
        target: resolvedRepresentation(relationship.targetId),
        description: relationship.description,
        technology: relationship.technology,
        origin,
        ...(plan ? { plan } : {}),
      })),
  }
}

export async function loadArchitectureViewModel(repositoryRoot, options = {}) {
  const revisions = await loadArchitecture(repositoryRoot, options)
  const observed = revisions.find(record => record.revision.kind === 'observed')
  const annotated = revisions.map(record => annotateRevision(observed, record))
  const elements = annotated.flatMap(model => model.elements)

  return {
    plans: revisions
      .filter(record => record.revision.kind === 'plan')
      .map(record => record.revision.name),
    elements: withDirectChildren(elements),
    relationships: annotated.flatMap(model => model.relationships),
  }
}
