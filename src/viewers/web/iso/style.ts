import { planeMatrix } from './project.ts'
import type { Plane } from './project.ts'
import { SIDE, depthOf, emphasis, strokeAt, tintAt } from './scale.ts'
import type { Level } from './scale.ts'

const ink = 'stroke="var(--map-hatch)" stroke-width="0.75"'
const dot = '<circle cx="4" cy="4" r="0.75" fill="var(--map-hatch)"/>'
const cross = `<path d="M4 2V6M2 4H6" ${ink}/>`
const line = `<path d="M0 3H6" ${ink}/>`

function tile(id: string, plane: Plane, size: number, body: string): string {
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix(plane)}">${body}</pattern>`
}

/**
 * One grey pattern per kind, each tile drawn in the pixels of the plane it
 * lies on and mapped by that plane's matrix: dots for people (their island
 * and the sides of their buildings), crosses for external systems, storey
 * lines for the sides of components, a faint grain for container slabs and a
 * diagonal hatch for group zones. Systems have no pattern, and neither does
 * any roof.
 */
export const mapDefs = '<defs>'
  + tile('dots', 'ground', 8, dot) + tile('dots-left', 'left', 8, dot) + tile('dots-right', 'right', 8, dot)
  + tile('cross', 'ground', 8, cross) + tile('cross-left', 'left', 8, cross) + tile('cross-right', 'right', 8, cross)
  + tile('lines-left', 'left', 6, line) + tile('lines-right', 'right', 6, line)
  + tile('grain', 'ground', 12, '<circle cx="6" cy="6" r="0.6" fill="var(--map-hatch)"/>')
  + tile('hatch-ground', 'ground', 8, `<path d="M0 8L8 0" ${ink}/>`)
  + '</defs>'

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
 * zoom weight) and fills; no literal width or tint lives here. Line style means origin; only a route leaving a touched element for an untouched one adds accent dots: observed solid, planned
 * dashed, missing dotted; patterns mean kind and nothing else. Selection
 * and context change strokes, never fills.
 */
export const mapCss = `
  #map > svg {
    display: block; width: 100%; height: 100%; cursor: grab;
    user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
  }
  #map > svg [data-id] { cursor: pointer; }
  #map > svg:active, #map > svg:active [data-id] { cursor: grabbing; }
  #map .camera { transform-box: view-box; transform-origin: 0 0; }
  #map .sheet { pointer-events: none; ${stroke('island')} }
  #map .tick, #map .compass { ${stroke('building')} }
  /* zones lie inside slab groups and keep their own weight while the slab is hovered or selected */
  #map .zone { ${stroke('building')} --emphasis: 1; }
  #map .island { ${tokens('island')} }
  #map .island.system { --top-fill: ${tint(depthOf('island') - 0.5)}; }
  #map .slab { ${tokens('slab')} }
  #map .building { ${tokens('building')} }
  #map .route { ${stroke('route')} }
  #map .frame, #map .tick, #map .compass .ring, #map .compass .star, #map .compass .north,
  #map .ground, #map .face, #map .route .line {
    stroke: var(--map-line); stroke-linejoin: round;
    stroke-width: calc(var(--stroke) * var(--emphasis, 1) * var(--weight, 1));
  }
  #map .frame, #map .tick, #map .compass .ring, #map .compass .star { fill: none; }
  #map .compass .north { fill: var(--map-line); }
  #map .compass .text { fill: var(--muted); }
  #map .grid { fill: none; stroke: var(--map-grid); }
  #map .grid.major { stroke: var(--map-grid-major); }
  #map .ground, #map .face.top { fill: var(--top-fill); }
  #map .face.right { fill: var(--right-fill); }
  #map .face.left { fill: var(--left-fill); }
  #map .person .face { fill: var(--paper); }
  #map .zone .ground { fill: url(#hatch-ground); stroke: var(--muted); }
  /* the sheet's name chips only: the Live work island has chips of its own that must stay clickable */
  #map .pattern, #map > svg .chip { stroke: none; pointer-events: none; }
  #map .island.people .pattern { fill: url(#dots); }
  #map .island.external .pattern { fill: url(#cross); }
  #map .slab .pattern { fill: url(#grain); }
  #map .building.component .pattern.left { fill: url(#lines-left); }
  #map .building.component .pattern.right { fill: url(#lines-right); }
  #map .building.person .pattern.left { fill: url(#dots-left); }
  #map .building.person .pattern.right { fill: url(#dots-right); }
  #map .building.external .pattern.left { fill: url(#cross-left); }
  #map .building.external .pattern.right { fill: url(#cross-right); }
  #map > svg .chip { fill: var(--paper); fill-opacity: 0.75; }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; }
  #map .ghost .pattern, #map .ghost .chip { display: none; }
  #map .ghost.planned .face, #map .ghost.planned .ground, #map .route.ghost.planned .line { stroke-dasharray: 4 3; }
  #map .ghost.missing .face, #map .ghost.missing .ground, #map .route.ghost.missing .line { stroke-dasharray: 1 3; }
  #map .text { fill: var(--ink); pointer-events: none; }
  #map .zone > .label .text { fill: var(--muted); }
  #map .building > .label { opacity: var(--name-opacity, 1); }
  #map .route .line { fill: none; stroke-linecap: round; opacity: 0.9; }
  #map .route .arrow { fill: var(--map-line); opacity: 0.9; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
  #map .route:hover, #map .route.endpoint, #map .route.touched { --emphasis: ${emphasis(1)}; }
  #map .route:hover .line { stroke: var(--ink); opacity: 1; }
  #map .route:hover .arrow { fill: var(--ink); opacity: 1; }
  #map .route.endpoint .line, #map .route.selected .line, #map .route.touched .line { stroke: var(--accent); opacity: 1; }
  #map .route.endpoint .arrow, #map .route.selected .arrow, #map .route.touched .arrow { fill: var(--accent); opacity: 1; }
  #map .route.touched.half .line { stroke-dasharray: 1 4; }
  #map .route.lit { --emphasis: ${emphasis(2)}; }
  #map .route.lit .line {
    stroke: var(--accent); opacity: 1;
    stroke-dasharray: 6 4; animation: map-flow 0.8s linear infinite;
  }
  #map .route.lit .arrow { fill: var(--accent); opacity: 1; }
  @keyframes map-flow { to { stroke-dashoffset: -10; } }
  @media (prefers-reduced-motion: reduce) {
    #map .route.lit .line { animation: none; stroke-dasharray: none; }
  }
  #map .camera[data-tracing] .route:not(.lit):not(.selected) { opacity: 0.18; }
  #map .camera[data-tracing] .building:not(.onpath):not(.selected),
  #map .camera[data-tracing] .slab:not(.onpath):not(.selected) { opacity: 0.3; }
  #map .building:not(.selected):hover, #map .slab:not(.selected):not(.context):hover,
  #map .island.system:not(.selected):not(.context):hover, #map .context { --emphasis: ${emphasis(0.5)}; }
  #map .building:not(.selected):hover .face, #map .slab:not(.selected):not(.context):hover .face,
  #map .island.system:not(.selected):not(.context):hover > .ground { stroke: var(--ink); }
  #map .selected, #map .touched { --emphasis: ${emphasis(1)}; }
  #map .context .face, #map .island.context > .ground, #map .selected .face, #map .island.selected > .ground,
  #map .touched .face, #map .island.touched > .ground { stroke: var(--accent); }
  #map .selected > .label .text, #map .touched > .label .text { fill: var(--accent); font-weight: 600; }
`
