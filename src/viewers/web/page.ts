import type {
  ArchitectureWorld,
  Bounds,
  WorldElement,
  WorldGroup,
  WorldRelationship,
} from '../../types.ts'
import {
  buildScene,
  corners,
  ISO_X,
  ISO_Y,
  project,
} from './scene.ts'
import type { SceneItem, ScreenPoint } from './scene.ts'

const labelSizes = { person: 4.5, system: 5.5, container: 5, component: 4.5 } as const

function escapeXml(text: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }
  return text.replace(/[&<>"']/g, character => replacements[character] as string)
}

function points(screenPoints: ScreenPoint[]): string {
  return screenPoints
    .map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
}

function polygon(screenPoints: ScreenPoint[], className: string): string {
  return `<polygon class="${className}" points="${points(screenPoints)}"/>`
}

/** Content drawn flat on the plane at elevation z; text inside skews with the map. */
function flat(z: number, content: string): string {
  const matrix = `${ISO_X} ${ISO_Y} ${-ISO_X} ${ISO_Y} 0 0`
  return `<g transform="translate(0 ${-z}) matrix(${matrix})">${content}</g>`
}

function fittedText(
  bounds: Bounds,
  text: string,
  fontSize: number,
  className: string,
): string {
  const available = bounds.width - 4
  const estimated = text.length * fontSize * 0.62
  const squeeze = estimated > available
    ? ` textLength="${available.toFixed(1)}" lengthAdjust="spacingAndGlyphs"`
    : ''
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  return `<text class="${className}" x="${x}" y="${y}" font-size="${fontSize}"${squeeze}>${escapeXml(text)}</text>`
}

function rightFace(bounds: Bounds, bottom: number, top: number): ScreenPoint[] {
  const x = bounds.x + bounds.width
  return [
    project(x, bounds.y, bottom),
    project(x, bounds.y + bounds.height, bottom),
    project(x, bounds.y + bounds.height, top),
    project(x, bounds.y, top),
  ]
}

function frontFace(bounds: Bounds, bottom: number, top: number): ScreenPoint[] {
  const y = bounds.y + bounds.height
  return [
    project(bounds.x, y, bottom),
    project(bounds.x + bounds.width, y, bottom),
    project(bounds.x + bounds.width, y, top),
    project(bounds.x, y, top),
  ]
}

function tooltip(element: WorldElement): string {
  const description = element.description === '' ? '' : `\n${element.description}`
  return `<title>${escapeXml(`${element.name} · ${element.kind}${description}`)}</title>`
}

function block(
  element: WorldElement,
  bottom: number,
  top: number,
  label: string,
): string {
  const ghost = element.origin === 'observed' ? '' : ' ghost'
  const right = rightFace(element.bounds, bottom, top)
  return `<g class="el${ghost}" data-kind="${element.kind}">${tooltip(element)}`
    + polygon(frontFace(element.bounds, bottom, top), 'side front')
    + polygon(right, 'side')
    + polygon(right, 'shade')
    + polygon(corners(element.bounds, top), 'top')
    + flat(top, label)
    + '</g>'
}

function slab(element: WorldElement, bottom: number, top: number): string {
  const label = `<text class="district" x="${element.bounds.x + 3}" y="${element.bounds.y + 3}" font-size="5">${escapeXml(element.name.toUpperCase())}</text>`
  return block(element, bottom, top, label)
}

function prism(element: WorldElement, bottom: number, top: number): string {
  const fontSize = labelSizes[element.kind]
  const head = element.kind === 'person'
    ? `<circle class="head" cx="${element.bounds.x + element.bounds.width / 2}" cy="${element.bounds.y + element.bounds.height / 2 - 7}" r="3.5"/>`
    : ''
  return block(element, bottom, top, head + fittedText(element.bounds, element.name, fontSize, 'name'))
}

function zone(group: WorldGroup, z: number): string {
  const bounds = group.bounds
  const label = `<text class="district" x="${bounds.x + 3}" y="${bounds.y + 3}" font-size="4.5">${escapeXml(group.name.toUpperCase())}</text>`
  const rect = `<rect class="zone" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"/>`
  return flat(z, rect + label)
}

function route(relationship: WorldRelationship, z: number): string {
  const ghost = relationship.origin === 'observed' ? '' : ' ghost'
  const line = `<polyline class="route${ghost}" points="${relationship.route.map(point => `${point.x},${point.y}`).join(' ')}" marker-end="url(#arrow)"/>`
  const label = relationship.label === null
    ? ''
    : fittedText(relationship.label, relationship.description, 4, 'flow')
  return flat(z, line + label)
}

function render(item: SceneItem): string {
  switch (item.kind) {
    case 'slab':
      return slab(item.element, item.bottom, item.top)
    case 'prism':
      return prism(item.element, item.bottom, item.top)
    case 'zone':
      return zone(item.group, item.z)
    case 'route':
      return route(item.relationship, item.z)
  }
}

const style = `
  :root { --paper: #EDE8D6; --raised: #F6F2E4; --ink: #26251D; --accent: #1D9E75; }
  html, body { margin: 0; height: 100%; background: var(--paper); }
  svg { display: block; width: 100%; height: 100%; cursor: grab; }
  svg:active { cursor: grabbing; }
  polygon { stroke: var(--ink); stroke-width: 0.5; stroke-linejoin: round; }
  .top { fill: var(--raised); }
  .shade { fill: var(--ink); fill-opacity: 0.08; stroke: none; }
  .el[data-kind="system"] .side { fill: url(#hatch-system); }
  .el[data-kind="container"] .side { fill: url(#hatch-container); }
  .el[data-kind="component"] .side { fill: url(#hatch-component); }
  .el[data-kind="person"] .side { fill: url(#hatch-person); }
  .el:hover polygon { stroke: var(--accent); stroke-width: 1; }
  .el.ghost polygon { stroke-dasharray: 2 1.5; }
  .head { fill: var(--ink); }
  text { font-family: 'SF Mono', ui-monospace, Menlo, monospace; fill: var(--ink); }
  .name { text-anchor: middle; dominant-baseline: central; }
  .district { dominant-baseline: hanging; letter-spacing: 0.08em; opacity: 0.65; }
  .zone { fill: var(--ink); fill-opacity: 0.03; stroke: var(--ink); stroke-width: 0.4; stroke-dasharray: 3 2; }
  .route { fill: none; stroke: var(--ink); stroke-width: 0.6; }
  .route.ghost { stroke-dasharray: 2 1.5; }
  .flow { text-anchor: middle; dominant-baseline: central; opacity: 0.8; paint-order: stroke; stroke: var(--paper); stroke-width: 2; }
`

const panZoomScript = `
  const svg = document.querySelector('svg')
  const view = svg.viewBox.baseVal
  const scale = () => {
    const rect = svg.getBoundingClientRect()
    return Math.min(rect.width / view.width, rect.height / view.height)
  }
  const toWorld = event => {
    const rect = svg.getBoundingClientRect()
    const k = scale()
    return {
      x: view.x + view.width / 2 + (event.clientX - rect.left - rect.width / 2) / k,
      y: view.y + view.height / 2 + (event.clientY - rect.top - rect.height / 2) / k,
    }
  }
  svg.addEventListener('wheel', event => {
    event.preventDefault()
    const factor = Math.exp(event.deltaY * 0.002)
    const pointer = toWorld(event)
    view.x = pointer.x - (pointer.x - view.x) * factor
    view.y = pointer.y - (pointer.y - view.y) * factor
    view.width *= factor
    view.height *= factor
  }, { passive: false })
  let last = null
  svg.addEventListener('pointerdown', event => {
    last = { x: event.clientX, y: event.clientY }
    svg.setPointerCapture(event.pointerId)
  })
  svg.addEventListener('pointermove', event => {
    if (last === null) return
    const k = scale()
    view.x -= (event.clientX - last.x) / k
    view.y -= (event.clientY - last.y) / k
    last = { x: event.clientX, y: event.clientY }
  })
  svg.addEventListener('pointerup', () => { last = null })
`

function hatch(id: string, content: string): string {
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="4" height="4">`
    + `<rect width="4" height="4" fill="var(--raised)"/>${content}</pattern>`
}

const defs = '<defs>'
  + hatch('hatch-system', '<path d="M-1,1 L1,-1 M0,4 L4,0 M3,5 L5,3" stroke="#26251D" stroke-width="0.6"/>')
  + hatch('hatch-container', '<path d="M-1,3 L3,-1 M1,5 L5,1" stroke="#26251D" stroke-width="0.5"/>')
  + hatch('hatch-component', '<path d="M0,1 H4 M0,3 H4" stroke="#26251D" stroke-width="0.4"/>')
  + hatch('hatch-person', '<circle cx="2" cy="2" r="0.7" fill="#26251D"/>')
  + '<marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
  + '<path d="M0,0 L6,3 L0,6 z" fill="#26251D"/></marker>'
  + '</defs>'

export function renderPage(world: ArchitectureWorld): string {
  const scene = buildScene(world)
  const margin = 12
  const viewBox = [
    scene.fit.x - margin,
    scene.fit.y - margin,
    scene.fit.width + margin * 2,
    scene.fit.height + margin * 2,
  ].map(value => value.toFixed(2)).join(' ')

  return '<!doctype html><html><head><meta charset="utf-8"><title>groma map</title>'
    + `<style>${style}</style></head><body>`
    + `<svg viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">`
    + defs
    + scene.items.map(render).join('')
    + '</svg>'
    + `<script>${panZoomScript}</script>`
    + '</body></html>'
}
