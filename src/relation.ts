import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { resolveFlows } from './flow-model.ts'
import {
  readDocument,
  withoutRelationship,
  withRelationship,
  writeDocument,
} from './markdown-emitter.ts'
import { requireText } from './naming.ts'
import type { ArchitectureElement, ArchitectureRelationship } from './types.ts'

/** The two ends of a relationship: the source owns the row, the target is what it uses. */
export interface RelationEnds {
  source: string
  target: string
}

export interface RelationInput extends RelationEnds {
  description?: string
  technology?: string
}

interface Ends {
  source: ArchitectureElement
  target: ArchitectureElement
  /** The row the source already holds for this target; one at most once Groma wrote it. */
  row: ArchitectureRelationship | undefined
}

interface Sentence {
  description: string
  technology: string
}

async function loadEnds(repositoryRoot: string, ends: RelationEnds): Promise<Ends> {
  const model = buildArchitectureModel((await loadArchitecture(repositoryRoot)).documents)
  const source = model.elements.find(element => element.id === ends.source)
  if (source === undefined) throw new Error(`unknown source "${ends.source}"`)
  const target = model.elements.find(element => element.id === ends.target)
  if (target === undefined) throw new Error(`unknown target "${ends.target}"`)
  const row = model.relationships.find(item => item.sourceId === source.id && item.targetId === target.id)
  return { source, target, row }
}

function requireRow(ends: Ends): ArchitectureRelationship {
  if (ends.row === undefined) throw new Error(`${ends.source.id} does not relate to ${ends.target.id}`)
  return ends.row
}

/** Rewrites the source document: the dropped row leaves and the added one joins the Relationships table. */
async function writeRow(
  repositoryRoot: string,
  ends: Ends,
  change: { drop?: ArchitectureRelationship; add?: Sentence },
): Promise<string> {
  const targetHref = path.posix.relative(path.posix.dirname(ends.source.sourceFilename), ends.target.sourceFilename)
  let document = await readDocument(repositoryRoot, ends.source.sourceFilename)
  if (change.drop !== undefined) {
    document = withoutRelationship(document, { targetHref, description: change.drop.description, technology: change.drop.technology })
  }
  if (change.add !== undefined) document = withRelationship(document, { targetName: ends.target.title, targetHref, ...change.add })
  await writeDocument(repositoryRoot, ends.source.sourceFilename, document)
  return ends.source.id
}

/** Writes the one relationship from the source to the target on the source document. */
export async function addRelation(repositoryRoot: string, input: RelationInput): Promise<string> {
  const description = requireText(input.description, '--description')
  const technology = requireText(input.technology, '--technology')
  const ends = await loadEnds(repositoryRoot, input)
  if (ends.row !== undefined) {
    throw new Error(
      `${ends.source.id} already relates to ${ends.target.id}; to reword it, run: groma edit relation ${ends.source.id} ${ends.target.id}`,
    )
  }
  return writeRow(repositoryRoot, ends, { add: { description, technology } })
}

/** Rewords the relationship; a flag left out keeps its current text. */
export async function editRelation(repositoryRoot: string, input: RelationInput): Promise<string> {
  if (input.description === undefined && input.technology === undefined) {
    throw new Error('--description or --technology is required')
  }
  const ends = await loadEnds(repositoryRoot, input)
  const current = requireRow(ends)
  return writeRow(repositoryRoot, ends, {
    drop: current,
    add: {
      description: input.description === undefined ? current.description : requireText(input.description, '--description'),
      technology: input.technology === undefined ? current.technology : requireText(input.technology, '--technology'),
    },
  })
}

export async function removeRelation(repositoryRoot: string, input: RelationEnds): Promise<string> {
  const records = await loadArchitecture(repositoryRoot)
  const flows = resolveFlows(records.flows, buildArchitectureModel(records.documents))
    .filter(flow => flow.steps.some(step => step.source === input.source && step.target === input.target))
  if (flows.length > 0) throw new Error(`cannot remove relationship: used by flows ${flows.map(flow => flow.id).join(', ')}`)
  const ends = await loadEnds(repositoryRoot, input)
  return writeRow(repositoryRoot, ends, { drop: requireRow(ends) })
}
