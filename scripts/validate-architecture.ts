import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { annotateArchitecture } from '../src/core.ts'
import { c4Kind, requireGromaMapping } from '../src/okf-profile.ts'
import type { ArchitectureRecords, C4Kind } from '../src/types.ts'

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
  id: string
  kind: C4Kind
  parent?: string
}

export interface ValidationResult {
  elementCount: number
  relationshipCount: number
  draftCount: number
  elements: ValidatedElement[]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function validatedElements(
  repositoryRoot: string,
  records: ArchitectureRecords,
): ValidatedElement[] {
  return records.documents.filter(document => c4Kind(document.frontmatter.type) !== undefined).map(document => {
    const groma = requireGromaMapping(document.frontmatter, document.sourceFilename)
    return {
      file: path.join(repositoryRoot, document.sourceFilename),
      id: groma.id as string,
      kind: c4Kind(document.frontmatter.type)!,
      ...(typeof groma.parent === 'string' ? { parent: groma.parent } : {}),
    }
  })
}

async function validateTree(repositoryRoot: string): Promise<ValidationResult> {
  const records = await loadArchitecture(repositoryRoot)
  const annotated = annotateArchitecture(records)
  const elements = validatedElements(repositoryRoot, records)
  if (elements.length === 0) {
    throw new Error('the Groma directory contains no C4 element documents')
  }
  return {
    elementCount: elements.length,
    relationshipCount: annotated.relationships.length,
    draftCount: annotated.drafts.length,
    elements,
  }
}

export async function validateRepository(
  repositoryRoot: string,
): Promise<ValidationResult> {
  const absoluteRoot = path.resolve(repositoryRoot)
  try {
    return await validateTree(absoluteRoot)
  } catch (error) {
    throw new ArchitectureValidationError(absoluteRoot, [errorMessage(error)])
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd())
  try {
    const result = await validateRepository(repositoryRoot)
    console.log(
      `Validated ${result.elementCount} elements, ${result.relationshipCount} relationships, `
      + `${result.draftCount} drafts.`,
    )
  } catch (error) {
    console.error(errorMessage(error))
    process.exitCode = 1
  }
}
