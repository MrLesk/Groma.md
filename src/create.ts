import { existsSync } from 'node:fs'
import path from 'node:path'

import { architectureElementPath } from './architecture-path.ts'
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

interface CreateArchitectureElementInput {
  name: string
  plan?: string
  observed?: boolean
  kind: string
  description: string
  parent?: string
  external?: boolean
  technology?: string
}

interface ValidatedCreateInput {
  name: string
  observed: boolean
  planId?: string
  kind: C4Kind
  description: string
  parentId?: string
  external: boolean
  technology?: string
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

async function ensureObservedReadme(repositoryRoot: string): Promise<void> {
  const filename = path.join(repositoryRoot, 'groma', 'observed', 'README.md')
  if (existsSync(filename)) return
  await writeObservedDocument(
    repositoryRoot,
    'groma/observed/README.md',
    '# Observed architecture\n',
  )
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

function validateElementMetadata(
  kind: C4Kind,
  input: CreateArchitectureElementInput,
): Pick<ValidatedCreateInput, 'external' | 'technology'> {
  const external = input.external === true
  if (external && kind !== 'system') {
    throw new Error('--external is allowed only for systems')
  }
  const technology = input.technology
  if (technology !== undefined && technology.trim().length === 0) {
    throw new Error('--technology must not be empty')
  }
  return { external, technology }
}

function validateCreateInput(input: CreateArchitectureElementInput): ValidatedCreateInput {
  const name = requireText(input.name, 'name')
  const observed = input.observed === true
  const planId = input.plan === undefined || input.plan === '' ? undefined : input.plan
  if (observed === (planId !== undefined)) {
    throw new Error('exactly one of --observed or --plan is required')
  }
  const kind = requireKind(requireText(input.kind, 'kind'))
  if (input.description === undefined) throw new Error('description is required')
  if (planId !== undefined && planId !== kebabCase(planId)) {
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
  const metadata = validateElementMetadata(kind, input)
  return {
    name,
    observed,
    planId,
    kind,
    description: input.description,
    parentId,
    ...metadata,
  }
}

function resolveParent(
  byId: Map<string, WorldRecord>,
  kind: C4Kind,
  parentId: string | undefined,
): WorldRecord | undefined {
  if (parentId === undefined) return undefined
  const parent = byId.get(parentId)
  if (parent === undefined) throw new Error(`unknown parent "${parentId}"`)
  const expectedParentKind = expectedParentKinds.get(kind)
  if (parent.kind !== expectedParentKind) {
    throw new Error(
      `${kind} requires a ${expectedParentKind} parent, `
      + `but "${parentId}" is a ${parent.kind}`,
    )
  }
  return parent
}

export async function createArchitectureElement(
  repositoryRoot: string,
  input: CreateArchitectureElementInput,
): Promise<string> {
  const {
    name,
    observed,
    planId,
    kind,
    description,
    parentId,
    external,
    technology,
  } = validateCreateInput(input)
  if (observed) await ensureObservedReadme(repositoryRoot)
  const revisions = await loadArchitecture(repositoryRoot)
  const byId = indexWorld(revisions)
  const id = kebabCase(name)
  if (byId.has(id)) {
    throw new Error(`id "${id}" already exists`)
  }

  const parent = resolveParent(byId, kind, parentId)

  if (planId !== undefined) {
    await ensurePlanReadme(repositoryRoot, planId, revisions)
  }
  await writeObservedDocument(
    repositoryRoot,
    architectureElementPath({
      root: planId === undefined ? 'groma/observed' : `groma/plans/${planId}`,
      kind,
      id,
      parentSourceFilename: parent?.sourceFilename,
    }),
    renderObservedDocument({
      id,
      kind,
      parent: parent?.id,
      external,
      technology,
      name,
      responsibility: description,
    }),
  )
  return id
}
