import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  ArchitectureDocument,
  ArchitectureFrontmatter,
  C4Kind,
  MarkdownElement,
  MarkdownNode,
} from '../src/types.ts'
import { c4Type } from '../src/okf-profile.ts'

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

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
  /** The OKF lifecycle word; pass null to build a document without one. */
  status?: unknown
  parent?: string | null
  draft?: unknown
  group?: unknown
  technology?: unknown
  code?: unknown
  /** Extra groma fields, for documents that claim something the profile does not know. */
  extraGroma?: Record<string, unknown>
  relationships?: RelationshipFixture[]
}

export function elementDocument({
  id,
  kind,
  title = id,
  description,
  sourceFilename,
  status = 'stable',
  parent,
  draft,
  group,
  technology,
  code,
  extraGroma = {},
  relationships = [],
}: ElementDocumentFixture): ArchitectureDocument {
  const groma: Record<string, unknown> = { id, ...extraGroma }
  const frontmatter: ArchitectureFrontmatter = {
    type: c4Type(kind),
    title,
    ...(description === undefined ? {} : { description }),
    ...(status === null ? {} : { status }),
    groma,
  }
  if (parent !== undefined) {
    groma.parent = parent
  }
  if (draft !== undefined) groma.draft = draft
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
