import { expect, test } from 'bun:test'

import {
  parentOfElements,
  promotedPeer,
  showsRelationshipText,
} from '../src/viewers/relationship-text.ts'

const parentOf = parentOfElements([
  { representationId: 'world-layout', parent: 'core' },
  { representationId: 'scene', parent: 'web-viewer' },
  { representationId: 'core', parent: 'groma' },
  { representationId: 'web-viewer', parent: 'groma' },
  { representationId: 'groma', parent: null },
  { representationId: 'git', parent: null },
])

const mapToLayout = { source: 'scene', target: 'world-layout' }
const gromaToGit = { source: 'groma', target: 'git' }

test.concurrent('relationship text is only for exclusive endpoints', () => {
  expect(showsRelationshipText(mapToLayout, null, parentOf)).toBe(false)
  expect(showsRelationshipText(mapToLayout, 'world-layout', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'scene', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'core', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'web-viewer', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'groma', parentOf)).toBe(false)
})

test.concurrent('promoted peers sit at the selection depth', () => {
  expect(promotedPeer(mapToLayout, 'world-layout', parentOf)).toEqual({
    outgoing: false,
    peerId: 'scene',
  })
  expect(promotedPeer(mapToLayout, 'core', parentOf)).toEqual({
    outgoing: false,
    peerId: 'web-viewer',
  })
  expect(promotedPeer(mapToLayout, 'web-viewer', parentOf)).toEqual({
    outgoing: true,
    peerId: 'core',
  })
  expect(promotedPeer(mapToLayout, 'groma', parentOf)).toBe(null)
  expect(promotedPeer(gromaToGit, 'groma', parentOf)).toEqual({
    outgoing: true,
    peerId: 'git',
  })
})
