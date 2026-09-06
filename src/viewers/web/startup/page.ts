import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { GromaInitResult } from '../../../initialize.ts'
import { escaped } from '../atoms/escape.ts'
import { cssBlock, palettes } from '../atoms/theme.ts'

type GromaDirectory = GromaInitResult['directory']

const lockupPath = import.meta.dir?.includes('$bunfs') === true
  ? path.join(import.meta.dir!, 'lockup.svg')
  : new URL('../atoms/lockup.svg', import.meta.url)
const lockup = readFileSync(lockupPath, 'utf8')

interface SetupPage {
  projectName: string
  directory?: GromaDirectory
  initialized: boolean
  error?: string
}

const style = `
  :root { ${cssBlock(palettes.light)} color-scheme: light; }
  @media (prefers-color-scheme: dark) { :root { ${cssBlock(palettes.dark)} color-scheme: dark; } }
  [data-theme="light"] { ${cssBlock(palettes.light)} color-scheme: light; }
  [data-theme="dark"] { ${cssBlock(palettes.dark)} color-scheme: dark; }
  [data-theme="blueprint"] { ${cssBlock(palettes.blueprint)} color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; padding: 32px 20px;
    display: grid; place-items: center; color: var(--ink); background-color: var(--paper);
    background-image: repeating-linear-gradient(30deg, transparent 0 39px, var(--map-grid) 39px 40px),
      repeating-linear-gradient(150deg, transparent 0 39px, var(--map-grid) 39px 40px);
    font: 13px/1.5 'SF Mono', ui-monospace, Menlo, monospace;
  }
  main {
    width: min(480px, 100%); padding: 32px; border: 1px solid var(--hairline); border-radius: 20px;
    background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(16px);
    box-shadow: 0 16px 64px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
  header svg { display: block; width: 146px; height: auto; }
  .steps { display: flex; gap: 12px; color: var(--muted); font-size: 10px; }
  .steps [aria-current] { color: var(--accent-text); }
  h1 { font-size: 24px; line-height: 1.3; margin: 0 0 28px; letter-spacing: -0.04em; }
  form { display: grid; gap: 24px; }
  label, legend { font-size: 11px; }
  .name { display: grid; gap: 8px; }
  input[type="text"] {
    width: 100%; padding: 12px; border: 1px solid var(--hairline); border-radius: 8px;
    font: inherit; background: var(--paper); color: var(--ink);
  }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 8px; }
  .directories { display: flex; gap: 10px; }
  .directory {
    display: flex; align-items: center; gap: 10px; flex: 1; padding: 12px;
    border: 1px solid var(--hairline); border-radius: 8px; cursor: pointer; font-size: 13px;
  }
  .directory:has(:checked) { border-color: var(--accent); background: var(--hover); }
  input[type="radio"] { margin: 0; accent-color: var(--accent); }
  .stored { padding: 12px 0; font-size: 13px; }
  button {
    padding: 12px 18px; border: 1px solid var(--accent); border-radius: 8px;
    color: var(--accent-text); background: var(--hover); font: inherit; cursor: pointer;
  }
  button:hover { background: color-mix(in srgb, var(--accent) 12%, var(--paper)); }
  button:disabled { cursor: progress; opacity: 0.65; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .error { margin: 0 0 24px; overflow-wrap: anywhere; white-space: pre-wrap; color: var(--diff-removed); }
  .next { margin: 24px 0 0; color: var(--muted); }
  .spinner {
    display: none; width: 24px; height: 24px; margin: 0 auto 20px;
    border: 2px solid var(--hairline); border-top-color: var(--accent); border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  main[aria-busy="true"] .spinner { display: block; }
  main[aria-busy="true"] h1 { text-align: center; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  @media (max-width: 420px) { main { padding: 24px; } header { flex-wrap: wrap; } }
`

const script = `
  const theme = localStorage.getItem('groma.theme');
  if (['light', 'dark', 'blueprint'].includes(theme)) document.documentElement.dataset.theme = theme;
  if (document.querySelector('main[aria-busy="true"]')) {
    fetch('/ready').then(() => location.reload());
  }
  document.querySelector('form')?.addEventListener('submit', () => {
    document.querySelector('main').setAttribute('aria-busy', 'true');
    document.querySelector('h1').textContent = 'Preparing your architecture';
    document.querySelector('[aria-current]')?.removeAttribute('aria-current');
    document.querySelector('[data-step="scan"]').setAttribute('aria-current', 'step');
    const button = document.querySelector('button');
    button.disabled = true;
    button.textContent = 'Initializing and scanning…';
  });
`

function directoryField(directory: GromaDirectory | undefined): string {
  if (directory !== undefined) {
    return `<fieldset><legend>Architecture folder</legend><div class="stored">${directory}/</div>`
      + `<input type="hidden" name="directory" value="${directory}"></fieldset>`
  }
  return '<fieldset><legend>Architecture folder</legend><div class="directories">'
    + '<label class="directory"><input type="radio" name="directory" value="groma" checked>groma/</label>'
    + '<label class="directory"><input type="radio" name="directory" value=".groma">.groma/</label>'
    + '</div></fieldset>'
}

/** Setup uses the map's brand and palette without loading or inventing an architecture world. */
export function renderSetupPage(input: SetupPage): string {
  const loading = input.initialized && input.error === undefined
  const error = input.error === undefined ? '' : `<p class="error" role="alert">${escaped(input.error)}</p>`
  let content = `<h1>Preparing your architecture</h1>`
  if (input.error !== undefined && input.initialized) {
    content = `<h1>Could not open architecture</h1>${error}<p class="next">Fix the reported issue, then run groma web again.</p>`
  } else if (!input.initialized) {
    content = `<h1>Initialize Groma</h1>${error}<form method="post" action="/initialize">`
      + `<label class="name">Project name<input type="text" name="projectName" value="${escaped(input.projectName)}" required autofocus></label>`
      + directoryField(input.directory)
      + '<button type="submit">Initialize &amp; scan</button></form>'
  }
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<title>Groma setup</title><style>${style}</style></head><body><main${loading ? ' aria-busy="true"' : ''}><header>${lockup}`
    + '<nav class="steps" aria-label="Setup progress">'
    + `<span${loading ? '' : ' aria-current="step"'}>1 Setup</span>`
    + `<span data-step="scan"${loading ? ' aria-current="step"' : ''}>2 Scan</span><span>3 Map</span></nav></header>`
    + `<span class="spinner" aria-hidden="true"></span>${content}</main><script>${script}</script></body></html>`
}
