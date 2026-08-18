import assert from 'node:assert/strict'
import { test } from 'bun:test'

import { loadArchitectureViewModel } from '../src/core.ts'
import { semanticView } from '../src/semantic-view.ts'
import type { Bounds, SemanticView } from '../src/types.ts'
import { campusSvg } from '../src/viewers/web/campus-svg.ts'
import { startWebViewer } from '../src/viewers/web/server.ts'
import { openclawFixtureRoot } from './helpers.ts'

const titledNames = ['Anthropic', 'OpenClaw', 'Operator', 'Telegram', 'WhatsApp']
const markIds = ['operator', 'whatsapp', 'telegram', 'anthropic']
const containerIds = [
  'agent-runtime',
  'channels',
  'cli',
  'control-ui',
  'gateway',
  'node',
]

function item(view: SemanticView, id: string): SemanticView['items'][number] {
  const found = view.items.find(entry => entry.id === id)
  assert.ok(found, `missing ${id}`)
  return found
}

function textOf(svg: string): Map<string, string> {
  const titles = new Map<string, string>()
  for (const match of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const id = match[1]!.match(/data-id="([^"]*)"/)?.[1]
    assert.ok(id, 'title without data-id')
    titles.set(id, match[2]!)
  }
  return titles
}

function groupOf(svg: string, name: string): string {
  const block = svg.match(new RegExp(`<g data-${name}>([\\s\\S]*?)</g>`))
  return block?.[1] ?? ''
}

function titleTag(svg: string, id: string): string {
  const tag = svg.match(new RegExp(`<text\\b[^>]*data-id="${id}"[^>]*>`))
  assert.ok(tag, `missing title ${id}`)
  return tag[0]!
}

function shapeOf(svg: string, id: string): Bounds & { role: string } {
  const tag = svg.match(new RegExp(`<rect\\b[^>]*data-id="${id}"[^>]*/?>`))
  assert.ok(tag, `missing shape ${id}`)
  const attr = (name: string): string => {
    const found = tag[0]!.match(new RegExp(`${name}="([^"]*)"`))
    assert.ok(found, `missing ${name} on ${id}`)
    return found[1]!
  }
  return {
    role: attr('data-role'),
    x: Number(attr('x')),
    y: Number(attr('y')),
    width: Number(attr('width')),
    height: Number(attr('height')),
  }
}

function inside(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  )
}

async function openclawContext() {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const view = semanticView(world, { level: 'context' })
  return { world, view, svg: campusSvg(view) }
}

async function openclawContainers() {
  const { world } = await loadArchitectureViewModel(openclawFixtureRoot)
  const openclaw = world.elements.find(element => element.id === 'openclaw')
  assert.ok(openclaw)
  const view = semanticView(world, {
    level: 'containers',
    focusId: openclaw.representationId,
  })
  return { world, view, svg: campusSvg(view) }
}

test.concurrent('OpenClaw Context SVG titles named systems and marks', async () => {
  const { view, svg } = await openclawContext()
  const titles = textOf(svg)
  assert.deepEqual([...titles.values()].sort(), titledNames)
  assert.equal(titles.get('openclaw'), 'OpenClaw')
  assert.equal(item(view, 'openclaw').role, 'named')
  for (const id of markIds) {
    assert.equal(item(view, id).role, 'mark')
    assert.equal(titles.get(id), item(view, id).name)
  }
  assert.match(svg, /<g data-titles>/)
  assert.match(svg, /<text\b/)
  assert.doesNotMatch(svg, /<image\b|canvas|CanvasTexture/i)
})

test.concurrent('OpenClaw containers are untitled underlay inside the wrapper', async () => {
  const { view, svg } = await openclawContext()
  const titles = textOf(svg)
  const wrapper = shapeOf(svg, 'openclaw')
  assert.equal(wrapper.role, 'named')
  assert.deepEqual(
    { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height },
    item(view, 'openclaw').bounds,
  )
  for (const id of containerIds) {
    const underlay = shapeOf(svg, id)
    assert.equal(underlay.role, 'underlay')
    assert.equal(item(view, id).role, 'underlay')
    assert.ok(![...titles.keys()].includes(id), id)
    assert.ok(![...titles.values()].includes(item(view, id).name), item(view, id).name)
    assert.ok(inside(wrapper, underlay), id)
  }
})

test.concurrent('people and external systems use mark bounds, not world plates', async () => {
  const { world, view, svg } = await openclawContext()
  const campus = item(view, 'openclaw').bounds
  for (const id of markIds) {
    const mark = shapeOf(svg, id)
    assert.equal(mark.role, 'mark')
    assert.deepEqual(
      { x: mark.x, y: mark.y, width: mark.width, height: mark.height },
      item(view, id).bounds,
    )
    assert.ok(mark.width < campus.width)
    assert.ok(mark.height < campus.height)
  }
  const operator = shapeOf(svg, 'operator')
  const laidOperator = world.elements.find(element => element.id === 'operator')
  assert.ok(laidOperator)
  assert.notEqual(operator.width, laidOperator.bounds.width)
  assert.equal(operator.width, item(view, 'operator').bounds.width)
})

test.concurrent('groma web serves the Context campus as SVG', async () => {
  const server = await startWebViewer(openclawFixtureRoot, { port: 0 })
  try {
    const response = await fetch(`${server.url}/context.svg`)
    assert.equal(response.ok, true)
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/)
    const svg = await response.text()
    assert.deepEqual([...textOf(svg).values()].sort(), titledNames)
  } finally {
    server.close()
  }
})

test.concurrent('OpenClaw title docks in screen space when the camera is on it', async () => {
  const { view, svg } = await openclawContainers()
  const campus = item(view, 'openclaw')
  const wrapper = shapeOf(svg, 'openclaw')
  const docked = textOf(groupOf(svg, 'dock'))
  const worldTitles = textOf(groupOf(svg, 'titles'))
  const tag = titleTag(svg, 'openclaw')
  const x = Number(tag.match(/x="([^"]*)"/)?.[1])
  const y = Number(tag.match(/y="([^"]*)"/)?.[1])
  assert.equal(campus.role, 'campus')
  assert.equal(wrapper.role, 'campus')
  assert.deepEqual(
    { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height },
    campus.bounds,
  )
  assert.equal(docked.get('openclaw'), 'OpenClaw')
  assert.ok(!worldTitles.has('openclaw'))
  assert.match(tag, /data-dock="campus"/)
  assert.notEqual(x, campus.bounds.x)
  assert.notEqual(y, campus.bounds.y)
  assert.doesNotMatch(svg, /<image\b|canvas|CanvasTexture/i)
})

test.concurrent('OpenClaw containers become the named level', async () => {
  const { world, view, svg } = await openclawContainers()
  const worldTitles = textOf(groupOf(svg, 'titles'))
  const named = view.items.filter(entry => entry.role === 'named')
  assert.deepEqual(named.map(entry => entry.id).sort(), [...containerIds].sort())
  assert.equal(view.items.filter(entry => entry.role === 'underlay').length, 0)
  assert.equal(world.elements.filter(element => element.kind === 'component').length, 0)
  for (const id of containerIds) {
    const drawn = shapeOf(svg, id)
    assert.equal(item(view, id).role, 'named')
    assert.equal(drawn.role, 'named')
    assert.equal(worldTitles.get(id), item(view, id).name)
    assert.deepEqual(
      { x: drawn.x, y: drawn.y, width: drawn.width, height: drawn.height },
      item(view, id).bounds,
    )
  }
})

test.concurrent('people and externals stay marks at their anchors when OpenClaw docks', async () => {
  const context = await openclawContext()
  const entered = await openclawContainers()
  const worldTitles = textOf(groupOf(entered.svg, 'titles'))
  for (const id of markIds) {
    const mark = item(entered.view, id)
    const drawn = shapeOf(entered.svg, id)
    const was = item(context.view, id)
    assert.equal(mark.role, 'mark')
    assert.equal(drawn.role, 'mark')
    assert.equal(worldTitles.get(id), mark.name)
    assert.equal(drawn.x, was.bounds.x)
    assert.equal(drawn.y, was.bounds.y)
    assert.deepEqual(
      { x: drawn.x, y: drawn.y, width: drawn.width, height: drawn.height },
      mark.bounds,
    )
  }
})

test.concurrent('groma web serves the docked OpenClaw campus as SVG', async () => {
  const server = await startWebViewer(openclawFixtureRoot, { port: 0 })
  try {
    const response = await fetch(`${server.url}/containers.svg?focus=openclaw`)
    assert.equal(response.ok, true)
    assert.match(response.headers.get('content-type') ?? '', /image\/svg\+xml/)
    const svg = await response.text()
    assert.equal(textOf(groupOf(svg, 'dock')).get('openclaw'), 'OpenClaw')
    const worldTitles = textOf(groupOf(svg, 'titles'))
    assert.ok(!worldTitles.has('openclaw'))
    for (const id of containerIds) {
      assert.ok(worldTitles.has(id), id)
    }
    for (const id of markIds) {
      assert.ok(worldTitles.has(id), id)
    }
  } finally {
    server.close()
  }
})
