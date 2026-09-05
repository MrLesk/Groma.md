interface PopoverOptions {
  dismiss?: () => void
  companion?: Node
}

/** Shares outside-click dismissal; search supplies cancellation and revision owns a tooltip. */
export function bindPopover(root: HTMLElement, options: PopoverOptions = {}): void {
  const dismiss = options.dismiss ?? (() => root.removeAttribute('open'))
  document.addEventListener('pointerdown', event => {
    const target = event.target
    if (!(target instanceof Node) || root.contains(target) || options.companion?.contains(target)) return
    dismiss()
  })
}

/** Shared anchored menu surface for compact controls in the Web header. */
export const anchoredPopoverCss = `
  .anchored-popover {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    right: 0;
    width: min(var(--popover-width, 480px), calc(100vw - 24px));
    max-height: min(460px, calc(100vh - 90px));
    overflow: auto;
    padding: 6px;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: var(--chrome-radius);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    backdrop-filter: blur(18px);
    box-shadow: 0 12px 36px color-mix(in srgb, var(--ink) 14%, transparent);
  }
  .anchored-option {
    width: 100%;
    border: 0;
    border-radius: var(--control-radius);
    padding: 8px 9px;
    background: transparent;
    color: var(--muted);
    text-align: left;
  }
  .anchored-option + .anchored-option { border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent); }
  .anchored-option:hover, .anchored-option:focus-visible { background: var(--hover); color: var(--ink); }
  .anchored-option[aria-current="true"], .anchored-option[aria-selected="true"] {
    background: var(--hover);
    color: var(--highlight-text);
  }
`
