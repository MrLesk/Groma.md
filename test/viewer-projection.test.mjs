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

function nodeByElementId(view, elementId) {
  return view.nodes.find(node => node.data.elementId === elementId)
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
