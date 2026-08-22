import { planeMatrix } from './project.ts'
import type { Plane } from './project.ts'

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
 * diagonal hatch for group zones. Systems stay plain paper, and so does
 * every roof.
 */
export const mapDefs = '<defs>'
  + tile('dots', 'ground', 8, dot) + tile('dots-left', 'left', 8, dot) + tile('dots-right', 'right', 8, dot)
  + tile('cross', 'ground', 8, cross) + tile('cross-left', 'left', 8, cross) + tile('cross-right', 'right', 8, cross)
  + tile('lines-left', 'left', 6, line) + tile('lines-right', 'right', 6, line)
  + tile('grain', 'ground', 12, '<circle cx="6" cy="6" r="0.6" fill="var(--map-hatch)"/>')
  + tile('hatch-ground', 'ground', 8, `<path d="M0 8L8 0" ${ink}/>`)
  + '</defs>'

/**
 * The map's own stylesheet; colours come from the page palette variables.
 * Line style means origin and nothing else: observed solid, planned dashed,
 * missing dotted; patterns mean kind and nothing else. Selection and
 * context change strokes, never fills.
 */
export const mapCss = `
  #map svg {
    display: block; width: 100%; height: 100%; cursor: grab;
    user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
  }
  #map svg:active { cursor: grabbing; }
  #map .camera { transform-box: view-box; transform-origin: 0 0; }
  #map .sheet { pointer-events: none; }
  #map .grid { fill: none; stroke: var(--map-grid); }
  #map .grid.major { stroke: var(--map-grid-major); }
  #map .frame { fill: none; stroke: var(--map-line); stroke-width: 1.5; }
  #map .tick { fill: none; stroke: var(--map-line); stroke-width: 1; }
  #map .compass .ring, #map .compass .star { fill: none; stroke: var(--map-line); stroke-width: 1; }
  #map .compass .north { fill: var(--map-line); stroke: var(--map-line); stroke-width: 1; }
  #map .compass .text { fill: var(--muted); }
  #map .ground { stroke: var(--map-line); stroke-width: 1; stroke-linejoin: round; }
  #map .island.people .ground { fill: var(--map-people); }
  #map .island.external .ground { fill: var(--map-external); }
  #map .island.system .ground { fill: var(--paper); stroke-width: 1.25; }
  #map .zone .ground { fill: url(#hatch-ground); stroke: var(--muted); }
  #map .pattern, #map .chip { stroke: none; pointer-events: none; }
  #map .island.people .pattern { fill: url(#dots); }
  #map .island.external .pattern { fill: url(#cross); }
  #map .slab .pattern { fill: url(#grain); }
  #map .building.component .pattern.left { fill: url(#lines-left); }
  #map .building.component .pattern.right { fill: url(#lines-right); }
  #map .building.person .pattern.left { fill: url(#dots-left); }
  #map .building.person .pattern.right { fill: url(#dots-right); }
  #map .building.external .pattern.left { fill: url(#cross-left); }
  #map .building.external .pattern.right { fill: url(#cross-right); }
  #map .chip { fill: var(--paper); fill-opacity: 0.75; }
  #map .face { stroke: var(--map-line); stroke-width: 1; stroke-linejoin: round; }
  #map .face.left { fill: var(--map-face-left); }
  #map .face.right { fill: var(--map-face-right); }
  #map .face.top { fill: var(--map-deck); }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; }
  #map .ghost .pattern, #map .ghost .chip { display: none; }
  #map .ghost.planned .face, #map .ghost.planned .ground, #map .route.ghost.planned .line { stroke-dasharray: 4 3; }
  #map .ghost.missing .face, #map .ghost.missing .ground, #map .route.ghost.missing .line { stroke-dasharray: 1 3; }
  #map .text { fill: var(--ink); pointer-events: none; }
  #map .zone > .label .text { fill: var(--muted); }
  #map .route .line { fill: none; stroke: var(--map-line); stroke-width: 1.25; stroke-linejoin: round; stroke-linecap: round; opacity: 0.9; }
  #map .route .arrow { fill: var(--map-line); opacity: 0.9; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
  #map .route:hover .line { stroke: var(--ink); stroke-width: 1.75; opacity: 1; }
  #map .route:hover .arrow { fill: var(--ink); opacity: 1; }
  #map .route.endpoint .line, #map .route.selected .line { stroke: var(--accent); stroke-width: 1.5; opacity: 1; }
  #map .route.endpoint .arrow, #map .route.selected .arrow { fill: var(--accent); opacity: 1; }
  #map .route.lit .line {
    stroke: var(--accent); stroke-width: 2; opacity: 1;
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
  #map .building:not(.selected):hover .face, #map .slab:not(.selected):not(.context):hover .face,
  #map .island.system:not(.selected):not(.context):hover .ground { stroke: var(--ink); stroke-width: 1.25; }
  #map .context .face, #map .island.context > .ground { stroke: var(--accent); stroke-width: 1.25; }
  #map .selected .face, #map .island.selected > .ground { stroke: var(--accent); stroke-width: 1.5; }
  #map .selected > .label .text { fill: var(--accent); font-weight: 600; }
`
