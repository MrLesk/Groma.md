import { expect, test } from 'bun:test'
import path from 'node:path'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { parse } from 'comark'
import { annotateArchitecture, loadAnnotatedArchitecture } from '../src/core.ts'
import { loadArchitecture } from '../src/architecture-reader.ts'
import { buildArchitectureModel } from '../src/architecture-model.ts'
import { writes } from '../src/authoring.ts'
import { elementOnPath, flowLegs, flowRouteIds, flowsThrough } from '../src/viewers/flows.ts'
import { inspectDetails } from '../src/viewers/web/organisms/details.ts'
import { sheetScene } from '../src/sheet/scene.ts'
import { loadMapRoot } from '../src/viewers/web/runtime.ts'
import type { MarkdownNode } from '../src/types.ts'

const fixture = path.resolve(import.meta.dir, '../test/fixtures/flows')

test.concurrent('Markdown links resolve ordered steps, including a callback and repeated relationship', async () => {
  const records = await loadArchitecture(fixture)
  const model = annotateArchitecture(records)
  const flow = model.flows[0]!
  const byId = new Map(model.relationships.map(relationship => [relationship.id, relationship]))
  expect(flow.steps.map(step => {
    const relationship = byId.get(step.relationshipId)!
    expect([step.source, step.target]).toEqual([relationship.source, relationship.target])
    return [relationship.source, relationship.target]
  })).toEqual([['requester', 'entry'], ['entry', 'worker'], ['worker', 'entry'], ['entry', 'worker']])
  expect(flow.steps[1]!.relationshipId).toBe(flow.steps[3]!.relationshipId)
  expect(flow.steps[1]!.action).not.toBe(flow.steps[3]!.action)
  expect(flowLegs(flow.id, model).map(leg => leg.description)).toEqual(flow.steps.map(step => step.action))
  const c4 = buildArchitectureModel(records.documents)
  expect(model.elements.map(element => element.id)).toEqual(c4.elements.map(element => element.id))
  expect(model.relationships).toHaveLength(c4.relationships.length)
})

test.concurrent('membership omits outgoing connections not authored in the scenario and a step selects one route', async () => {
  const model = await loadAnnotatedArchitecture(fixture)
  const flow = model.flows[0]!
  const all = flowRouteIds({ id: flow.id }, model)
  const omitted = model.relationships.find(relationship => relationship.target === 'journal')!
  expect(all.has(omitted.id)).toBe(false)
  expect(elementOnPath('journal', all, model)).toBe(false)
  expect(elementOnPath('api', all, model)).toBe(true)
  expect(flowsThrough('journal', model)).toEqual([])
  expect(flowsThrough('api', model).map(item => item.id)).toEqual([flow.id])
  expect(flowRouteIds({ id: flow.id, step: 2 }, model)).toEqual(new Set([flow.steps[2]!.relationshipId]))
  const journal = model.elements.find(element => element.id === 'journal')!
  expect(inspectDetails(journal, model).flows).toEqual([])
  const entry = model.elements.find(element => element.id === 'entry')!
  expect(inspectDetails(entry, model).relationships.some(relationship => relationship.target.representationId === 'journal')).toBe(true)
  expect(inspectDetails(entry, model).flows.map(row => row.flow.id)).toEqual([flow.id])
})

test.concurrent('flow records preserve the shared sheet and reach the browser payload', async () => {
  const model = await loadAnnotatedArchitecture(fixture)
  const sheet = sheetScene(model)
  expect(sheetScene({ ...model, flows: [] })).toEqual(sheet)
  const payload = await loadMapRoot(fixture)
  expect(payload.world.flows).toEqual(model.flows)
})

test.concurrent('a flow rejects a missing directed relationship', async () => {
  const records = await loadArchitecture(fixture)
  const flow = records.flows[0]!
  const body = flow.body.replace('[Requester](../actors/requester.md) | [Entry][entry]', '[Requester](../actors/requester.md) | [Worker][worker]')
  const changed = { ...flow, body, nodes: (await parse(body)).nodes as MarkdownNode[] }
  expect(() => annotateArchitecture({ ...records, flows: [changed] })).toThrow('requester → worker must resolve exactly one directed relationship')
})

test.concurrent('a flow rejects an ambiguous endpoint pair', async () => {
  const records = await loadArchitecture(fixture)
  const document = records.documents.find(document => document.sourceFilename.endsWith('/entry.md'))!
  const row = '| [Worker](worker.md) | Also dispatches | Function call |'
  const body = `${document.body.trimEnd()}\n${row}\n`
  const changed = { ...document, body, nodes: (await parse(body)).nodes as MarkdownNode[] }
  expect(() => annotateArchitecture({ ...records, documents: records.documents.map(item => item === document ? changed : item) }))
    .toThrow('entry → worker must resolve exactly one directed relationship')
})

test.concurrent('flow authoring edits steps and blocks removal of referenced endpoints or connections', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groma-flow-'))
  try {
    await cp(fixture, root, { recursive: true })
    const steps = '| From | To | Action |\n| --- | --- | --- |\n| [Requester](../actors/requester.md) | [Entry](../systems/service/containers/api/components/entry.md) | Start |'
    const id = await writes.add(root, { thing: 'flow', name: 'Another scenario', overview: 'Start a unit of work.', steps })
    expect((await loadAnnotatedArchitecture(root)).flows).toHaveLength(2)
    await writes.edit(root, { id, title: 'Updated scenario', steps: steps.replace('| Start |', '| Submit |') })
    const edited = (await loadAnnotatedArchitecture(root)).flows.find(flow => flow.id === id)!
    expect(edited.steps[0]!.action).toBe('Submit')
    await expect(writes.remove(root, { id: 'requester' })).rejects.toThrow('used by flows')
    await expect(writes.remove(root, { id: 'entry', relation: 'worker' })).rejects.toThrow('used by flows')
    await writes.remove(root, { id })
    expect((await loadAnnotatedArchitecture(root)).flows).toHaveLength(1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
