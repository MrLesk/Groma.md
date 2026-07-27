import assert from 'node:assert/strict'
import test from 'node:test'

import { compareArchitectureModels } from '../src/architecture-comparison.mjs'

function system(id) {
  return {
    id,
    kind: 'system',
    name: id,
    description: `${id} system`,
    parentId: null,
    external: false,
  }
}

function model(kind, elements, relationships) {
  return {
    revision: kind === 'observed'
      ? { kind: 'observed' }
      : { kind: 'plan', name: 'comparison-test' },
    elements,
    relationships,
  }
}

test('preserves both containment histories for a moved shared element', () => {
  const observed = model('observed', [
    system('old-system'),
    system('new-system'),
    {
      id: 'moved-container',
      kind: 'container',
      name: 'Moved container',
      description: 'Moves between systems.',
      parentId: 'old-system',
      external: false,
    },
  ], [])
  const planned = model('plan', [
    system('old-system'),
    system('new-system'),
    {
      id: 'moved-container',
      kind: 'container',
      name: 'Moved container',
      description: 'Moves between systems.',
      parentId: 'new-system',
      external: false,
    },
  ], [])

  const comparison = compareArchitectureModels(observed, planned)
  const moved = comparison.elements.find(element => {
    return element.id === 'moved-container'
  })

  assert.equal(moved.comparisonStatus, 'modification')
  assert.equal(moved.observedParentId, 'old-system')
  assert.equal(moved.plannedParentId, 'new-system')
  assert.deepEqual(moved.comparisonMove, {
    observedParentId: 'old-system',
    observedParentName: 'old-system',
    plannedParentId: 'new-system',
    plannedParentName: 'new-system',
  })
})

test('classifies relationship content replacements on a directed endpoint pair', () => {
  const elements = [system('a'), system('b')]
  const observed = model('observed', elements, [
    {
      sourceId: 'a',
      targetId: 'b',
      description: 'Stable label',
      technology: 'HTTP',
    },
    {
      sourceId: 'a',
      targetId: 'b',
      description: 'Current label',
      technology: 'REST',
    },
  ])
  const planned = model('plan', [...elements].reverse(), [
    {
      sourceId: 'a',
      targetId: 'b',
      description: 'Planned label',
      technology: 'Events',
    },
    {
      sourceId: 'a',
      targetId: 'b',
      description: 'Stable label',
      technology: 'HTTP',
    },
  ])

  const comparison = compareArchitectureModels(observed, planned)

  assert.deepEqual(
    comparison.relationships.map(relationship => ({
      comparisonStatus: relationship.comparisonStatus,
      observed: relationship.observed,
      planned: relationship.planned,
    })),
    [
      {
        comparisonStatus: 'modification',
        observed: {
          sourceId: 'a',
          targetId: 'b',
          description: 'Current label',
          technology: 'REST',
        },
        planned: {
          sourceId: 'a',
          targetId: 'b',
          description: 'Planned label',
          technology: 'Events',
        },
      },
      {
        comparisonStatus: 'unchanged',
        observed: {
          sourceId: 'a',
          targetId: 'b',
          description: 'Stable label',
          technology: 'HTTP',
        },
        planned: {
          sourceId: 'a',
          targetId: 'b',
          description: 'Stable label',
          technology: 'HTTP',
        },
      },
    ],
  )
})

test('classifies a relationship direction change as removal plus addition', () => {
  const elements = [system('a'), system('b')]
  const observed = model('observed', elements, [{
    sourceId: 'a',
    targetId: 'b',
    description: 'Signals',
    technology: 'Events',
  }])
  const planned = model('plan', elements, [{
    sourceId: 'b',
    targetId: 'a',
    description: 'Signals',
    technology: 'Events',
  }])

  const first = compareArchitectureModels(observed, planned)
  const second = compareArchitectureModels(
    { ...observed, relationships: [...observed.relationships].reverse() },
    { ...planned, relationships: [...planned.relationships].reverse() },
  )

  assert.deepEqual(first, second)
  assert.deepEqual(
    first.relationships.map(relationship => ({
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      comparisonStatus: relationship.comparisonStatus,
    })),
    [
      { sourceId: 'a', targetId: 'b', comparisonStatus: 'removal' },
      { sourceId: 'b', targetId: 'a', comparisonStatus: 'addition' },
    ],
  )
})
