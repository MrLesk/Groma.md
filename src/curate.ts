import { parseFrontmatter, parseMarkdown } from 'comark'

import { architectureElementPath } from './architecture-path.ts'
import { buildArchitectureModel, expectedParentKinds } from './architecture-model.ts'
import { relocated, requireElement } from './curate-rewrites.ts'
import type { CurationContext, DocumentWrite, Rewrite } from './curate-rewrites.ts'
import { linkWrites, renamedTarget } from './curate-rename.ts'
import { resolveFlows } from './flow-model.ts'
import { moveBlocker } from './movable.ts'
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
  /** The new id of the target; its document and everything stored under it move to the matching paths. */
  newId?: string
}

/** Facts from a completed structural write; paths are repository-relative. */
export interface StructuralResult {
  id: string
  created: string[]
  /** Existing documents rewritten by the operation, even when their bytes stay identical. */
  changed: string[]
  removed: string[]
  affectedIds: string[]
  /** Each ID that no longer exists and the ID that now stands for it: a renamed or an absorbed record. */
  replacements: Array<{ oldId: string; newId: string }>
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
  rewrites: readonly DocumentWrite[],
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
  rewrites: readonly DocumentWrite[],
  removals: readonly string[],
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

/**
 * A combine rebuilds Code from the stored records, which would restore detached files, and places the
 * absorbed children under the stored target path, which a move changes. A rename is always its own edit.
 */
function requireSeparateEdits(input: CurateInput): void {
  const combines = (input.combine?.length ?? 0) > 0
  const detaches = (input.detach?.length ?? 0) > 0
  if (input.parent !== undefined && combines) {
    throw new Error('--parent and --combine must be separate edits')
  }
  if (detaches && combines) {
    throw new Error('--detach and --combine must be separate edits')
  }
  if (input.newId !== undefined && (combines || detaches || input.parent !== undefined)) {
    throw new Error('--id must be a separate edit')
  }
}

function validateCurationInput(input: CurateInput): void {
  if (input.group !== undefined && input.ungroup === true) {
    throw new Error('--group and --ungroup cannot be used together')
  }
  if (input.group !== undefined && input.group.trim() === '') {
    throw new Error('--group requires non-empty text')
  }
  requireSeparateEdits(input)
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
 * Relationship rows and flow steps name their endpoints by document, and a flow step needs its
 * relationship, so a detached file, a removed record, or a relocated document can leave the
 * architecture unloadable or a flow unresolvable. The write is refused first.
 */
async function requireLoadableResult(
  context: CurationContext,
  target: ArchitectureElement,
  rewrites: readonly DocumentWrite[],
  removals: readonly string[],
): Promise<void> {
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
  let model: ArchitectureModel
  try {
    model = buildArchitectureModel(documents)
  } catch (error) {
    throw new Error(`cannot change "${target.id}": ${error instanceof Error ? error.message : String(error)}`)
  }
  const flows = await Promise.all(context.records.flows.map(async flow => {
    const rewrite = written.get(flow.sourceFilename)
    return rewrite === undefined ? flow : await parsedDocument(rewrite.destinationFilename, rewrite.source)
  }))
  const broken = flows
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
  const flows = resolveFlows(context.records.flows, context.model)
  const blocker = moveBlocker(target, parseFrontmatter(source).content, context.model.relationships, flows)
  if (blocker !== undefined) throw new Error(blocker)
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

/** A moved or renamed record takes everything stored under it to its new path; children name a new ID. */
async function movedDescendants(
  context: CurationContext,
  target: ArchitectureElement,
  destination: string,
  id: string,
): Promise<Rewrite[]> {
  if (destination === target.sourceFilename) return []
  const children = context.model.elements.filter(item => item.parentId === target.id)
  const parentId = id === target.id ? undefined : id
  const relocations = await Promise.all(children.map(child => relocated(context, child, destination, parentId)))
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

/** Structural curation of one element: group, detach files, move, rename, or fold empty scan records into it; each element keeps its own status. */
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
  const renamed = renamedTarget(context, target, combined.targetSource, moved.destination, input.newId)
  const rewrites: Rewrite[] = [
    {
      id: renamed.id,
      sourceFilename: target.sourceFilename,
      destinationFilename: renamed.destination,
      source: withMeaning(renamed.source, input),
    },
    ...combined.rewrites,
    ...await movedDescendants(context, target, renamed.destination, renamed.id),
  ]
  // Only a rename repoints links; requireLoadableResult refuses a move or combine that would break one.
  const links = input.newId === undefined ? [] : await linkWrites(context, rewrites)
  const writes: DocumentWrite[] = [...rewrites, ...links]
  validateDestinations(filesystem, writes)
  const removals = combined.removals.map(element => element.sourceFilename)
  await requireLoadableResult(context, target, writes, removals)
  const paths = await applyRewrites(repositoryRoot, writes, removals)
  return {
    id: renamed.id,
    ...paths,
    affectedIds: [...rewrites.map(rewrite => rewrite.id), ...combined.removals.map(element => element.id)],
    replacements: [
      ...input.newId === undefined ? [] : [{ oldId: target.id, newId: renamed.id }],
      ...combined.removals.map(element => ({ oldId: element.id, newId: target.id })),
    ],
  }
}
