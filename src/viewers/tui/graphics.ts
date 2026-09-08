import { ImageRenderable, NativeImage, resolveImageRenderProtocol } from '@opentui/core'
import { rasterizeGraphics } from './graphics-raster.ts'
import type { CliRenderer, FrameBufferRenderable, KeyEvent, MouseEvent, TerminalCapabilities } from '@opentui/core'
import type { Point } from '../../types.ts'
import type { TerminalViewModel } from './model.ts'
import type { MapDirection, ViewerState } from './navigation.ts'
import { nearestInDirection } from './navigation-spatial.ts'
import { graphicsAnchors, graphicsHit, graphicsScene, graphicsScope, graphicsSvg } from './graphics-scene.ts'
import type { GraphicsScene } from './graphics-scene.ts'
import { fitGraphics, panGraphics, rasterSize, revealGraphics, toGraphicsWorld, zoomGraphics } from './graphics-camera.ts'
import type { GraphicsCamera, PixelSize } from './graphics-camera.ts'

export type GraphicsProtocol = 'auto' | 'text' | 'kitty' | 'sixel' | 'blocks'

export function graphicsProtocol(requested: GraphicsProtocol, capabilities: TerminalCapabilities | null, hasResolution: boolean): Exclude<GraphicsProtocol, 'auto'> {
  if (requested === 'text') return 'text'
  const resolved = resolveImageRenderProtocol(requested, capabilities, hasResolution)
  return resolved === 'blocks' && requested !== 'blocks' ? 'text' : resolved
}

interface GraphicsRequest {
  scene: GraphicsScene
  model: TerminalViewModel
  state: ViewerState
  camera: GraphicsCamera
  size: PixelSize
  columns: number
  rows: number
  svg: string
  generation: number
}

const directions: Readonly<Record<string, MapDirection>> = { up: 'up', down: 'down', left: 'left', right: 'right', j: 'down', k: 'up' }
const deltas: Readonly<Record<MapDirection, Point>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

/** One image viewport inside the existing TUI. One raster in flight, one replaceable pending frame. */
export class TerminalGraphics {
  private readonly renderer: CliRenderer
  private readonly map: FrameBufferRenderable
  private readonly image: ImageRenderable
  private readonly changed: () => void
  private readonly select: (id: string) => void
  private readonly focus: () => void
  private requested: GraphicsProtocol
  private previous: GraphicsProtocol
  private scene?: GraphicsScene
  private sheet?: TerminalViewModel['sheet']
  private model?: TerminalViewModel
  private state?: ViewerState
  private camera?: GraphicsCamera
  private size: PixelSize = { width: 1, height: 1 }
  private paths: ReadonlySet<string> = new Set()
  private presented?: GraphicsRequest
  private pending?: GraphicsRequest
  private timer?: ReturnType<typeof setTimeout>
  private busy = false
  private closed = false
  private generation = 0
  private lastSvg = ''
  private failure?: string
  private drag?: { at: Point; moved: boolean }
  private readonly onCapabilities = (): void => this.changed()

  constructor(renderer: CliRenderer, map: FrameBufferRenderable, protocol: GraphicsProtocol,
    handlers: { changed(): void; select(id: string): void; focus(): void }) {
    this.renderer = renderer
    this.map = map
    this.requested = protocol
    this.previous = protocol === 'text' ? 'auto' : protocol
    this.changed = handlers.changed
    this.select = handlers.select
    this.focus = handlers.focus
    this.image = new ImageRenderable(renderer, {
      id: 'groma-graphics', position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
      fit: 'fill', visible: false, onMouse: event => this.mouse(event),
    })
    map.add(this.image)
    renderer.on('capabilities', this.onCapabilities)
  }

  get active(): boolean {
    return !this.closed && !this.failure && this.state?.work === undefined && this.protocol !== 'text'
  }

  private get protocol(): Exclude<GraphicsProtocol, 'auto'> {
    const resolution = this.renderer.resolution
    const hasResolution = resolution !== null && resolution.width > 0 && resolution.height > 0
    return graphicsProtocol(this.requested, this.renderer.capabilities, hasResolution)
  }

  get caption(): string {
    if (this.failure) return 'Text · graphics error'
    return this.active ? `2D · ${this.protocol}` : 'Text'
  }

  get error(): string | undefined { return this.failure }

  update(model: TerminalViewModel, state: ViewerState, paths: ReadonlySet<string>): void {
    const previousState = this.state
    this.model = model
    this.state = state
    this.paths = paths
    if (!this.active || model.elements.length === 0 || this.map.width < 4 || this.map.height < 3) { this.hide(); return }
    if (!this.scene || this.sheet !== model.sheet) {
      this.scene = graphicsScene(model)
      this.sheet = model.sheet
      this.camera = undefined
    }
    const resolution = this.renderer.resolution
    this.size = rasterSize(this.map.width, this.map.height,
      resolution ? resolution.width / Math.max(1, this.renderer.terminalWidth) : 8,
      resolution ? resolution.height / Math.max(1, this.renderer.terminalHeight) : 16)
    if (!this.camera || previousState?.level !== state.level) this.camera = fitGraphics(graphicsScope(this.scene, model, state), this.size)
    else if (previousState?.currentId !== state.currentId) {
      const bounds = state.currentId === undefined ? undefined : this.scene.bounds.get(state.currentId)
      if (bounds) this.camera = revealGraphics(this.camera, bounds, this.size)
    }
    this.queue()
  }

  /** Camera commands are map-local; search and all text-reading modes retain their keys. */
  key(key: KeyEvent): boolean {
    const state = this.state
    if (state?.focus !== 'architecture' || state.search || state.history || state.work || key.ctrl || key.meta) return false
    if (key.name === 'g') {
      this.requested = this.requested === 'text' ? this.previous : 'text'
      this.failure = undefined
      this.changed()
      return true
    }
    if (!this.active || !this.scene || !this.camera || !this.model) return false
    return this.mapKey(key)
  }

  private mapKey(key: KeyEvent): boolean {
    const direction = directions[key.name]
    if (direction) {
      if (key.shift) this.pan(deltas[direction].x * 48, deltas[direction].y * 48)
      else this.navigate(direction)
      return true
    }
    const commands: Record<string, () => void> = {
      '+': () => this.zoom(1.25), '=': () => this.zoom(1.25), '-': () => this.zoom(1 / 1.25),
      '0': () => this.fitAll(), home: () => this.fitAll(), f: () => this.fitSelection(),
      '[': () => this.cycle(-1), ']': () => this.cycle(1),
    }
    const command = commands[key.name]
    command?.()
    return command !== undefined
  }

  private fitAll(): void {
    this.camera = fitGraphics(this.scene!.projected.bounds, this.size)
    this.queue()
  }

  private fitSelection(): void {
    const bounds = this.state?.currentId === undefined ? undefined : this.scene?.bounds.get(this.state.currentId)
    if (bounds) { this.camera = fitGraphics(bounds, this.size); this.queue() }
  }

  private navigate(direction: MapDirection): void {
    const anchors = graphicsAnchors(this.scene!, this.model!, this.state!)
    const current = this.state!.currentId ?? anchors.keys().next().value
    const origin = current === undefined ? undefined : anchors.get(current)
    const next = origin === undefined ? anchors.keys().next().value : nearestInDirection(anchors, current!, origin, direction)
    if (next !== undefined) this.select(next)
  }

  private cycle(delta: number): void {
    const ids = [...graphicsAnchors(this.scene!, this.model!, this.state!).keys()]
    if (ids.length === 0) return
    const at = this.state!.currentId === undefined ? -1 : ids.indexOf(this.state!.currentId)
    this.select(ids[(at + delta + ids.length) % ids.length]!)
  }

  private pan(dx: number, dy: number): void {
    this.camera = panGraphics(this.camera!, dx, dy)
    this.queue()
  }

  private zoom(factor: number, anchor?: Point): void {
    this.camera = zoomGraphics(this.camera!, factor, this.size, fitGraphics(this.scene!.projected.bounds, this.size).scale, anchor)
    this.queue()
  }

  private pixel(event: MouseEvent): Point {
    return { x: (event.x - this.map.x + 0.5) * this.size.width / Math.max(1, this.map.width),
      y: (event.y - this.map.y + 0.5) * this.size.height / Math.max(1, this.map.height) }
  }

  private mouse(event: MouseEvent): void {
    event.stopPropagation()
    event.preventDefault()
    if (!this.active || !this.presented || this.state?.search || this.state?.history || this.state?.keys || this.state?.profile) return
    if (event.type === 'scroll') {
      this.scroll(event)
      return
    }
    if (event.button === 0 || event.type === 'drag-end') this.pointer(event)
  }

  private scroll(event: MouseEvent): void {
    const direction = event.scroll?.direction
    if (direction !== 'up' && direction !== 'down') return
    this.focus()
    this.zoom(direction === 'up' ? 1.25 : 1 / 1.25, this.pixel(event))
  }

  private pointer(event: MouseEvent): void {
    const point = this.pixel(event)
    if (event.type === 'down') { this.drag = { at: point, moved: false }; return }
    if ((event.type === 'drag' || event.type === 'move') && this.drag) {
      const dx = this.drag.at.x - point.x
      const dy = this.drag.at.y - point.y
      if (dx !== 0 || dy !== 0) { this.focus(); this.pan(dx, dy); this.drag = { at: point, moved: true } }
      return
    }
    if (event.type === 'up' || event.type === 'drag-end') this.releasePointer(event)
  }

  private releasePointer(event: MouseEvent): void {
    const drag = this.drag
    this.drag = undefined
    const frame = this.presented
    if (!drag || drag.moved || !frame) return
    const pixel = { x: (event.x - this.map.x + 0.5) * frame.size.width / frame.columns,
      y: (event.y - this.map.y + 0.5) * frame.size.height / frame.rows }
    const id = graphicsHit(frame.scene, toGraphicsWorld(pixel, frame.camera, frame.size), frame.model, this.state!)
    if (id !== undefined && this.model?.elements.some(element => element.representationId === id)) this.select(id)
    else this.focus()
  }

  private queue(): void {
    if (!this.active || !this.scene || !this.camera || !this.model || !this.state) return
    const svg = graphicsSvg(this.scene, this.camera, this.size, this.state.currentId, this.paths)
    if (svg === this.lastSvg) return
    this.lastSvg = svg
    this.pending = { scene: this.scene, camera: this.camera, size: this.size, model: this.model, state: this.state,
      columns: this.map.width, rows: this.map.height, svg, generation: ++this.generation }
    this.schedule()
  }

  private schedule(): void {
    if (this.closed || this.busy || this.timer || !this.pending) return
    this.timer = setTimeout(() => { this.timer = undefined; void this.renderNext() }, 40)
  }

  private async renderNext(): Promise<void> {
    const frame = this.pending
    this.pending = undefined
    if (!frame || !this.active) return
    this.busy = true
    try {
      const raster = await rasterizeGraphics(frame.svg)
      if (this.closed || frame.generation !== this.generation) return
      const image = NativeImage.fromRgba(raster.pixels, raster.width, raster.height)
      try {
        this.image.protocol = this.protocol === 'text' ? 'blocks' : this.protocol
        this.image.source = image
        await this.image.loadPromise
        if (this.closed || frame.generation !== this.generation) return
        this.presented = frame
        this.image.visible = true
      } finally { image.dispose() }
    } catch (error) {
      if (this.closed || frame.generation !== this.generation) return
      this.failure = error instanceof Error ? error.message : String(error)
      this.hide()
      this.changed()
    } finally { this.busy = false; this.schedule() }
  }

  private hide(): void {
    if (!this.lastSvg && !this.presented && !this.pending) return
    ++this.generation
    this.pending = undefined
    this.presented = undefined
    this.lastSvg = ''
    this.drag = undefined
    clearTimeout(this.timer)
    this.timer = undefined
    if (!this.image.isDestroyed) { this.image.visible = false; this.image.source = undefined }
  }

  destroy(): void {
    if (this.closed) return
    this.closed = true
    this.hide()
    this.renderer.off('capabilities', this.onCapabilities)
  }
}
