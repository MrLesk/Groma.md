import { loadArchitecture } from './architecture-reader.ts'
import {
  renderObservedDocument,
  writeObservedDocument,
} from './markdown-emitter.ts'
import { displayName, kebabCase } from './naming.ts'
import type { C4Kind, RevisionRecord } from './types.ts'

const expectedParentKinds = new Map<C4Kind, C4Kind>([
  ['container', 'system'],
  ['component', 'container'],
])
const rootKinds = new Set<C4Kind>(['actor', 'system'])
const supportedKinds = new Set<C4Kind>([...rootKinds, ...expectedParentKinds.keys()])

interface WorldRecord {
  id: string
  kind: C4Kind
  sourceFilename: string
}

interface CreatePlannedElementInput {
  name: string
  plan: string
  kind: string
  description: string
  parent?: string
}

function architectureRelative(sourceFilename: string): string {
  if (sourceFilename.startsWith('groma/plans/')) {
    const slash = sourceFilename.indexOf('/', 'groma/plans/'.length)
    return sourceFilename.slice(slash + 1)
  }
  if (sourceFilename.startsWith('groma/observed/')) {
    return sourceFilename.slice('groma/observed/'.length)
  }
  return sourceFilename
}

function posixDirname(filename: string): string {
  const separator = filename.lastIndexOf('/')
  return separator === -1 ? '' : filename.slice(0, separator)
}

function plannedPathFor(
  planId: string,
  kind: C4Kind,
  id: string,
  parent: WorldRecord | undefined,
): string {
  const root = `groma/plans/${planId}`
  if (kind === 'actor') return `${root}/actors/${id}.md`
  if (kind === 'system') return `${root}/systems/${id}/system.md`
  if (parent === undefined) {
    throw new Error(`missing parent for ${id}`)
  }
  const parentDir = posixDirname(architectureRelative(parent.sourceFilename))
  if (kind === 'container') {
    return `${root}/${parentDir}/containers/${id}/container.md`
  }
  return `${root}/${parentDir}/components/${id}.md`
}

function indexWorld(revisions: RevisionRecord[]) {
  const byId = new Map<string, WorldRecord>()

  for (const record of revisions) {
    if (record.revision.kind === 'missing') continue
    const origin = record.revision.kind === 'plan' ? 'planned' : 'observed'
    for (const document of record.documents) {
      const id = document.frontmatter.id
      const kind = document.frontmatter.kind
      if (typeof id !== 'string' || !supportedKinds.has(kind as C4Kind)) continue
      const worldRecord: WorldRecord = {
        id,
        kind: kind as C4Kind,
        sourceFilename: document.sourceFilename,
      }
      const existing = byId.get(id)
      if (existing === undefined || origin === 'planned') {
        byId.set(id, worldRecord)
      }
    }
  }

  return byId
}

export async function ensurePlanReadme(
  repositoryRoot: string,
  planId: string,
  revisions: RevisionRecord[],
): Promise<void> {
  const planExists = revisions.some(record => {
    return record.revision.kind === 'plan' && record.revision.name === planId
  })
  if (planExists) return
  await writeObservedDocument(
    repositoryRoot,
    `groma/plans/${planId}/README.md`,
    `---\nid: ${planId}\n---\n\n# ${displayName(planId)}\n`,
  )
}

function requireText(value: string | undefined, flag: string): string {
  if (value === undefined || value === '') {
    throw new Error(`${flag} is required`)
  }
  return value
}

function requireKind(kind: string): C4Kind {
  if (!supportedKinds.has(kind as C4Kind)) {
    throw new Error(`unknown kind "${kind}"`)
  }
  return kind as C4Kind
}

export async function createPlannedElement(
  repositoryRoot: string,
  input: CreatePlannedElementInput,
): Promise<string> {
  const name = requireText(input.name, 'name')
  const planId = requireText(input.plan, 'plan')
  const kind = requireKind(requireText(input.kind, 'kind'))
  if (input.description === undefined) {
    throw new Error('description is required')
  }
  if (planId !== kebabCase(planId)) {
    throw new Error('plan id must be lowercase kebab-case')
  }

  const parentId = input.parent === undefined || input.parent === ''
    ? undefined
    : input.parent
  if (rootKinds.has(kind) && parentId !== undefined) {
    throw new Error(`--parent is forbidden for ${kind}`)
  }
  if (!rootKinds.has(kind) && parentId === undefined) {
    throw new Error(`--parent is required for ${kind}`)
  }

  const revisions = await loadArchitecture(repositoryRoot)
  const byId = indexWorld(revisions)
  const id = kebabCase(name)
  if (byId.has(id)) {
    throw new Error(`id "${id}" already exists`)
  }

  const parent = parentId === undefined ? undefined : byId.get(parentId)
  if (parentId !== undefined) {
    if (parent === undefined) {
      throw new Error(`unknown parent "${parentId}"`)
    }
    const expectedParentKind = expectedParentKinds.get(kind)
    if (parent.kind !== expectedParentKind) {
      throw new Error(
        `${kind} requires a ${expectedParentKind} parent, `
        + `but "${parentId}" is a ${parent.kind}`,
      )
    }
  }

  await ensurePlanReadme(repositoryRoot, planId, revisions)
  await writeObservedDocument(
    repositoryRoot,
    plannedPathFor(planId, kind, id, parent),
    renderObservedDocument({
      id,
      kind,
      parent: parent?.id,
      name,
      responsibility: input.description,
    }),
  )
  return id
}
