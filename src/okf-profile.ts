import type { C4Kind } from './types.ts'

export const OKF_VERSION = '0.2'
export const GROMA_PROJECT_TYPE = 'Groma Project'
export const GROMA_PROFILE = 'architecture'
export const DRAFT_TYPE = 'Draft'
export const FLOW_TYPE = 'Groma Flow'
export const RELATIONSHIPS_TYPE = 'Groma Relationships'

const typeByKind: Record<C4Kind, string> = {
  actor: 'C4 Actor',
  system: 'C4 System',
  container: 'C4 Container',
  component: 'C4 Component',
}

const kindByType = new Map(
  Object.entries(typeByKind).map(([kind, type]) => [type, kind as C4Kind]),
)

export class GromaProfileError extends Error {
  readonly sourceFilename: string

  constructor(sourceFilename: string, message: string) {
    super(`${sourceFilename}: ${message}`)
    this.name = 'GromaProfileError'
    this.sourceFilename = sourceFilename
  }
}

function mapping(
  value: unknown,
  sourceFilename: string,
  label: string,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GromaProfileError(
      sourceFilename,
      `${label} must be a mapping`,
    )
  }
  return value as Record<string, unknown>
}

function requireNonEmptyString(
  value: unknown,
  sourceFilename: string,
  field: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GromaProfileError(
      sourceFilename,
      `${field} must be a non-empty string`,
    )
  }
  return value
}

export function c4Type(kind: C4Kind): string {
  return typeByKind[kind]
}

export function c4Kind(type: unknown): C4Kind | undefined {
  return typeof type === 'string' ? kindByType.get(type) : undefined
}

export function requireConceptType(
  frontmatter: Record<string, unknown>,
  sourceFilename: string,
): string {
  return requireNonEmptyString(frontmatter.type, sourceFilename, 'type')
}

export function requireBundleIndex(
  frontmatter: Record<string, unknown>,
  sourceFilename: string,
): void {
  const fields = Object.keys(frontmatter)
  if (fields.length !== 1 || fields[0] !== 'okf_version') {
    throw new GromaProfileError(
      sourceFilename,
      'root index frontmatter must contain only okf_version',
    )
  }
  if (frontmatter.okf_version !== OKF_VERSION) {
    throw new GromaProfileError(
      sourceFilename,
      `okf_version must be "${OKF_VERSION}"`,
    )
  }
}

export interface GromaProjectMetadata {
  title: string
  description?: string
}

export function requireProjectMetadata(
  frontmatter: Record<string, unknown>,
  sourceFilename: string,
): GromaProjectMetadata {
  if (requireConceptType(frontmatter, sourceFilename) !== GROMA_PROJECT_TYPE) {
    throw new GromaProfileError(
      sourceFilename,
      `type must be "${GROMA_PROJECT_TYPE}"`,
    )
  }
  const groma = mapping(frontmatter.groma, sourceFilename, 'groma')
  const fields = Object.keys(groma)
  if (fields.length !== 1 || fields[0] !== 'profile' || groma.profile !== GROMA_PROFILE) {
    throw new GromaProfileError(
      sourceFilename,
      `groma must contain only profile: ${GROMA_PROFILE}`,
    )
  }
  const title = requireNonEmptyString(frontmatter.title, sourceFilename, 'title')
  const description = frontmatter.description
  if (description !== undefined && typeof description !== 'string') {
    throw new GromaProfileError(
      sourceFilename,
      'description must be a string when present',
    )
  }
  return {
    title,
    ...(description === undefined ? {} : { description }),
  }
}

export function requireProjectOverview(
  nodes: unknown[],
  body: string,
  sourceFilename: string,
): string {
  if (nodes.some(node => Array.isArray(node) && node[0] === 'h1')) {
    throw new GromaProfileError(
      sourceFilename,
      'project body must not duplicate title with a level-one heading',
    )
  }
  if (!Array.isArray(nodes[0]) || nodes[0][0] !== 'p' || body.trim().length === 0) {
    throw new GromaProfileError(
      sourceFilename,
      'project body must start with overview prose',
    )
  }
  return body.trim()
}

export function requireGromaMapping(
  frontmatter: Record<string, unknown>,
  sourceFilename: string,
): Record<string, unknown> {
  return mapping(frontmatter.groma, sourceFilename, 'groma')
}
