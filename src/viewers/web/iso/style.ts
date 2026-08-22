import { ISLAND_SPACING } from '../../../sheet/measure.ts'
import { planeMatrix } from './project.ts'

const hatch = 'stroke="var(--map-hatch)" stroke-width="0.75"'

/**
 * Patterns the islands, zones and towers are filled with. Each tile is drawn
 * in the pixels of the plane it lies on and mapped by that plane's matrix, so
 * dots, crosses and hatches follow the sheet and the faces like every name.
 */
export const mapDefs = '<defs>'
  + `<pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix('ground')}">`
  + '<circle cx="4" cy="4" r="0.75" fill="var(--map-hatch)"/></pattern>'
  + `<pattern id="cross" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix('ground')}">`
  + `<path d="M4 2V6M2 4H6" ${hatch}/></pattern>`
  + `<pattern id="hatch-ground" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix('ground')}">`
  + `<path d="M0 8L8 0" ${hatch}/></pattern>`
  + `<pattern id="hatch-left" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix('left')}">`
  + `<path d="M0 4L4 0" ${hatch}/></pattern>`
  + `<pattern id="hatch-right" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="${planeMatrix('right')}">`
  + `<path d="M0 4L4 0" ${hatch}/></pattern>`
  + '</defs>'

/**
 * The map's own stylesheet; colours come from the page palette variables.
 * Line style means origin and nothing else: observed solid, planned dashed,
 * missing dotted. Selection and context change strokes, never fills.
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
  #map .pattern, #map .hatch { stroke: none; pointer-events: none; }
  #map .island.people .pattern { fill: url(#dots); }
  #map .island.external .pattern { fill: url(#cross); }
  #map .hatch.left { fill: url(#hatch-left); }
  #map .hatch.right { fill: url(#hatch-right); }
  #map .face { stroke: var(--map-line); stroke-width: 1; stroke-linejoin: round; }
  #map .face.left { fill: var(--map-face-left); }
  #map .face.right { fill: var(--map-face-right); }
  #map .face.top { fill: var(--map-deck); }
  #map .building.person .face.top { fill: var(--map-people); }
  #map .building.external .face.top { fill: var(--map-external); }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; }
  #map .ghost .pattern, #map .ghost .hatch { display: none; }
  #map .ghost.planned .face, #map .ghost.planned .ground, #map .route.ghost.planned .line { stroke-dasharray: 4 3; }
  #map .ghost.missing .face, #map .ghost.missing .ground, #map .route.ghost.missing .line { stroke-dasharray: 1 3; }
  #map .text { fill: var(--ink); pointer-events: none; }
  #map .island > .label .text { letter-spacing: ${ISLAND_SPACING}em; }
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
