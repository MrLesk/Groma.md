import { layerCss } from '../layers/paint.ts'
import { DEFAULT_PROJECTION, planeMatrix } from './project.ts'
import type { Plane, ProjectionView } from './project.ts'
import { FACADE_MARK, SIDE, depthOf, emphasis, strokeAt, tintAt } from './scale.ts'
import type { Level } from './scale.ts'

const ink = 'stroke="var(--map-hatch)" stroke-width="0.75"'
const dot = '<circle cx="4" cy="4" r="0.75" fill="var(--map-hatch)"/>'
const cross = `<path d="M4 2V6M2 4H6" ${ink}/>`
const line = `<path d="M0 3H6" ${ink}/>`

function tile(id: string, plane: Plane, size: number, body: string, view: ProjectionView): string {
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix(plane, undefined, view)}">${body}</pattern>`
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
): string {
  const value = hash(fileType)
  const bits = (value ^ (value >>> 9) ^ (value >>> 18)) & 0x1ff || 1
  const windows = Array.from({ length: 9 }, (_, index) => {
    if ((bits & (1 << index)) === 0) return ''
    const x = 1 + (index % 3) * 2.5
    const y = 1 + Math.floor(index / 3) * 2.5
    return `<rect x="${x}" y="${y}" width="${FACADE_MARK}" height="${FACADE_MARK}" fill="var(--map-hatch)"/>`
  }).join('')
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
export function mapDefs(view: ProjectionView = DEFAULT_PROJECTION): string {
  return tile('dots', 'ground', 8, dot, view)
    + tile('dots-left', 'left', 8, dot, view) + tile('dots-right', 'right', 8, dot, view)
    + tile('cross', 'ground', 8, cross, view)
    + tile('cross-left', 'left', 8, cross, view) + tile('cross-right', 'right', 8, cross, view)
    + tile('lines-left', 'left', 6, line, view) + tile('lines-right', 'right', 6, line, view)
    + tile('grain', 'ground', 12, '<circle cx="6" cy="6" r="0.6" fill="var(--map-hatch)"/>', view)
    + tile('hatch-ground', 'ground', 8, `<path d="M0 8L8 0" ${ink}/>`, view)
}

/** Paper with a depth's share of ink mixed in, in whichever theme. */
function tint(depth: number): string {
  return `color-mix(in srgb, var(--ink) ${(tintAt(depth) * 100).toFixed(1)}%, var(--paper))`
}

function stroke(level: Level): string {
  return `--stroke: ${strokeAt(depthOf(level)).toFixed(2)}px;`
}

/** A level's tokens: its stroke, the tint of its top and, deeper, of its sides. */
function tokens(level: Level): string {
  const depth = depthOf(level)
  return `${stroke(level)} --top-fill: ${tint(depth)}; --right-fill: ${tint(depth + SIDE.right)}; --left-fill: ${tint(depth + SIDE.left)};`
}

/**
 * The map's own stylesheet. Every level group sets its tokens from the
 * scale, with the system island half a tint step lighter on that scale. One
 * rule turns them into strokes (times the state's emphasis and the camera's
 * zoom weight) and fills; no literal width or tint lives here. Neutral routes show
 * origin; task highlights are solid and selected flows use moving dashes. Patterns
 * mean kind, and component facade windows mean file type. Selection
 * and context change strokes, never fills.
 */
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
  #map > .map-surface:active, #map > .map-surface:active [data-id] { cursor: grabbing; }
  #map .camera { transform-origin: 0 0; }
  #map .sheet { pointer-events: none; ${stroke('island')} }
  #map .calibration-tick, #map .compass, #map .project-plate { ${stroke('building')} }
  /* zones lie inside slab groups and keep their own weight while the slab is hovered or selected */
  #map .zone { ${stroke('building')} --emphasis: 1; }
  #map .island { ${tokens('island')} }
  #map .island.system { --top-fill: ${tint(depthOf('island') - 0.5)}; }
  #map .slab { ${tokens('slab')} }
  #map .building { ${tokens('building')} }
  #map .route { ${stroke('route')} }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star, #map .compass .north,
  #map .project-plate .plate, #map .project-plate .edit-frame,
  #map .project-plate .pencil path, #map .project-plate .pencil polygon,
  #map .ground, #map .face, #map .route-base, #map .route .line {
    stroke: var(--map-line); stroke-linejoin: round;
    stroke-width: calc(var(--stroke) * var(--emphasis, 1) * var(--weight, 1));
  }
  #map .frame, #map .calibration-tick,
  #map .compass .ring, #map .compass .star,
  #map .project-plate .edit-frame, #map .project-plate .pencil path { fill: none; }
  #map .frame { --emphasis: 1.6; }
  #map .calibration-tick { stroke-linecap: square; }
  #map .compass { --emphasis: 1.25; }
  #map .compass .north { fill: var(--map-line); }
  #map .compass .text { fill: var(--ink); font-weight: 600; }
  #map .project-plate .plate { fill: var(--paper); fill-opacity: 0.72; }
  #map .project-plate .project-title .text { font-weight: 650; letter-spacing: 0.06em; }
  #map .project-plate .project-overview .text { fill: var(--muted); }
  #map .project-plate .project-overview .md-strong { font-weight: 700; fill: var(--ink); }
  #map .project-plate .project-overview .md-emphasis { font-style: italic; }
  #map .project-plate .project-overview .md-code { font-family: 'SF Mono', ui-monospace, Menlo, monospace; fill: var(--ink); }
  #map .project-plate .project-overview .md-link { text-decoration: underline; text-underline-offset: 2px; }
  #map .project-plate .project-meta .text { fill: var(--muted); letter-spacing: 0.14em; }
  #map .project-edit { pointer-events: all; cursor: pointer; outline: none; }
  #map .project-edit .edit-frame { fill: transparent; pointer-events: all; }
  #map .project-edit .pencil path { stroke-linecap: square; }
  #map .project-edit .pencil .body { fill: color-mix(in srgb, var(--ink) 10%, var(--paper)); }
  #map .project-edit .pencil .facet { fill: color-mix(in srgb, var(--ink) 18%, var(--paper)); }
  #map .project-edit .pencil .eraser { fill: color-mix(in srgb, var(--ink) 28%, var(--paper)); }
  #map .project-edit .pencil .ferrule { fill: color-mix(in srgb, var(--ink) 18%, var(--paper)); }
  #map .project-edit .pencil .tip { fill: color-mix(in srgb, var(--ink) 12%, var(--paper)); }
  #map .project-edit .pencil .lead { fill: var(--ink); }
  #map .project-edit .pencil .facet, #map .project-edit .pencil .eraser, #map .project-edit .pencil .ferrule,
  #map .project-edit .pencil .tip, #map .project-edit .pencil .lead { stroke: none; }
  #map .project-edit:hover .edit-frame, #map .project-edit:focus .edit-frame { fill: var(--ink); fill-opacity: 0.05; }
  #map .project-edit:hover .pencil path, #map .project-edit:focus .pencil path,
  #map .project-edit:hover .pencil .body, #map .project-edit:focus .pencil .body { stroke: var(--ink); }
  #map .grid { fill: none; stroke: var(--map-grid); }
  #map .grid.major { stroke: var(--map-grid-major); }
  #map > .map-surface[data-minor-grid-hidden] .grid:not(.major) { display: none; }
  #map .ground, #map .face.top { fill: var(--top-fill); }
  #map .face.right { fill: var(--right-fill); }
  #map .face.left { fill: var(--left-fill); }
  #map .actor .face { fill: var(--paper); }
  #map .zone .ground { fill: url(#hatch-ground); }
  /* the sheet's name chips only: the Live work island has chips of its own that must stay clickable */
  #map .pattern, #map > .map-surface .chip { stroke: none; pointer-events: none; }
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
  #map > .map-surface .chip { fill: var(--paper); }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; pointer-events: all; }
  #map .ghost .pattern, #map .ghost .chip { display: none; }
  #map .ghost.draft .face, #map .ghost.draft .ground,
  #map .route-base.ghost.draft, #map .route.ghost.draft:not(.touched):not(.lit) .line { stroke-dasharray: 4 3; }
  #map .text { fill: var(--ink); pointer-events: none; }
  #map :is(.island, .slab, .zone) > .label .text { font-weight: 600; }
  #map .route-base, #map .route .line { fill: none; stroke-linecap: round; opacity: 0.9; }
  #map .route-base { pointer-events: none; }
  #map .route .line { opacity: 0; }
  #map .route .arrow { fill: var(--map-line); opacity: 0.9; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
  #map .route:hover, #map .route.endpoint, #map .route.touched { --emphasis: ${emphasis(1)}; }
  #map .route:hover .line { stroke: var(--map-line); opacity: 1; }
  #map .route:hover .arrow { fill: var(--map-line); opacity: 1; }
  #map .route.endpoint .line, #map .route.selected .line, #map .route.touched .line { stroke: var(--highlight); opacity: 1; }
  #map .route.endpoint .arrow, #map .route.selected .arrow, #map .route.touched .arrow { fill: var(--highlight); opacity: 1; }
  #map .route.touched .line { stroke-dasharray: none; }
  #map .route.lit { --emphasis: ${emphasis(2)}; }
  #map .route.lit .line { stroke: var(--highlight); opacity: 1; stroke-dasharray: 8 5; animation: map-flow 900ms linear infinite; }
  #map .route.lit .arrow { fill: var(--highlight); opacity: 1; }
  @keyframes map-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -13; } }
  @media (prefers-reduced-motion: reduce) {
    #map .route.lit .line { animation: none; }
  }
  #map .camera[data-tracing] .route-base,
  #map .camera[data-tracing] .route:not(.lit) { display: none; }
  #map .camera[data-tracing] .building:not(.onpath):not(.selected),
  #map .camera[data-tracing] .slab:not(.onpath):not(.selected) { opacity: 0.3; }
  #map .building:not(.selected):hover, #map .slab:not(.selected):not(.context):hover,
  #map .island.system:not(.selected):not(.context):hover, #map .context { --emphasis: ${emphasis(0.5)}; }
  #map .building:not(.selected):hover .face, #map .slab:not(.selected):not(.context):hover .face,
  #map .island.system:not(.selected):not(.context):hover > .ground { stroke: var(--map-line); }
  #map .selected, #map .touched,
  #map .building.lit, #map .slab.lit, #map .island.lit { --emphasis: ${emphasis(1)}; }
  #map .context .face, #map .island.context > .ground, #map .selected .face, #map .island.selected > .ground,
  #map .touched .face, #map .island.touched > .ground,
  #map .building.lit .face, #map .slab.lit > .face, #map .island.lit > .ground { stroke: var(--highlight); }
  #map .selected > .label .text, #map .touched > .label .text,
  #map .building.lit > .label .text, #map .slab.lit > .label .text, #map .island.lit > .label .text {
    fill: var(--ink); font-weight: 600;
  }
  ${layerCss}
`
