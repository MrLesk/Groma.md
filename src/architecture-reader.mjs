import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { parse } from 'comark'

export class ArchitectureReadError extends Error {
  constructor(sourceFilename, revision, cause) {
    super(`Comark could not parse ${sourceFilename}: ${cause.message}`, { cause })
    this.name = 'ArchitectureReadError'
    this.sourceFilename = sourceFilename
    this.revision = revision
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

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listMarkdownFiles(entryPath))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function identifyRevision(revisionId) {
  if (revisionId === 'observed') {
    return {
      id: revisionId,
      kind: 'observed',
      sourceDirectory: 'groma/observed',
    }
  }

  if (
    typeof revisionId !== 'string'
    || revisionId.length === 0
    || revisionId === '.'
    || revisionId === '..'
    || revisionId.includes('/')
    || revisionId.includes('\\')
  ) {
    throw new TypeError('A plan revision must be identified by its directory name')
  }

  return {
    id: revisionId,
    kind: 'plan',
    sourceDirectory: `groma/plans/${revisionId}`,
  }
}

async function parseDocument(repositoryRoot, revision, filename) {
  const sourceFilename = repositoryRelative(repositoryRoot, filename)

  try {
    const source = await readFile(filename, 'utf8')
    const tree = await parse(source)
    const data = JSON.parse(JSON.stringify({
      sourceFilename,
      nodes: tree.nodes,
      frontmatter: tree.frontmatter,
    }))

    return deepFreeze(data)
  } catch (error) {
    throw new ArchitectureReadError(sourceFilename, revision, error)
  }
}

export async function loadRevision(repositoryRoot, revisionId) {
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const revision = deepFreeze(identifyRevision(revisionId))
  const revisionRoot = path.join(absoluteRepositoryRoot, revision.sourceDirectory)
  const contextFile = path.join(revisionRoot, 'README.md')
  const markdownFiles = await listMarkdownFiles(revisionRoot)
  const documentFiles = markdownFiles.filter(filename => filename !== contextFile)

  const context = await parseDocument(absoluteRepositoryRoot, revision, contextFile)
  const documents = []

  for (const filename of documentFiles) {
    documents.push(await parseDocument(absoluteRepositoryRoot, revision, filename))
  }

  return deepFreeze({
    revision,
    context,
    documents,
  })
}

export async function loadArchitecture(repositoryRoot) {
  const absoluteRepositoryRoot = path.resolve(repositoryRoot)
  const plansRoot = path.join(absoluteRepositoryRoot, 'groma', 'plans')
  const planEntries = await readdir(plansRoot, { withFileTypes: true })
  const revisionIds = [
    'observed',
    ...planEntries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(),
  ]
  const revisions = []

  for (const revisionId of revisionIds) {
    revisions.push(await loadRevision(absoluteRepositoryRoot, revisionId))
  }

  return deepFreeze(revisions)
}
