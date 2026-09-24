import { expect, test } from 'bun:test'
import path from 'node:path'
import { loadAnnotatedArchitecture } from '../src/core.ts'
import { createMapHighlights } from '../src/viewers/web/iso/highlights.ts'
import { noSelection, primarySelection, selectArchitecture, selectTask } from '../src/viewers/web/selection.ts'

async function session(fixture = 'relationship-pairs') {
  const world = await loadAnnotatedArchitecture(path.resolve(import.meta.dir, `../test/fixtures/${fixture}`))
  let selected: readonly string[] = []
  let focused: string | undefined
  let neighbors: ReadonlySet<string> = new Set()
  let lit: ReadonlySet<string> = new Set()
  const highlights = createMapHighlights({
    select(ids) { selected = ids },
    mark() {},
    markNeighbors(id, ids) { focused = id; neighbors = ids },
    setLitRoutes(ids) { lit = ids },
  })
  return { world, highlights, selected: () => selected, focused: () => focused, neighbors: () => neighbors, lit: () => lit }
}

test.concurrent('selection separates direct neighbors from the focused component without following a second hop', async () => {
  const s = await session()
  const selection = selectArchitecture(noSelection, 'talks', false)
  const original = structuredClone({ world: s.world, selection })
  s.highlights.paint(selection, s.world, [], [])
  expect(s.focused()).toBe(primarySelection(selection))
  expect(s.selected()).toEqual(['talks'])
  expect([...s.neighbors()].sort()).toEqual(['people', 'sessions'])
  expect(s.neighbors().has('speakers')).toBe(false)
  expect(s.neighbors().has(s.focused()!)).toBe(false)
  expect({ world: s.world, selection }).toEqual(original)
})

test.concurrent('incoming-only neighbors are included and a new selection replaces the old neighborhood', async () => {
  const s = await session()
  s.highlights.paint(selectArchitecture(noSelection, 'talks', false), s.world, [], [])
  s.highlights.paint(selectArchitecture(noSelection, 'people', false), s.world, [], [])
  expect(s.focused()).toBe('people')
  expect([...s.neighbors()].sort()).toEqual(['speakers', 'talks'])
  expect(s.neighbors().has('sessions')).toBe(false)
})

test.concurrent('task, relationship, container, and empty selections clear component emphasis', async () => {
  const s = await session()
  const container = s.world.elements.find(element => element.kind === 'container')!
  for (const next of [selectTask('task'), noSelection,
    selectArchitecture(noSelection, s.world.relationships[0]!.id, false),
    selectArchitecture(noSelection, container.representationId, false)]) {
    s.highlights.paint(selectArchitecture(noSelection, 'talks', false), s.world, [], [])
    s.highlights.paint(next, s.world, [], [])
    expect(s.focused()).toBeUndefined()
    expect(s.neighbors().size).toBe(0)
  }
})

test.concurrent('component neighbors coexist with active flow filtering without claiming actors or external systems', async () => {
  const s = await session('flows')
  const flows = [{ id: s.world.flows[0]!.id }]
  s.highlights.paint(noSelection, s.world, flows, [])
  const before = [...s.lit()]
  expect(before.length).toBeGreaterThan(0)
  s.highlights.paint(selectArchitecture(noSelection, 'entry', false), s.world, flows, [])
  expect([...s.lit()]).toEqual(before)
  expect([...s.neighbors()]).toEqual(['worker'])
  expect(s.focused()).toBe('entry')
})
