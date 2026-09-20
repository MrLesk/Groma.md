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
  #revision[open] .revision-current { display: none; }
  #revision[open] .revision-search { display: block; }
  #revision[open] summary { border-color: var(--highlight); }
  #revision .revision-loader { display: none; animation: revision-spin 700ms linear infinite; }
  #revision[aria-busy="true"] .revision-history { display: none; }
  #revision[aria-busy="true"] .revision-loader { display: block; }
  #revision .chevron { width: 8px; height: 8px; flex: none; margin-left: 3px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform 160ms ease; }
  #revision[open] .chevron { transform: translateY(2px) rotate(225deg); }
  body[data-revision] #revision summary { color: var(--ink); }
  @keyframes revision-spin { to { transform: rotate(360deg); } }
  .revision-option { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; }
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

export function revisionOptions(revisions: WebPayload['revisions'], selected?: string, query = ''): string {
  const filter = query.trim().toLocaleLowerCase()
  const current = 'current working tree'.includes(filter)
    ? `<button class="anchored-option revision-option current" type="button" data-revision="" aria-current="${selected === undefined}"><span class="revision-subject">Current working tree</span></button>` : ''
  const matches = revisions.filter(revision => `${revision.id} ${revision.subject} ${revision.body}`.toLocaleLowerCase().includes(filter))
  return current + matches.map(revision => revisionOption(revision, revision.id === selected)).join('')
    || '<div class="revision-notice">No matching revisions</div>'
}

export function revisionControl(payload: WebPayload, icons: { history: string, loader: string }): string {
  const current = payload.revision?.subject ?? 'Current working tree'
  return `<details id="revision"><summary class="chrome-button" aria-label="Choose revision">${icons.history}${icons.loader}<span class="revision-current" title="${escaped(revisionTitle(payload.revision))}">${escaped(current)}</span><input class="revision-search" type="search" aria-label="Find revision by commit ID or message" placeholder="Find commit or message…" autocomplete="off"><span class="chevron"></span></summary><div class="anchored-popover revision-menu"><div class="revision-error revision-notice" role="alert" hidden></div><div class="revision-results">${revisionOptions(payload.revisions, payload.revision?.id)}</div></div></details>`
}
