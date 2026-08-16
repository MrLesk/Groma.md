import type { ArchitectureWorld } from '../../types.ts'

const style = `
  :root { --paper: #EDE8D6; --raised: #F6F2E4; --ink: #26251D; --accent: #1D9E75; }
  html, body { margin: 0; height: 100%; background: var(--paper); overflow: hidden; }
  #map { position: fixed; inset: 0; }
  #map canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  #map canvas:active { cursor: grabbing; }
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
    + '<div id="map"></div>'
    + controls
    + `<script type="application/json" id="world">${json}</script>`
    + '<script src="/render.js"></script>'
    + '</body></html>'
}
