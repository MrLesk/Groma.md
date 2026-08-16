import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  ArchitectureModelError,
  buildArchitectureModel,
} from '../src/architecture-model.ts'
import { loadRevision } from '../src/architecture-reader.ts'
import type {
  ArchitectureDocument,
  ArchitectureFrontmatter,
  C4Kind,
  MarkdownElement,
  MarkdownNode,
  RevisionRecord,
} from '../src/types.ts'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function revisionRecord(
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

function elementDocument({
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

test('exports a revision model builder', () => {
  assert.equal(typeof buildArchitectureModel, 'function')
})

test('builds a serializable revision-local C4 graph with Code references', async () => {
  const loadedRevision = await loadRevision(
    path.join(repositoryRoot, 'test', 'fixtures', 'core-view'),
    { kind: 'observed' },
  )
  const model = buildArchitectureModel(loadedRevision)
  const reloadedModel = buildArchitectureModel(await loadRevision(
    path.join(repositoryRoot, 'test', 'fixtures', 'core-view'),
    { kind: 'observed' },
  ))

  assert.deepEqual(model, reloadedModel)
  assert.deepEqual(Object.keys(model), ['revision', 'elements', 'relationships'])
  assert.deepEqual(model.revision, {
    kind: 'observed',
    sourceDirectory: 'groma/observed',
  })
  assert.deepEqual(
    model.elements.map(element => element.id),
    ['api', 'orders', 'payments', 'shop'],
  )
  assert.deepEqual(
    model.elements.find(element => element.id === 'orders'),
    {
      id: 'orders',
      kind: 'component',
      name: 'Orders',
      description: 'Places and tracks customer orders.',
      parentId: 'api',
      external: false,
      code: [
        {
          scanner: 'typescript',
          file: 'src/orders.ts',
          symbol: 'placeOrder',
        },
        {
          scanner: 'routes',
          file: 'src/routes/orders.ts',
        },
      ],
      sourceFilename:
        'groma/observed/systems/shop/containers/api/components/orders.md',
    },
  )
  assert.equal(model.relationships.length, 1)
  assert.deepEqual(
    model.relationships[0],
    {
      sourceId: 'orders',
      targetId: 'payments',
      description: 'Requests payment authorization',
      technology: 'HTTPS',
      sourceFilename:
        'groma/observed/systems/shop/containers/api/components/orders.md',
      targetSourceFilename:
        'groma/observed/systems/payments/system.md',
    },
  )
  assert.doesNotThrow(() => JSON.stringify(model))
  assert.ok(Object.isFrozen(model))
  assert.ok(Object.isFrozen(model.revision))
  assert.ok(Object.isFrozen(model.elements))
  assert.ok(Object.isFrozen(model.elements[0]))
  assert.ok(Object.isFrozen(model.relationships))
  assert.ok(Object.isFrozen(model.relationships[0]))
})

test('keeps the group on the element and omits it otherwise', () => {
  const model = buildArchitectureModel(revisionRecord([
    elementDocument({
      id: 'grouped-system',
      kind: 'system',
      group: 'Edge services',
      sourceFilename: 'groma/plans/test-revision/systems/grouped-system/system.md',
    }),
    elementDocument({
      id: 'plain-system',
      kind: 'system',
      sourceFilename: 'groma/plans/test-revision/systems/plain-system/system.md',
    }),
  ]))

  const grouped = model.elements.find(element => element.id === 'grouped-system')
  const plain = model.elements.find(element => element.id === 'plain-system')
  assert.equal(grouped?.group, 'Edge services')
  assert.ok(plain)
  assert.equal(Object.hasOwn(plain, 'group'), false)
})

test('resolves a relationship link to the target document stable id', () => {
  const source = elementDocument({
    id: 'architect',
    kind: 'person',
    sourceFilename: 'groma/plans/test-revision/people/architect.md',
    relationships: [{
      href: '../systems/platform/system.md#context',
      label: 'Readable platform name',
      description: 'Uses the platform',
      technology: 'Browser',
    }],
  })
  const target = elementDocument({
    id: 'stable-platform-id',
    kind: 'system',
    sourceFilename: 'groma/plans/test-revision/systems/platform/system.md',
  })

  const model = buildArchitectureModel(revisionRecord([target, source]))

  assert.deepEqual(model.relationships, [{
    sourceId: 'architect',
    targetId: 'stable-platform-id',
    description: 'Uses the platform',
    technology: 'Browser',
    sourceFilename: 'groma/plans/test-revision/people/architect.md',
    targetSourceFilename: 'groma/plans/test-revision/systems/platform/system.md',
  }])
})

test('orders equivalent unchanged revisions deterministically', () => {
  const system = elementDocument({
    id: 'z-system',
    kind: 'system',
    sourceFilename: 'groma/plans/test-revision/systems/z/system.md',
  })
  const person = elementDocument({
    id: 'a-person',
    kind: 'person',
    sourceFilename: 'groma/plans/test-revision/people/a.md',
    relationships: [
      {
        href: '../systems/z/system.md',
        description: 'Second alphabetically',
        technology: 'Two',
      },
      {
        href: '../systems/z/system.md',
        description: 'First alphabetically',
        technology: 'One',
      },
    ],
  })

  const first = buildArchitectureModel(revisionRecord([system, person]))
  const second = buildArchitectureModel(revisionRecord([person, system]))

  assert.deepEqual(first, second)
  assert.deepEqual(first.elements.map(element => element.id), ['a-person', 'z-system'])
  assert.deepEqual(
    first.relationships.map(relationship => relationship.description),
    ['First alphabetically', 'Second alphabetically'],
  )
})

for (const {
  name,
  documents,
  code,
  sourceFilename,
  message,
} of [
  {
    name: 'reports a quoted external true value instead of coercing it',
    documents: [
      elementDocument({
        id: 'quoted-external-system',
        kind: 'system',
        external: 'true',
        sourceFilename:
          'groma/plans/test-revision/systems/quoted-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/quoted-external-system/system.md',
    message: /external must be a boolean/,
  },
  {
    name: 'reports an explicitly false external field',
    documents: [
      elementDocument({
        id: 'false-external-system',
        kind: 'system',
        external: false,
        sourceFilename:
          'groma/plans/test-revision/systems/false-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/false-external-system/system.md',
    message: /external may only be present with the value true/,
  },
  {
    name: 'reports a null external value instead of coercing it',
    documents: [
      elementDocument({
        id: 'null-external-system',
        kind: 'system',
        external: null,
        sourceFilename:
          'groma/plans/test-revision/systems/null-external-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/null-external-system/system.md',
    message: /external must be a boolean/,
  },
  {
    name: 'reports an external person',
    documents: [
      elementDocument({
        id: 'external-person',
        kind: 'person',
        external: true,
        sourceFilename: 'groma/plans/test-revision/people/external-person.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename: 'groma/plans/test-revision/people/external-person.md',
    message: /only a system can be external.*"external-person" is a person/,
  },
  {
    name: 'reports a duplicate stable id at the second document',
    documents: [
      elementDocument({
        id: 'same-id',
        kind: 'person',
        sourceFilename: 'groma/plans/test-revision/people/first.md',
      }),
      elementDocument({
        id: 'same-id',
        kind: 'system',
        sourceFilename: 'groma/plans/test-revision/systems/second/system.md',
      }),
    ],
    code: 'DUPLICATE_ID',
    sourceFilename: 'groma/plans/test-revision/systems/second/system.md',
    message: /duplicate id "same-id".*people\/first\.md/,
  },
  {
    name: 'reports an unknown parent id at the contained document',
    documents: [
      elementDocument({
        id: 'orphan',
        kind: 'container',
        parent: 'missing-system',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/orphan/container.md',
      }),
    ],
    code: 'UNKNOWN_PARENT_ID',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/orphan/container.md',
    message: /unknown parent id "missing-system"/,
  },
  {
    name: 'reports a parent with the wrong C4 kind',
    documents: [
      elementDocument({
        id: 'person-parent',
        kind: 'person',
        sourceFilename: 'groma/plans/test-revision/people/person-parent.md',
      }),
      elementDocument({
        id: 'wrongly-contained',
        kind: 'container',
        parent: 'person-parent',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/wrong/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/wrong/container.md',
    message: /container "wrongly-contained" requires a system parent.*is a person/,
  },
  {
    name: 'reports a root C4 element with an explicitly null parent',
    documents: [
      elementDocument({
        id: 'null-parent-person',
        kind: 'person',
        parent: null,
        sourceFilename: 'groma/plans/test-revision/people/null-parent-person.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/plans/test-revision/people/null-parent-person.md',
    message: /person "null-parent-person" cannot declare a parent/,
  },
  {
    name: 'reports a root C4 element with an empty parent',
    documents: [
      elementDocument({
        id: 'empty-parent-system',
        kind: 'system',
        parent: '',
        sourceFilename:
          'groma/plans/test-revision/systems/empty-parent-system/system.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/empty-parent-system/system.md',
    message: /system "empty-parent-system" cannot declare a parent/,
  },
  {
    name: 'reports a root C4 element that declares a parent',
    documents: [
      elementDocument({
        id: 'nested-person',
        kind: 'person',
        parent: 'some-system',
        sourceFilename: 'groma/plans/test-revision/people/nested-person.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename: 'groma/plans/test-revision/people/nested-person.md',
    message: /person "nested-person" cannot declare a parent/,
  },
  {
    name: 'reports a contained C4 element with an omitted parent',
    documents: [
      elementDocument({
        id: 'missing-parent-container',
        kind: 'container',
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/missing/container.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/missing/container.md',
    message: /container "missing-parent-container" requires a system parent id/,
  },
  {
    name: 'reports a contained C4 element with an explicitly null parent',
    documents: [
      elementDocument({
        id: 'null-parent-component',
        kind: 'component',
        parent: null,
        sourceFilename:
          'groma/plans/test-revision/systems/groma/containers/viewer/components/'
          + 'null-parent-component.md',
      }),
    ],
    code: 'INVALID_PARENT',
    sourceFilename:
      'groma/plans/test-revision/systems/groma/containers/viewer/components/'
      + 'null-parent-component.md',
    message: /component "null-parent-component" requires a container parent id/,
  },
  {
    name: 'reports an unresolved relationship link at its source document',
    documents: [
      elementDocument({
        id: 'architect',
        kind: 'person',
        sourceFilename: 'groma/plans/test-revision/people/architect.md',
        relationships: [{
          href: '../systems/missing/system.md',
          description: 'Uses missing software',
          technology: 'Browser',
        }],
      }),
    ],
    code: 'UNKNOWN_RELATIONSHIP_TARGET',
    sourceFilename: 'groma/plans/test-revision/people/architect.md',
    message: /relationship target.*systems\/missing\/system\.md.*does not resolve/,
  },
  {
    name: 'reports a group that is not a string',
    documents: [
      elementDocument({
        id: 'numeric-group-system',
        kind: 'system',
        group: 7,
        sourceFilename:
          'groma/plans/test-revision/systems/numeric-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/numeric-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
  {
    name: 'reports a blank group',
    documents: [
      elementDocument({
        id: 'blank-group-system',
        kind: 'system',
        group: '  ',
        sourceFilename:
          'groma/plans/test-revision/systems/blank-group-system/system.md',
      }),
    ],
    code: 'INVALID_ELEMENT',
    sourceFilename:
      'groma/plans/test-revision/systems/blank-group-system/system.md',
    message: /group must be a non-empty string when present/,
  },
]) {
  test(name, () => {
    assert.throws(
      () => buildArchitectureModel(revisionRecord(documents)),
      error => {
        assert.ok(error instanceof ArchitectureModelError)
        assert.equal(error.code, code)
        assert.equal(error.sourceFilename, sourceFilename)
        assert.match(error.message, message)
        return true
      },
    )
  })
}

test('contains no presentation state', async () => {
  const loadedRevision = await loadRevision(
    repositoryRoot,
    { kind: 'observed' },
  )

  const model = buildArchitectureModel(loadedRevision)
  const forbiddenKeys = new Set([
    'coordinates',
    'x',
    'y',
    'zoom',
    'selection',
    'selected',
    'color',
    'colors',
    'position',
    'layout',
  ])

  function assertNoPresentationState(value: unknown): void {
    if (value === null || typeof value !== 'object') {
      return
    }
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `unexpected presentation key "${key}"`)
      assertNoPresentationState(child)
    }
  }

  assertNoPresentationState(model)
})
