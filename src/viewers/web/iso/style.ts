import { mixColour, webFontFamily, type Palette } from '../atoms/theme.ts'
import { layerCss } from '../layers/paint.ts'
import { glowCss } from './glow.ts'
import { DEFAULT_PROJECTION, planeMatrix } from './project.ts'
import type { Plane, ProjectionView } from './project.ts'
import { FACADE_MARK, SIDE, depthOf, emphasis, strokeAt, tintAt } from './scale.ts'
import type { Level } from './scale.ts'
import { node, type SvgNode } from './svg.ts'

/** Tile marks draw in pattern space, so they keep ordinary strokes instead of the map's non-scaling ones. */
function mark(tag: string, attributes: Record<string, string | number>): SvgNode {
  return { tag, attributes: Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name, String(value)])), children: [] }
}

const ink = { stroke: 'var(--map-hatch)', 'stroke-width': 0.75 }
const dot = mark('circle', { cx: 4, cy: 4, r: 0.75, fill: 'var(--map-hatch)' })
const cross = mark('path', { d: 'M4 2V6M2 4H6', ...ink })
const line = mark('path', { d: 'M0 3H6', ...ink })

function tile(id: string, plane: Plane, size: number, body: SvgNode[], view: ProjectionView): SvgNode[] {
  if (view.pitch === 90 && plane !== 'ground') return []
  return [node('pattern', {
    id, width: size, height: size, patternUnits: 'userSpaceOnUse', patternTransform: planeMatrix(plane, undefined, view),
  }, '', body)]
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function facadePatternId(fileType: string, plane: Extract<Plane, 'left' | 'right'>): string {
  return `facade-${hash(fileType).toString(36)}-${plane}`
}

/** A stable window tile derived from the file type itself, so unknown extensions need no registry. */
export function facadePattern(
  fileType: string,
  plane: Extract<Plane, 'left' | 'right'>,
  view: ProjectionView = DEFAULT_PROJECTION,
): SvgNode[] {
  const value = hash(fileType)
  const bits = (value ^ (value >>> 9) ^ (value >>> 18)) & 0x1ff || 1
  const windows = Array.from({ length: 9 }, (_, index) => index).filter(index => (bits & (1 << index)) !== 0)
    .map(index => mark('rect', {
      x: 1 + (index % 3) * 2.5, y: 1 + Math.floor(index / 3) * 2.5, width: FACADE_MARK, height: FACADE_MARK, fill: 'var(--map-hatch)',
    }))
  return tile(facadePatternId(fileType, plane), plane, 8, windows, view)
}

/**
 * One grey pattern per kind, each tile drawn in the pixels of the plane it
 * lies on and mapped by that plane's matrix: dots for actors (their island
 * and the sides of their buildings), crosses for external systems, storey
 * fallback lines for components without source files, a faint grain for container slabs and a
 * diagonal hatch for group zones. Systems have no pattern, and neither does
 * any roof.
 */
export function mapDefs(view: ProjectionView = DEFAULT_PROJECTION): SvgNode[] {
  return [
    ...tile('dots', 'ground', 8, [dot], view),
    ...tile('dots-left', 'left', 8, [dot], view), ...tile('dots-right', 'right', 8, [dot], view),
    ...tile('cross', 'ground', 8, [cross], view),
    ...tile('cross-left', 'left', 8, [cross], view), ...tile('cross-right', 'right', 8, [cross], view),
    ...tile('lines-left', 'left', 6, [line], view), ...tile('lines-right', 'right', 6, [line], view),
    ...tile('grain', 'ground', 12, [mark('circle', { cx: 6, cy: 6, r: 0.6, fill: 'var(--map-hatch)' })], view),
    ...tile('hatch-ground', 'ground', 8, [mark('path', { d: 'M0 8L8 0', ...ink })], view),
  ]
}

/** The same colour and level rules serve browser CSS and explicit static SVG values. */
function paintTint(share: number, palette?: Palette): string {
  return palette === undefined
    ? `color-mix(in srgb, var(--ink) ${(share * 100).toFixed(1)}%, var(--paper))`
    : mixColour(palette.paper, palette.ink, share)
}

function stroke(level: Level, palette: Palette | undefined, zoom: number): string {
  const width = strokeAt(depthOf(level)).toFixed(2)
  return palette === undefined ? `--stroke: ${width}px;` : `stroke-width: ${Number(width) / zoom};`
}

function surfaceColours(kind: string, depth: number, palette?: Palette): string {
  return `#map .${kind} .ground, #map .${kind} .top { fill: ${paintTint(tintAt(depth), palette)}; }
    #map .${kind} .right { fill: ${paintTint(tintAt(depth + SIDE.right), palette)}; }
    #map .${kind} .left { fill: ${paintTint(tintAt(depth + SIDE.left), palette)}; }`
}

/** Supplying a palette resolves theme values and compensates strokes for a fixed SVG camera. */
export function mapDrawingCss(palette?: Palette, zoom = 1): string {
  const paper = palette?.paper ?? 'var(--paper)'
  const ink = palette?.ink ?? 'var(--ink)'
  const muted = palette?.muted ?? 'var(--muted)'
  const line = palette?.line ?? 'var(--map-line)'
  const grid = palette === undefined ? 'var(--map-grid)' : mixColour(palette.paper, palette.line, 0.12)
  const gridMajor = palette === undefined ? 'var(--map-grid-major)' : mixColour(palette.paper, palette.line, 0.2)
  const width = palette === undefined ? 'stroke-width: calc(var(--stroke) * var(--emphasis, 1) * var(--weight, 1));' : ''
  return `
  #map .sheet { pointer-events: none; ${stroke('island', palette, zoom)} }
  #map .calibration-tick, #map .compass, #map .project-plate { ${stroke('building', palette, zoom)} }
  /* zones lie inside slab groups and keep their own weight while the slab is hovered or selected */
  #map .zone { ${stroke('building', palette, zoom)} --emphasis: 1; }
  #map .island { ${stroke('island', palette, zoom)} }
  #map .slab { ${stroke('slab', palette, zoom)} }
  #map .building { ${stroke('building', palette, zoom)} }
  #map .route { ${stroke('route', palette, zoom)} }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star, #map .compass .north,
  #map .project-plate .plate, #map .project-plate .edit-frame,
  #map .project-plate .pencil path, #map .project-plate .pencil polygon,
  #map .ground, #map .face, #map .route-base, #map .route .line {
    stroke: ${line}; stroke-linejoin: round;
    ${width}
  }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star,
  #map .project-plate .edit-frame, #map .project-plate .pencil path { fill: none; }
  #map .frame { ${palette === undefined ? '--emphasis: 1.6;' : `stroke-width: ${strokeAt(0) * 1.6 / zoom};`} }
  #map .calibration-tick { stroke-linecap: square; }
  #map .compass { ${palette === undefined ? '--emphasis: 1.25;' : `stroke-width: ${strokeAt(2) * 1.25 / zoom};`} }
  #map .compass .north { fill: ${line}; }
  #map .compass .text { fill: ${ink}; font-weight: 600; }
  #map .project-plate .plate { fill: ${paper}; fill-opacity: 0.72; }
  #map .project-plate .project-title .text { font-weight: 650; letter-spacing: 0.06em; }
  #map .project-plate .project-overview .text { fill: ${muted}; }
  #map .project-plate .project-overview .md-strong { font-weight: 700; fill: ${ink}; }
  #map .project-plate .project-overview .md-emphasis { font-style: italic; }
  #map .project-plate .project-overview .md-code { font-family: ${webFontFamily}; fill: ${ink}; }
  #map .project-plate .project-overview .md-link { text-decoration: underline; text-underline-offset: 2px; }
  #map .project-plate .project-meta .text { fill: ${muted}; letter-spacing: 0.14em; }
  #map .project-edit { pointer-events: all; cursor: pointer; outline: none; }
  #map .project-edit .edit-frame { fill: transparent; pointer-events: all; }
  #map .project-edit .pencil path { stroke-linecap: square; }
  #map .project-edit .pencil .body { fill: ${paintTint(0.1, palette)}; }
  #map .project-edit .pencil .facet { fill: ${paintTint(0.18, palette)}; }
  #map .project-edit .pencil .eraser { fill: ${paintTint(0.28, palette)}; }
  #map .project-edit .pencil .ferrule { fill: ${paintTint(0.18, palette)}; }
  #map .project-edit .pencil .tip { fill: ${paintTint(0.12, palette)}; }
  #map .project-edit .pencil .lead { fill: ${ink}; }
  #map .project-edit .pencil .facet, #map .project-edit .pencil .eraser, #map .project-edit .pencil .ferrule,
  #map .project-edit .pencil .tip, #map .project-edit .pencil .lead { stroke: none; }
  #map .grid { fill: none; stroke: ${grid}; }
  #map .grid.major { stroke: ${gridMajor}; }
  #map > .map-surface[data-minor-grid-hidden] .grid:not(.major) { display: none; }
  ${surfaceColours('island', depthOf('island'), palette)}
  ${surfaceColours('system', depthOf('island') - 0.5, palette)}
  ${surfaceColours('slab', depthOf('slab'), palette)}
  ${surfaceColours('building', depthOf('building'), palette)}
  #map .actor .face { fill: ${paper}; }
  #map .zone .ground { fill: url(#hatch-ground); }
  #map .pattern { stroke: none; pointer-events: none; }
  #map .island.actors .pattern { fill: url(#dots); }
  #map .island.external .pattern { fill: url(#cross); }
  #map .slab .pattern { fill: url(#grain); }
  #map .building.component .pattern.left { fill: url(#lines-left); }
  #map .building.component .pattern.right { fill: url(#lines-right); }
  #map .building.actor .pattern.left { fill: url(#dots-left); }
  #map .building.actor .pattern.right { fill: url(#dots-right); }
  #map .building.external .pattern.left { fill: url(#cross-left); }
  #map .building.external .pattern.right { fill: url(#cross-right); }
  #map .camera[data-facades-hidden] .building .pattern { display: none; }
  #map .label-hit { fill: transparent; stroke: none; pointer-events: all; }
  #map .label-leader {
    stroke: ${line}; ${width}
    vector-effect: non-scaling-stroke; pointer-events: none;
  }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; pointer-events: all; }
  #map .ghost .pattern { display: none; }
  #map .ghost.draft .face, #map .ghost.draft .ground,
  #map .route-base.ghost.draft, #map .route.ghost.draft:not(.touched):not(.lit) .line { stroke-dasharray: ${4 / zoom} ${3 / zoom}; }
  #map .text { fill: ${ink}; pointer-events: none; }
  #map .island > .label .text, #map .slab > .label .text, #map .zone > .label .text { font-weight: 600; }
  #map .route-base, #map .route .line { fill: none; stroke-linecap: round; opacity: 0.9; }
  #map .route-base { pointer-events: none; }
  #map .route .line { opacity: 0; }
  #map .route .arrow { fill: ${line}; opacity: 0.9; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
`
}

/**
 * What shows a hover look. Map hover looks key off the .hovered class that iso/map.ts puts on the closest of these
 * under a resting mouse, never :hover, and the camera layer keeps will-change: either change would make Safari
 * redraw the whole map when a pan starts.
 */
export const HOVERABLE = '.building, .slab, .island.system, .route, .project-edit'

/** Browser layout, interaction states and motion surround the shared drawing rules. */
export const mapCss = `
  #map > .map-surface {
    position: absolute; inset: 0; cursor: grab;
    user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
  }
  #map .field-surface, #map .camera { position: absolute; inset: 0; width: 100%; height: 100%; }
  #map .field-surface { pointer-events: none; }
  #map .paint-surface { position: absolute; inset: 0; pointer-events: none; }
  #map .scene { display: block; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
  #map .world { pointer-events: auto; }
  #map .camera[data-tracing] .route-surface { will-change: transform; }
  #map > .map-surface [data-id] { cursor: pointer; }
  #map > .map-surface:active, #map .drag-cover { cursor: grabbing; }
  #map .drag-cover { position: absolute; inset: 0; }
  #map .camera { transform-origin: 0 0; will-change: transform; }
  ${mapDrawingCss()}
  #map .route.hovered, #map .route.endpoint, #map .route.touched { --emphasis: ${emphasis(1)}; }
  #map .route.hovered .line { stroke: var(--map-line); opacity: 1; }
  #map .route.hovered .arrow { fill: var(--map-line); opacity: 1; }
  #map .route.endpoint .line, #map .route.selected .line, #map .route.touched .line { stroke: var(--highlight); opacity: 1; }
  #map .route.endpoint .arrow, #map .route.selected .arrow, #map .route.touched .arrow { fill: var(--highlight); opacity: 1; }
  #map .route.touched .line { stroke-dasharray: none; }
  #map .route.lit { --emphasis: ${emphasis(2)}; }
  #map .route.lit .line { stroke: var(--highlight); opacity: 1; stroke-dasharray: 8 5; animation: map-flow 900ms linear infinite; }
  #map .route.lit .arrow { fill: var(--highlight); opacity: 1; }
  #map :is(.route, .building, .slab, .island).focused { --emphasis: ${emphasis(3)}; }
  @keyframes map-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -13; } }
  @media (prefers-reduced-motion: reduce) {
    #map .route.lit .line { animation: none; }
  }
  ${glowCss}
  #map .camera[data-tracing] .route-base,
  #map .camera[data-tracing] .route:not(.lit) { display: none; }
  #map .camera[data-tracing] .building:not(.onpath):not(.selected):not(.touched):not(.neighbor),
  #map .camera[data-tracing] .slab:not(.onpath):not(.selected):not(.touched) { opacity: 0.3; }
  #map .project-edit.hovered .edit-frame, #map .project-edit:focus .edit-frame { fill: var(--ink); fill-opacity: 0.05; }
  #map .project-edit.hovered .pencil path, #map .project-edit:focus .pencil path,
  #map .project-edit.hovered .pencil .body, #map .project-edit:focus .pencil .body { stroke: var(--ink); }
  #map .building.hovered:not(.selected), #map .slab.hovered:not(.selected):not(.context),
  #map .island.system.hovered:not(.selected):not(.context), #map .context { --emphasis: ${emphasis(0.5)}; }
  #map .building.hovered:not(.selected) .face, #map .slab.hovered:not(.selected):not(.context) .face,
  #map .island.system.hovered:not(.selected):not(.context) > .ground { stroke: var(--map-line); }
  #map .selected, #map .touched,
  #map .building.lit, #map .slab.lit, #map .island.lit { --emphasis: ${emphasis(1)}; }
  #map .context .face, #map .island.context > .ground, #map .selected .face, #map :is(.island, .zone).selected > .ground,
  #map .touched .face, #map .island.touched > .ground,
  #map .building.lit .face, #map .slab.lit > .face, #map .island.lit > .ground { stroke: var(--highlight); }
  #map .selected > .label .text, #map .touched > .label .text,
  #map .building.lit > .label .text, #map .slab.lit > .label .text, #map .island.lit > .label .text {
    fill: var(--ink); font-weight: 600;
  }
  #map :is(.island, .slab, .zone):is(.selected, .touched, .lit, .context) > .surface-label .text { fill: var(--highlight); }
  #map :is(.island, .slab, .zone):is(.selected, .touched, .lit, .context) > .surface-label .label-leader { stroke: var(--highlight); }
  #map .building.neighbor:not(.selected):not(.touched):not(.lit) { --emphasis: ${emphasis(0.5)}; }
  #map .building.neighbor:not(.selected):not(.touched):not(.lit) .face { stroke: color-mix(in srgb, var(--highlight) 45%, var(--map-line)); }
  #map .camera:has(.component-focus) .building.component:not(.component-focus):not(.neighbor) { opacity: 0.3; }
  #map [data-change="added"] { --change: var(--diff-added); }
  #map [data-change="modified"] { --change: var(--diff-modified); }
  #map [data-change="removed"] { --change: var(--diff-removed); }
  #map .building.component[data-change] .face.top { fill: color-mix(in srgb, var(--change) 25%, var(--paper)); }
  #map .building.component[data-change] .face.left { fill: color-mix(in srgb, var(--change) 18%, var(--paper)); }
  #map .building.component[data-change] .face.right { fill: color-mix(in srgb, var(--change) 11%, var(--paper)); }
  #map .building.component[data-change]:not(.selected):not(.lit):not(.component-focus) .face { stroke: var(--change); }
  #map .building.component[data-change] > .label .text { fill: var(--change); }
  #map .building.component:is(.selected, .lit) > .label .text { fill: var(--highlight-text); }
  #map .route[data-change]:not(.lit):not(.selected):not(.endpoint) .line { stroke: var(--change); opacity: 1; }
  #map .route[data-change]:not(.lit):not(.selected):not(.endpoint) .arrow { fill: var(--change); opacity: 1; }
  ${layerCss}
`
