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
  ArchitectureRecords,
  FilesystemAccessHandler,
} from './types.ts'

export class ArchitectureReadError extends Error {
  readonly sourceFilename: string
  readonly stage: 'read' | 'parse' | 'serialize'

  constructor(
    sourceFilename: string,
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

/** The two root documents describe the bundle and the project, never an element. */
const rootDocuments = new Set(['index.md', 'project.md'])

/** Names the scanner must never hand to an element, since Markdown tooling reserves them. */
export function isReservedDocument(filename: string): boolean {
  const basename = path.posix.basename(filename)
  return basename === 'index.md' || basename === 'log.md'
}

async function parseDocument(
  filesystem: GromaFileSystem,
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
    throw new ArchitectureReadError(sourceFilename, 'read', error)
  }

  let tree: Awaited<ReturnType<typeof parse>>
  try {
    tree = await parse(source)
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, 'parse', error)
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
    throw new ArchitectureReadError(sourceFilename, 'serialize', error)
  }
}

async function requireGromaPackage(
  filesystem: GromaFileSystem,
  onFilesystemAccess?: FilesystemAccessHandler,
): Promise<void> {
  const index = await parseDocument(filesystem, 'index.md', onFilesystemAccess)
  requireBundleIndex(index.frontmatter, index.sourceFilename)
  const project = await parseDocument(filesystem, 'project.md', onFilesystemAccess)
  requireProjectMetadata(project.frontmatter, project.sourceFilename)
  requireProjectOverview(project.nodes, project.body, project.sourceFilename)
}

/** Reads the one architecture tree: element documents wherever they sit, draft records under drafts/. */
export async function loadArchitecture(
  repositoryRoot: string,
  options: { onFilesystemAccess?: FilesystemAccessHandler } = {},
): Promise<ArchitectureRecords> {
  const { onFilesystemAccess } = options
  const filesystem = GromaFileSystem.open(repositoryRoot)
  await requireGromaPackage(filesystem, onFilesystemAccess)
  const documents: ArchitectureDocument[] = []
  const drafts: ArchitectureDocument[] = []

  for (const filename of await listMarkdownFiles(filesystem, '', onFilesystemAccess)) {
    if (rootDocuments.has(filename) || isReservedDocument(filename)) continue
    const document = await parseDocument(filesystem, filename, onFilesystemAccess)
    if (filename.startsWith('drafts/')) {
      drafts.push(document)
      continue
    }
    const type = requireConceptType(document.frontmatter, document.sourceFilename)
    if (c4Kind(type) !== undefined) documents.push(document)
  }

  return deepFreeze({ documents, drafts })
}
