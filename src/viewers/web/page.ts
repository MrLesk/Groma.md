import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { ArchitectureWorld, C4Kind } from '../../types.ts'
import { kindGlyph, kindLabel } from './atoms/kind.ts'
import { cssVars } from './atoms/theme.ts'

const lockup = readFileSync(
  fileURLToPath(new URL('./atoms/lockup.svg', import.meta.url)),
  'utf8',
)

const legendKinds: C4Kind[][] = [
  ['person', 'system'],
  ['container', 'component'],
]

const style = `
  :root { ${cssVars} }
  html { margin: 0; height: 100%; overflow-x: auto; overflow-y: hidden; background: var(--paper); }
  body {
    margin: 0;
    height: 100%;
    min-width: 900px;
    overflow: hidden;
    background: var(--paper);
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 240px minmax(200px, 1fr) 280px;
    gap: 8px;
    padding: 8px;
    box-sizing: border-box;
    font-family: 'SF Mono', ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: var(--ink);
  }
  #header { grid-column: 1 / -1; display: flex; align-items: center; color: var(--ink); }
  #header svg { height: 28px; width: auto; display: block; }
  #hierarchy, #details, #map {
    background: var(--raised);
    border: 1px solid var(--ink);
    min-width: 0;
    min-height: 0;
  }
  #hierarchy { display: flex; flex-direction: column; }
  #tree { flex: 1; overflow: auto; padding: 4px 0; }
  #legend { border-top: 1px solid var(--ink); padding: 6px 10px; display: grid; gap: 2px; }
  #legend div { display: flex; gap: 10px; }
  #legend span { display: inline-flex; align-items: center; gap: 4px; }
  #map canvas { display: block; width: 100%; height: 100%; cursor: grab; }
  #map canvas:active { cursor: grabbing; }
  #details { overflow: auto; padding: 12px; }
  #details h1 { font-size: 14px; margin: 0 0 6px; }
  #details .meta { margin: 0 0 8px; opacity: 0.7; }
  #details .description { margin: 0 0 8px; }
  #details .section { margin: 12px 0 4px; opacity: 0.55; }
  #details ul { margin: 0; padding: 0; list-style: none; }
  #details li { margin: 0 0 4px; }
  #footer {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }
  #controls { display: flex; gap: 4px; }
  #controls button, .row, .link {
    padding: 2px 10px;
    background: var(--paper);
    border: 1px solid var(--ink);
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  #controls button.active { background: var(--accent); border-color: var(--accent); color: var(--raised); }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 2px 8px;
  }
  .row.selected { box-shadow: inset 3px 0 var(--accent); }
  .row .twist { width: 1em; flex: none; }
  .row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .link { border: 0; background: transparent; padding: 0; }
  .mark { flex: none; }
  .mark.person { color: var(--person); }
  .mark.system { color: var(--system); }
  .mark.container { color: var(--container); }
  .mark.component { color: var(--component); }
  .ghost { opacity: 0.55; }
`

function legend(): string {
  return legendKinds.map(line => {
    const marks = line.map(kind => {
      return `<span><span class="mark ${kind}">${kindGlyph(kind)}</span>${kindLabel(kind)}</span>`
    }).join('')
    return `<div>${marks}</div>`
  }).join('')
}

export function renderPage(world: ArchitectureWorld): string {
  const json = JSON.stringify(world).replace(/</g, '\\u003c')
  return '<!doctype html><html><head><meta charset="utf-8"><title>groma map</title>'
    + `<style>${style}</style></head><body>`
    + `<header id="header">${lockup}</header>`
    + `<nav id="hierarchy"><div id="tree"></div><div id="legend">${legend()}</div></nav>`
    + '<div id="map"></div>'
    + '<aside id="details"><h1></h1><p class="meta"></p><p class="description"></p><div class="body"></div></aside>'
    + '<footer id="footer"><span id="zoom">fit</span>'
    + '<div id="controls"><button id="mode-2d">2D</button><button id="mode-3d" class="active">3D</button></div>'
    + '</footer>'
    + `<script type="application/json" id="world">${json}</script>`
    + '<script src="/render.js"></script>'
    + '</body></html>'
}
