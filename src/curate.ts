import { existsSync } from 'node:fs'
import path from 'node:path'

import { buildArchitectureModel } from './architecture-model.ts'
import { architectureElementPath } from './architecture-path.ts'
import {
  readDocument,
  removeDocument,
  replaceLeadProse,
  withCodeFrontmatter,
  withFrontmatterField,
  writeObservedDocument,
} from './markdown-emitter.ts'
import type {
  ArchitectureElement,
  CodeReference,
  RevisionRecord,
} from './types.ts'

export interface CurateObservedInput {
  id: string
  description?: string
  group?: string
  ungroup?: boolean
  parent?: string
  combine?: string[]
}

interface Rewrite {
  sourceFilename: string
  destinationFilename: string
  source: string
}

interface CurationContext {
  repositoryRoot: string
  model: ReturnType<typeof buildArchitectureModel>
  byId: Map<string, ArchitectureElement>
}

interface CurationChange {
  targetSource: string
  rewrites: Rewrite[]
  removals: string[]
}

function observedRevision(revisions: RevisionRecord[]): RevisionRecord {
  const observed = revisions.find(record => record.revision.kind === 'observed')
  if (observed === undefined) throw new Error('observed architecture is missing')
  return observed
}

function requiresEmptyMeaning(source: string, id: string): void {
  const heading = source.match(/^# .+$/m)
  const trailing = heading?.index === undefined
    ? source
    : source.slice(heading.index + heading[0].length)
  if (trailing.trim() !== '') {
    throw new Error(`cannot structurally replace "${id}" because it has authored meaning`)
  }
}

function requireUnrelated(
  relationships: ReturnType<typeof buildArchitectureModel>['relationships'],
  ids: Set<string>,
): void {
  const relationship = relationships.find(entry => {
    return ids.has(entry.sourceId) || ids.has(entry.targetId)
  })
  if (relationship !== undefined) {
    throw new Error(
      `cannot structurally replace "${relationship.sourceId}" or "${relationship.targetId}" `
      + 'while it owns an authored relationship',
    )
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

function absoluteFilename(repositoryRoot: string, sourceFilename: string): string {
  return path.join(repositoryRoot, ...sourceFilename.split('/'))
}

function validateDestinations(repositoryRoot: string, rewrites: Rewrite[]): void {
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
      && existsSync(absoluteFilename(repositoryRoot, destination))
    ) {
      throw new Error(`architecture document already exists at ${destination}`)
    }
  }
}

async function applyRewrites(
  repositoryRoot: string,
  rewrites: Rewrite[],
  removals: string[],
): Promise<void> {
  for (const rewrite of rewrites) {
    await writeObservedDocument(
      repositoryRoot,
      rewrite.destinationFilename,
      rewrite.source,
    )
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
    }
  }
}

function requireElement(
  byId: Map<string, ArchitectureElement>,
  id: string,
): ArchitectureElement {
  const element = byId.get(id)
  if (element === undefined) throw new Error(`unknown observed id "${id}"`)
  return element
}

function validateCurationInput(input: CurateObservedInput): void {
  if (input.group !== undefined && input.ungroup === true) {
    throw new Error('--group and --ungroup cannot be used together')
  }
  if (input.group !== undefined && input.group.trim() === '') {
    throw new Error('--group requires non-empty text')
  }
  if (input.parent !== undefined && (input.combine?.length ?? 0) > 0) {
    throw new Error('--parent and --combine must be separate edits')
  }
}

function groupedSource(
  target: ArchitectureElement,
  source: string,
  input: CurateObservedInput,
): string {
  if (input.group === undefined && input.ungroup !== true) return source
  if (target.kind !== 'component') {
    throw new Error('--group and --ungroup are only valid on components')
  }
  return withFrontmatterField(
    source,
    'group',
    input.ungroup === true ? undefined : input.group?.trim(),
  )
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
  if (target.kind !== 'component') {
    throw new Error('--parent can currently move only components')
  }
  const parent = requireElement(context.byId, parentId)
  if (parent.kind !== 'container') {
    throw new Error(`component requires a container parent, but "${parent.id}" is a ${parent.kind}`)
  }
  requireUnrelated(context.model.relationships, new Set([target.id]))
  requiresEmptyMeaning(source, target.id)
  return {
    source: withFrontmatterField(source, 'parent', parent.id),
    destination: architectureElementPath({
      root: 'groma/observed',
      kind: target.kind,
      id: target.id,
      parentSourceFilename: parent.sourceFilename,
    }),
  }
}

function requireCombinableSources(
  context: CurationContext,
  target: ArchitectureElement,
  sourceIds: string[],
): ArchitectureElement[] {
  if (target.kind !== 'component' && target.kind !== 'container') {
    throw new Error('--combine is only valid on components and containers')
  }
  const sources = sourceIds.map(id => requireElement(context.byId, id))
  for (const source of sources) {
    if (source.kind !== target.kind || source.parentId !== target.parentId) {
      throw new Error('combined elements must have the target kind and parent')
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
  const movedChildren = target.kind === 'container'
    ? context.model.elements.filter(element => sourceIds.includes(element.parentId ?? ''))
    : []
  const replacedIds = new Set([...sourceIds, ...movedChildren.map(child => child.id)])
  requireUnrelated(context.model.relationships, replacedIds)
  for (const element of [...sources, ...movedChildren]) {
    requiresEmptyMeaning(
      await readDocument(context.repositoryRoot, element.sourceFilename),
      element.id,
    )
  }
  const rewrites: Rewrite[] = []
  for (const child of movedChildren) {
    rewrites.push({
      sourceFilename: child.sourceFilename,
      destinationFilename: architectureElementPath({
        root: 'groma/observed',
        kind: child.kind,
        id: child.id,
        parentSourceFilename: target.sourceFilename,
      }),
      source: withFrontmatterField(
        await readDocument(context.repositoryRoot, child.sourceFilename),
        'parent',
        target.id,
      ),
    })
  }
  return {
    targetSource: withCodeFrontmatter(targetSource, combinedCode([target, ...sources])),
    rewrites,
    removals: sources.map(source => source.sourceFilename),
  }
}

export async function curateObserved(
  repositoryRoot: string,
  revisions: RevisionRecord[],
  input: CurateObservedInput,
): Promise<string> {
  validateCurationInput(input)
  const record = observedRevision(revisions)
  const model = buildArchitectureModel(record)
  const byId = new Map(model.elements.map(element => [element.id, element]))
  const context = { repositoryRoot, model, byId }
  const target = requireElement(byId, input.id)
  const originalSource = await readDocument(repositoryRoot, target.sourceFilename)
  const grouped = groupedSource(target, originalSource, input)
  const moved = movedTarget(context, target, grouped, input.parent)
  const combined = await combineElements(context, target, moved.source, input.combine)
  const targetSource = input.description === undefined
    ? combined.targetSource
    : replaceLeadProse(combined.targetSource, input.description)
  const rewrites = [...combined.rewrites]
  rewrites.unshift({
    sourceFilename: target.sourceFilename,
    destinationFilename: moved.destination,
    source: targetSource,
  })
  validateDestinations(repositoryRoot, rewrites)
  await applyRewrites(repositoryRoot, rewrites, combined.removals)
  return target.id
}
