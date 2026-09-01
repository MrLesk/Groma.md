import path from 'node:path'

import { parse, parseFrontmatter } from 'comark'

import {
  c4Kind,
  requireBundleIndex,
  requireConceptType,
  requireProjectMetadata,
  requireProjectOverview,
} from './okf-profile.ts'
import { GromaFileSystem } from './groma-filesystem.ts'

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

function recordFilesystemAccess(
  onFilesystemAccess: FilesystemAccessHandler | undefined,
  operation: 'read-directory' | 'read-file',
  filename: string,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function listMarkdownFiles(
  filesystem: GromaFileSystem,
  directory: string,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<string[]> {
  recordFilesystemAccess(
    onFilesystemAccess,
    'read-directory',
    filesystem.absolute(directory),
  )
  const entries = await filesystem.list(directory)
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.posix.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(
        filesystem,
        entryPath,
        onFilesystemAccess,
      ))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function identifyRevision(
  filesystem: GromaFileSystem,
  descriptor: unknown,
): Revision {
  const revision = descriptor as Partial<RevisionDescriptor> | null
  if (revision?.kind === 'observed') {
    return {
      kind: 'observed',
      sourceDirectory: filesystem.sourceFilename('observed'),
    }
  }

  if (revision?.kind === 'missing') {
    return {
      kind: 'missing',
      sourceDirectory: filesystem.sourceFilename('missing'),
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
    sourceDirectory: filesystem.sourceFilename(`plans/${revision.name}`),
  }
}

function isReservedDocument(filename: string): boolean {
  const basename = path.posix.basename(filename)
  return basename === 'index.md' || basename === 'log.md'
}

function requireReservedFrontmatter(document: ArchitectureDocument): void {
  if (Object.keys(document.frontmatter).length > 0) {
    throw new TypeError(
      `${document.sourceFilename}: only the bundle-root index may have frontmatter`,
    )
  }
}

async function parseDocument(
  filesystem: GromaFileSystem,
  revision: Revision,
  relativeFilename: string,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<ArchitectureDocument> {
  const sourceFilename = filesystem.sourceFilename(relativeFilename)
  let source: string

  try {
    recordFilesystemAccess(
      onFilesystemAccess,
      'read-file',
      filesystem.absolute(relativeFilename),
    )
    source = await filesystem.read(relativeFilename)
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
    const { content } = parseFrontmatter(source)
    return deepFreeze(JSON.parse(JSON.stringify({
      sourceFilename,
      body: content,
      nodes: tree.nodes,
      frontmatter: tree.frontmatter,
    })) as ArchitectureDocument)
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'serialize', error)
  }
}

async function requireGromaPackage(
  filesystem: GromaFileSystem,
  revision: Revision,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<void> {
  const index = await parseDocument(
    filesystem,
    revision,
    'index.md',
    onFilesystemAccess,
  )
  requireBundleIndex(index.frontmatter, index.sourceFilename)
  const project = await parseDocument(
    filesystem,
    revision,
    'project.md',
    onFilesystemAccess,
  )
  requireProjectMetadata(project.frontmatter, project.sourceFilename)
  requireProjectOverview(project.nodes, project.body, project.sourceFilename)
}

async function loadRevisionRecord(
  filesystem: GromaFileSystem,
  revision: Revision,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<RevisionRecord> {
  const revisionRoot = filesystem.relative(revision.sourceDirectory)
  const contextFile = path.posix.join(revisionRoot, 'index.md')
  const markdownFiles = await listMarkdownFiles(
    filesystem,
    revisionRoot,
    onFilesystemAccess,
  )
  let context: ArchitectureDocument | undefined
  const documents: ArchitectureDocument[] = []

  for (const filename of markdownFiles) {
    const document = await parseDocument(
      filesystem,
      revision,
      filename,
      onFilesystemAccess,
    )

    if (isReservedDocument(document.sourceFilename)) {
      requireReservedFrontmatter(document)
      if (filename === contextFile) context = document
      continue
    }

    const type = requireConceptType(document.frontmatter, document.sourceFilename)
    if (c4Kind(type) !== undefined) documents.push(document)
  }

  if (!context) {
    context = await parseDocument(
      filesystem,
      revision,
      contextFile,
      onFilesystemAccess,
    )
  }

  return deepFreeze({ revision, context, documents })
}

export async function loadRevision(
  repositoryRoot: string,
  revisionDescriptor: unknown,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<RevisionRecord> {
  const { onFilesystemAccess } = options
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const revision = deepFreeze(identifyRevision(filesystem, revisionDescriptor))
  await requireGromaPackage(filesystem, revision, onFilesystemAccess)
  return loadRevisionRecord(filesystem, revision, onFilesystemAccess)
}

export async function loadArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<RevisionRecord[]> {
  const { onFilesystemAccess } = options
  const filesystem = GromaFileSystem.open(repositoryRoot)
  const packageRevision = deepFreeze(identifyRevision(filesystem, { kind: 'observed' }))
  await requireGromaPackage(
    filesystem,
    packageRevision,
    onFilesystemAccess,
  )
  recordFilesystemAccess(
    onFilesystemAccess,
    'read-directory',
    filesystem.absolute('plans'),
  )
  const planEntries = await filesystem.list('plans')
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
    revisions.push(await loadRevisionRecord(
      filesystem,
      deepFreeze(identifyRevision(filesystem, revision)),
      onFilesystemAccess,
    ))
  }

  return deepFreeze(revisions)
}
