import { escaped } from '../atoms/escape.ts'
import type { WebPayload, WebRevision } from '../payload.ts'

/** Which revision field is the commit search: the browsed one, or an endpoint of a comparison. */
export type RevisionField = 'revision' | 'from' | 'to'

const motion = 'calc(var(--chrome-motion) * 0.75) var(--chrome-ease)'

/** Narrow headers name revisions by tag or short ID, and an open search takes the whole box. */
export const NARROW_HEADER = '(max-width: 1080px)'

export const revisionCss = `
  .time-machine { position: relative; display: flex; align-items: center; min-width: 0; flex: 0 1 auto; }
  .time-machine .revision-menu { right: auto; left: var(--field-left, 0px); }
  #revision { min-width: 0; gap: 6px; padding: 0 6px 0 10px; color: var(--ink); }
  /* One search input follows the fields in the DOM. The order property moves it into the first or second slot,
     which only works while the fields are the box's own flex items. */
  #revision .revision-fields { display: contents; }
  #revision .revision-loader { display: none; animation: revision-spin 700ms linear infinite; }
  #revision[aria-busy="true"] .revision-history { display: none; }
  #revision[aria-busy="true"] .revision-loader { display: block; }

  /* A field is as wide as its commit message; the two fields of a pair clip together. */
  .revision-field {
    order: 3; flex: 0 1 auto; min-width: 48px; height: 24px;
    display: inline-flex; align-items: center; gap: 6px;
    border: 0; border-radius: 5px; padding: 0 6px; background: transparent; color: var(--ink); font: inherit; cursor: pointer;
    transition: background-color ${motion};
  }
  .revision-field[data-field="from"] { order: 1; }
  .revision-field:hover, .revision-field:focus-visible { background: var(--hover); }
  .revision-message, .revision-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .revision-name { display: none; }
  .revision-field .chevron { width: 6px; height: 6px; flex: none; margin: -3px 2px 0; border-right: 1px solid var(--muted); border-bottom: 1px solid var(--muted); transform: rotate(45deg); }
  .revision-vs {
    order: 2; flex: none; align-self: stretch; display: inline-flex; align-items: center; margin: 0 2px; padding: 0 10px;
    border-left: 1px solid var(--hairline); border-right: 1px solid var(--hairline); color: var(--muted); font-size: 10px;
  }

  /* The edited field gives its place and width to the search; the other field does not move. */
  #revision .revision-search { order: 3; flex: 0 1 auto; width: var(--slot-width, 260px); padding: 0 6px; animation: revision-fade-in ${motion} both; }
  #revision[data-editing="from"] .revision-search { order: 1; }
  #revision[data-editing="from"] [data-field="from"],
  #revision[data-editing="to"] [data-field="to"],
  #revision[data-editing="revision"] [data-field="revision"] { display: none; }
  #revision[data-editing] .revision-field { max-width: var(--other-width, none); }

  /* Browsing: the open search keeps the field's place and width; only a newly selected commit's message resizes it.
     The width is a preferred one: a header with no room left still shrinks the box rather than cover Search. */
  #revision[data-editing="revision"] { width: var(--box-width, auto); min-width: 0; }
  #revision[data-editing="revision"] .revision-search { flex: 1 1 0; width: auto; }
  /* The way into a comparison ends the empty browsing search, inside a box with room for it, else just outside. */
  .revision-compare { order: 4; flex: none; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); white-space: nowrap; animation: revision-slide-in ${motion} 60ms both; }
  .revision-compare[hidden] { display: none; }
  .time-machine > .revision-compare { margin-left: 10px; }
  .revision-compare button {
    height: 24px; border: 0; border-radius: 5px; padding: 0 6px; background: transparent; color: var(--ink); font: inherit; cursor: pointer;
    text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--ink) 30%, transparent); text-underline-offset: 3px;
  }
  .revision-compare button:hover, .revision-compare button:focus-visible { background: var(--hover); text-decoration-color: var(--highlight); }
  /* A start is typed into a full-width slot: the waiting destination gives way long before the search does. */
  #revision[data-starting] .revision-field { flex-shrink: 1000; }
  #revision[data-starting] .revision-vs, #revision[data-starting] .revision-field { animation: revision-slide-in ${motion} both; }

  #end-comparison[hidden] { display: none; }
  #end-comparison { margin-left: 4px; font-size: 18px; padding: 6px 9px; animation: revision-fade-in ${motion} both; }
  @keyframes revision-spin { to { transform: rotate(360deg); } }
  @keyframes revision-fade-in { from { opacity: 0; } }
  @keyframes revision-slide-in { from { opacity: 0; transform: translateX(8px); } }

  .revision-option { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .revision-menu .revision-option:disabled { opacity: .4; cursor: not-allowed; background: transparent; }
  .revision-subject { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
  .revision-meta { min-width: 0; display: flex; align-items: center; font-size: 10px; white-space: nowrap; }
  .revision-meta > * { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .revision-meta > * + *::before { content: '·'; margin: 0 6px; color: var(--muted); }
  .revision-tag { flex: none; color: var(--highlight-text); }
  .revision-snapshot { padding: 12px; }
  .revision-snapshot strong { display: block; font-weight: 500; font-size: 12px; margin-bottom: 6px; overflow-wrap: anywhere; }
  .revision-snapshot p { font-size: 11px; color: var(--muted); white-space: pre-wrap; margin: 8px 0 0; }
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
  /* Narrow headers name a revision by its tag or short ID, and an open search takes the whole box. */
  @media ${NARROW_HEADER} {
    .revision-message, .revision-field .chevron { display: none; }
    .revision-name { display: inline; }
    /* Below about 985px even two short IDs do not fit: they clip inside the box like messages do. */
    .revision-field { min-width: 0; }
    .revision-vs { padding: 0 8px; }
    #revision[data-editing] { flex: 1 1 auto; width: auto; min-width: 0; }
    #revision[data-editing] .revision-field, #revision[data-editing] .revision-vs { display: none; }
    #revision[data-editing] .revision-search { flex: 1 1 0; width: auto; }
    .time-machine:has(#revision[data-editing]) { flex: 1 1 auto; }
  }
  /* At the page's minimum width both short IDs still read whole once the gaps tighten. */
  @media (max-width: 1000px) {
    .revision-field { padding: 0 3px; }
    .revision-vs { margin: 0; padding: 0 4px; }
  }
  @media (prefers-reduced-motion: reduce) {
    #revision, #revision *, .revision-compare, #end-comparison { animation: none !important; transition: none !important; }
  }
`

function revisionTitle(revision: WebRevision | null): string {
  return revision === null ? 'Current working tree' : `${revision.id} - ${revision.subject}`
}

function revisionOption(revision: WebRevision, current: boolean): string {
  const tag = revision.tag === undefined ? '' : `<span class="revision-tag">${escaped(revision.tag)}</span>`
  const body = revision.body === '' ? '' : ` data-body="${escaped(revision.body)}"`
  return `<button class="anchored-option revision-option" type="button" data-revision="${revision.id}"${body} title="${escaped(revisionTitle(revision))}" aria-current="${current}"><span class="revision-subject">${escaped(revision.subject)}</span><span class="revision-meta">${tag}<code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span></button>`
}

/** `held` is the commit id the edited field holds, '' for the working tree, or undefined when it holds nothing yet. */
export function revisionOptions(revisions: WebPayload['revisions'], held: string | undefined, query = '', workingTree = true): string {
  const filter = query.trim().toLocaleLowerCase()
  const tree = workingTree && 'current working tree'.includes(filter)
    ? `<button class="anchored-option revision-option" type="button" data-revision="" aria-current="${held === ''}"><span class="revision-subject">Current working tree</span></button>` : ''
  const matches = revisions.filter(revision => `${revision.id} ${revision.subject} ${revision.body}`.toLocaleLowerCase().includes(filter))
  return tree + matches.map(revision => revisionOption(revision, revision.id === held)).join('')
    || '<div class="revision-notice">No matching revisions</div>'
}

function revisionField(field: RevisionField, revision: WebRevision | null): string {
  const name = revision === null ? 'Working tree' : revision.tag ?? revision.shortId
  return `<button class="revision-field" type="button" data-field="${field}" title="${escaped(revisionTitle(revision))}"><span class="revision-message">${escaped(revision?.subject ?? 'Current working tree')}</span><span class="revision-name">${escaped(name)}</span><span class="chevron" aria-hidden="true"></span></button>`
}

const versus = '<span class="revision-vs">vs.</span>'

/** One field while browsing; start and destination around "vs." while comparing. */
export function revisionFields(payload: WebPayload): string {
  return payload.comparison === undefined ? revisionField('revision', payload.revision)
    : revisionField('from', payload.comparison.from) + versus + revisionField('to', payload.revision)
}

/** While a start is being chosen the search holds its place; the viewed revision waits as the destination. */
export function pendingPairFields(destination: WebRevision | null): string {
  return versus + revisionField('revision', destination)
}

export function snapshotNotice(revision: WebRevision | null): string {
  const metadata = revision === null ? '<strong>Current working tree</strong>'
    : `<strong>${escaped(revision.subject)}</strong><span class="revision-meta"><code>${revision.shortId}</code><time datetime="${revision.date}">${revision.date}</time></span>${revision.body === '' ? '' : `<p>${escaped(revision.body)}</p>`}`
  return `<div class="revision-snapshot">${metadata}</div><div class="revision-notice">No other revisions are available in this static Groma.</div>`
}

export function revisionControl(payload: WebPayload, icons: { history: string, loader: string }): string {
  return `<div class="time-machine"><div id="revision" class="chrome-field" role="group" aria-label="Revision">${icons.history}${icons.loader}<span class="revision-fields">${revisionFields(payload)}</span><input class="revision-search" type="search" aria-label="Find revision by commit ID or message" autocomplete="off" spellcheck="false" hidden><span class="revision-compare" hidden>or<button type="button" data-action="compare">compare 2 revisions</button></span></div><div class="anchored-popover animated revision-menu" hidden><div class="revision-error revision-notice" role="alert" hidden></div><div class="revision-results"></div></div><button id="end-comparison" class="chrome-button" type="button" aria-label="End comparison" title="End comparison" hidden>×</button></div>`
}
