import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { resolveFlows } from './flow-model.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  readDocument,
  withoutRelationship,
  withRelationship,
  writeDocument,
  validateElementSource,
} from './markdown-emitter.ts'
import { requireText } from './naming.ts'
import { RELATIONSHIPS_TYPE } from './okf-profile.ts'
import { storedConnections } from './relationship-markdown.ts'
import { fileOwners } from './source-relationships.ts'
import type { ArchitectureDocument, ArchitectureElement, RelationshipConnection, ElementStatus } from './types.ts'

/** Code interactions use repository-relative files; actor/external declarations may use concept IDs. */
export interface RelationEnds {
  source: string
  target: string
}

export interface RelationInput extends RelationEnds {
  description?: string
  technology?: string
}

interface Ends {
  documents: ArchitectureDocument[]
  records: Awaited<ReturnType<typeof loadArchitecture>>
  model: ReturnType<typeof buildArchitectureModel>
  input: RelationEnds
  source: ArchitectureElement
  target: ArchitectureElement
  row: RelationshipConnection | undefined
}

type Sentence = Pick<RelationshipConnection, 'description' | 'technology' | 'status'>

async function loadEnds(repositoryRoot: string, input: RelationEnds): Promise<Ends> {
  const records = await loadArchitecture(repositoryRoot)
  const { documents } = records
  const model = buildArchitectureModel(documents)
  const owners = fileOwners(model.elements)
  const source = owners.get(input.source) ?? model.elements.find(element => element.id === input.source)
  if (!source) throw new Error(`unknown source "${input.source}"`)
  const target = owners.get(input.target) ?? model.elements.find(element => element.id === input.target)
  if (!target) throw new Error(`unknown target "${input.target}"`)
  const declaredConcept = [source, target].some(element => element.kind === 'actor' || element.external)
  if (!declaredConcept && (!owners.has(input.source) || !owners.has(input.target))) {
    throw new Error('code relationships require source-file endpoints')
  }
  const connections = storedConnections(documents, model.elements, (_code, filename, message) => {
    throw new Error(`${filename}: ${message}`)
  })
  const row = [...connections].sort((left, right) => Number(right.authored) - Number(left.authored))
    .find(item => item.source === input.source && item.target === input.target)
  return { documents, records, model, input, source, target, row }
}

function requireRow(ends: Ends): RelationshipConnection {
  if (!ends.row) throw new Error(`${ends.input.source} does not relate to ${ends.input.target}`)
  return ends.row
}

function endpointLink(value: string, element: ArchitectureElement, filename: string): { name: string; href: string } {
  const isFile = element.code.some(reference => reference.file === value)
  return {
    name: isFile ? value : element.title,
    href: path.posix.relative(path.posix.dirname(filename), isFile ? value : element.sourceFilename),
  }
}

async function writeRow(
  repositoryRoot: string,
  ends: Ends,
  change: { drop?: RelationshipConnection; add?: Sentence },
): Promise<string> {
  const filename = GromaFileSystem.open(repositoryRoot).sourceFilename('relationships.md')
  const source = endpointLink(ends.input.source, ends.source, filename)
  const target = endpointLink(ends.input.target, ends.target, filename)
  let document = ends.documents.some(record => record.sourceFilename === filename)
    ? await readDocument(repositoryRoot, filename)
    : `---\ntype: ${RELATIONSHIPS_TYPE}\ntitle: Architecture relationships\n---\n`
  const links = { sourceName: source.name, sourceHref: source.href, targetName: target.name, targetHref: target.href }
  if (change.drop) document = withoutRelationship(document, { ...links, ...change.drop })
  if (change.add) document = withRelationship(document, { ...links, ...change.add })
  await validateElementSource(ends.documents, filename, document)
  await writeDocument(repositoryRoot, filename, document)
  return ends.source.id
}

/** Authored text takes ownership of the current interaction for these exact endpoints. */
export async function addRelation(repositoryRoot: string, input: RelationInput, status: ElementStatus = 'stable'): Promise<string> {
  const description = requireText(input.description, '--description')
  const technology = requireText(input.technology, '--technology')
  const ends = await loadEnds(repositoryRoot, input)
  if (ends.row?.authored) throw new Error(`${input.source} already relates to ${input.target}; use groma edit relation`)
  return writeRow(repositoryRoot, ends, { drop: status === 'stable' ? ends.row : undefined, add: { description, technology, status } })
}

export async function editRelation(repositoryRoot: string, input: RelationInput): Promise<string> {
  if (input.description === undefined && input.technology === undefined) {
    throw new Error('--description or --technology is required')
  }
  const ends = await loadEnds(repositoryRoot, input)
  const current = requireRow(ends)
  return writeRow(repositoryRoot, ends, {
    drop: current,
    add: {
      status: current.status,
      description: input.description === undefined ? current.description : requireText(input.description, '--description'),
      technology: input.technology === undefined ? current.technology : requireText(input.technology, '--technology'),
    },
  })
}

export async function acceptRelation(repositoryRoot: string, input: RelationEnds): Promise<string> {
  const ends = await loadEnds(repositoryRoot, input)
  const current = requireRow(ends)
  if (!current.authored || current.status !== 'draft') throw new Error('not a draft relationship')
  return writeRow(repositoryRoot, ends, { drop: current, add: { ...current, status: 'stable' } })
}

export async function removeRelation(repositoryRoot: string, input: RelationEnds): Promise<string> {
  const ends = await loadEnds(repositoryRoot, input)
  const current = requireRow(ends)
  const flows = resolveFlows(ends.records.flows, ends.model)
    .filter(flow => flow.steps.some(step => step.source === ends.source.id && step.target === ends.target.id))
  if (flows.length) throw new Error(`cannot remove relationship: used by flows ${flows.map(flow => flow.id).join(', ')}`)
  if (!current.authored || current.status !== 'draft') throw new Error('only draft relationships can be removed')
  return writeRow(repositoryRoot, ends, { drop: current })
}
