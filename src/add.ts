import { buildArchitectureModel, freeId } from './architecture-model.ts'
import { architectureElementPath, draftRecordPath } from './architecture-path.ts'
import { loadArchitecture } from './architecture-reader.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  renderArchitectureDocument,
  renderDraftDocument,
  writeDocument,
} from './markdown-emitter.ts'
import { addGroup } from './group.ts'
import type { StructuralResult } from './curate.ts'
import { requireText } from './naming.ts'
import { addRelation } from './relation.ts'
import { addFlow } from './flow-authoring.ts'

export interface AddInput {
  thing: string
  /** The name of a person, an external or a draft, or the source id of a relation. */
  name: string
  /** With thing relation: the target id. */
  relation?: string
  /** With thing group: the member ids. */
  members?: string[]
  overview?: string
  description?: string
  technology?: string
  steps?: string
}

type DeclaredThing = 'actor' | 'external' | 'draft'

/** Kinds only a scan or an accepted draft creates, each with the parent flag its teaching sentence shows. */
const scannedKinds: Record<string, string> = {
  system: '',
  container: ' --parent <system-id>',
  component: ' --parent <container-id>',
}

function requireThing(thing: string, name: string): DeclaredThing {
  const parentHint = scannedKinds[thing]
  if (parentHint !== undefined) {
    throw new Error(
      `${thing}s are found by the scanner. To draft one, run: groma draft ${thing} "${name}"${parentHint}`,
    )
  }
  if (thing === 'actor' || thing === 'external' || thing === 'draft') return thing
  throw new Error('thing must be actor, external or draft')
}

function renderThing(thing: DeclaredThing, id: string, input: AddInput, overview: string): string {
  if (thing === 'draft') return renderDraftDocument({ id, title: input.name, outcome: overview })
  return renderArchitectureDocument({
    id,
    kind: thing === 'actor' ? 'actor' : 'system',
    technology: input.technology,
    name: input.name,
    description: input.description,
    overview,
    status: 'stable',
  })
}

/** Writes what no scan can see: a person, an outside system, or the record of a draft. */
export function addThing(repositoryRoot: string, input: AddInput & { thing: DeclaredThing | 'relation' | 'flow' }): Promise<string>
export function addThing(repositoryRoot: string, input: AddInput): Promise<string | StructuralResult>
export async function addThing(repositoryRoot: string, input: AddInput): Promise<string | StructuralResult> {
  if (input.thing === 'flow') return addFlow(repositoryRoot, requireText(input.name, 'name'), input)
  if (input.thing === 'relation') {
    return addRelation(repositoryRoot, {
      source: input.name,
      target: requireText(input.relation, 'target'),
      description: input.description,
      technology: input.technology,
    })
  }
  if (input.thing === 'group') return addGroup(repositoryRoot, { name: input.name, members: input.members ?? [] })
  const name = requireText(input.name, 'name')
  const thing = requireThing(input.thing, name)
  const overview = requireText(input.overview, '--overview')
  if (input.technology !== undefined && thing !== 'external') {
    throw new Error('--technology is only valid for an external')
  }
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const records = await loadArchitecture(repositoryRoot)
  const id = freeId(records, buildArchitectureModel(records.documents), name)
  const root = filesystem.sourceFilename()
  const destination = thing === 'draft'
    ? draftRecordPath(root, id)
    : architectureElementPath({ root, kind: thing === 'actor' ? 'actor' : 'system', id, external: thing === 'external' })
  if (filesystem.exists(filesystem.relative(destination))) {
    throw new Error(`architecture document already exists at ${destination}`)
  }
  await writeDocument(repositoryRoot, destination, renderThing(thing, id, input, overview))
  return id
}
