import { ISLAND_SPACING } from '../../../sheet/measure.ts'

const hatch = 'stroke="var(--map-hatch)" stroke-width="0.75"'

/** Patterns the islands, zones and towers are filled with; world-space, so they scale with the map. */
export const mapDefs = '<defs>'
  + '<pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">'
  + '<circle cx="4" cy="4" r="0.75" fill="var(--map-hatch)"/></pattern>'
  + '<pattern id="cross" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
  + `<path d="M4 0V8M0 4H8" ${hatch}/></pattern>`
  + '<pattern id="hatch-45" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
  + `<path d="M0 0V4" ${hatch}/></pattern>`
  + '<pattern id="hatch-135" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">'
  + `<path d="M0 0V8" ${hatch}/></pattern>`
  + '</defs>'

/** The map's own stylesheet; colours come from the page palette variables. */
export const mapCss = `
  #map svg {
    display: block; width: 100%; height: 100%; cursor: grab;
    user-select: none; -webkit-user-select: none; touch-action: none; outline: none;
  }
  #map svg:active { cursor: grabbing; }
  #map .camera { transform-box: view-box; transform-origin: 0 0; }
  #map .camera.animate { transition: transform 200ms ease-out; }
  #map .sheet { pointer-events: none; }
  #map .grid { fill: none; stroke: var(--map-grid); stroke-width: 1; }
  #map .grid.major { stroke: var(--map-grid-major); }
  #map .frame { fill: none; stroke: var(--map-frame); stroke-width: 1; }
  #map .tick { fill: none; stroke: var(--map-frame); stroke-width: 1; }
  #map .ground { stroke: var(--ink); stroke-width: 1; stroke-linejoin: round; }
  #map .island.people .ground { fill: var(--map-people); stroke-dasharray: 4 3; }
  #map .island.external .ground { fill: var(--map-external); stroke-dasharray: 6 2 1 2; }
  #map .island.system .ground { fill: var(--paper); stroke-width: 1.25; }
  #map .zone .ground { fill: url(#hatch-135); stroke: var(--muted); stroke-dasharray: 2 2; }
  #map .pattern, #map .hatch { stroke: none; pointer-events: none; }
  #map .island.people .pattern, #map .building.person .pattern { fill: url(#dots); }
  #map .island.external .pattern, #map .building.external .pattern { fill: url(#cross); }
  #map .hatch { fill: url(#hatch-45); }
  #map .face { stroke: var(--ink); stroke-width: 1; stroke-linejoin: round; }
  #map .face.left { fill: var(--map-face-left); }
  #map .face.right { fill: var(--map-face-right); }
  #map .face.top { fill: var(--map-deck); }
  #map .building.person .face.top { fill: var(--map-people); }
  #map .building.external .face.top { fill: var(--map-external); }
  #map .building.person .face { stroke-dasharray: 4 3; }
  #map .building.external .face { stroke-dasharray: 6 2 1 2; }
  #map .ghost { opacity: 0.8; }
  #map .ghost .face, #map .ghost .ground { fill: none; }
  #map .ghost .pattern, #map .ghost .hatch { display: none; }
  #map .ghost.planned .face, #map .ghost.planned .ground, #map .route.ghost.planned .line { stroke-dasharray: 4 3; }
  #map .ghost.missing .face, #map .ghost.missing .ground, #map .route.ghost.missing .line { stroke-dasharray: 1 3; }
  #map .text { fill: var(--ink); pointer-events: none; }
  #map .island > .label .text { letter-spacing: ${ISLAND_SPACING}em; }
  #map .zone > .label .text { fill: var(--muted); }
  #map .route .line { fill: none; stroke: var(--ink); stroke-width: 1; stroke-linejoin: round; stroke-linecap: round; opacity: 0.55; }
  #map .route .arrow { fill: var(--ink); opacity: 0.55; }
  #map .route .hit { fill: none; stroke: transparent; stroke-width: 12; }
  #map .route:hover .line { stroke-width: 1.75; opacity: 1; }
  #map .route:hover .arrow { opacity: 1; }
  #map .route.endpoint .line { stroke: var(--accent); stroke-width: 1.5; opacity: 1; }
  #map .route.endpoint .arrow { fill: var(--accent); opacity: 1; }
  #map .route.lit .line {
    stroke: var(--accent); stroke-width: 2; opacity: 1;
    stroke-dasharray: 6 4; animation: map-flow 0.8s linear infinite;
  }
  #map .route.lit .arrow { fill: var(--accent); opacity: 1; }
  @keyframes map-flow { to { stroke-dashoffset: -10; } }
  @media (prefers-reduced-motion: reduce) {
    #map .route.lit .line { animation: none; stroke-dasharray: none; }
  }
  #map .camera[data-tracing] .route:not(.lit) { opacity: 0.18; }
  #map .camera[data-tracing] .building:not(.onpath):not(.selected),
  #map .camera[data-tracing] .slab:not(.onpath):not(.selected) { opacity: 0.3; }
  #map .building:hover .face, #map .slab:hover .face, #map .island.system:hover .ground { stroke-width: 1.75; }
  #map .selected .face.top, #map .selected > .ground { stroke: var(--accent); stroke-width: 2; }
  #map .building.selected .face.top { fill: var(--accent-wash); }
  #map .selected > .label .text { fill: var(--accent); }
`
