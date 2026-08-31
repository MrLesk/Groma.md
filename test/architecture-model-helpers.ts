import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  ArchitectureDocument,
  ArchitectureFrontmatter,
  C4Kind,
  MarkdownElement,
  MarkdownNode,
  RevisionRecord,
} from '../src/types.ts'
import { c4Type } from '../src/okf-profile.ts'

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

export function revisionRecord(
  documents: ArchitectureDocument[],
): Pick<RevisionRecord, 'revision' | 'documents'> {
  return {
    revision: {
      kind: 'plan',
      name: 'test-revision',
      sourceDirectory: 'groma/plans/test-revision',
    },
    documents,
  }
}

interface RelationshipFixture {
  href: string
  label?: string
  description: string
  technology: string
}

interface ElementDocumentFixture {
  id: string
  kind: C4Kind
  title?: string
  description?: string
  sourceFilename: string
  parent?: string | null
  external?: unknown
  group?: unknown
  technology?: unknown
  code?: unknown
  relationships?: RelationshipFixture[]
}

export function elementDocument({
  id,
  kind,
  title = id,
  description,
  sourceFilename,
  parent,
  external,
  group,
  technology,
  code,
  relationships = [],
}: ElementDocumentFixture): ArchitectureDocument {
  const groma: Record<string, unknown> = { id }
  const frontmatter: ArchitectureFrontmatter = {
    type: c4Type(kind),
    title,
    ...(description === undefined ? {} : { description }),
    groma,
  }
  if (parent !== undefined) {
    groma.parent = parent
  }
  if (external !== undefined) {
    groma.external = external
  }
  if (group !== undefined) {
    groma.group = group
  }
  if (technology !== undefined) groma.technology = technology
  if (code !== undefined) groma.code = code

  const nodes: MarkdownNode[] = [
    ['p', {}, `${id} responsibility`],
  ]

  if (relationships.length > 0) {
    nodes.push(
      ['h2', { id: 'relationships' }, 'Relationships'],
      [
        'table',
        {},
        [
          'thead',
          {},
          [
            'tr',
            {},
            ['th', {}, 'Target'],
            ['th', {}, 'Description'],
            ['th', {}, 'Technology'],
          ],
        ],
        [
          'tbody',
          {},
          ...relationships.map((relationship): MarkdownElement => [
            'tr',
            {},
            ['td', {}, ['a', { href: relationship.href }, relationship.label ?? 'Target']],
            ['td', {}, relationship.description],
            ['td', {}, relationship.technology],
          ]),
        ],
      ] as MarkdownElement,
    )
  }

  return { sourceFilename, body: `${id} responsibility`, frontmatter, nodes }
}
