import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

import type {
  ArchitectureDocument,
  FilesystemAccessHandler,
  Revision,
  RevisionDescriptor,
  RevisionRecord,
} from './types.ts'

export class ArchitectureReadError extends Error {
  readonly sourceFilename: string
  readonly revision: Revision
  readonly stage: 'read' | 'parse' | 'serialize'

  constructor(
    sourceFilename: string,
    revision: Revision,
    stage: 'read' | 'parse' | 'serialize',
    cause: unknown,
  ) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    const message = stage === 'parse'
      ? `Comark could not parse ${sourceFilename}: ${detail}`
      : stage === 'read'
        ? `Could not read architecture Markdown ${sourceFilename}: ${detail}`
        : `Could not serialize Comark data for ${sourceFilename}: ${detail}`

    super(message, { cause })
    this.name = 'ArchitectureReadError'
    this.sourceFilename = sourceFilename
    this.revision = revision
    this.stage = stage
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child)
  }

  return value
}

function repositoryRelative(repositoryRoot: string, filename: string): string {
  return path.relative(repositoryRoot, filename).split(path.sep).join('/')
}

function recordFilesystemAccess(
  onFilesystemAccess: FilesystemAccessHandler | undefined,
  operation: 'read-directory' | 'read-file',
  filename: string,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function listMarkdownFiles(
  directory: string,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<string[]> {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', directory)
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(entryPath, onFilesystemAccess))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function identifyRevision(descriptor: unknown): Revision {
  const revision = descriptor as Partial<RevisionDescriptor> | null
  if (revision?.kind === 'observed') {
    return {
      kind: 'observed',
      sourceDirectory: 'groma/observed',
    }
  }

  if (revision?.kind === 'missing') {
    return {
      kind: 'missing',
      sourceDirectory: 'groma/missing',
    }
  }

  if (
    revision?.kind !== 'plan'
    || typeof revision.name !== 'string'
    || revision.name.length === 0
    || revision.name === '.'
    || revision.name === '..'
    || revision.name.includes('/')
    || revision.name.includes('\\')
  ) {
    throw new TypeError(
      'A revision must be { kind: "observed" }, { kind: "missing" }, '
      + 'or { kind: "plan", name: "<directory>" }',
    )
  }

  return {
    kind: 'plan',
    name: revision.name,
    sourceDirectory: `groma/plans/${revision.name}`,
  }
}

function isElementDocument(document: ArchitectureDocument): boolean {
  return Object.hasOwn(document.frontmatter, 'id')
    && Object.hasOwn(document.frontmatter, 'kind')
}

async function parseDocument(
  repositoryRoot: string,
  revision: Revision,
  filename: string,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<ArchitectureDocument> {
  const sourceFilename = repositoryRelative(repositoryRoot, filename)
  let source: string

  try {
    recordFilesystemAccess(onFilesystemAccess, 'read-file', filename)
    source = await readFile(filename, 'utf8')
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'read', error)
  }

  let tree: Awaited<ReturnType<typeof parse>>
  try {
    tree = await parse(source)
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'parse', error)
  }

  try {
    return deepFreeze(JSON.parse(JSON.stringify({
      sourceFilename,
      nodes: tree.nodes,
      frontmatter: tree.frontmatter,
    })) as ArchitectureDocument)
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'serialize', error)
  }
}

export async function loadRevision(
  repositoryRoot: string,
  revisionDescriptor: unknown,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<RevisionRecord> {
  const { onFilesystemAccess } = options
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const revision = deepFreeze(identifyRevision(revisionDescriptor))
  const revisionRoot = path.join(absoluteRepositoryRoot, revision.sourceDirectory)
  const contextFile = path.join(revisionRoot, 'README.md')
  const markdownFiles = await listMarkdownFiles(
    revisionRoot,
    onFilesystemAccess,
  )
  let context: ArchitectureDocument | undefined
  const documents: ArchitectureDocument[] = []

  for (const filename of markdownFiles) {
    const document = await parseDocument(
      absoluteRepositoryRoot,
      revision,
      filename,
      onFilesystemAccess,
    )

    if (filename === contextFile) {
      context = document
    } else if (isElementDocument(document)) {
      documents.push(document)
    }
  }

  if (!context) {
    context = await parseDocument(
      absoluteRepositoryRoot,
      revision,
      contextFile,
      onFilesystemAccess,
    )
  }

  return deepFreeze({
    revision,
    context,
    documents,
  })
}

export async function loadArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<RevisionRecord[]> {
  const { onFilesystemAccess } = options
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const plansRoot = path.join(absoluteRepositoryRoot, 'groma', 'plans')
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', plansRoot)
  const planEntries = await readdir(plansRoot, { withFileTypes: true })
  const revisionDescriptors: RevisionDescriptor[] = [
    { kind: 'observed' },
    { kind: 'missing' },
    ...planEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .map(name => ({ kind: 'plan' as const, name })),
  ]
  const revisions: RevisionRecord[] = []

  for (const revision of revisionDescriptors) {
    revisions.push(await loadRevision(
      absoluteRepositoryRoot,
      revision,
      options,
    ))
  }

  return deepFreeze(revisions)
}
