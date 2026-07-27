import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildArchitectureModel } from '../src/architecture-model.mjs'
import { loadRevision } from '../src/architecture-reader.mjs'
import { projectArchitectureView } from '../src/viewer/projection.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

const loadedRevision = await loadRevision(
  repositoryRoot,
  { kind: 'plan', name: '02-live-viewer' },
)
const model = buildArchitectureModel(loadedRevision)
const plan03Model = buildArchitectureModel(await loadRevision(
  repositoryRoot,
  { kind: 'plan', name: '03-code-observation' },
))

function nodeByElementId(view, elementId) {
  return view.nodes.find(node => node.data.elementId === elementId)
}

function syntheticComparisonModels() {
  const shared = [
    {
      id: 'architect',
      kind: 'person',
      name: 'Architect',
      description: 'Studies the architecture.',
      parentId: null,
      external: false,
    },
    {
      id: 'groma',
      kind: 'system',
      name: 'Groma',
      description: 'Keeps architecture readable.',
      parentId: null,
      external: false,
    },
    {
      id: 'platform',
      kind: 'container',
      name: 'Platform',
      description: 'Hosts architecture capabilities.',
      parentId: 'groma',
      external: false,
    },
    {
      id: 'stable-component',
      kind: 'component',
      name: 'Stable component',
      description: 'Stays architecturally equivalent.',
      parentId: 'platform',
      external: false,
    },
  ]
  const observedElements = [
    ...shared,
    {
      id: 'legacy-system',
      kind: 'system',
      name: 'Legacy system',
      description: 'Connects only to the observed design.',
      parentId: null,
      external: true,
    },
    {
      id: 'legacy-container',
      kind: 'container',
      name: 'Legacy container',
      description: 'Will leave the desired design.',
      parentId: 'groma',
      external: false,
    },
    {
      id: 'changed-component',
      kind: 'component',
      name: 'Current component',
      description: 'Current responsibility.',
      parentId: 'platform',
      external: false,
    },
    {
      id: 'legacy-component',
      kind: 'component',
      name: 'Legacy component',
      description: 'Will be removed.',
      parentId: 'platform',
      external: false,
    },
  ]
  const plannedElements = [
    ...shared.map(element => ({
      ...element,
      sourceFilename: `groma/plans/synthetic/${element.id}.md`,
      position: { x: 999, y: 999 },
      selected: true,
    })),
    {
      id: 'future-system',
      kind: 'system',
      name: 'Future system',
      description: 'Connects only to the desired design.',
      parentId: null,
      external: true,
    },
    {
      id: 'future-container',
      kind: 'container',
      name: 'Future container',
      description: 'Will join the desired design.',
      parentId: 'groma',
      external: false,
    },
    {
      id: 'changed-component',
      kind: 'component',
      name: 'Planned component',
      description: 'Planned responsibility.',
      parentId: 'platform',
      external: false,
    },
    {
      id: 'future-component',
      kind: 'component',
      name: 'Future component',
      description: 'Will be added.',
      parentId: 'platform',
      external: false,
    },
  ]
  const unchangedRelationship = {
    sourceId: 'architect',
    targetId: 'stable-component',
    description: 'Studies architecture',
    technology: 'Browser',
  }

  return {
    observed: {
      revision: {
        kind: 'observed',
        sourceDirectory: 'groma/observed',
      },
      elements: observedElements.map(element => ({
        ...element,
        sourceFilename: `groma/observed/${element.id}.md`,
      })),
      relationships: [
        {
          ...unchangedRelationship,
          sourceFilename: 'groma/observed/architect.md',
          targetSourceFilename: 'groma/observed/stable-component.md',
        },
        {
          sourceId: 'legacy-system',
          targetId: 'legacy-component',
          description: 'Uses the legacy component',
          technology: 'Observed API',
          sourceFilename: 'groma/observed/legacy-system.md',
          targetSourceFilename: 'groma/observed/legacy-component.md',
        },
      ],
    },
    planned: {
      revision: {
        kind: 'plan',
        name: 'synthetic',
        sourceDirectory: 'groma/plans/synthetic',
      },
      elements: plannedElements,
      relationships: [
        {
          ...unchangedRelationship,
          sourceFilename: 'groma/plans/synthetic/architect.md',
          targetSourceFilename: 'groma/plans/synthetic/stable-component.md',
        },
        {
          sourceId: 'future-system',
          targetId: 'future-component',
          description: 'Uses the future component',
          technology: 'Planned API',
          sourceFilename: 'groma/plans/synthetic/future-system.md',
          targetSourceFilename: 'groma/plans/synthetic/future-component.md',
        },
      ],
    },
  }
}

function modelWithSyntheticContext() {
  const elements = [
    {
      id: 'connected-person',
      kind: 'person',
      name: 'Connected person',
      description: 'Uses a focal component.',
      parentId: null,
      external: false,
      sourceFilename: 'synthetic/connected-person.md',
    },
    {
      id: 'connected-system',
      kind: 'system',
      name: 'Connected system',
      description: 'Supplies a focal component.',
      parentId: null,
      external: true,
      sourceFilename: 'synthetic/connected-system.md',
    },
    {
      id: 'unrelated-person',
      kind: 'person',
      name: 'Unrelated person',
      description: 'Uses only an unrelated system.',
      parentId: null,
      external: false,
      sourceFilename: 'synthetic/unrelated-person.md',
    },
    {
      id: 'unrelated-system',
      kind: 'system',
      name: 'Unrelated system',
      description: 'Has no relationship with Groma.',
      parentId: null,
      external: true,
      sourceFilename: 'synthetic/unrelated-system.md',
    },
  ]
  const relationships = [
    {
      sourceId: 'connected-person',
      targetId: 'canvas',
      description: 'Uses the canvas',
      technology: 'Browser',
    },
    {
      sourceId: 'connected-system',
      targetId: 'architecture-model',
      description: 'Supplies architecture data',
      technology: 'Local API',
    },
    {
      sourceId: 'unrelated-person',
      targetId: 'unrelated-system',
      description: 'Uses an unrelated system',
      technology: 'Browser',
    },
  ]

  return {
    ...model,
    elements: [...model.elements, ...elements],
    relationships: [...model.relationships, ...relationships],
  }
}

test('projects the opening system context with promoted labeled relationships', () => {
  const view = projectArchitectureView(model, 'groma', [])

  assert.equal(view.level, 'context')
  assert.deepEqual(
    view.nodes.map(node => node.data.elementId),
    ['coding-agent', 'human-architect', 'groma', 'git'],
  )
  assert.ok(view.nodes.every(node => node.parentId === undefined))
  assert.ok(nodeByElementId(view, 'groma').data.expandable)
  assert.ok(view.edges.every(edge => edge.markerEnd?.type === 'arrowclosed'))
  assert.deepEqual(view.edges[0].data, {
    sourceName: 'Coding agent',
    targetName: 'Groma',
    labels: [
      'Reads plans and records materialized architecture · Markdown and Git',
      'Inspects architecture during implementation · Local web interface',
    ],
    accessibleLabel:
      'Relationship from Coding agent to Groma: '
      + 'Reads plans and records materialized architecture · Markdown and Git; '
      + 'Inspects architecture during implementation · Local web interface',
  })

  assert.deepEqual(
    view.edges.map(edge => [edge.source, edge.target, edge.label]),
    [
      [
        'element:coding-agent',
        'element:groma',
        'Reads plans and records materialized architecture · Markdown and Git\n'
        + 'Inspects architecture during implementation · Local web interface',
      ],
      [
        'element:groma',
        'element:git',
        'Versions and reviews architecture changes · Git',
      ],
      [
        'element:human-architect',
        'element:groma',
        'Authors current and planned architecture · Markdown and Git\n'
        + 'Explores architecture and plan revisions · Local web interface',
      ],
    ],
  )
})

test('Plan 03 component projections keep component-bearing sibling containers expandable', () => {
  const viewer = projectArchitectureView(
    plan03Model,
    'groma',
    ['groma', 'viewer'],
  )
  const scanner = projectArchitectureView(
    plan03Model,
    'groma',
    ['groma', 'scanner'],
  )

  assert.equal(viewer.level, 'component')
  assert.equal(nodeByElementId(viewer, 'scanner').data.expandable, true)
  assert.equal(scanner.level, 'component')
  assert.equal(nodeByElementId(scanner, 'viewer').data.expandable, true)
  assert.ok(nodeByElementId(scanner, 'source-watcher'))
  assert.ok(nodeByElementId(scanner, 'typescript-observer'))
  assert.ok(nodeByElementId(scanner, 'markdown-emitter'))
})

test('comparison classifies and draws root additions, removals, and unchanged elements', () => {
  const { observed, planned } = syntheticComparisonModels()
  const view = projectArchitectureView(
    planned,
    'groma',
    [],
    { observedModel: observed },
  )

  assert.equal(nodeByElementId(view, 'future-system').data.comparisonStatus, 'addition')
  assert.equal(nodeByElementId(view, 'legacy-system').data.comparisonStatus, 'removal')
  assert.equal(nodeByElementId(view, 'architect').data.comparisonStatus, 'unchanged')
  assert.equal(nodeByElementId(view, 'groma').data.comparisonStatus, 'unchanged')
})

test('comparison preserves planned and observed-only containment at container level', () => {
  const { observed, planned } = syntheticComparisonModels()
  const view = projectArchitectureView(
    planned,
    'groma',
    ['groma'],
    { observedModel: observed },
  )
  const boundary = nodeByElementId(view, 'groma')

  assert.equal(boundary.data.comparisonStatus, 'unchanged')
  assert.equal(
    nodeByElementId(view, 'future-container').data.comparisonStatus,
    'addition',
  )
  assert.equal(
    nodeByElementId(view, 'legacy-container').data.comparisonStatus,
    'removal',
  )
  assert.equal(nodeByElementId(view, 'future-container').parentId, boundary.id)
  assert.equal(nodeByElementId(view, 'legacy-container').parentId, boundary.id)
})

test('comparison draws component additions, modifications, removals, and unchanged content', () => {
  const { observed, planned } = syntheticComparisonModels()
  const view = projectArchitectureView(
    planned,
    'groma',
    ['groma', 'platform'],
    { observedModel: observed },
  )

  assert.equal(
    nodeByElementId(view, 'future-component').data.comparisonStatus,
    'addition',
  )
  assert.equal(
    nodeByElementId(view, 'changed-component').data.comparisonStatus,
    'modification',
  )
  assert.equal(
    nodeByElementId(view, 'legacy-component').data.comparisonStatus,
    'removal',
  )
  assert.equal(
    nodeByElementId(view, 'stable-component').data.comparisonStatus,
    'unchanged',
  )
  assert.equal(
    nodeByElementId(view, 'changed-component').data.name,
    'Planned component',
  )
})

test('comparison is deterministic and ignores revision, source, and runtime metadata', () => {
  const { observed, planned } = syntheticComparisonModels()
  const before = JSON.stringify({ observed, planned })
  const first = projectArchitectureView(
    planned,
    'groma',
    ['groma', 'platform'],
    { observedModel: observed },
  )
  const second = projectArchitectureView(
    {
      ...planned,
      revision: {
        kind: 'plan',
        name: 'renamed-revision',
        sourceDirectory: 'elsewhere',
      },
      elements: [...planned.elements].reverse(),
      relationships: [...planned.relationships].reverse(),
    },
    'groma',
    ['groma', 'platform'],
    { observedModel: observed },
  )

  assert.deepEqual(second, first)
  assert.equal(
    nodeByElementId(first, 'stable-component').data.comparisonStatus,
    'unchanged',
  )
  assert.equal(JSON.stringify({ observed, planned }), before)
})

test('comparison treats outgoing relationship content as source element architecture', () => {
  const { observed, planned } = syntheticComparisonModels()
  const changedRelationshipPlan = {
    ...planned,
    relationships: planned.relationships.map(relationship => {
      return relationship.sourceId === 'architect'
        ? { ...relationship, technology: 'Planned desktop app' }
        : relationship
    }),
  }
  const view = projectArchitectureView(
    changedRelationshipPlan,
    'groma',
    [],
    { observedModel: observed },
  )

  assert.equal(
    nodeByElementId(view, 'architect').data.comparisonStatus,
    'modification',
  )
  assert.equal(
    nodeByElementId(view, 'groma').data.comparisonStatus,
    'unchanged',
  )
})

test('system context excludes roots without a relationship to the focal subtree', () => {
  const view = projectArchitectureView(modelWithSyntheticContext(), 'groma', [])
  const elementIds = view.nodes.map(node => node.data.elementId)

  assert.ok(elementIds.includes('connected-person'))
  assert.ok(elementIds.includes('connected-system'))
  assert.ok(!elementIds.includes('unrelated-person'))
  assert.ok(!elementIds.includes('unrelated-system'))
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-person'
      && edge.target === 'element:groma'
  }))
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-system'
      && edge.target === 'element:groma'
  }))
})

test('replaces the focal system with its container boundary and preserves context', () => {
  const view = projectArchitectureView(model, 'groma', ['groma'])
  const systemBoundary = nodeByElementId(view, 'groma')
  const workspace = nodeByElementId(view, 'architecture-workspace')
  const viewer = nodeByElementId(view, 'viewer')

  assert.equal(view.level, 'container')
  assert.equal(systemBoundary.type, 'boundary')
  assert.equal(workspace.parentId, systemBoundary.id)
  assert.equal(viewer.parentId, systemBoundary.id)
  assert.equal(workspace.parentId, viewer.parentId)
  assert.ok(viewer.data.expandable)
  assert.ok(nodeByElementId(view, 'coding-agent'))
  assert.ok(nodeByElementId(view, 'human-architect'))
  assert.ok(nodeByElementId(view, 'git'))
  assert.ok(view.edges.some(edge => {
    return edge.source === workspace.id && edge.target === nodeByElementId(view, 'git').id
  }))
})

test('container view preserves only root context connected to the focal subtree', () => {
  const view = projectArchitectureView(
    modelWithSyntheticContext(),
    'groma',
    ['groma'],
  )
  const elementIds = view.nodes.map(node => node.data.elementId)

  assert.ok(elementIds.includes('connected-person'))
  assert.ok(elementIds.includes('connected-system'))
  assert.ok(!elementIds.includes('unrelated-person'))
  assert.ok(!elementIds.includes('unrelated-system'))
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-person'
      && edge.target === 'element:viewer'
  }))
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-system'
      && edge.target === 'element:viewer'
  }))
})

test('reveals components without nesting collaborating containers or systems', () => {
  const view = projectArchitectureView(model, 'groma', ['groma', 'viewer'])
  const systemBoundary = nodeByElementId(view, 'groma')
  const viewerBoundary = nodeByElementId(view, 'viewer')
  const workspace = nodeByElementId(view, 'architecture-workspace')
  const git = nodeByElementId(view, 'git')
  const componentIds = [
    'architecture-model',
    'canvas',
    'markdown-reader',
    'markdown-watcher',
  ]

  assert.equal(view.level, 'component')
  assert.equal(viewerBoundary.type, 'boundary')
  assert.equal(viewerBoundary.parentId, systemBoundary.id)
  assert.equal(workspace.parentId, systemBoundary.id)
  assert.notEqual(workspace.parentId, viewerBoundary.id)
  assert.equal(git.parentId, undefined)
  assert.ok(componentIds.every(id => {
    return nodeByElementId(view, id).parentId === viewerBoundary.id
  }))
  assert.ok(view.edges.some(edge => {
    return edge.source === nodeByElementId(view, 'markdown-watcher').id
      && edge.target === workspace.id
  }))
})

test('component view preserves only root context connected to the focal subtree', () => {
  const view = projectArchitectureView(
    modelWithSyntheticContext(),
    'groma',
    ['groma', 'viewer'],
  )
  const elementIds = view.nodes.map(node => node.data.elementId)

  assert.ok(elementIds.includes('connected-person'))
  assert.ok(elementIds.includes('connected-system'))
  assert.ok(!elementIds.includes('unrelated-person'))
  assert.ok(!elementIds.includes('unrelated-system'))
  assert.equal(
    nodeByElementId(view, 'architecture-workspace').parentId,
    nodeByElementId(view, 'viewer').parentId,
  )
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-person'
      && edge.target === 'element:canvas'
  }))
  assert.ok(view.edges.some(edge => {
    return edge.source === 'element:connected-system'
      && edge.target === 'element:architecture-model'
  }))
})

test('projection is pure and focus remains caller-owned interaction state', () => {
  const before = JSON.stringify(model)
  const context = projectArchitectureView(model, 'groma', [])
  const containers = projectArchitectureView(model, 'groma', ['groma'])
  const returned = projectArchitectureView(model, 'groma', [])

  assert.deepEqual(returned, context)
  assert.notDeepEqual(containers, context)
  assert.equal(JSON.stringify(model), before)
  assert.equal(
    model.elements.some(element => {
      return 'position' in element || 'selected' in element || 'focus' in element
    }),
    false,
  )
})
