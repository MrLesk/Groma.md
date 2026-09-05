import { escaped } from '../atoms/escape.ts'
import type { WebPayload } from '../payload.ts'

export const revisionCss = `
  #revision { position: relative; flex: none; --popover-width: 520px; }
  #revision .revision-menu { right: auto; left: 0; }
  #revision summary {
    min-width: 132px;
    background: transparent;
    list-style: none;
  }
  #revision summary::-webkit-details-marker { display: none; }
  #revision summary:hover { color: var(--ink); background: var(--hover); }
  #revision summary:focus-visible { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #revision .revision-current { width: 16ch; flex: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #revision .revision-loading { display: none; width: 16ch; flex: none; white-space: nowrap; }
  #revision .revision-dots { width: 3ch; flex: none; display: inline-flex; }
  #revision .revision-dots span { width: 1ch; opacity: 0.25; animation: revision-dot 900ms ease-in-out infinite; }
  #revision .revision-dots span:nth-child(2) { animation-delay: 150ms; }
  #revision .revision-dots span:nth-child(3) { animation-delay: 300ms; }
  #revision .revision-loader { display: none; animation: revision-spin 700ms linear infinite; }
  #revision[aria-busy="true"] .revision-current { display: none; }
  #revision[aria-busy="true"] .revision-loading { display: flex; }
  #revision[aria-busy="true"] .revision-history { display: none; }
  #revision[aria-busy="true"] .revision-loader { display: block; }
  #revision[aria-busy="true"] summary { pointer-events: none; }
  #revision .chevron { width: 8px; height: 8px; flex: none; margin-left: 3px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: translateY(-2px) rotate(45deg); transform-origin: center; transition: transform 160ms ease; }
  #revision[open] .chevron { transform: translateY(2px) rotate(225deg); }
  body[data-revision] #revision summary { border-color: var(--highlight); color: var(--ink); }
  @keyframes revision-spin { to { transform: rotate(360deg); } }
  @keyframes revision-dot { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }
  .revision-option {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .revision-subject { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  .revision-meta { min-width: 0; display: flex; align-items: center; overflow: hidden; font-size: 10px; letter-spacing: 0.04em; white-space: nowrap; }
  .revision-meta > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .revision-meta > * + *::before { content: '·'; margin: 0 6px; color: var(--muted); }
  .revision-tag { flex: none; color: var(--highlight-text); }
  .revision-option:disabled { cursor: default; opacity: 0.48; }
  .revision-option:disabled:hover { background: transparent; color: var(--muted); }
  .revision-option .unsupported { flex: none; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; }
  .revision-tooltip {
    position: fixed;
    z-index: 100;
    max-width: min(420px, calc(100vw - 24px));
    max-height: min(420px, calc(100vh - 24px));
    overflow: auto;
    padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: 8px;
    background: color-mix(in srgb, var(--paper) 96%, var(--ink));
    box-shadow: 0 10px 28px color-mix(in srgb, var(--ink) 18%, transparent);
    color: var(--ink);
    font: 11px/1.45 'SF Mono', ui-monospace, Menlo, monospace;
    white-space: pre-wrap;
    pointer-events: auto;
  }
  @media (prefers-reduced-motion: reduce) {
    #revision .revision-loader { animation: none; }
    #revision .revision-dots span { animation: none; opacity: 1; }
    #revision .chevron { transition: none; }
  }
`


function revisionOption(revision: WebPayload['revisions'][number], selected: boolean): string {
  const unsupported = revision.compatible ? '' : ' disabled'
  const status = revision.compatible ? '' : '<span class="unsupported">Unsupported</span>'
  const tag = revision.tag === undefined ? '' : `<span class="revision-tag">${escaped(revision.tag)}</span>`
  const body = revision.body === '' ? '' : ` data-body="${escaped(revision.body)}"`
  return `<button class="anchored-option revision-option" type="button" data-revision="${revision.id}"${body} aria-current="${selected}"${unsupported}><span class="revision-subject">${escaped(revision.subject)}</span><span class="revision-meta">${tag}<code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time>${status}</span></button>`
}

export function revisionControl(
  payload: WebPayload,
  icons: { history: string, loader: string },
): string {
  const liveLabel = 'Current revision'
  const options = payload.revisions
    .map(revision => revisionOption(revision, revision.id === payload.revision?.id))
    .join('')
  const current = payload.revision?.shortId ?? liveLabel
  return `<details id="revision"><summary class="chrome-button" aria-label="Groma revision">${icons.history}${icons.loader}<span class="revision-current">${current}</span><span class="revision-loading">Loading<span class="revision-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></span><span class="chevron"></span></summary><div class="anchored-popover revision-menu"><button class="anchored-option revision-option current" type="button" data-revision="" aria-current="${String(payload.revision === null)}"><span class="revision-subject">${liveLabel}</span></button>${options}</div></details>`
}
