import { expect, test } from 'bun:test'
import { createTestRenderer, createTerminalCapabilities } from '@opentui/core/testing'
import type { ImageRenderable } from '@opentui/core'
import { rasterizeGraphics as renderAsync } from '../src/viewers/tui/graphics-raster.ts'
import { initialState } from '../src/viewers/tui/navigation.ts'
import { canEnter, nearestInDirection } from '../src/viewers/tui/navigation-spatial.ts'
import { graphicsProtocol } from '../src/viewers/tui/graphics.ts'
import { fitGraphics, insideGraphics, panGraphics, rasterSize, revealGraphics, toGraphicsWorld, zoomGraphics } from '../src/viewers/tui/graphics-camera.ts'
import { graphicsAnchors, graphicsHit, graphicsScene, graphicsScope, graphicsSvg } from '../src/viewers/tui/graphics-scene.ts'
import { mountTerminalViewer } from '../src/viewers/tui/terminal-viewer.ts'
import { projectScene } from '../src/viewers/web/iso/project.ts'
import { terminalModel, viewerFixtureRoot } from './helpers.ts'

async function eventually(setup: Awaited<ReturnType<typeof createTestRenderer>>, condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000
  while (!condition() && Date.now() < deadline) { await setup.renderOnce(); await Bun.sleep(10) }
  expect(condition()).toBe(true)
  await setup.renderOnce()
}

async function mounted() {
  const model = await terminalModel(viewerFixtureRoot)
  const setup = await createTestRenderer({ width: 160, height: 48, useMouse: true })
  const app = mountTerminalViewer(setup.renderer, model, { graphics: 'blocks' })
  const image = setup.renderer.root.findDescendantById('groma-graphics') as ImageRenderable
  try { await eventually(setup, () => image.visible && image.image !== null) }
  catch (error) { app.destroy(); throw error }
  return { model, setup, app, image }
}

test.concurrent('terminal capabilities choose pixels only when usable and preserve text fallback', () => {
  const kitty = createTerminalCapabilities({ kitty_graphics: true })
  expect(graphicsProtocol('auto', kitty, false)).toBe('kitty')
  expect(graphicsProtocol('auto', createTerminalCapabilities({ kitty_graphics: true, multiplexer: 'tmux' }), true)).toBe('text')
  expect(graphicsProtocol('auto', null, false)).toBe('text')
  expect(graphicsProtocol('sixel', kitty, false)).toBe('text')
  expect(graphicsProtocol('text', kitty, true)).toBe('text')
  expect(graphicsProtocol('blocks', null, false)).toBe('blocks')
})

test.concurrent('raster work is capped while preserving non-square terminal geometry', () => {
  const size = rasterSize(400, 160, 10, 23)
  expect(size.width * size.height).toBeLessThanOrEqual(1_200_000)
  expect(size.width).toBeLessThanOrEqual(1600)
  expect(size.height).toBeLessThanOrEqual(1000)
  expect(size.width / size.height).toBeCloseTo(4000 / 3680, 2)
})

test.concurrent('zoom keeps the world under its anchor and pan does not modify source bounds', () => {
  const bounds = { x: -120, y: 30, width: 1000, height: 700 }
  const size = { width: 800, height: 480 }
  const camera = fitGraphics(bounds, size)
  const point = { x: 100, y: 320 }
  const before = toGraphicsWorld(point, camera, size)
  const zoomed = zoomGraphics(camera, 3, size, camera.scale, point)
  expect(toGraphicsWorld(point, zoomed, size).x).toBeCloseTo(before.x, 8)
  expect(toGraphicsWorld(point, zoomed, size).y).toBeCloseTo(before.y, 8)
  const moved = panGraphics(zoomed, 48, -48)
  expect(moved.center.x - zoomed.center.x).toBeCloseTo(48 / zoomed.scale, 8)
  expect(bounds).toEqual({ x: -120, y: 30, width: 1000, height: 700 })
  expect(zoomGraphics(camera, 1e20, size, camera.scale).scale).toBe(camera.scale * 128)
})

test.concurrent('revealing an already visible selection preserves a manual camera', () => {
  const size = { width: 800, height: 480 }
  const camera = { center: { x: 40, y: 20 }, scale: 2 }
  const bounds = { x: 30, y: 10, width: 20, height: 20 }
  expect(revealGraphics(camera, bounds, size)).toEqual(camera)
  const revealed = revealGraphics(camera, { x: 1000, y: 0, width: 20, height: 20 }, size)
  expect(revealed.center.x).toBeGreaterThan(camera.center.x)
  expect(revealed.scale).toBe(camera.scale)
})

test.concurrent('hit testing rejects empty corners of a projected diamond', () => {
  const diamond = [{ x: 5, y: 0 }, { x: 10, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 5 }]
  expect(insideGraphics({ x: 1, y: 1 }, diamond)).toBe(false)
  expect(insideGraphics({ x: 5, y: 5 }, diamond)).toBe(true)
  expect(insideGraphics({ x: 5, y: 0 }, diamond)).toBe(true)
})

test.concurrent('isometric geometry matches the web and flattening never mutates the sheet', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const before = JSON.stringify(model.sheet)
  const iso = graphicsScene(model, 'iso')
  expect(iso.projected).toEqual(projectScene(model.sheet, model.project))
  const plan = graphicsScene(model, 'plan')
  expect(plan.projected.buildings.every(item => item.building.heightUnits === 0 && item.building.floors.length === 0)).toBe(true)
  const footprints = (scene: ReturnType<typeof graphicsScene>) => Object.fromEntries(scene.projected.buildings.map(item => [item.building.representationId, item.building.rect]))
  expect(footprints(plan)).toEqual(footprints(iso))
  expect(JSON.stringify(model.sheet)).toBe(before)
  const state = initialState(model)
  const anchors = graphicsAnchors(iso, model, state)
  expect([...anchors.keys()].every(id => model.elements.find(element => element.representationId === id)?.kind !== 'component')).toBe(true)
  const raster = await renderAsync(graphicsSvg(iso, fitGraphics(iso.projected.bounds, { width: 800, height: 480 }), { width: 800, height: 480 }))
  expect(raster.pixels.byteLength).toBe(800 * 480 * 4)
})

test.concurrent('mounted viewer zooms from keyboard, stops rasterizing while idle, and toggles to text', async () => {
  const { setup, app, image } = await mounted()
  try {
    const first = image.image
    setup.mockInput.pressKey('+')
    await eventually(setup, () => image.image !== first)
    const zoomed = image.image
    await Bun.sleep(160)
    await setup.renderOnce()
    expect(image.image).toBe(zoomed)
    setup.mockInput.pressKey('d')
    await setup.renderOnce()
    setup.mockInput.pressKey('+')
    await Bun.sleep(100)
    expect(image.image).toBe(zoomed)
    setup.mockInput.pressEscape()
    await Bun.sleep(60)
    setup.mockInput.pressKey('g')
    await eventually(setup, () => !image.visible && image.image === null)
    setup.mockInput.pressKey('g')
    await eventually(setup, () => image.visible && image.image !== null)
    setup.resize(200, 60)
    const beforeResize = image.image
    await eventually(setup, () => image.image !== beforeResize)
    expect(image.image!.width * image.image!.height).toBeLessThanOrEqual(1_200_000)
  } finally { app.destroy() }
})

test.concurrent('mouse selection and wheel zoom use the displayed map, and dragging does not select', async () => {
  const { model, setup, app, image } = await mounted()
  try {
    const component = model.elements.find(element => element.kind === 'component')!
    const old = image.image
    app.setView({ level: 'components', currentId: component.representationId })
    await eventually(setup, () => image.image !== old)
    const state = { ...initialState(model), level: 'components' as const, currentId: component.representationId }
    const scene = graphicsScene(model, 'iso')
    const size = { width: image.image!.width, height: image.image!.height }
    const camera = fitGraphics(graphicsScope(scene, model, state), size)
    let target: { x: number; y: number; id: string } | undefined
    for (let y = 0; y < image.height && !target; y++) {
      for (let x = 0; x < image.width; x++) {
        const point = toGraphicsWorld({ x: (x + 0.5) * size.width / image.width, y: (y + 0.5) * size.height / image.height }, camera, size)
        const id = graphicsHit(scene, point, model, state)
        if (id && id !== component.representationId) { target = { x: image.x + x, y: image.y + y, id }; break }
      }
    }
    expect(target).toBeDefined()
    await setup.mockMouse.click(target!.x, target!.y)
    await setup.renderOnce()
    const title = model.elements.find(element => element.representationId === target!.id)!.title
    expect(setup.captureCharFrame()).toContain(title)
    const selected = image.image
    await eventually(setup, () => image.image !== selected)
    const beforeWheel = image.image
    const x = image.x + Math.floor(image.width / 2)
    const y = image.y + Math.floor(image.height / 2)
    await setup.mockMouse.scroll(x, y, 'up')
    await eventually(setup, () => image.image !== beforeWheel)
    const beforeDrag = image.image
    await setup.mockMouse.drag(x, y, x + 3, y + 2)
    await eventually(setup, () => image.image !== beforeDrag)
    expect(setup.captureCharFrame()).toContain(title)
  } finally { app.destroy() }
})

test.concurrent('search receives graphical shortcut characters and shutdown cancels pending presentation', async () => {
  const { setup, app, image } = await mounted()
  try {
    setup.mockInput.pressKey('/')
    await setup.renderOnce()
    setup.mockInput.pressKey('g')
    setup.mockInput.pressKey('v')
    await setup.renderOnce()
    expect(image.visible).toBe(true)
    setup.mockInput.pressEscape()
    await Bun.sleep(60)
    setup.mockInput.pressKey('+')
    app.destroy()
    await Bun.sleep(120)
    expect(image.isDestroyed).toBe(true)
  } finally { app.destroy() }
})


test.concurrent('keyboard navigation uses displayed geometry; scope, pan, fit and view switch need no mouse', async () => {
  const { model, setup, app, image } = await mounted()
  try {
    const container = model.elements.find(canEnter)!
    let before = image.image
    app.setView({ level: 'context', currentId: container.representationId })
    // Changing to an already selected container may not create a new frame.
    await setup.renderOnce()
    await Bun.sleep(120)
    before = image.image
    setup.mockInput.pressEnter()
    await eventually(setup, () => image.image !== before)
    const component = model.elements.find(element => element.parent === container.representationId && element.kind === 'component')!
    const scene = graphicsScene(model, 'iso')
    const anchors = graphicsAnchors(scene, model, { level: 'components' })
    const origin = anchors.get(component.representationId)!
    app.setView({ level: 'components', currentId: component.representationId })
    await setup.renderOnce()
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const next = nearestInDirection(anchors, component.representationId, origin, direction)
      if (next === undefined) continue
      setup.mockInput.pressArrow(direction)
      await setup.renderOnce()
      expect(setup.captureCharFrame()).toContain(model.elements.find(element => element.representationId === next)!.title)
      break
    }
    for (const input of [() => setup.mockInput.pressArrow('right', { shift: true }),
      () => setup.mockInput.pressKey('f'), () => setup.mockInput.pressKey('0'), () => setup.mockInput.pressKey('v')]) {
      before = image.image
      input()
      await eventually(setup, () => image.image !== before)
    }
    before = image.image
    setup.mockInput.pressBackspace()
    await eventually(setup, () => image.image !== before)
    expect(image.visible).toBe(true)
  } finally { app.destroy() }
})

test.concurrent('zoomed and offscreen routes rasterize without SVG-marker panics', async () => {
  const model = await terminalModel(viewerFixtureRoot)
  const scene = graphicsScene(model, 'iso')
  const size = { width: 600, height: 400 }
  const component = model.elements.find(element => element.kind === 'component')!
  const fitted = fitGraphics(scene.bounds.get(component.representationId)!, size)
  for (const camera of [fitted, panGraphics(fitted, 2000, -2000)]) {
    const raster = await renderAsync(graphicsSvg(scene, camera, size, component.representationId))
    expect(raster.pixels.length).toBe(size.width * size.height * 4)
  }
})
