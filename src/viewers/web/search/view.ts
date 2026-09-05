import type { WebSearchResult } from './model.ts'
import { kindGlyph, kindLabel } from '../../atoms/kind.ts'

export const searchCss = `
  #web-search {
    position: relative;
    --popover-width: 480px;
    --search-result-height: 50px;
    --search-motion: calc(var(--chrome-motion) * 0.7);
  }
  #web-search .search-field {
    height: 32px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--hairline);
    border-radius: var(--control-radius);
    padding: 0 7px 0 10px;
    background: color-mix(in srgb, var(--paper) 60%, transparent);
    color: var(--muted);
  }
  #web-search[data-open] .search-field {
    border-color: var(--highlight);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--highlight) 12%, transparent);
  }
  #web-search input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
  }
  #web-search input::placeholder { color: var(--muted); }
  #web-search input::-webkit-search-cancel-button { display: none; }
  #web-search .search-clear {
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
  #web-search[data-has-query] .search-clear { display: grid; }
  #web-search .search-clear:hover { color: var(--ink); background: var(--hover); }
  #web-search .search-menu {
    right: auto;
    left: 50%;
    translate: -50% 0;
    max-height: calc(100vh - 64px);
    overflow: hidden;
    padding-bottom: 4px;
    opacity: 1;
    transform: translateY(0) scale(1);
    transform-origin: top center;
    background: var(--paper);
  }
  #web-search .search-menu[hidden] {
    display: none;
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  #web-search .search-menu:not([hidden]) { animation: search-menu-in var(--search-motion) var(--chrome-ease) both; }
  @keyframes search-menu-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
  #web-search .search-results {
    max-height: calc(5 * var(--search-result-height));
    overflow-y: auto;
  }
  #web-search .anchored-popover-footer {
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
  #web-search .result-count { margin-right: auto; }
  #web-search .keycap {
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
  #web-search .search-result {
    box-sizing: border-box;
    height: var(--search-result-height);
    display: grid;
    grid-template-columns: 16px 14px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 2px 9px;
  }
  #web-search .search-rank { grid-row: 1 / 3; color: var(--muted); font-size: 10px; }
  #web-search .search-mark { grid-row: 1 / 3; color: var(--ink); }
  #web-search .search-name { overflow: hidden; color: var(--ink); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  #web-search .search-meta { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
  #web-search .search-path { grid-column: 3 / 5; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  #web-search .search-empty { margin: 0; padding: 14px 10px; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) {
    #web-search .search-menu:not([hidden]) { animation: none; }
  }
`

export function searchControl(icons: { search: string, close: string }): string {
  return `<div id="web-search"><div class="search-field">${icons.search}<input type="search" placeholder="Search" autocomplete="off" spellcheck="false" role="combobox" aria-label="Search" aria-autocomplete="list" aria-expanded="false" aria-controls="web-search-results"><button class="search-clear" type="button" aria-label="Clear search">${icons.close}</button><span class="keycap search-shortcut" aria-hidden="true"></span></div><div class="anchored-popover search-menu" hidden><div id="web-search-results" class="search-results" role="listbox" aria-label="Search results"></div><div class="anchored-popover-footer"><span class="result-count"></span><span>↑↓ Navigate</span><span><span class="keycap">↵</span> Open</span><span><span class="keycap">Esc</span> Close</span></div></div></div>`
}

export function paintSearchResults(
  host: HTMLElement,
  results: readonly WebSearchResult[],
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
    const content = result.kind === 'task'
      ? { mark: '#', title: result.task.title, meta: `Task · ${result.task.status}`, path: result.task.id }
      : {
        mark: kindGlyph(result.element.kind),
        title: result.element.title,
        meta: `${kindLabel(result.element.kind, result.element.external)} · ${result.element.origin}`,
        path: result.path.length === 0 ? result.element.id : result.path.join(' › '),
      }
    const row = document.createElement('button')
    row.type = 'button'
    row.id = `web-search-result-${index}`
    row.className = 'anchored-option search-result'
    row.dataset.searchResult = String(index)
    row.setAttribute('role', 'option')
    row.setAttribute('aria-selected', String(index === activeIndex))

    const rank = document.createElement('span')
    rank.className = 'search-rank'
    rank.textContent = String(index + 1)
    const mark = document.createElement('span')
    mark.className = 'search-mark'
    mark.textContent = content.mark
    const name = document.createElement('span')
    name.className = 'search-name'
    name.textContent = content.title
    const meta = document.createElement('span')
    meta.className = 'search-meta'
    meta.textContent = content.meta
    const path = document.createElement('span')
    path.className = 'search-path'
    path.textContent = content.path
    row.append(rank, mark, name, meta, path)
    host.append(row)
  })
}
