import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { createTestRenderer } from '@opentui/core/testing'

import { loadArchitectureViewModel } from '../src/core.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { initialState, reduceViewer } from '../src/viewers/tui/navigation.ts'
import { paneLayout } from '../src/viewers/tui/layout.ts'
import { zoomReadout } from '../src/viewers/tui/organisms/chrome.ts'
import { kindGlyph, kindLabel } from '../src/viewers/tui/atoms/kind.ts'
import { projectWorld } from '../src/viewers/tui/projection.ts'
import {
  cameraOn,
  navigationWorld,
  press,
  projectedById,
  viewerFixtureRoot,
  requiredElement,
} from './helpers.ts'

test.concurrent('header and footer sit one row in from the terminal edges', () => {
  const height = 36
  const layout = paneLayout(120, height)
  assert.equal(layout.header.y, 1)
  assert.equal(layout.footer.y, height - 2)
  assert.equal(layout.hierarchy.y, layout.header.y + layout.header.height)
  assert.equal(layout.map.y, layout.hierarchy.y)
  assert.equal(layout.details.y, layout.hierarchy.y)
  assert.equal(layout.hierarchy.y + layout.hierarchy.height, layout.footer.y)
  assert.equal(layout.footer.y + layout.footer.height, height - 1)
})

test.concurrent('pane toggles resize the map viewport without touching the world', async () => {
  const world = navigationWorld()
  let state = initialState(world)
  assert.deepEqual(state.panes, { hierarchy: true, details: true })

  state = reduceViewer(world, state, 'toggle-details')
  assert.deepEqual(state.panes, { hierarchy: true, details: false })
  state = reduceViewer(world, state, 'toggle-hierarchy')
  assert.deepEqual(state.panes, { hierarchy: false, details: false })

  state = reduceViewer(world, state, 'tab')
  assert.equal(state.focus, 'hierarchy')
  assert.equal(state.panes.hierarchy, true)
  state = reduceViewer(world, state, 'toggle-hierarchy')
  assert.equal(state.focus, 'architecture')
  assert.equal(state.panes.hierarchy, false)

  const full = paneLayout(120, 36, { hierarchy: false, details: false })
  assert.equal(full.map.x, 0)
  assert.equal(full.map.width, 120)
  const partial = paneLayout(120, 36, { hierarchy: true, details: false })
  assert.equal(partial.map.x + partial.map.width, 120)

  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const threePane = paneLayout(120, 36)
  const narrow = projectWorld(response.world, {
    viewport: threePane.mapViewport,
    camera: cameraOn(response.world, 'observed:shop', 1),
    lockCamera: true,
  })
  const wide = projectWorld(response.world, {
    viewport: full.mapViewport,
    camera: cameraOn(response.world, 'observed:shop', 1),
    lockCamera: true,
  })
  assert.equal(wide.camera.zoom, narrow.camera.zoom)
  const wideById = projectedById(wide.elements)
  const deltaX = full.mapViewport.x + full.mapViewport.width / 2
    - (threePane.mapViewport.x + threePane.mapViewport.width / 2)
  for (const element of narrow.elements) {
    const moved = requiredElement(wideById, element.representationId)
    assert.equal(moved.cellBounds.y, element.cellBounds.y, element.representationId)
    if (element.kind === 'person' || element.external) continue
    assert.equal(
      moved.cellBounds.x - element.cellBounds.x,
      Math.round(deltaX),
      element.representationId,
    )
  }
})

test.concurrent('the zoom readout names fit, in-between, and one-to-one states', () => {
  assert.equal(zoomReadout(0.31, 0.31), 'fit')
  assert.equal(zoomReadout(0.62, 0.31), '62%')
  assert.equal(zoomReadout(1, 0.31), '1:1')
  assert.equal(zoomReadout(1, 1), '1:1')
})

test.concurrent('the details pane always shows the selection and reserves its column', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()

  const layout = paneLayout(120, 36)
  app.setView({ level: 'components', currentId: 'observed:orders' })
  await setup.renderOnce()
  const frame = setup.captureCharFrame()
  const lines = frame.split('\n')
  assert.equal(lines[layout.details.y]![layout.details.x], '┌')
  assert.equal(
    lines[layout.details.y + layout.details.height - 1]![layout.details.x],
    '└',
  )
  const pane = lines
    .map(line => [...line].slice(layout.details.x).join(''))
    .join('\n')
  assert.match(pane, /Orders/)
  assert.match(
    pane,
    new RegExp(`${kindGlyph('component')} ${kindLabel('component')} · observed`),
  )
  // The code evidence lives on the How it's built tab.
  const builtPane = (await press(setup, 't'))
    .split('\n')
    .map(line => [...line].slice(layout.details.x).join(''))
    .join('\n')
  assert.match(builtPane, /src\/orders\.ts/)
  const treePane = lines
    .map(line => [...line].slice(layout.hierarchy.x, layout.map.x).join(''))
    .join('\n')
  assert.match(treePane, new RegExp(kindGlyph('system')))
  assert.match(treePane, new RegExp(kindGlyph('container')))
  assert.match(treePane, new RegExp(kindGlyph('component')))
  app.destroy()
})

test.concurrent('the hierarchy pane ends with the kind legend', async () => {
  const response = await loadArchitectureViewModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 120, height: 36 })
  const app = mountTerminalViewer(setup.renderer, response)
  await setup.renderOnce()
  const layout = paneLayout(120, 36)
  const lines = setup.captureCharFrame().split('\n')
  const column = (line: string) => {
    return [...line].slice(layout.hierarchy.x, layout.map.x).join('')
  }
  const interior = lines
    .slice(layout.hierarchy.y + 1, layout.hierarchy.y + layout.hierarchy.height - 1)
    .map(column)
  const tail = interior.slice(-3).join('\n')
  const tree = interior.slice(0, -3).join('\n')
  for (const kind of ['person', 'system', 'container', 'component'] as const) {
    assert.match(tail, new RegExp(`${kindGlyph(kind)} ${kindLabel(kind)}`))
    assert.doesNotMatch(tree, new RegExp(kindLabel(kind)))
  }
  app.destroy()
})
