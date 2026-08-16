import type { ArchitectureWorld } from '../../types.ts'

const style = `
  :root { --paper: #EDE8D6; --raised: #F6F2E4; --ink: #26251D; --accent: #1D9E75; }
  html, body { margin: 0; height: 100%; background: var(--paper); }
  svg { display: block; width: 100%; height: 100%; cursor: grab; }
  svg:active { cursor: grabbing; }
  polygon { stroke: var(--ink); stroke-width: 0.5; stroke-linejoin: round; }
  .shade { fill: var(--ink); fill-opacity: 0.08; stroke: none; }
  .el[data-kind="system"] .side { fill: url(#hatch-system); }
  .el[data-kind="container"] .side { fill: url(#hatch-container); }
  .el[data-kind="component"] .side { fill: url(#hatch-component); }
  .el[data-kind="person"] .side { fill: url(#hatch-person); }
  .top { fill: var(--raised); }
  .el[data-kind="system"] .top { stroke-width: 1.1; }
  .el[data-kind="component"] .top { stroke-width: 0.45; }
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
  #controls { position: fixed; top: 12px; right: 12px; display: flex; gap: 4px;
    padding: 8px; background: var(--raised); border: 1px solid var(--ink);
    font-family: 'SF Mono', ui-monospace, Menlo, monospace; font-size: 12px; color: var(--ink); }
  #controls button { padding: 2px 14px; background: var(--paper); border: 1px solid var(--ink);
    font: inherit; color: inherit; cursor: pointer; }
  #controls button.active { background: var(--accent); border-color: var(--accent); color: var(--raised); }
`

const controls = `<div id="controls">
  <button id="mode-2d">2D</button><button id="mode-3d" class="active">3D</button>
</div>`

export function renderPage(world: ArchitectureWorld): string {
  const json = JSON.stringify(world).replace(/</g, '\\u003c')
  return '<!doctype html><html><head><meta charset="utf-8"><title>groma map</title>'
    + `<style>${style}</style></head><body>`
    + '<svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet"></svg>'
    + controls
    + `<script type="application/json" id="world">${json}</script>`
    + '<script src="/render.js"></script>'
    + '</body></html>'
}
