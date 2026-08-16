import { expect, test } from 'bun:test'

import {
  parentOfElements,
  promotedPeer,
  showsRelationshipText,
} from '../src/viewers/relationship-text.ts'

const parentOf = parentOfElements([
  { representationId: 'world-layout', parent: 'core' },
  { representationId: 'web-map', parent: 'web-viewer' },
  { representationId: 'core', parent: 'groma' },
  { representationId: 'web-viewer', parent: 'groma' },
  { representationId: 'groma', parent: null },
  { representationId: 'workspace', parent: 'groma' },
  { representationId: 'git', parent: null },
])

const layoutToMap = { source: 'world-layout', target: 'web-map' }
const workspaceToGit = { source: 'workspace', target: 'git' }

test.concurrent('relationship text is only for exclusive endpoints', () => {
  expect(showsRelationshipText(layoutToMap, null, parentOf)).toBe(false)
  expect(showsRelationshipText(layoutToMap, 'world-layout', parentOf)).toBe(true)
  expect(showsRelationshipText(layoutToMap, 'web-map', parentOf)).toBe(true)
  expect(showsRelationshipText(layoutToMap, 'core', parentOf)).toBe(true)
  expect(showsRelationshipText(layoutToMap, 'web-viewer', parentOf)).toBe(true)
  expect(showsRelationshipText(layoutToMap, 'groma', parentOf)).toBe(false)
})

test.concurrent('promoted peers sit at the selection depth', () => {
  expect(promotedPeer(layoutToMap, 'world-layout', parentOf)).toEqual({
    outgoing: true,
    peerId: 'web-map',
  })
  expect(promotedPeer(layoutToMap, 'core', parentOf)).toEqual({
    outgoing: true,
    peerId: 'web-viewer',
  })
  expect(promotedPeer(layoutToMap, 'web-viewer', parentOf)).toEqual({
    outgoing: false,
    peerId: 'core',
  })
  expect(promotedPeer(layoutToMap, 'groma', parentOf)).toBe(null)
  expect(promotedPeer(workspaceToGit, 'groma', parentOf)).toEqual({
    outgoing: true,
    peerId: 'git',
  })
})
