/** One rounded surface for the camera tabs and the tasks bar over the map. */
export const floatingBarCss = `
  .floating-map-bar {
    display: flex; align-items: center; border-radius: 28px;
    background: var(--chrome-surface); border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
    backdrop-filter: blur(14px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
    white-space: nowrap;
  }
`
