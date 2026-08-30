import type { ArchitectureSearchResult } from '../../../search.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'

export const searchCss = `
  #architecture-search {
    position: relative;
    flex: none;
    --popover-width: 480px;
    --search-result-height: 50px;
    --search-motion: calc(var(--chrome-motion) * 0.7);
  }
  #architecture-search .search-trigger {
    border-color: transparent;
    background: transparent;
    transform-origin: right center;
    animation: search-control-in var(--search-motion) var(--chrome-ease) both;
    transition: display var(--search-motion) allow-discrete, opacity var(--search-motion) var(--chrome-ease), transform var(--search-motion) var(--chrome-ease);
  }
  #architecture-search .search-field {
    width: 260px;
    height: 34px;
    display: none;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--highlight);
    border-radius: var(--control-radius);
    padding: 0 7px 0 10px;
    background: color-mix(in srgb, var(--paper) 60%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--highlight) 12%, transparent);
    opacity: 0;
    transform: translateX(8px) scale(0.96);
    transform-origin: right center;
  }
  #architecture-search[data-open] .search-trigger {
    display: none;
    opacity: 0;
    transform: translateX(8px) scale(0.96);
  }
  #architecture-search[data-open] .search-field {
    display: flex;
    opacity: 1;
    transform: translateX(0) scale(1);
    animation: search-control-in var(--search-motion) var(--chrome-ease) both;
  }
  #architecture-search[data-closing] .search-field { animation: search-control-out var(--search-motion) var(--chrome-ease) both; }
  #architecture-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
  }
  #architecture-search input::placeholder { color: var(--muted); }
  #architecture-search input::-webkit-search-cancel-button { display: none; }
  #architecture-search .search-clear {
    width: 22px;
    height: 22px;
    display: none;
    place-items: center;
    border: 0;
    border-radius: 50%;
    padding: 4px;
    background: transparent;
    color: var(--muted);
  }
  #architecture-search[data-has-query] .search-clear { display: grid; }
  #architecture-search .search-clear:hover { color: var(--ink); background: var(--hover); }
  #architecture-search .search-menu {
    max-height: calc(100vh - 64px);
    overflow: hidden;
    padding-bottom: 4px;
    opacity: 1;
    transform: translateY(0) scale(1);
    transform-origin: top right;
  }
  #architecture-search .search-menu[hidden] {
    display: none;
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  #architecture-search .search-menu:not([hidden]) { animation: search-menu-in var(--search-motion) var(--chrome-ease) both; }
  #architecture-search[data-closing] .search-menu:not([hidden]) { animation: search-menu-out var(--search-motion) var(--chrome-ease) both; }
  @keyframes search-control-in {
    from { opacity: 0; transform: translateX(8px) scale(0.96); }
  }
  @keyframes search-control-out {
    to { opacity: 0; transform: translateX(8px) scale(0.96); }
  }
  @keyframes search-menu-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
  @keyframes search-menu-out {
    to { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
  #architecture-search .search-results {
    max-height: calc(5 * var(--search-result-height));
    overflow-y: auto;
  }
  #architecture-search .anchored-popover-footer {
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 6px -6px 0;
    padding: 6px 12px;
    border-top: 1px solid var(--hairline);
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
  }
  #architecture-search .result-count { margin-right: auto; }
  #architecture-search .keycap {
    display: inline-flex;
    min-width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--hairline);
    border-radius: 5px;
    padding: 0 5px;
    background: color-mix(in srgb, var(--paper) 60%, transparent);
    color: var(--ink);
    line-height: 1;
  }
  #architecture-search .search-result {
    box-sizing: border-box;
    height: var(--search-result-height);
    display: grid;
    grid-template-columns: 16px 14px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 2px 9px;
  }
  #architecture-search .search-rank { grid-row: 1 / 3; color: var(--muted); font-size: 10px; }
  #architecture-search .search-mark { grid-row: 1 / 3; color: var(--ink); }
  #architecture-search .search-name { overflow: hidden; color: var(--ink); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  #architecture-search .search-meta { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
  #architecture-search .search-path { grid-column: 3 / 5; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  #architecture-search .search-empty { margin: 0; padding: 14px 10px; color: var(--muted); }
  @media (max-width: 1080px) {
    #architecture-search .search-trigger .label { display: none; }
    #architecture-search .search-field { width: 220px; }
  }
  @media (prefers-reduced-motion: reduce) {
    #architecture-search .search-trigger,
    #architecture-search[data-open] .search-field,
    #architecture-search[data-closing] .search-field,
    #architecture-search .search-menu:not([hidden]),
    #architecture-search[data-closing] .search-menu:not([hidden]) { animation: none; transition: none; }
  }
`

export function searchControl(icons: { search: string, close: string }): string {
  return `<div id="architecture-search"><button class="chrome-button search-trigger" type="button" aria-label="Search architecture" aria-expanded="false">${icons.search}<span class="label">Search</span></button><div class="search-field">${icons.search}<input type="search" autocomplete="off" spellcheck="false" aria-label="Search architecture" aria-controls="architecture-search-results"><button class="search-clear" type="button" aria-label="Clear search">${icons.close}</button><span class="keycap search-shortcut" aria-hidden="true"></span></div><div class="anchored-popover search-menu" hidden><div id="architecture-search-results" class="search-results" role="listbox"></div><div class="anchored-popover-footer"><span class="result-count"></span><span>↑↓ Navigate</span><span><span class="keycap">↵</span> Enter</span><span><span class="keycap">Esc</span> Close</span></div></div></div>`
}

export function paintSearchResults(
  host: HTMLElement,
  results: readonly ArchitectureSearchResult[],
  activeIndex: number,
): void {
  host.replaceChildren()
  if (results.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'search-empty'
    empty.textContent = 'No matches'
    host.append(empty)
    return
  }
  results.forEach((result, index) => {
    const row = document.createElement('button')
    row.type = 'button'
    row.id = `architecture-search-result-${index}`
    row.className = 'anchored-option search-result'
    row.dataset.searchResult = String(index)
    row.setAttribute('role', 'option')
    row.setAttribute('aria-selected', String(index === activeIndex))

    const rank = document.createElement('span')
    rank.className = 'search-rank'
    rank.textContent = String(index + 1)
    const mark = document.createElement('span')
    mark.className = 'search-mark'
    mark.textContent = kindGlyph(result.element.kind)
    const name = document.createElement('span')
    name.className = 'search-name'
    name.textContent = result.element.name
    const meta = document.createElement('span')
    meta.className = 'search-meta'
    meta.textContent = `${kindLabel(result.element.kind, result.element.external)} · ${result.element.origin}`
    const path = document.createElement('span')
    path.className = 'search-path'
    path.textContent = result.path.length === 0 ? result.element.id : result.path.join(' › ')
    row.append(rank, mark, name, meta, path)
    host.append(row)
  })
}
