import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

export class ArchitectureReadError extends Error {
  constructor(sourceFilename, revision, stage, cause) {
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

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }

  return value
}

function repositoryRelative(repositoryRoot, filename) {
  return path.relative(repositoryRoot, filename).split(path.sep).join('/')
}

function recordFilesystemAccess(
  onFilesystemAccess,
  operation,
  filename,
) {
  onFilesystemAccess?.({ operation, filename })
}

async function listMarkdownFiles(directory, onFilesystemAccess) {
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', directory)
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

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

function identifyRevision(revision) {
  if (revision?.kind === 'observed') {
    return {
      kind: 'observed',
      sourceDirectory: 'groma/observed',
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
      'A revision must be { kind: "observed" } or { kind: "plan", name: "<directory>" }',
    )
  }

  return {
    kind: 'plan',
    name: revision.name,
    sourceDirectory: `groma/plans/${revision.name}`,
  }
}

async function parseDocument(
  repositoryRoot,
  revision,
  filename,
  onFilesystemAccess,
) {
  const sourceFilename = repositoryRelative(repositoryRoot, filename)
  let source

  try {
    recordFilesystemAccess(onFilesystemAccess, 'read-file', filename)
    source = await readFile(filename, 'utf8')
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'read', error)
  }

  let tree
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
    })))
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, 'serialize', error)
  }
}

export async function loadRevision(
  repositoryRoot,
  revisionDescriptor,
  options = {},
) {
  const { onFilesystemAccess } = options
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const revision = deepFreeze(identifyRevision(revisionDescriptor))
  const revisionRoot = path.join(absoluteRepositoryRoot, revision.sourceDirectory)
  const contextFile = path.join(revisionRoot, 'README.md')
  const markdownFiles = await listMarkdownFiles(
    revisionRoot,
    onFilesystemAccess,
  )
  const documentFiles = markdownFiles.filter(filename => filename !== contextFile)

  const context = await parseDocument(
    absoluteRepositoryRoot,
    revision,
    contextFile,
    onFilesystemAccess,
  )
  const documents = []

  for (const filename of documentFiles) {
    documents.push(await parseDocument(
      absoluteRepositoryRoot,
      revision,
      filename,
      onFilesystemAccess,
    ))
  }

  return deepFreeze({
    revision,
    context,
    documents,
  })
}

export async function loadArchitecture(repositoryRoot, options = {}) {
  const { onFilesystemAccess } = options
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const plansRoot = path.join(absoluteRepositoryRoot, 'groma', 'plans')
  recordFilesystemAccess(onFilesystemAccess, 'read-directory', plansRoot)
  const planEntries = await readdir(plansRoot, { withFileTypes: true })
  const revisionDescriptors = [
    { kind: 'observed' },
    ...planEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .map(name => ({ kind: 'plan', name })),
  ]
  const revisions = []

  for (const revision of revisionDescriptors) {
    revisions.push(await loadRevision(
      absoluteRepositoryRoot,
      revision,
      options,
    ))
  }

  return deepFreeze(revisions)
}
