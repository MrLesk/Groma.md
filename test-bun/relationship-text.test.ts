import { expect, test } from 'bun:test'

import {
  parentOfElements,
  promotedPeer,
  showsRelationshipText,
} from '../src/viewers/relationship-text.ts'

const hierarchy = () => parentOfElements([
  { representationId: 'compute', parent: 'core' },
  { representationId: 'scene', parent: 'frontend' },
  { representationId: 'core', parent: 'service' },
  { representationId: 'frontend', parent: 'service' },
  { representationId: 'service', parent: null },
  { representationId: 'external', parent: null },
])

const mapToLayout = { source: 'scene', target: 'compute' }
const serviceToGit = { source: 'service', target: 'external' }

test.concurrent('relationship text is only for exclusive endpoints', () => {
  const parentOf = hierarchy()
  expect(showsRelationshipText(mapToLayout, null, parentOf)).toBe(false)
  expect(showsRelationshipText(mapToLayout, 'compute', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'scene', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'core', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'frontend', parentOf)).toBe(true)
  expect(showsRelationshipText(mapToLayout, 'service', parentOf)).toBe(false)
})

test.concurrent('promoted peers sit at the selection depth', () => {
  const parentOf = hierarchy()
  expect(promotedPeer(mapToLayout, 'compute', parentOf)).toEqual({
    outgoing: false,
    peerId: 'scene',
  })
  expect(promotedPeer(mapToLayout, 'core', parentOf)).toEqual({
    outgoing: false,
    peerId: 'frontend',
  })
  expect(promotedPeer(mapToLayout, 'frontend', parentOf)).toEqual({
    outgoing: true,
    peerId: 'core',
  })
  expect(promotedPeer(mapToLayout, 'service', parentOf)).toBe(null)
  expect(promotedPeer(serviceToGit, 'service', parentOf)).toEqual({
    outgoing: true,
    peerId: 'external',
  })
})
