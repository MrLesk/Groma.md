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
  /* One text field look for the header: Search and the revision fields share it. The field's parent carries
     data-open while its list is open, which gives the field its focus ring. */
  .chrome-field {
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
  [data-open] > .chrome-field {
    border-color: var(--highlight);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--highlight) 12%, transparent);
  }
  .chrome-field input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    padding: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
  }
  .chrome-field input::placeholder { color: var(--muted); }
  .chrome-field input::-webkit-search-cancel-button { display: none; }
  * {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--ink) 38%, transparent) transparent;
  }
  *::-webkit-scrollbar { width: 4px; height: 4px; }
  *::-webkit-scrollbar-track, *::-webkit-scrollbar-corner { background: transparent; }
  *::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--ink) 38%, transparent); border-radius: 2px; }
  *::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--ink) 58%, transparent); }
`
