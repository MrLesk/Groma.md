import { expect, test } from 'bun:test'
import path from 'node:path'
import { annotateArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { boundaryRelationships, fileConnections, renderPlainRecord, rootRelationships } from '../src/plain-world.ts'
import type { PlainRelationship } from '../src/plain-world.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/flows')
const plainViewFixture = path.resolve(import.meta.dir, '../test/fixtures/plain-view')

async function loadFixture() {
  return annotateArchitecture(await loadArchitecture(fixture))
}

function ends(relationships: readonly PlainRelationship[]): string[] {
  return relationships.map(relationship => `${relationship.source}->${relationship.target}`).sort()
}

test.concurrent('the overview lifts relationships to root elements and drops those inside one system', async () => {
  const world = await loadFixture()
  expect(ends(rootRelationships(world))).toEqual(['requester->service', 'service->journal'])
})

test.concurrent('a drill-down keeps only relationships crossing the element boundary, split by direction', async () => {
  const world = await loadFixture()
  const container = boundaryRelationships(world, 'api')
  expect(ends(container.incoming)).toEqual(['requester->entry'])
  expect(ends(container.outgoing)).toEqual(['entry->journal'])
  const component = boundaryRelationships(world, 'entry')
  expect(ends(component.incoming)).toEqual(['requester->entry', 'worker->entry'])
  expect(ends(component.outgoing)).toEqual(['entry->journal', 'entry->worker'])
})

test.concurrent('a file lists only the rows whose endpoint is that file, not the rows addressed to its owner', async () => {
  const world = await loadFixture()
  const rows = fileConnections(world, 'src/entry.ts')
  expect(ends(rows.incoming)).toEqual(['src/worker.ts->src/entry.ts'])
  expect(ends(rows.outgoing)).toEqual(['src/entry.ts->src/worker.ts'])
})

test.concurrent('a file without relationship rows still answers with its owner and the owner record command', async () => {
  const answer = await renderPlainRecord(plainViewFixture, 'src/routes/orders.ts', false)
  expect(answer.ok).toBe(true)
  expect(answer.ok ? answer.text.trimEnd() : '').toEndWith('groma view orders')
})
