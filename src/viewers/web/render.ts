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
  defaultProjection,
  fitScene,
  orderScene,
  project,
} from './scene.ts'
import type { Projection, SceneItem, ScreenPoint } from './scene.ts'

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
function flat(projection: Projection, z: number, content: string): string {
  // The projected axes and origin ARE the affine matrix, so labels lie on the
  // same plane as the geometry by construction.
  const u = project(projection, 1, 0, 0)
  const v = project(projection, 0, 1, 0)
  const origin = project(projection, 0, 0, z)
  return `<g transform="matrix(${u.x} ${u.y} ${v.x} ${v.y} ${origin.x} ${origin.y})">${content}</g>`
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

interface Wall {
  corners: ScreenPoint[]
  /** Positive when the wall faces the viewer. */
  facing: number
  /** East/west walls carry the shade overlay so lighting stays consistent while rotating. */
  shaded: boolean
}

/** The walls that face the viewer; back walls sit fully behind the top and front ones. */
function visibleWalls(
  projection: Projection,
  bounds: Bounds,
  bottom: number,
  top: number,
): Wall[] {
  const { x, y, width, height } = bounds
  const sin = Math.sin(projection.rotation)
  const cos = Math.cos(projection.rotation)
  const p = (px: number, py: number, z: number) => project(projection, px, py, z)
  const walls: Wall[] = [
    {
      corners: [p(x + width, y, bottom), p(x + width, y + height, bottom), p(x + width, y + height, top), p(x + width, y, top)],
      facing: sin,
      shaded: true,
    },
    {
      corners: [p(x, y, bottom), p(x, y + height, bottom), p(x, y + height, top), p(x, y, top)],
      facing: -sin,
      shaded: true,
    },
    {
      corners: [p(x, y + height, bottom), p(x + width, y + height, bottom), p(x + width, y + height, top), p(x, y + height, top)],
      facing: cos,
      shaded: false,
    },
    {
      corners: [p(x, y, bottom), p(x + width, y, bottom), p(x + width, y, top), p(x, y, top)],
      facing: -cos,
      shaded: false,
    },
  ]
  return walls.filter(wall => wall.facing > 0)
}

function tooltip(element: WorldElement): string {
  const description = element.description === '' ? '' : `\n${element.description}`
  return `<title>${escapeXml(`${element.name} · ${element.kind}${description}`)}</title>`
}

function block(
  projection: Projection,
  element: WorldElement,
  bottom: number,
  top: number,
  label: string,
): string {
  const ghost = element.origin === 'observed' ? '' : ' ghost'
  // At top-down elevation the walls collapse to lines; drawing them would
  // double every box edge's stroke.
  const topDown = Math.cos(projection.elevation) < 0.01
  const sides = topDown
    ? ''
    : visibleWalls(projection, element.bounds, bottom, top)
        .map(wall => polygon(wall.corners, 'side') + (wall.shaded ? polygon(wall.corners, 'shade') : ''))
        .join('')
  return `<g class="el${ghost}" data-kind="${element.kind}">${tooltip(element)}`
    + sides
    + polygon(corners(projection, element.bounds, top), 'top')
    + flat(projection, top, label)
    + '</g>'
}

function slab(projection: Projection, element: WorldElement, bottom: number, top: number): string {
  const label = `<text class="district" x="${element.bounds.x + 3}" y="${element.bounds.y + 3}" font-size="5">${escapeXml(element.name.toUpperCase())}</text>`
  return block(projection, element, bottom, top, label)
}

function prism(projection: Projection, element: WorldElement, bottom: number, top: number): string {
  const fontSize = labelSizes[element.kind]
  const head = element.kind === 'person'
    ? `<circle class="head" cx="${element.bounds.x + element.bounds.width / 2}" cy="${element.bounds.y + element.bounds.height / 2 - 7}" r="3.5"/>`
    : ''
  return block(projection, element, bottom, top, head + fittedText(element.bounds, element.name, fontSize, 'name'))
}

function zone(projection: Projection, group: WorldGroup, z: number): string {
  const bounds = group.bounds
  const label = `<text class="district" x="${bounds.x + 3}" y="${bounds.y + 3}" font-size="4.5">${escapeXml(group.name.toUpperCase())}</text>`
  const rect = `<rect class="zone" x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}"/>`
  return flat(projection, z, rect + label)
}

function route(projection: Projection, relationship: WorldRelationship, z: number): string {
  const ghost = relationship.origin === 'observed' ? '' : ' ghost'
  const line = `<polyline class="route${ghost}" points="${relationship.route.map(point => `${point.x},${point.y}`).join(' ')}" marker-end="url(#arrow)"/>`
  const label = relationship.label === null
    ? ''
    : fittedText(relationship.label, relationship.description, 4, 'flow')
  return flat(projection, z, line + label)
}

function renderItem(projection: Projection, item: SceneItem): string {
  switch (item.kind) {
    case 'slab':
      return slab(projection, item.element, item.bottom, item.top)
    case 'prism':
      return prism(projection, item.element, item.bottom, item.top)
    case 'zone':
      return zone(projection, item.group, item.z)
    case 'route':
      return route(projection, item.relationship, item.z)
  }
}

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

const world: ArchitectureWorld = JSON.parse(
  document.getElementById('world')!.textContent!,
)
const items = buildScene(world)
const svg = document.querySelector('svg')!
const view = svg.viewBox.baseVal

const degrees = (radians: number) => Math.round(radians * 180 / Math.PI)
const radians = (value: string) => Number(value) * Math.PI / 180

const rotation = document.getElementById('rotation') as HTMLInputElement
const tilt = document.getElementById('tilt') as HTMLInputElement
const button2d = document.getElementById('mode-2d') as HTMLButtonElement
const button3d = document.getElementById('mode-3d') as HTMLButtonElement

rotation.value = String(degrees(defaultProjection.rotation))
tilt.value = String(degrees(defaultProjection.elevation))
let planView = false

function projection(): Projection {
  return {
    rotation: radians(rotation.value),
    elevation: planView ? Math.PI / 2 : radians(tilt.value),
  }
}

function fitCamera(current: Projection): void {
  const margin = 12
  const fit = fitScene(items, current)
  view.x = fit.x - margin
  view.y = fit.y - margin
  view.width = fit.width + margin * 2
  view.height = fit.height + margin * 2
}

let queued = false
function draw(): void {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    const current = projection()
    fitCamera(current)
    svg.innerHTML = defs + orderScene(items, current).map(item => renderItem(current, item)).join('')
    document.getElementById('rotation-value')!.textContent = `${rotation.value}°`
    document.getElementById('tilt-value')!.textContent = planView ? '90°' : `${tilt.value}°`
  })
}

function setMode(plan: boolean): void {
  planView = plan
  button2d.classList.toggle('active', planView)
  button3d.classList.toggle('active', !planView)
  tilt.disabled = planView
  draw()
}

button2d.addEventListener('click', () => setMode(true))
button3d.addEventListener('click', () => setMode(false))
rotation.addEventListener('input', () => draw())
tilt.addEventListener('input', () => draw())

const scale = () => {
  const rect = svg.getBoundingClientRect()
  return Math.min(rect.width / view.width, rect.height / view.height)
}
svg.addEventListener('wheel', event => {
  event.preventDefault()
  const rect = svg.getBoundingClientRect()
  const k = scale()
  const pointer = {
    x: view.x + view.width / 2 + (event.clientX - rect.left - rect.width / 2) / k,
    y: view.y + view.height / 2 + (event.clientY - rect.top - rect.height / 2) / k,
  }
  const factor = Math.exp(event.deltaY * 0.002)
  view.x = pointer.x - (pointer.x - view.x) * factor
  view.y = pointer.y - (pointer.y - view.y) * factor
  view.width *= factor
  view.height *= factor
}, { passive: false })

let last: ScreenPoint | null = null
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
svg.addEventListener('pointerup', () => {
  last = null
})

draw()
