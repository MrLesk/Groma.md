import lockup from '../atoms/lockup.svg' with { type: 'text' }
import packageJson from '../../../../package.json' with { type: 'json' }

import type { ScannerDiscovery } from '../../../scanner/modules/discovery.ts'
import { scannerSelection, scannerSelectionScript } from './scanners.ts'

import type { GromaInitResult } from '../../../initialize.ts'
import { escaped } from '../atoms/escape.ts'
import { cssBlock, palettes } from '../atoms/theme.ts'
import { chromeCss } from '../atoms/chrome.ts'
import { startupUpdate, type StartupProgress } from './progress.ts'

type GromaDirectory = GromaInitResult['directory']

interface SetupPage {
  projectName: string
  directory?: GromaDirectory
  initialized: boolean
  firstRun: boolean
  progress?: StartupProgress
  error?: string
  proposal?: ScannerDiscovery
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
    font: 14px/1.5 'SF Mono', ui-monospace, Menlo, monospace;
  }
  main {
    width: min(520px, 100%); min-width: 0; padding: 32px; border: 1px solid var(--hairline); border-radius: 16px;
    background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(16px);
    box-shadow: 0 16px 64px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  main[data-view="scanners"] { width: min(640px, 100%); }
  main[data-view="loading"] { width: min(560px, 100%); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
  header svg { display: block; width: 146px; height: auto; }
  .brand { display: flex; align-items: center; gap: 20px; min-width: 0; }
  .brand svg { flex-shrink: 0; }
  .header-project { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); border-left: 1px solid var(--hairline); padding-left: 20px; }
  main[data-view="setup"] .header-project { display: none; }
  .version { color: var(--muted); font-size: 12px; flex-shrink: 0; }
  .steps { display: flex; gap: 16px; color: var(--muted); font-size: 13px; margin-bottom: 28px; border-bottom: 1px solid var(--hairline); }
  .steps span { flex: 1; padding-bottom: 10px; white-space: nowrap; }
  .steps [aria-current] { color: var(--accent-text); box-shadow: 0 2px var(--accent); }
  h1 { font-size: 24px; line-height: 1.3; margin: 0 0 24px; letter-spacing: -0.04em; }
  form { display: grid; gap: 22px; }
  .scanner-list { display: grid; gap: 12px; }
  .scanner-card { border: 1px solid var(--hairline); border-radius: 12px; overflow: hidden; min-width: 0; }
  .scanner-card:has(input[name="scanner"]:checked) { border-color: color-mix(in srgb, var(--accent) 45%, var(--hairline)); }
  .scanner-choice { display: flex; align-items: center; gap: 14px; padding: 20px; }
  label.scanner-choice { cursor: pointer; }
  label.scanner-choice:hover { background: var(--hover); }
  .scanner-choice input { margin: 0; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--accent); }
  .scanner-heading { display: grid; gap: 4px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .scanner-heading strong { font-size: 16px; font-weight: 600; }
  .detected-version { font-size: 11px; color: var(--muted); }
  .scanner-state { font-size: 10px; color: var(--accent-text); background: var(--hover); padding: 4px 8px; border-radius: 5px; }
  .scanner-state.attention { color: var(--syntax-number); }
  .scanner-issue { margin: 0 20px 16px; font-size: 12px; overflow-wrap: anywhere; }
  details summary { padding: 12px 20px; cursor: pointer; color: var(--muted); font-size: 11px; }
  details summary:hover { color: var(--ink); }
  details summary span { float: right; margin-left: 8px; }
  .scanner-evidence { border-top: 1px solid var(--hairline); }
  .evidence-body { padding: 4px 20px 16px; display: grid; gap: 12px; }
  .scanner-package { font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
  .evidence-search { min-width: 0; width: 100%; padding: 10px 12px; border: 1px solid var(--hairline); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-size: 12px; }
  .evidence-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; }
  .evidence-list li { display: grid; gap: 4px; padding: 12px 0; border-top: 1px solid var(--hairline); overflow-wrap: anywhere; font-size: 11px; }
  .evidence-list li span { color: var(--muted); }
  .evidence-list code { font: inherit; }
  .no-matches, .scanner-empty { margin: 0; color: var(--muted); font-size: 12px; }
  .coverage-notes { border: 1px solid var(--hairline); border-radius: 8px; }
  .coverage-notes ul { padding: 0 24px 12px 36px; margin: 0; max-height: 240px; overflow-y: auto; font-size: 12px; overflow-wrap: anywhere; }
  .coverage-notes li + li { margin-top: 10px; }
  [hidden] { display: none !important; }
  label, legend { font-size: 14px; color: var(--muted); }
  .name { display: grid; gap: 8px; }
  input[type="text"] {
    width: 100%; padding: 12px; border: 1px solid var(--hairline); border-radius: 8px;
    font: inherit; background: var(--paper); color: var(--ink);
  }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 8px; }
  .directories { display: grid; gap: 12px; }
  .directory {
    display: flex; align-items: center; gap: 12px; cursor: pointer; color: var(--ink);
  }
  input[type="radio"] { margin: 0; width: 18px; height: 18px; accent-color: var(--accent); }
  .stored { padding: 12px 0; font-size: 13px; }
  button {
    padding: 12px 18px; border: 1px solid var(--accent); border-radius: 8px;
    color: var(--on-colour); background: var(--accent); font: inherit; font-weight: 600; cursor: pointer;
  }
  button:hover { background: color-mix(in srgb, var(--accent) 88%, var(--ink)); }
  #scanner-selection > button { min-height: 46px; font-weight: 600; }
  button:disabled { cursor: progress; opacity: 0.65; }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  .error { margin: 0 0 24px; overflow-wrap: anywhere; white-space: pre-wrap; color: var(--diff-removed); }
  .next { margin: 24px 0 0; color: var(--muted); }
  .spinner {
    display: block; width: 24px; height: 24px; flex-shrink: 0;
    border: 2px solid var(--hairline); border-top-color: var(--accent); border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  .status-strip { display: flex; align-items: center; gap: 20px; margin: 36px 0 12px; }
  .status-strip h1 { font-size: 18px; font-weight: 500; letter-spacing: -0.02em; margin: 0; text-align: left; overflow-wrap: anywhere; }
  main[data-view="loading"] header { padding-bottom: 24px; margin: 0; border-bottom: 1px solid var(--hairline); }
  main[data-view="loading"] .first-progress, main[data-view="first-scan"] .loading-progress { display: none; }
  .milestones { list-style: none; padding: 0; margin: 30px 0 0; }
  .milestones > li { position: relative; display: flex; align-items: flex-start; gap: 22px; min-height: 60px; color: var(--muted); }
  .milestones > li:not(:last-child)::after { content: ''; position: absolute; left: 11px; top: 45px; bottom: -15px; width: 1px; background: var(--hairline); }
  .milestone-mark { width: 24px; height: 24px; margin-top: 18px; flex-shrink: 0; display: grid; place-items: center; border: 2px solid var(--muted); border-radius: 50%; }
  .milestone-work { min-width: 0; padding: 18px 0; }
  .milestone-mark .check { display: none; }
  .milestones [data-state="complete"] .milestone-mark { color: var(--on-colour); border-color: var(--accent); background: var(--accent); }
  .milestones [data-state="complete"] .check { display: block; font-weight: 700; }
  .milestones > li[data-state="complete"]::after { background: var(--accent); }
  .milestones [data-state="active"] { color: var(--ink); }
  .milestones [data-state="active"] .milestone-mark { border-color: var(--hairline); border-top-color: var(--accent); animation: spin 700ms linear infinite; }
  .scanner-progress { list-style: none; padding: 0; margin: 8px 0 0; }
  .scanner-progress > li { display: flex; align-items: center; gap: 12px; min-height: 32px; overflow-wrap: anywhere; }
  .scanner-progress .spinner { width: 16px; height: 16px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner, .milestones [data-state="active"] .milestone-mark { animation: none; } }
  @media (max-width: 420px) {
    body { padding: 16px 12px; }
    main { padding: 24px 20px; }
    header { gap: 10px; }
    header svg { width: 125px; }
    .brand { gap: 10px; }
    .header-project { padding-left: 10px; font-size: 12px; }
    .steps { gap: 10px; font-size: 12px; }
    .status-strip { gap: 14px; }
    .status-strip h1 { font-size: 16px; }
    .scanner-choice { padding: 16px 14px; gap: 10px; flex-wrap: wrap; }
    .scanner-state { margin-left: auto; }
    details summary { padding: 12px 14px; }
    details summary span { float: none; display: block; margin: 4px 0 0 14px; }
    .evidence-body { padding: 4px 14px 14px; }
  }
  ${chromeCss}
`

const script = `
  ${scannerSelectionScript}
  const theme = localStorage.getItem('groma.theme');
  if (['light', 'dark', 'blueprint'].includes(theme)) document.documentElement.dataset.theme = theme;
  const main = document.querySelector('main');
  const content = document.querySelector('#startup-content');
  const progress = document.querySelector('#startup-progress');
  let events;
  function showScanners(names) {
    document.querySelector('.status-strip > .spinner').hidden = names.length > 0;
    document.querySelectorAll('[data-scanners]').forEach(list => {
      list.hidden = names.length === 0;
      list.replaceChildren(...names.map(name => {
        const row = document.createElement('li');
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        spinner.setAttribute('aria-hidden', 'true');
        row.append(spinner, document.createTextNode(name));
        return row;
      }));
    });
  }
  function showPhase(update) {
    main.dataset.view = main.dataset.firstRun === 'true' ? 'first-scan' : 'loading';
    main.setAttribute('aria-busy', 'true');
    content.hidden = true;
    progress.hidden = false;
    showScanners(update.scannerNames);
    document.querySelector('[data-phase]').textContent = update.label + '…';
    document.querySelector('[data-announcement]').textContent = [update.label, ...update.scannerNames].join(' ');
    document.querySelectorAll('[data-milestone]').forEach(row => {
      const index = Number(row.dataset.milestone);
      const state = index < update.milestone ? 'complete' : index === update.milestone ? 'active' : 'pending';
      row.dataset.state = state;
      if (state === 'active') row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
      row.querySelector('[data-label]').textContent = state === 'active' ? update.label : row.dataset[state === 'complete' ? 'completed' : 'pending'];
    });
  }
  function connectProgress() {
    events = new EventSource('/startup-events');
    events.onmessage = event => showPhase(JSON.parse(event.data));
  }
  function failed(error) {
    events?.close();
    main.removeAttribute('aria-busy');
    progress.hidden = true;
    const message = document.querySelector('#request-error');
    message.textContent = error.message;
    message.hidden = false;
  }
  if (main.getAttribute('aria-busy') === 'true') {
    connectProgress();
    fetch('/ready').then(() => { events.close(); location.reload(); }).catch(failed);
  }
  document.querySelector('form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    form.querySelector('button[type="submit"]').disabled = true;
    if (data.has('projectName')) document.querySelector('.header-project').textContent = data.get('projectName');
    connectProgress();
    try {
      await fetch(form.action, { method: 'POST', body: data });
      events.close();
      location.reload();
    } catch (error) { failed(error); }
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

function setupContent(input: SetupPage): string {
  const error = input.error === undefined ? '' : `<p class="error" role="alert">${escaped(input.error)}</p>`
  if (input.proposal !== undefined) {
    return `<h1>Set up scanners</h1>${error}`
      + scannerSelection(input.proposal)
  }
  if (!input.initialized) {
    return `<h1>Initialize Groma</h1>${error}<form method="post" action="/initialize">`
      + `<label class="name">Project name<input type="text" name="projectName" value="${escaped(input.projectName)}" required autofocus></label>`
      + directoryField(input.directory)
      + '<button type="submit">Continue</button></form>'
  }
  return `<h1>Could not open architecture</h1>${error}<p class="next">Fix the reported issue, then run groma web again.</p>`
}

function scannerRows(names: readonly string[]): string {
  return `<ul class="scanner-progress" data-scanners${names.length ? '' : ' hidden'}>`
    + names.map(name => `<li><span class="spinner" aria-hidden="true"></span>${escaped(name)}</li>`).join('') + '</ul>'
}

function progressContent(progress: StartupProgress): string {
  const update = startupUpdate(progress)
  const scanners = scannerRows(update.scannerNames)
  const milestones = [
    ['Create project', 'Project created'],
    ['Set up scanners', 'Scanner setup complete'],
    ['Prepare architecture', 'Architecture ready'],
    ['Open map', 'Map ready'],
  ]
  const rows = milestones.map(([pending, completed], index) => {
    const state = index < update.milestone ? 'complete' : index === update.milestone ? 'active' : 'pending'
    const label = state === 'active' ? update.label : state === 'complete' ? completed : pending
    return `<li data-milestone="${index}" data-state="${state}" data-pending="${pending}" data-completed="${completed}"${state === 'active' ? ' aria-current="step"' : ''}>`
      + `<span class="milestone-mark" aria-hidden="true"><span class="check">✓</span></span>`
      + `<div class="milestone-work"><span data-label>${escaped(label)}</span>${index === 2 ? scanners : ''}</div></li>`
  }).join('')
  return `<div class="first-progress"><h1>Creating your first map</h1><ol class="milestones" aria-label="Startup progress">${rows}</ol></div>`
    + `<div class="loading-progress"><div class="status-strip"><span class="spinner" aria-hidden="true"${update.scannerNames.length ? ' hidden' : ''}></span>`
    + `<h1 data-phase>${escaped(update.label)}…</h1></div>${scanners}</div>`
}

function pageView(input: SetupPage): string {
  if (input.error === undefined && input.progress !== undefined) return input.firstRun ? 'first-scan' : 'loading'
  if (input.proposal !== undefined) return 'scanners'
  if (!input.initialized) return 'setup'
  if (input.error !== undefined) return 'error'
  return input.firstRun ? 'first-scan' : 'loading'
}

/** Distinct setup, first-scan and normal loading surfaces share real startup phases. */
export function renderSetupPage(input: SetupPage): string {
  const view = pageView(input)
  const loading = view === 'loading' || view === 'first-scan'
  const steps = '<nav class="steps" aria-label="Setup progress">'
    + `<span${input.initialized ? '' : ' aria-current="step"'}>1 Project</span>`
    + `<span${input.initialized ? ' aria-current="step"' : ''}>2 Scanners</span><span>3 Map</span></nav>`
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<title>${loading ? 'Opening Groma' : 'Groma setup'}</title><style>${style}</style></head><body>`
    + `<main data-view="${view}" data-first-run="${input.firstRun}"${loading ? ' aria-busy="true"' : ''}><header>`
    + `<div class="brand">${lockup}<span class="header-project" title="${escaped(input.projectName)}">${escaped(input.projectName)}</span></div>`
    + `<span class="version">v${escaped(packageJson.version)}</span></header><p id="request-error" class="error" role="alert" hidden></p>`
    + `<section id="startup-content"${loading ? ' hidden' : ''}>${view === 'setup' || view === 'scanners' ? steps : ''}${setupContent(input)}</section>`
    + `<section id="startup-progress"${loading ? '' : ' hidden'}>${progressContent(input.progress ?? { phase: 'preparing-viewer' })}</section></main>`
    + `<span class="sr-only" role="status" aria-live="polite" data-announcement></span><script>${script}</script></body></html>`
}
