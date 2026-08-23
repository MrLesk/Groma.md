import { loadArchitecture } from './architecture-reader.ts'
import {
  renderObservedDocument,
  upsertCode,
  writeObservedDocument,
} from './markdown-emitter.ts'
import type {
  CodeReference,
  Origin,
  RevisionRecord,
  ScanCandidate,
  ScanResult,
  ScanSummary,
} from './types.ts'

function kebabCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readCode(value: unknown): CodeReference[] {
  if (!Array.isArray(value)) return []
  return value.map(entry => {
    const reference = entry as CodeReference
    return {
      scanner: reference.scanner,
      file: reference.file,
      ...(Object.hasOwn(reference, 'symbol') ? { symbol: reference.symbol } : {}),
    }
  })
}

function codeKey(reference: CodeReference): string {
  return `${reference.scanner}\0${reference.file}\0${reference.symbol ?? ''}`
}

function codeFileKey(reference: CodeReference): string {
  return `${reference.scanner}\0${reference.file}`
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

interface WorldRecord {
  id: string
  origin: Origin
  sourceFilename: string
  code: CodeReference[]
}

function observedPathFor(
  candidate: ScanCandidate,
  id: string,
  parent: WorldRecord | undefined,
): string {
  if (candidate.kind === 'actor') {
    return `groma/observed/actors/${id}.md`
  }
  if (candidate.kind === 'system') {
    return `groma/observed/systems/${id}/system.md`
  }
  if (parent === undefined) {
    throw new Error(`missing parent for ${id}`)
  }
  const parentDir = posixDirname(architectureRelative(parent.sourceFilename))
  if (candidate.kind === 'container') {
    return `groma/observed/${parentDir}/containers/${id}/container.md`
  }
  return `groma/observed/${parentDir}/components/${id}.md`
}

function indexWorld(revisions: RevisionRecord[]) {
  const byId = new Map<string, WorldRecord>()
  const byCode = new Map<string, string>()
  const byCodeFile = new Map<string, string>()

  for (const record of revisions) {
    if (record.revision.kind === 'missing') continue
    const origin: Origin = record.revision.kind === 'plan' ? 'planned' : 'observed'
    for (const document of record.documents) {
      const id = document.frontmatter.id
      if (typeof id !== 'string') continue
      const worldRecord: WorldRecord = {
        id,
        origin,
        sourceFilename: document.sourceFilename,
        code: readCode(document.frontmatter.code),
      }
      const existing = byId.get(id)
      if (existing === undefined || origin === 'planned') {
        byId.set(id, worldRecord)
      }
      for (const reference of worldRecord.code) {
        byCode.set(codeKey(reference), id)
        byCodeFile.set(codeFileKey(reference), id)
      }
    }
  }

  return { byId, byCode, byCodeFile }
}

function matchCandidate(
  world: ReturnType<typeof indexWorld>,
  candidate: ScanCandidate,
): WorldRecord | undefined {
  for (const reference of candidate.code ?? []) {
    const id = world.byCode.get(codeKey(reference))
      ?? world.byCodeFile.get(codeFileKey(reference))
    if (id !== undefined) return world.byId.get(id)
  }
  return world.byId.get(kebabCase(candidate.name))
}

export async function foldScanResult(
  repositoryRoot: string,
  scanResult: ScanResult,
): Promise<ScanSummary> {
  const world = indexWorld(await loadArchitecture(repositoryRoot))
  const summary: ScanSummary = { created: 0, refreshed: 0, matched: 0 }

  for (const candidate of scanResult.candidates) {
    const match = matchCandidate(world, candidate)
    const code = candidate.code ?? []
    if (match !== undefined) {
      await upsertCode(repositoryRoot, match.sourceFilename, code)
      if (match.origin === 'planned') summary.matched += 1
      else summary.refreshed += 1
      continue
    }

    const id = kebabCase(candidate.name)
    const parentId = candidate.parent === undefined
      ? undefined
      : kebabCase(candidate.parent)
    const parent = parentId === undefined ? undefined : world.byId.get(parentId)
    const sourceFilename = observedPathFor(candidate, id, parent)
    await writeObservedDocument(
      repositoryRoot,
      sourceFilename,
      renderObservedDocument({
        id,
        kind: candidate.kind,
        parent: parent?.id ?? parentId,
        name: candidate.name,
        responsibility: candidate.responsibility,
        code,
      }),
    )
    const created: WorldRecord = {
      id,
      origin: 'observed',
      sourceFilename,
      code,
    }
    world.byId.set(id, created)
    for (const reference of code) {
      world.byCode.set(codeKey(reference), id)
      world.byCodeFile.set(codeFileKey(reference), id)
    }
    summary.created += 1
  }

  return summary
}

export { architectureRelative, readCode }
