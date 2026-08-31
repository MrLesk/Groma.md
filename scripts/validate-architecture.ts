import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { annotateArchitecture } from '../src/core.ts'
import { c4Kind, requireGromaMapping } from '../src/okf-profile.ts'
import type { C4Kind, Origin, Revision, RevisionRecord } from '../src/types.ts'

export class ArchitectureValidationError extends Error {
  readonly errors: string[]

  constructor(repositoryRoot: string, errors: string[]) {
    super(`${repositoryRoot} is invalid:\n${errors.map(error => `- ${error}`).join('\n')}`)
    this.name = 'ArchitectureValidationError'
    this.errors = errors
  }
}

export interface ValidatedElement {
  file: string
  relativeFile: string
  id: string
  kind: C4Kind
  parent?: string
}

export interface RevisionValidationResult {
  revisionRoot: string
  elementCount: number
  relationshipCount: number
  elements: ValidatedElement[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function originFor(revision: Revision): Origin {
  return revision.kind === 'plan' ? 'planned' : revision.kind
}

function belongsToRevision(
  relationship: { origin: Origin; plan?: string },
  revision: Revision,
): boolean {
  if (relationship.origin !== originFor(revision)) return false
  return revision.kind !== 'plan' || relationship.plan === revision.name
}

function validatedElements(
  repositoryRoot: string,
  record: RevisionRecord,
): ValidatedElement[] {
  return record.documents.map(document => {
    const groma = requireGromaMapping(document.frontmatter, document.sourceFilename)
    return {
      file: path.join(repositoryRoot, document.sourceFilename),
      relativeFile: path.posix.relative(record.revision.sourceDirectory, document.sourceFilename),
      id: groma.id as string,
      kind: c4Kind(document.frontmatter.type)!,
      ...(typeof groma.parent === 'string' ? { parent: groma.parent } : {}),
    }
  })
}

async function validateMarkedPackage(repositoryRoot: string): Promise<RevisionValidationResult[]> {
  const revisions = await loadArchitecture(repositoryRoot)
  const annotated = annotateArchitecture(revisions)
  const results = revisions.map(record => {
    const elements = validatedElements(repositoryRoot, record)
    return {
      revisionRoot: path.join(repositoryRoot, record.revision.sourceDirectory),
      elementCount: elements.length,
      relationshipCount: annotated.relationships.filter(relationship => {
        return belongsToRevision(relationship, record.revision)
      }).length,
      elements,
    }
  })
  if ((results[0]?.elementCount ?? 0) === 0) {
    throw new Error('groma/observed contains no C4 element documents')
  }
  return results
}

export async function validateRepository(
  repositoryRoot: string,
): Promise<RevisionValidationResult[]> {
  const absoluteRoot = path.resolve(repositoryRoot)
  try {
    return await validateMarkedPackage(absoluteRoot)
  } catch (error) {
    throw new ArchitectureValidationError(absoluteRoot, [errorMessage(error)])
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd())
  try {
    const results = await validateRepository(repositoryRoot)
    for (const result of results) {
      console.log(
        `✓ ${path.relative(repositoryRoot, result.revisionRoot)}: `
        + `${result.elementCount} elements, ${result.relationshipCount} relationships`,
      )
    }
    const elementCount = results.reduce((count, result) => count + result.elementCount, 0)
    const relationshipCount = results.reduce((count, result) => count + result.relationshipCount, 0)
    console.log(
      `Validated ${results.length} revisions, ${elementCount} elements, `
      + `${relationshipCount} relationships.`,
    )
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 1
  }
}
