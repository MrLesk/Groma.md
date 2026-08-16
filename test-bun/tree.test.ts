import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { scrollOffset } from '../src/viewers/tui/organisms/hierarchy.ts'
import { initialTree, treeRows } from '../src/viewers/tui/tree.ts'
import { navigationWorld } from './helpers.ts'

test.concurrent('the containment tree lists every element once and tracks collapse state', () => {
  const world = navigationWorld()
  const all = treeRows(world, undefined, {
    expanded: new Set(world.elements.map(element => element.representationId)),
    collapsed: new Set(),
  })
  assert.deepEqual(
    [...all.map(row => row.id)].sort(),
    [...world.elements.map(element => element.representationId)].sort(),
  )
  const depths = new Map(all.map(row => [row.id, row.depth]))
  assert.equal(depths.get('observed:alpha'), 0)
  assert.equal(depths.get('observed:cleft'), 1)
  assert.equal(depths.get('observed:pleft'), 2)
  const kinds = new Map(all.map(row => [row.id, row.kind]))
  assert.equal(kinds.get('observed:alpha'), 'system')
  assert.equal(kinds.get('observed:cleft'), 'container')
  assert.equal(kinds.get('observed:pleft'), 'component')
  assert.equal(kinds.get('observed:ext'), 'system')
  assert.equal(all.find(row => row.id === 'observed:ext')?.external, true)
  assert.deepEqual(
    all.filter(row => row.depth === 0).map(row => row.id),
    [
      'observed:ann',
      'observed:alpha',
      'observed:zeta',
      'observed:empty',
      'observed:ext',
    ],
  )
  assert.deepEqual(
    all.filter(row => row.id === 'observed:cleft' || row.id === 'observed:cright')
      .map(row => row.id),
    ['observed:cleft', 'observed:cright'],
  )

  const rows = treeRows(world, 'observed:pleft', initialTree())
  const ids = rows.map(row => row.id)
  assert.ok(ids.includes('observed:pleft'))
  assert.ok(ids.includes('observed:pmid'))
  assert.ok(!ids.includes('observed:pright'))
  assert.equal(rows.find(row => row.id === 'observed:alpha')?.expanded, true)
  const cright = rows.find(row => row.id === 'observed:cright')
  assert.equal(cright?.expanded, false)
  assert.equal(cright?.count, 1)
})

test.concurrent('tree focus moves the cursor and enter drives selection and level', () => {
  const world = navigationWorld()
  let state = reduceViewer(world, initialState(world), 'tab')
  assert.equal(state.focus, 'hierarchy')
  assert.equal(state.tree.cursor, 'observed:alpha')

  const opened = reduceViewer(world, state, 'enter')
  assert.equal(opened.currentId, 'observed:alpha')
  assert.ok(opened.tree.expanded.has('observed:alpha'))
  assert.equal(opened.focus, 'hierarchy')

  state = reduceViewer(world, state, 'right')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.tree.cursor, 'observed:cleft')
  state = reduceViewer(world, state, 'right')
  state = reduceViewer(world, state, 'down')
  assert.equal(state.tree.cursor, 'observed:pleft')

  state = reduceViewer(world, state, 'enter')
  assert.equal(state.currentId, 'observed:pleft')
  assert.equal(state.level, 'components')
  assert.equal(state.focus, 'hierarchy')

  const backFromLeaf = reduceViewer(world, state, 'right')
  assert.equal(backFromLeaf.focus, 'architecture')
  assert.equal(backFromLeaf.currentId, state.currentId)
  assert.equal(backFromLeaf.tree.cursor, state.tree.cursor)

  state = reduceViewer(world, state, 'left')
  assert.equal(state.tree.cursor, 'observed:cleft')
  const backFromExpanded = reduceViewer(world, state, 'right')
  assert.equal(backFromExpanded.focus, 'architecture')
  state = reduceViewer(world, state, 'left')
  assert.ok(state.tree.collapsed.has('observed:cleft'))
  assert.equal(state.currentId, 'observed:pleft')

  state = reduceViewer(world, state, 'dismiss')
  assert.equal(state.focus, 'architecture')
  state = reduceViewer(world, state, 'right')
  assert.equal(state.tree.cursor, state.currentId)
  assert.equal(state.tree.collapsed.has('observed:cleft'), false)
})

test.concurrent('tree scrolling keeps the cursor inside the visible window', () => {
  for (let rows = 1; rows < 60; rows += 7) {
    for (let height = 1; height <= 20; height += 3) {
      for (let cursor = 0; cursor < rows; cursor += 1) {
        const scroll = scrollOffset(cursor, rows, height)
        assert.ok(scroll >= 0)
        assert.ok(cursor >= scroll)
        assert.ok(cursor < scroll + height)
        assert.ok(scroll <= Math.max(0, rows - height))
      }
    }
  }
})
