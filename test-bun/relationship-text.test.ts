import { expect, test } from 'bun:test'

import { showsRelationshipText } from '../src/viewers/relationship-text.ts'

test.concurrent('relationship text is only for the selected endpoints', () => {
  const relationship = { source: 'a', target: 'b' }
  expect(showsRelationshipText(relationship, null)).toBe(false)
  expect(showsRelationshipText(relationship, 'a')).toBe(true)
  expect(showsRelationshipText(relationship, 'b')).toBe(true)
  expect(showsRelationshipText(relationship, 'c')).toBe(false)
})
