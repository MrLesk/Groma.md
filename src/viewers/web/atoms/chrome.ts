/** Shared standalone controls and compact scrollbars for every Web chrome surface. */
export const chromeCss = `
  .chrome-button {
    box-sizing: border-box;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 6px 10px;
    background: color-mix(in srgb, var(--paper) 35%, transparent);
    color: var(--muted);
    cursor: pointer;
  }
  .chrome-button:hover { color: var(--ink); background: var(--hover); }
  * {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--ink) 38%, var(--paper)) transparent;
  }
  *::-webkit-scrollbar { width: 4px; height: 4px; }
  *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: transparent; }
  *::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ink) 38%, var(--paper)); border-radius: 2px; }
  *::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--ink) 58%, var(--paper)); }
`
