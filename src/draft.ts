import {
  buildArchitectureModel,
  freeId,
  expectedParentKinds,
  requireDraftRecord,
} from './architecture-model.ts'
import { architectureElementPath } from './architecture-path.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import { renderArchitectureDocument, writeDocument } from './markdown-emitter.ts'
import { requireText } from './naming.ts'
import type { ArchitectureElement, C4Kind } from './types.ts'

export interface DraftElementInput {
  kind: string
  name: string
  parent?: string
  overview?: string
  description?: string
  technology?: string
  draft?: string
}

/** Only software is drafted: people and externals are declared, never drafted. */
const draftableKinds = new Set<C4Kind>(['system', 'container', 'component'])

function requireKind(kind: string): C4Kind {
  if (!draftableKinds.has(kind as C4Kind)) {
    throw new Error('kind must be system, container or component')
  }
  return kind as C4Kind
}

function resolveParent(
  byId: Map<string, ArchitectureElement>,
  kind: C4Kind,
  parentId: string | undefined,
): ArchitectureElement | undefined {
  const expectedParentKind = expectedParentKinds.get(kind)
  if (expectedParentKind === undefined) {
    if (parentId !== undefined) throw new Error('--parent is forbidden for a system')
    return undefined
  }
  if (parentId === undefined) throw new Error(`--parent is required for a ${kind}`)
  const parent = byId.get(parentId)
  if (parent === undefined) throw new Error(`unknown parent "${parentId}"`)
  if (parent.kind !== expectedParentKind) {
    throw new Error(
      `${kind} requires a ${expectedParentKind} parent, but "${parentId}" is a ${parent.kind}`,
    )
  }
  if (parent.external) throw new Error(`"${parentId}" is external and has no containers`)
  return parent
}

/** Writes a ghost at the path it will keep once accepted. */
export async function draftElement(
  repositoryRoot: string,
  input: DraftElementInput,
): Promise<string> {
  const name = requireText(input.name, 'name')
  const kind = requireKind(input.kind)
  if (input.overview === undefined) throw new Error('--overview is required')
  if (input.technology !== undefined && input.technology.trim().length === 0) {
    throw new Error('--technology must not be empty')
  }
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const records = await loadArchitecture(repositoryRoot)
  const model = buildArchitectureModel(records.documents)
  const byId = new Map(model.elements.map(element => [element.id, element]))
  const id = freeId(records, model, name)
  const draft = input.draft === undefined || input.draft === ''
    ? undefined
    : requireDraftRecord(records, input.draft)
  const parent = resolveParent(byId, kind, input.parent === '' ? undefined : input.parent)
  const destination = architectureElementPath({
    root: filesystem.sourceFilename(),
    kind,
    id,
    parentSourceFilename: parent?.sourceFilename,
  })
  if (filesystem.exists(filesystem.relative(destination))) {
    throw new Error(`architecture document already exists at ${destination}`)
  }

  await writeDocument(
    repositoryRoot,
    destination,
    renderArchitectureDocument({
      id,
      kind,
      parent: parent?.id,
      technology: input.technology,
      draft,
      name,
      description: input.description,
      overview: input.overview,
      status: 'draft',
    }),
  )
  return id
}
