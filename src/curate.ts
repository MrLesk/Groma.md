import { parseFrontmatter, parseMarkdown } from 'comark'

import { architectureElementPath } from './architecture-path.ts'
import { buildArchitectureModel, expectedParentKinds } from './architecture-model.ts'
import { resolveFlows } from './flow-model.ts'
import { requireGromaMapping } from './okf-profile.ts'
import { GromaFileSystem } from './groma-filesystem.ts'
import {
  readDocument,
  removeDocument,
  withGromaCode,
  withGromaField,
  withMeaning,
  writeDocument,
} from './markdown-emitter.ts'
import type { MeaningChanges } from './markdown-emitter.ts'
import type {
  ArchitectureDocument,
  ArchitectureElement,
  ArchitectureModel,
  ArchitectureRecords,
  CodeReference,
} from './types.ts'

export interface CurateInput extends MeaningChanges {
  id: string
  group?: string
  ungroup?: boolean
  parent?: string
  combine?: string[]
  /** Source files whose Code references leave the component; the next scan gives them owners. */
  detach?: string[]
}

/** Facts from a completed structural write; paths are repository-relative. */
export interface StructuralResult {
  id: string
  created: string[]
  /** Existing documents rewritten by the operation, even when their bytes stay identical. */
  changed: string[]
  removed: string[]
  affectedIds: string[]
  replacements: Array<{ absorbedId: string; survivingId: string }>
}

interface Rewrite {
  id: string
  sourceFilename: string
  destinationFilename: string
  source: string
}

interface CurationContext {
  filesystem: GromaFileSystem
  repositoryRoot: string
  records: ArchitectureRecords
  model: ArchitectureModel
  byId: Map<string, ArchitectureElement>
}

interface CurationChange {
  targetSource: string
  rewrites: Rewrite[]
  removals: ArchitectureElement[]
}

function requiresEmptyMeaning(source: string, id: string): void {
  if (parseFrontmatter(source).content.trim() !== '') {
    throw new Error(`cannot structurally replace "${id}" because it has authored meaning`)
  }
}

function requireUnrelated(
  relationships: ArchitectureModel['relationships'],
  ids: Set<string>,
): void {
  const relationship = relationships.find(entry => {
    return entry.connections.some(connection => connection.authored
      && (ids.has(connection.source) || ids.has(connection.target)))
  })
  if (relationship !== undefined) {
    throw new Error(
      `cannot structurally replace "${relationship.sourceId}" or "${relationship.targetId}" `
      + 'while it owns an authored relationship',
    )
  }
}

/** Every element stored under this one, at any depth. */
function descendants(model: ArchitectureModel, id: string): ArchitectureElement[] {
  const children = model.elements.filter(element => element.parentId === id)
  return [...children, ...children.flatMap(child => descendants(model, child.id))]
}

function subtreeIds(model: ArchitectureModel, id: string): string[] {
  return [id, ...descendants(model, id).map(element => element.id)]
}

function codeKey(reference: CodeReference): string {
  return `${reference.scanner}\0${reference.file}`
}

function combinedCode(elements: ArchitectureElement[]): CodeReference[] {
  const byFile = new Map<string, CodeReference>()
  for (const element of elements) {
    for (const reference of element.code) byFile.set(codeKey(reference), reference)
  }
  return [...byFile.values()]
}

function validateDestinations(
  filesystem: GromaFileSystem,
  rewrites: Rewrite[],
): void {
  const sources = new Set(rewrites.map(rewrite => rewrite.sourceFilename))
  const destinations = new Set<string>()
  for (const rewrite of rewrites) {
    const destination = rewrite.destinationFilename
    if (destinations.has(destination)) {
      throw new Error(`multiple elements would be written to ${destination}`)
    }
    destinations.add(destination)
    if (
      destination !== rewrite.sourceFilename
      && !sources.has(destination)
      && filesystem.exists(filesystem.relative(destination))
    ) {
      throw new Error(`architecture document already exists at ${destination}`)
    }
  }
}

async function applyRewrites(
  repositoryRoot: string,
  rewrites: Rewrite[],
  removals: string[],
): Promise<Pick<StructuralResult, 'created' | 'changed' | 'removed'>> {
  const sources = new Set([...rewrites.map(rewrite => rewrite.sourceFilename), ...removals])
  const created: string[] = []
  const changed: string[] = []
  const removed: string[] = []
  for (const rewrite of rewrites) {
    await writeDocument(
      repositoryRoot,
      rewrite.destinationFilename,
      rewrite.source,
    )
    ;(sources.has(rewrite.destinationFilename) ? changed : created).push(rewrite.destinationFilename)
  }
  const destinations = new Set(rewrites.map(rewrite => rewrite.destinationFilename))
  for (const sourceFilename of new Set([
    ...rewrites.flatMap(rewrite => rewrite.sourceFilename === rewrite.destinationFilename
      ? []
      : [rewrite.sourceFilename]),
    ...removals,
  ])) {
    if (!destinations.has(sourceFilename)) {
      await removeDocument(repositoryRoot, sourceFilename)
      removed.push(sourceFilename)
    }
  }
  return { created, changed, removed }
}

function requireElement(
  byId: Map<string, ArchitectureElement>,
  id: string,
): ArchitectureElement {
  const element = byId.get(id)
  if (element === undefined) throw new Error(`unknown id "${id}"`)
  return element
}

function validateCurationInput(input: CurateInput): void {
  if (input.group !== undefined && input.ungroup === true) {
    throw new Error('--group and --ungroup cannot be used together')
  }
  if (input.group !== undefined && input.group.trim() === '') {
    throw new Error('--group requires non-empty text')
  }
  if (input.parent !== undefined && (input.combine?.length ?? 0) > 0) {
    throw new Error('--parent and --combine must be separate edits')
  }
  if ((input.detach?.length ?? 0) > 0 && (input.combine?.length ?? 0) > 0) {
    throw new Error('--detach and --combine must be separate edits')
  }
}

function groupedSource(
  target: ArchitectureElement,
  source: string,
  input: CurateInput,
): string {
  if (input.group === undefined && input.ungroup !== true) return source
  if (target.kind !== 'component') {
    throw new Error('--group and --ungroup are only valid on components')
  }
  return withGromaField(
    source,
    'group',
    input.ungroup === true ? undefined : input.group?.trim(),
  )
}

function detachedSource(
  target: ArchitectureElement,
  source: string,
  files: string[] | undefined,
): string {
  if (files === undefined || files.length === 0) return source
  const detached = new Set(files)
  const unowned = [...detached].filter(file => !target.code.some(reference => reference.file === file))
  if (unowned.length > 0) throw new Error(`"${target.id}" does not own ${unowned.join(', ')}`)
  return withGromaCode(source, target.code.filter(reference => !detached.has(reference.file)))
}

async function parsedDocument(sourceFilename: string, source: string): Promise<ArchitectureDocument> {
  const tree = await parseMarkdown(source)
  return {
    sourceFilename,
    body: parseFrontmatter(source).content,
    nodes: tree.nodes,
    frontmatter: tree.frontmatter,
  } as ArchitectureDocument
}

/**
 * Flow steps name their endpoints by document and need their relationship, so a detached file, a
 * removed record, or a relocated document can leave a flow unresolvable. The write is refused first.
 */
async function requireResolvableFlows(
  context: CurationContext,
  target: ArchitectureElement,
  rewrites: readonly Rewrite[],
  removals: readonly string[],
): Promise<void> {
  if (context.records.flows.length === 0) return
  const written = new Map(rewrites.map(rewrite => [rewrite.sourceFilename, rewrite]))
  const gone = new Set(removals)
  const documents: ArchitectureDocument[] = []
  for (const document of context.records.documents) {
    if (gone.has(document.sourceFilename)) continue
    const rewrite = written.get(document.sourceFilename)
    documents.push(rewrite === undefined
      ? document
      : await parsedDocument(rewrite.destinationFilename, rewrite.source))
  }
  const model = buildArchitectureModel(documents)
  const broken = context.records.flows
    .filter(flow => {
      try {
        resolveFlows([flow], model)
        return false
      } catch {
        return true
      }
    })
    .map(flow => requireGromaMapping(flow.frontmatter, flow.sourceFilename).id)
  if (broken.length > 0) {
    throw new Error(`cannot change "${target.id}": flows ${broken.join(', ')} would not resolve`)
  }
}

function movedTarget(
  context: CurationContext,
  target: ArchitectureElement,
  source: string,
  parentId: string | undefined,
): { source: string, destination: string } {
  if (parentId === undefined) {
    return { source, destination: target.sourceFilename }
  }
  const parentKind = expectedParentKinds.get(target.kind)
  if (parentKind === undefined) throw new Error('--parent moves only components and containers')
  const parent = requireElement(context.byId, parentId)
  if (parent.kind !== parentKind) {
    throw new Error(`${target.kind} requires a ${parentKind} parent, but "${parent.id}" has kind ${parent.kind}`)
  }
  if (parent.external) throw new Error(`"${parent.id}" is an external system and stores nothing`)
  requiresEmptyMeaning(source, target.id)
  // A relocated document changes path, so an authored concept row naming it anywhere below would break.
  requireUnrelated(context.model.relationships, new Set(subtreeIds(context.model, target.id)))
  return {
    source: withGromaField(source, 'parent', parent.id),
    destination: architectureElementPath({
      root: context.filesystem.sourceFilename(),
      kind: target.kind,
      id: target.id,
      parentSourceFilename: parent.sourceFilename,
    }),
  }
}

/** Moves one element's document under a new parent path, with every document stored beneath it. */
async function relocated(
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

/** A moved record takes everything stored under it to the new path. */
async function movedDescendants(
  context: CurationContext,
  target: ArchitectureElement,
  destination: string,
): Promise<Rewrite[]> {
  if (destination === target.sourceFilename) return []
  const children = context.model.elements.filter(item => item.parentId === target.id)
  const relocations = await Promise.all(children.map(child => relocated(context, child, destination)))
  return relocations.flat()
}

function requireCombinableSources(
  context: CurationContext,
  target: ArchitectureElement,
  sourceIds: string[],
): ArchitectureElement[] {
  if (target.kind === 'actor') {
    throw new Error('--combine is only valid on systems, containers, and components')
  }
  const sources = sourceIds.map(id => requireElement(context.byId, id))
  for (const source of sources) {
    if (source.kind !== target.kind || source.parentId !== target.parentId) {
      throw new Error('combined elements must have the target kind and parent')
    }
    if (source.external !== target.external) {
      throw new Error('an external system and an internal system cannot combine')
    }
    if (source.group !== undefined || source.technology !== undefined) {
      throw new Error(`cannot combine "${source.id}" because it has authored metadata`)
    }
  }
  return sources
}

async function combineElements(
  context: CurationContext,
  target: ArchitectureElement,
  targetSource: string,
  requestedIds: string[] | undefined,
): Promise<CurationChange> {
  const sourceIds = [...new Set(requestedIds ?? [])]
  if (sourceIds.includes(target.id)) {
    throw new Error('an element cannot combine into itself')
  }
  if (sourceIds.length === 0) {
    return { targetSource, rewrites: [], removals: [] }
  }
  const sources = requireCombinableSources(context, target, sourceIds)
  const movedChildren = target.kind === 'component'
    ? []
    : context.model.elements.filter(element => sourceIds.includes(element.parentId ?? ''))
  const replacedIds = new Set([
    ...sourceIds,
    ...movedChildren.flatMap(child => subtreeIds(context.model, child.id)),
  ])
  requireUnrelated(context.model.relationships, replacedIds)
  for (const element of [...sources, ...movedChildren]) {
    requiresEmptyMeaning(
      await readDocument(context.repositoryRoot, element.sourceFilename),
      element.id,
    )
  }
  const rewrites: Rewrite[] = []
  for (const child of movedChildren) {
    rewrites.push(...await relocated(context, child, target.sourceFilename, target.id))
  }
  return {
    targetSource: withGromaCode(
      targetSource,
      combinedCode([target, ...sources]),
    ),
    rewrites,
    removals: sources,
  }
}

/** Structural curation of one element: group, detach files, move, or fold empty scan records into it; each element keeps its own status. */
export async function curateElement(
  repositoryRoot: string,
  records: ArchitectureRecords,
  model: ArchitectureModel,
  input: CurateInput,
): Promise<StructuralResult> {
  validateCurationInput(input)
  const byId = new Map(model.elements.map(element => [element.id, element]))
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const context = { filesystem, repositoryRoot, records, model, byId }
  const target = requireElement(byId, input.id)
  const originalSource = await readDocument(repositoryRoot, target.sourceFilename)
  const grouped = groupedSource(target, originalSource, input)
  const detached = detachedSource(target, grouped, input.detach)
  const moved = movedTarget(context, target, detached, input.parent)
  const combined = await combineElements(context, target, moved.source, input.combine)
  const targetSource = withMeaning(combined.targetSource, input)
  const rewrites = [...combined.rewrites]
  rewrites.unshift({
    id: target.id,
    sourceFilename: target.sourceFilename,
    destinationFilename: moved.destination,
    source: targetSource,
  })
  rewrites.push(...await movedDescendants(context, target, moved.destination))
  validateDestinations(filesystem, rewrites)
  const removals = combined.removals.map(element => element.sourceFilename)
  await requireResolvableFlows(context, target, rewrites, removals)
  const paths = await applyRewrites(repositoryRoot, rewrites, removals)
  return {
    id: target.id,
    ...paths,
    affectedIds: [...rewrites.map(rewrite => rewrite.id), ...combined.removals.map(element => element.id)],
    replacements: combined.removals.map(element => ({ absorbedId: element.id, survivingId: target.id })),
  }
}
