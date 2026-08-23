import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { C4Kind } from '../../types.ts'
import { kindGlyph, kindLabel } from './atoms/kind.ts'
import { cssBlock, palettes } from './atoms/theme.ts'
import { mapCss } from './iso/style.ts'
import { pinsCss } from './organisms/pins.ts'
import type { WebPayload } from './payload.ts'

const lockup = readFileSync(
  fileURLToPath(new URL('./atoms/lockup.svg', import.meta.url)),
  'utf8',
)

const legendKinds: C4Kind[][] = [
  ['person', 'system'],
  ['container', 'component'],
]

const style = `
  :root { ${cssBlock(palettes.light)} }
  [data-theme="dark"] { ${cssBlock(palettes.dark)} }
  html { margin: 0; height: 100%; overflow-x: auto; overflow-y: hidden; background: var(--paper); }
  body {
    margin: 0;
    height: 100%;
    min-width: 900px;
    overflow: hidden;
    background: var(--paper);
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 280px minmax(200px, 1fr) 320px;
    box-sizing: border-box;
    font-family: 'SF Mono', ui-monospace, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink);
  }
  button { font: inherit; color: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
  #legend span, #details .meta, #details .section, #flows .section, #action.hint, #zoom, #details .chip, #stats {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  #header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 20px;
    height: 52px;
    padding: 0 20px;
    border-bottom: 1px solid var(--ink);
  }
  #header svg { height: 26px; width: auto; display: block; }
  #stats { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  #hierarchy, #details, #map { min-width: 0; min-height: 0; }
  #hierarchy { display: flex; flex-direction: column; border-right: 1px solid var(--ink); }
  #flows { padding: 14px 0 10px; border-bottom: 1px solid var(--hairline); }
  #flows:empty { display: none; }
  #flows .section { margin: 0 0 6px; padding: 0 14px; width: 100%; border: 0; background: transparent; text-align: left; }
  #tree { flex: 1; overflow: auto; padding: 14px 0; }
  #legend { border-top: 1px solid var(--ink); padding: 12px 16px; display: grid; gap: 4px; }
  #legend div { display: flex; gap: 16px; }
  #legend span { display: inline-flex; align-items: center; gap: 6px; }
  #legend .mark { color: var(--ink); letter-spacing: 0; }
  #map { position: relative; overflow: hidden; }
  #details { overflow: auto; padding: 24px 20px; border-left: 1px solid var(--ink); }
  #details .meta { margin: 0 0 6px; }
  #details h1 { font-size: 20px; font-weight: 600; line-height: 1.3; margin: 0 0 14px; }
  #details .description { margin: 0 0 10px; line-height: 1.65; }
  #details .section {
    margin: 26px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--hairline);
  }
  #details ul { margin: 0; padding: 0; list-style: none; }
  #details li { margin: 0 0 6px; }
  #details .tabs { margin: 0 0 8px; }
  #details .tabs button { flex: 1; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  #details .chip { border: 1px solid var(--hairline); padding: 2px 8px; margin: 0; }
  #footer {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 16px;
    height: 40px;
    padding: 0 12px 0 20px;
    border-top: 1px solid var(--ink);
  }
  #action { margin-right: auto; white-space: pre; overflow: hidden; text-overflow: ellipsis; }
  .controls { display: flex; }
  .controls button {
    padding: 4px 16px;
    background: var(--paper);
    border: 1px solid var(--ink);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .controls button + button { margin-left: -1px; }
  .controls button.active { background: var(--ink); color: var(--paper); }
  #zoom-in, #zoom-out { padding: 4px 0; width: 30px; font-size: 12px; line-height: 1.2; }
  .row {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 5px 14px;
  }
  .row:hover { background: var(--hover); }
  .row.selected { background: rgba(29, 158, 117, 0.1); box-shadow: inset 2px 0 var(--accent); }
  .row .twist { width: 1em; flex: none; color: var(--muted); }
  .row .twist.toggle:hover { color: var(--accent); }
  .row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .link { border: 0; background: transparent; padding: 0; text-align: left; }
  .link:hover { text-decoration: underline; text-underline-offset: 2px; }
  .link.active { box-shadow: inset 2px 0 var(--accent); padding-left: 6px; }
  .mark { flex: none; }
  .ghost { opacity: 0.5; }
${mapCss}${pinsCss}`

function legend(): string {
  return legendKinds.map(line => {
    const marks = line.map(kind => {
      return `<span><span class="mark">${kindGlyph(kind)}</span>${kindLabel(kind)}</span>`
    }).join('')
    return `<div>${marks}</div>`
  }).join('')
}

export function renderPage(payload: WebPayload): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return '<!doctype html><html><head><meta charset="utf-8"><title>groma.md</title>'
    + `<style>${style}</style></head><body>`
    + `<header id="header">${lockup}<span id="stats"></span>`
    + '<div class="controls"><button id="theme">Dark</button></div>'
    + '</header>'
    + `<nav id="hierarchy"><div id="flows"></div><div id="tree"></div><div id="legend">${legend()}</div></nav>`
    + '<div id="map"></div>'
    + '<aside id="details"><p class="meta"></p><h1></h1><nav class="controls tabs"></nav><div class="body"></div></aside>'
    + '<footer id="footer"><span id="action"></span><span id="zoom"></span>'
    + '<div class="controls"><button id="zoom-out">−</button><button id="zoom-in">+</button></div>'
    + '</footer>'
    + `<script type="application/json" id="world">${json}</script>`
    + '<script src="/render.js"></script>'
    + '</body></html>'
}
