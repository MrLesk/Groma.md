import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { C4Kind } from '../../types.ts'
import { chromeCss } from './atoms/chrome.ts'
import { anchoredPopoverCss } from './atoms/popover.ts'
import { kindGlyph, kindLabel } from '../atoms/kind.ts'
import { cssBlock, palettes } from './atoms/theme.ts'
import { mapDebugCss } from './chrome/map-debug.ts'
import { motionCss } from './chrome/motion.ts'
import { flowRowCss } from './flow/row.ts'
import { mapCss } from './iso/style.ts'
import { tipCss } from './organisms/tip.ts'
import type { WebPayload } from './payload.ts'
import { projectEditorCss } from './project/editor.ts'
import { revisionControl, revisionCss } from './revision/view.ts'
import { searchControl, searchCss } from './search/view.ts'
import { highlightCss } from './source/highlight.ts'
import { sourceCss } from './source/view.ts'
import { taskDiffCss } from './task-diff/view.ts'
import { backlogMarkCss } from './work/backlog-mark.ts'
import { workBadgeCss } from './work/badge.ts'
import { workDetailsCss } from './work/component-tasks.ts'
import { workCss } from './work/island.ts'
import { pinsCss } from './work/pins.ts'

const lockup = readFileSync(
  fileURLToPath(new URL('./atoms/lockup.svg', import.meta.url)),
  'utf8',
)
const backlogMark = readFileSync(
  fileURLToPath(new URL('./work/backlog-mark.png', import.meta.url)),
).toString('base64')

const icon = (body: string, className = ''): string => `<svg class="control-icon${className === '' ? '' : ` ${className}`}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
const fitIcon = icon('<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>')
const moonIcon = icon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>')
const sunIcon = icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>')
const blueprintIcon = icon('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>')
const historyIcon = icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', 'revision-history')
const searchIcon = icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>')
const revisionLoader = icon('<path d="M21 12a9 9 0 1 1-9-9"/>', 'revision-loader')
const closeIcon = icon('<path d="M18 6 6 18M6 6l12 12"/>')
const hierarchyIcon = icon('<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>', 'hierarchy-chevron')

const legendKinds: C4Kind[][] = [
  ['actor', 'system'],
  ['container', 'component'],
]

const style = `
  :root {
    ${cssBlock(palettes.light)}
    --backlog-mark-image: url("data:image/png;base64,${backlogMark}");
    --chrome-radius: 10px;
    --control-radius: 6px;
    --chrome-surface: color-mix(in srgb, var(--paper) 35%, transparent);
    --chrome-motion: 260ms;
    --chrome-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
    --hierarchy-column: clamp(280px, 27vw, 360px);
    --details-column: clamp(360px, 32vw, 420px);
    --hierarchy-inset: var(--hierarchy-column);
    --details-inset: var(--details-column);
  }
  [data-theme="dark"] { ${cssBlock(palettes.dark)} }
  [data-theme="blueprint"] {
    ${cssBlock(palettes.blueprint)}
    --chrome-surface: color-mix(in srgb, var(--paper) 78%, transparent);
  }
  html { margin: 0; height: 100%; overflow-x: auto; overflow-y: hidden; background: var(--paper); }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    height: 100%;
    min-width: 900px;
    overflow: hidden;
    background: transparent;
    position: relative;
    font-family: 'SF Mono', ui-monospace, Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink);
  }
  body.hierarchy-collapsed { --hierarchy-inset: 44px; }
  body.details-hidden { --details-inset: 0px; }
  body.hud-hidden { min-width: 0; display: block; padding: 0; }
  body.hud-hidden #header,
  body.hud-hidden #hierarchy,
  body.hud-hidden #details,
  body.hud-hidden #work,
  body.hud-hidden #pins { display: none; }
  button { font: inherit; color: inherit; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #legend span, #details .meta, #details .section, #hierarchy .section, #tree .group, #zoom, #details .chip, #stats, .pane-label {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  #header, #hierarchy, #details, #help .help-panel {
    border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    border-radius: var(--chrome-radius);
    backdrop-filter: blur(14px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 6%, transparent);
  }
  #header, #hierarchy, #details { background: var(--chrome-surface); }
  #header {
    position: absolute;
    top: 10px;
    right: 12px;
    left: 12px;
    height: 52px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 20px;
  }
  #header > svg { height: 26px; width: auto; display: block; }
  #stats { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .header-actions { display: flex; align-items: center; gap: 8px; }
  .header-actions > button, #help summary, #hierarchy-toggle {
    border: 0;
    border-radius: var(--control-radius);
    background: transparent;
    padding: 7px 10px;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
  }
  .header-actions > button:hover, #help summary:hover, #hierarchy-toggle:hover { color: var(--ink); background: var(--hover); }
  .control-icon { width: 14px; height: 14px; display: block; flex: none; }
  #theme { display: flex; align-items: center; gap: 7px; }
  #theme .theme-icon { display: none; }
  #theme[data-next-theme="dark"] .dark,
  #theme[data-next-theme="blueprint"] .blueprint,
  #theme[data-next-theme="light"] .light { display: block; }
  #help { position: relative; }
  #help summary { list-style: none; }
  #help summary::-webkit-details-marker { display: none; }
  #help .help-panel {
    position: fixed;
    z-index: 20;
    top: 74px;
    right: calc(var(--details-inset) + 24px);
    width: 260px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--paper) 82%, transparent);
    line-height: 1.8;
  }
  #help .help-panel p { margin: 0; }
  #hierarchy, #details { position: absolute; top: 74px; bottom: 12px; min-width: 0; min-height: 0; z-index: 5; }
  #hierarchy {
    left: 12px;
    width: var(--hierarchy-column);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform: translateX(0);
    transition: transform var(--chrome-motion) var(--chrome-ease);
  }
  #hierarchy-title { display: flex; align-items: center; min-height: 44px; padding: 0 8px 0 14px; border-bottom: 1px solid var(--hairline); }
  #hierarchy-title .pane-label { flex: 1; white-space: nowrap; transition: opacity var(--chrome-motion) var(--chrome-ease); }
  #hierarchy-toggle { display: grid; flex: none; place-items: center; border: 1px solid var(--hairline); background: color-mix(in srgb, var(--paper) 35%, transparent); }
  #hierarchy-toggle .hierarchy-chevron { transition: transform var(--chrome-motion) var(--chrome-ease); }
  #hierarchy-content { flex: 1; min-height: 0; display: flex; flex-direction: column; opacity: 1; transition: opacity calc(var(--chrome-motion) * 0.6) var(--chrome-ease); }
  body.hierarchy-collapsed #hierarchy { transform: translateX(calc(-100% + 44px)); }
  body.hierarchy-collapsed #hierarchy-toggle .hierarchy-chevron { transform: rotate(180deg); }
  body.hierarchy-collapsed #hierarchy-title { border-bottom-color: transparent; }
  body.hierarchy-collapsed #hierarchy-title .pane-label { opacity: 0; }
  body.hierarchy-collapsed #hierarchy-content { opacity: 0; pointer-events: none; }
  #flows { padding: 14px 0 10px; border-bottom: 1px solid var(--hairline); }
  #flows:empty { display: none; }
  #hierarchy .section { margin: 0 0 6px; padding: 0 14px; width: 100%; border: 0; background: transparent; text-align: left; }
  #tree { flex: 1; overflow: auto; padding: 14px 0; }
  #tree .group { padding: 10px 14px 4px; }
  #tree .group:first-child { padding-top: 4px; }
  #legend { border-top: 1px solid var(--ink); padding: 12px 16px; display: grid; gap: 4px; }
  #legend div { display: flex; gap: 16px; }
  #legend span { display: inline-flex; align-items: center; gap: 6px; }
  #legend .mark { color: var(--ink); letter-spacing: 0; }
  #map { position: fixed; inset: 0; z-index: 0; overflow: hidden; }
  [data-theme="blueprint"] #header,
  [data-theme="blueprint"] #hierarchy,
  [data-theme="blueprint"] #details,
  [data-theme="blueprint"] #help .help-panel {
    border-color: color-mix(in srgb, var(--map-line) 34%, transparent);
    background: var(--chrome-surface);
    box-shadow: 0 0 20px color-mix(in srgb, var(--map-line) 7%, transparent), inset 0 0 18px color-mix(in srgb, var(--map-line) 3%, transparent);
  }
  #details {
    right: 12px;
    width: var(--details-column);
    overflow: auto;
    padding: 22px 24px;
    opacity: 1;
    transform: translateX(0);
    visibility: visible;
    transition: opacity var(--chrome-motion) var(--chrome-ease), transform var(--chrome-motion) var(--chrome-ease), width var(--chrome-motion) var(--chrome-ease), visibility 0s linear 0s;
  }
  body.details-hidden #details {
    opacity: 0;
    transform: translateX(calc(100% + 12px));
    visibility: hidden;
    pointer-events: none;
    transition: opacity var(--chrome-motion) var(--chrome-ease), transform var(--chrome-motion) var(--chrome-ease), visibility 0s linear var(--chrome-motion);
  }
  #details-close {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    place-items: center;
    border: 1px solid var(--hairline);
    border-radius: var(--control-radius);
    background: color-mix(in srgb, var(--paper) 35%, transparent);
  }
  #details-close:hover { background: var(--hover); }
  #details .meta { margin: 0 0 6px; }
  #details h1 { font-size: 21px; font-weight: 600; line-height: 1.3; margin: 0 0 16px; overflow-wrap: anywhere; }
  #details .overview { margin: 0 0 10px; line-height: 1.65; }
  #details .section {
    margin: 26px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--hairline);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  #details ul { margin: 0; padding: 0; list-style: none; }
  #details li { margin: 0 0 6px; }
  #details .relationships li { margin: 0; }
  #details .criterion-check { color: var(--accent-text); }
  #details .tabs { margin: 0 0 8px; border: 1px solid var(--hairline); border-radius: var(--control-radius); overflow: hidden; }
  #details .tabs button { flex: 1; border: 0; border-radius: 0; }
  #details .tabs button + button { margin-left: 0; border-left: 1px solid var(--hairline); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  #details .chip { border: 1px solid var(--hairline); padding: 2px 8px; margin: 0; }
  .controls { display: flex; }
  .controls button {
    padding: 6px 14px;
    background: transparent;
    border: 1px solid var(--hairline);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .controls button + button { margin-left: -1px; }
  .controls button.active { background: var(--ink); color: var(--paper); }
  #map-controls {
    align-items: stretch;
    border: 0;
    border-radius: var(--control-radius);
    box-shadow: inset 0 0 0 1px var(--hairline);
    overflow: hidden;
    transform: translateY(-1px);
  }
  #map-controls button { display: flex; align-items: center; gap: 6px; border: 0; border-right: 1px solid var(--hairline); }
  #zoom { display: grid; min-width: 54px; place-items: center; padding: 0 8px; border-right: 1px solid var(--hairline); }
  #hierarchy-toggle, #details-close, #zoom-in, #zoom-out { width: 32px; height: 32px; padding: 0; }
  #zoom-in, #zoom-out { justify-content: center; font-size: 12px; line-height: 1.2; }
  .control-glyph { display: block; transform-origin: center; }
  body #work {
    left: calc(var(--hierarchy-inset) + 24px);
    right: calc(var(--details-inset) + 24px);
    max-width: calc(100% - var(--hierarchy-inset) - var(--details-inset) - 48px);
    transition: left var(--chrome-motion) var(--chrome-ease), right var(--chrome-motion) var(--chrome-ease);
  }
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
  .row.selected { background: var(--hover); box-shadow: inset 2px 0 color-mix(in srgb, var(--ink) 35%, transparent); }
  .row .branch { align-self: stretch; width: 16px; flex: none; border-left: 1px solid color-mix(in srgb, var(--ink) 18%, transparent); position: relative; }
  .row .branch.current::after { content: ''; position: absolute; top: 50%; left: 0; width: 11px; border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent); }
  .row .branch.current.end { height: 50%; align-self: flex-start; }
  .row .branch.current.end::after { top: 100%; }
  .row .twist { width: 1em; flex: none; color: var(--muted); }
  .row .twist.toggle:hover { color: var(--highlight-text); }
  .row .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .relationship-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 10px;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 2px 8px;
    width: 100%;
    padding: 8px 0;
    border: 0;
    border-bottom: 1px solid var(--hairline);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .relationship-row:hover { background: var(--hover); }
  .relationship-peer { grid-column: 1; grid-row: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .relationship-detail { grid-column: 1 / -1; grid-row: 2; padding-left: 17px; color: var(--muted); font-size: 9px; }
  .relationship-destination { grid-column: 2; grid-row: 1; font-size: 16px; text-align: right; }
  .link { border: 0; background: transparent; padding: 0; text-align: left; }
  .link:hover { text-decoration: underline; text-underline-offset: 2px; }
  .mark { flex: none; }
  .ghost { opacity: 0.5; }
  @media (prefers-reduced-motion: reduce) {
    #hierarchy, #hierarchy-toggle .hierarchy-chevron, #hierarchy-content, #hierarchy-title .pane-label, #details, body.details-hidden #details, body #work { transition: none; }
  }
${chromeCss}${anchoredPopoverCss}${motionCss}${revisionCss}${searchCss}${highlightCss}${sourceCss}${taskDiffCss}${backlogMarkCss}${workBadgeCss}${workDetailsCss}${flowRowCss}${mapCss}${pinsCss}${workCss}${tipCss}${projectEditorCss}${mapDebugCss}`

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
    + `<header id="header">${lockup}<span id="stats"></span>${revisionControl(payload, { history: historyIcon, loader: revisionLoader })}`
    + `<div class="header-actions"><div id="map-controls" class="controls" aria-label="Map controls"><button id="fit" aria-label="Fit map">${fitIcon}<span>Fit</span></button><button id="zoom-out" aria-label="Zoom out"><span class="control-glyph">−</span></button><span id="zoom" aria-live="polite"></span><button id="zoom-in" aria-label="Zoom in"><span class="control-glyph">+</span></button></div><details id="help"><summary>Help</summary><div class="help-panel"><p>Drag or scroll to pan<br>Pinch, + or − to zoom<br>0 or Fit shows the whole map<br>/ or Cmd/Ctrl+K searches<br>F1 toggles map only<br>F2 toggles layers<br>In layers: drag orbits; Shift-drag pans<br>F3 toggles map debug<br>Escape clears selection</p></div></details><button id="theme" data-next-theme="dark"><span class="theme-icon dark">${moonIcon}</span><span class="theme-icon blueprint">${blueprintIcon}</span><span class="theme-icon light">${sunIcon}</span><span class="label">Dark</span></button>${searchControl({ search: searchIcon, close: closeIcon })}</div>`
    + '</header>'
    + `<nav id="hierarchy" aria-label="Hierarchy"><div id="hierarchy-title"><span class="pane-label">Hierarchy</span><button id="hierarchy-toggle" type="button" aria-controls="hierarchy-content">${hierarchyIcon}</button></div><div id="hierarchy-content"><div id="flows"></div><div id="tree"></div><div id="legend">${legend()}</div></div></nav>`
    + '<div id="map"></div>'
    + `<aside id="details" aria-label="Details"><button id="details-close" aria-label="Close details">${closeIcon}</button><p class="meta"></p><h1></h1><nav class="controls tabs"></nav><div class="body"></div></aside>`
    + `<script type="application/json" id="world">${json}</script>`
    + '<script src="/render.js"></script>'
    + '</body></html>'
}
