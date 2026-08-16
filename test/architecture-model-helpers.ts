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
  sourceFilename: string
  parent?: string | null
  external?: unknown
  group?: unknown
  relationships?: RelationshipFixture[]
}

export function elementDocument({
  id,
  kind,
  sourceFilename,
  parent,
  external,
  group,
  relationships = [],
}: ElementDocumentFixture): ArchitectureDocument {
  const frontmatter: ArchitectureFrontmatter = { id, kind }
  if (parent !== undefined) {
    frontmatter.parent = parent
  }
  if (external !== undefined) {
    frontmatter.external = external
  }
  if (group !== undefined) {
    frontmatter.group = group
  }

  const nodes: MarkdownNode[] = [
    ['h1', { id }, id],
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

  return { sourceFilename, frontmatter, nodes }
}
