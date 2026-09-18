import { architectureElementPath } from './architecture-path.ts'
import type { GromaFileSystem } from './groma-filesystem.ts'
import { readDocument, withGromaField } from './markdown-emitter.ts'
import type { ArchitectureElement, ArchitectureModel, ArchitectureRecords } from './types.ts'

/** One architecture document a curation writes, at its current or its new path. */
export interface DocumentWrite {
  sourceFilename: string
  destinationFilename: string
  source: string
}

/** A document that stores one element. */
export interface Rewrite extends DocumentWrite {
  id: string
}

export interface CurationContext {
  filesystem: GromaFileSystem
  repositoryRoot: string
  records: ArchitectureRecords
  model: ArchitectureModel
  byId: Map<string, ArchitectureElement>
}

export function requireElement(
  byId: Map<string, ArchitectureElement>,
  id: string,
): ArchitectureElement {
  const element = byId.get(id)
  if (element === undefined) throw new Error(`unknown id "${id}"`)
  return element
}

/** Moves one element's document under a new parent path, with every document stored beneath it. */
export async function relocated(
  context: CurationContext,
  element: ArchitectureElement,
  parentSourceFilename: string,
  newParentId?: string,
): Promise<Rewrite[]> {
  const destinationFilename = architectureElementPath({
    root: context.filesystem.sourceFilename(),
    kind: element.kind,
    id: element.id,
    parentSourceFilename,
  })
  const stored = await readDocument(context.repositoryRoot, element.sourceFilename)
  const rewrites: Rewrite[] = [{
    id: element.id,
    sourceFilename: element.sourceFilename,
    destinationFilename,
    source: newParentId === undefined ? stored : withGromaField(stored, 'parent', newParentId),
  }]
  for (const child of context.model.elements.filter(item => item.parentId === element.id)) {
    rewrites.push(...await relocated(context, child, destinationFilename))
  }
  return rewrites
}
