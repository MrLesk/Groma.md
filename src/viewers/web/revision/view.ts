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
  #revision .revision-current { max-width: 42ch; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  .revision-context { padding: 8px 9px; color: var(--muted); font-size: 10px; }
  .revision-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px; border-block: 1px solid var(--hairline); }
  .revision-actions button, .revision-range button { background: var(--paper); color: var(--ink); border: 1px solid var(--hairline); border-radius: var(--control-radius); padding: 7px 9px; font: inherit; cursor: pointer; }
  .revision-actions button:disabled { opacity: .45; cursor: default; }
  .revision-actions strong { margin-right: auto; }
  .revision-range { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 8px; }
  .revision-range button { overflow: hidden; text-align: left; overflow-wrap: anywhere; }
  .revision-range button span { display: block; color: var(--muted); font-size: 9px; text-transform: uppercase; margin-bottom: 5px; }
  .revision-range code { display: block; font-size: 9px; margin-top: 5px; color: var(--muted); overflow-wrap: anywhere; }
  .revision-search { display: flex; gap: 6px; padding: 8px; }
  .revision-search :is(input, select) { min-width: 0; width: 50%; background: var(--paper); color: var(--ink); border: 1px solid var(--hairline); border-radius: var(--control-radius); padding: 7px; font: inherit; }
  .revision-error { padding: 10px; color: var(--change-removed); white-space: pre-wrap; }
  .revision-result { display: flex; align-items: center; }
  .revision-result > button { min-width: 0; }
  .revision-external { color: var(--muted); padding: 10px; }
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
  @media (prefers-reduced-motion: reduce) {
    #revision .revision-loader { animation: none; }
    #revision .revision-dots span { animation: none; opacity: 1; }
    #revision .chevron { transition: none; }
  }
`


export function revisionControl(
  payload: WebPayload,
  icons: { history: string, loader: string },
): string {
  const liveLabel = 'Working tree'
  const current = payload.revision?.shortId ?? liveLabel
  return `<details id="revision"><summary class="chrome-button" aria-label="Groma revision">${icons.history}${icons.loader}<span class="revision-current">${current}</span><span class="revision-loading">Loading<span class="revision-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></span><span class="chevron"></span></summary><div class="anchored-popover revision-menu"></div></details>`
}
