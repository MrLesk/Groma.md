import type { Point } from '../../types.ts'

const svgNamespace = 'http://www.w3.org/2000/svg'
const flowSpeed = 26
const flowSpacing = 30

export interface SvgFlowRoute {
  id: string
  points: Point[]
}

export function flowSyncDecision(
  currentKey: string,
  currentSignature: string,
  currentTravelled: number,
  nextKey: string,
  nextSignature: string,
): { refresh: boolean; travelled: number } {
  if (currentKey === nextKey && currentSignature === nextSignature) {
    return { refresh: false, travelled: currentTravelled }
  }
  return {
    refresh: true,
    travelled: currentKey === nextKey ? currentTravelled : 0,
  }
}

interface FlowLane {
  points: Point[]
  cums: number[]
  total: number
}

interface FlowDot {
  element: SVGCircleElement
  lane: FlowLane
  offset: number
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(svgNamespace, tag)
}

function pathText(points: readonly Point[]): string {
  const [first, ...rest] = points
  if (!first) return ''
  const text = (point: Point): string => `${point.x} ${point.y}`
  return [`M ${text(first)}`, ...rest.map(point => `L ${text(point)}`)].join(' ')
}

function laneFor(points: readonly Point[]): FlowLane | undefined {
  if (points.length < 2) return undefined
  const cums = [0]
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!
    const to = points[index]!
    cums.push(cums[index - 1]! + Math.hypot(to.x - from.x, to.y - from.y))
  }
  const total = cums.at(-1) ?? 0
  return total < 1 ? undefined : { points: [...points], cums, total }
}

function routeSignature(routes: readonly SvgFlowRoute[], pathIds: Set<string>): string {
  return routes
    .filter(route => pathIds.has(route.id))
    .map(route => `${route.id}:${route.points.map(point => `${point.x},${point.y}`).join(';')}`)
    .join('|')
}

/** SVG route overlays and travelling dots for the existing flow playback state. */
export class SvgFlow {
  private key = ''
  private signature = ''
  private group: SVGGElement | null = null
  private dots: FlowDot[] = []
  private frame = 0
  private travelled = 0
  private last = 0
  private paused = false
  private rate = 1

  clear(): void {
    this.key = ''
    this.signature = ''
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.group?.remove()
    this.group = null
    this.dots = []
    this.travelled = 0
    this.last = 0
  }

  sync(key: string, routes: readonly SvgFlowRoute[], pathIds: Set<string>): void {
    const signature = routeSignature(routes, pathIds)
    const decision = flowSyncDecision(
      this.key,
      this.signature,
      this.travelled,
      key,
      signature,
    )
    if (!decision.refresh) return
    if (key !== this.key) {
      this.clear()
      this.key = key
    }
    this.signature = signature
    if (key === '') return
    this.replace(routes, pathIds, decision.travelled)
  }

  private replace(
    routes: readonly SvgFlowRoute[],
    pathIds: Set<string>,
    travelled: number,
  ): void {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.group?.remove()
    this.group = null
    this.dots = []

    const group = svgElement('g')
    group.dataset.flow = ''
    const dots: FlowDot[] = []
    for (const route of routes) {
      if (!pathIds.has(route.id)) continue
      const lane = laneFor(route.points)
      if (!lane) continue
      const trace = svgElement('path')
      trace.dataset.routeId = route.id
      trace.setAttribute('d', pathText(route.points))
      trace.setAttribute('fill', 'none')
      trace.setAttribute('stroke', 'var(--accent)')
      trace.setAttribute('stroke-width', '2')
      trace.setAttribute('vector-effect', 'non-scaling-stroke')
      group.append(trace)
      const count = Math.max(1, Math.floor(lane.total / flowSpacing))
      for (let index = 0; index < count; index += 1) {
        const dot = svgElement('circle')
        dot.dataset.routeId = route.id
        dot.setAttribute('r', '2')
        dot.setAttribute('fill', 'var(--accent)')
        dots.push({
          element: dot,
          lane,
          offset: (index / count) * lane.total,
        })
        group.append(dot)
      }
    }
    this.travelled = travelled
    this.last = 0
    if (dots.length === 0) return
    this.group = group
    this.dots = dots
    this.placeDots(travelled)
    this.frame = requestAnimationFrame(now => this.step(now))
  }

  appendTo(svg: SVGSVGElement): void {
    if (this.group !== null) svg.append(this.group)
  }

  paint(
    step: number | null,
    legs: readonly { id: string }[],
    paused: boolean,
    rate: number,
  ): void {
    if (this.group === null) return
    this.paused = paused
    this.rate = rate
    const active = step === null ? undefined : legs[step]?.id
    for (const node of this.group.querySelectorAll('[data-route-id]')) {
      const routeId = node.getAttribute('data-route-id')
      node.toggleAttribute('hidden', active !== undefined && routeId !== active)
    }
  }

  private placeDots(travelled: number): void {
    for (const dot of this.dots) {
      const distance = (dot.offset + travelled) % dot.lane.total
      let index = 1
      while (index < dot.lane.cums.length - 1 && dot.lane.cums[index]! <= distance) index += 1
      const from = dot.lane.points[index - 1]!
      const to = dot.lane.points[index]!
      const span = dot.lane.cums[index]! - dot.lane.cums[index - 1]!
      const t = span > 0
        ? (distance - dot.lane.cums[index - 1]!) / span
        : 0
      dot.element.setAttribute('cx', String(from.x + (to.x - from.x) * t))
      dot.element.setAttribute('cy', String(from.y + (to.y - from.y) * t))
    }
  }

  private step(now: number): void {
    if (this.group === null) return
    if (this.last === 0) this.last = now
    if (!this.paused) this.travelled += ((now - this.last) / 1000) * flowSpeed * this.rate
    this.last = now
    this.placeDots(this.travelled)
    this.frame = requestAnimationFrame(next => this.step(next))
  }
}
