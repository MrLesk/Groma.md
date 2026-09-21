import { escaped } from '../atoms/escape.ts'
import type { WebPayload, WebRevision } from '../payload.ts'

export const revisionCss = `
  #revision { position: relative; flex: none; --popover-width: 480px; }
  #revision .revision-menu { right: auto; left: 0; }
  #revision summary { min-width: 210px; max-width: min(360px, 35vw); background: transparent; list-style: none; }
  #revision summary::-webkit-details-marker { display: none; }
  #revision summary:hover { color: var(--ink); background: var(--hover); }
  #revision summary:focus-visible { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #revision .revision-current { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #revision .revision-search { display: none; width: 100%; min-width: 0; flex: 1; padding: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; }
  #revision[open] summary { border-color: var(--highlight); }
  #revision .revision-loader { display: none; animation: revision-spin 700ms linear infinite; }
  #revision[aria-busy="true"] .revision-history { display: none; }
  #revision[aria-busy="true"] .revision-loader { display: block; }
  #revision .chevron { width: 8px; height: 8px; flex: none; margin-left: 3px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform 160ms ease; }
  #revision[open] .chevron { transform: translateY(2px) rotate(225deg); }
  body[data-revision] #revision summary { color: var(--ink); }
  .time-machine { display: flex; align-items: center; min-width: 0; flex: none; }
  #revision .revision-current { display: flex; align-items: center; gap: 10px; }
  .revision-current > span:not(.revision-vs) { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .revision-vs { flex: none; color: var(--muted); font-size: 10px; }
  #revision[data-comparison] summary { max-width: min(360px, 32vw); }
  #revision[data-searching] .revision-current { display: none; }
  #revision[data-searching] .revision-search { display: block; }
  #revision .revision-context { display: flex; align-items: center; gap: 12px; }
  #revision .revision-context:not(:empty) { padding: 10px 12px; border-bottom: 1px solid var(--hairline); }
  .revision-context span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 11px; }
  .revision-actions:not(:empty) { padding: 8px; border-top: 1px solid var(--hairline); }
  .revision-actions button { width: 100%; justify-content: flex-start; }
  .revision-endpoint { display: flex; align-items: start; gap: 14px; padding: 12px; }
  .revision-endpoint > div { flex: 1; min-width: 0; }
  .revision-endpoint strong { display: block; font-weight: 500; font-size: 12px; margin-bottom: 6px; overflow-wrap: anywhere; }
  .revision-endpoint p { font-size: 11px; color: var(--muted); white-space: pre-wrap; margin: 8px 0 0; }
  .revision-endpoint button { flex: none; font-size: 10px; }
  .revision-pair-direction { color: var(--muted); padding-left: 12px; }
  #end-comparison[hidden] { display: none; }
  #end-comparison { margin-left: 4px; font-size: 18px; padding: 6px 9px; }
  @keyframes revision-spin { to { transform: rotate(360deg); } }
  .revision-option { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; }
  #revision .revision-option:disabled { opacity: .4; cursor: not-allowed; background: transparent; }
  .revision-subject { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  .revision-meta { min-width: 0; display: flex; align-items: center; font-size: 10px; white-space: nowrap; }
  .revision-meta > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .revision-meta > * + *::before { content: '·'; margin: 0 6px; color: var(--muted); }
  .revision-tag { flex: none; color: var(--highlight-text); }
  .revision-notice { padding: 12px; color: var(--muted); font-size: 12px; }
  .revision-error { color: var(--ink); white-space: pre-wrap; }
  .revision-tooltip {
    position: fixed; z-index: 100;
    max-width: min(420px, calc(100vw - 24px)); max-height: min(420px, calc(100vh - 24px));
    overflow: auto; padding: 8px 10px;
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent); border-radius: 8px;
    background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(18px);
    box-shadow: 0 10px 28px color-mix(in srgb, var(--ink) 18%, transparent);
    color: var(--ink); font: 11px/1.45 'SF Mono', ui-monospace, Menlo, monospace;
    white-space: pre-wrap; pointer-events: auto;
  }
  @media (prefers-reduced-motion: reduce) {
    #revision .revision-loader { animation: none; }
    #revision .chevron { transition: none; }
  }
`

export function revisionTitle(revision: WebRevision | null): string {
  return revision === null ? 'Current working tree' : `${revision.id} - ${revision.subject}`
}

function revisionOption(revision: WebRevision, selected: boolean): string {
  const tag = revision.tag === undefined ? '' : `<span class="revision-tag">${escaped(revision.tag)}</span>`
  const body = revision.body === '' ? '' : ` data-body="${escaped(revision.body)}"`
  return `<button class="anchored-option revision-option" type="button" data-revision="${revision.id}"${body} title="${escaped(revisionTitle(revision))}" aria-current="${selected}"><span class="revision-subject">${escaped(revision.subject)}</span><span class="revision-meta">${tag}<code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span></button>`
}

export function revisionOptions(revisions: WebPayload['revisions'], selected?: string, query = '', workingTree = true): string {
  const filter = query.trim().toLocaleLowerCase()
  const current = workingTree && 'current working tree'.includes(filter)
    ? `<button class="anchored-option revision-option current" type="button" data-revision="" aria-current="${selected === undefined}"><span class="revision-subject">Current working tree</span></button>` : ''
  const matches = revisions.filter(revision => `${revision.id} ${revision.subject} ${revision.body}`.toLocaleLowerCase().includes(filter))
  return current + matches.map(revision => revisionOption(revision, revision.id === selected)).join('')
    || '<div class="revision-notice">No matching revisions</div>'
}


export function revisionLabel(payload: WebPayload): string {
  const label = (revision: WebRevision | null) => `<span title="${escaped(revisionTitle(revision))}">${escaped(revision?.subject ?? 'Current working tree')}</span>`
  return payload.comparison === undefined ? label(payload.revision)
    : `${label(payload.comparison.from)}<span class="revision-vs">vs.</span>${label(payload.revision)}`
}

export function revisionMetadata(revision: WebRevision | null): string {
  if (revision === null) return '<strong>Current working tree</strong>'
  return `<strong>${escaped(revision.subject)}</strong><span class="revision-meta"><code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span>${revision.body === '' ? '' : `<p>${escaped(revision.body)}</p>`}`
}

export function comparisonMenu(payload: WebPayload): string {
  return `<div class="revision-endpoint"><div>${revisionMetadata(payload.comparison!.from)}</div><button class="chrome-button" data-action="from">Change start</button></div>
    <div class="revision-pair-direction">↓</div>
    <div class="revision-endpoint"><div>${revisionMetadata(payload.revision)}</div><button class="chrome-button" data-action="to">Change destination</button></div>`
}

export function revisionControl(payload: WebPayload, icons: { history: string, loader: string }): string {
  return `<div class="time-machine"><details id="revision"><summary class="chrome-button" aria-label="Choose revision">${icons.history}${icons.loader}<span class="revision-current">${revisionLabel(payload)}</span><input class="revision-search" type="search" aria-label="Find revision by commit ID or message" placeholder="Find commit or message…" autocomplete="off"><span class="chevron"></span></summary><div class="anchored-popover revision-menu"><div class="revision-error revision-notice" role="alert" hidden></div><div class="revision-context"></div><div class="revision-results"></div><div class="revision-actions"></div></div></details><button id="end-comparison" class="chrome-button" aria-label="End comparison" title="End comparison" hidden>×</button></div>`
}
