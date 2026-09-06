import { ownsDetails, primarySelection } from '../selection.ts'
import type { Selection } from '../selection.ts'
import { bindPopover } from '../atoms/popover.ts'
import { bindShortcuts, type ShortcutActions } from './shortcuts.ts'

/** Buttons and keys use the same actions; shell events stay outside map orchestration. */
export function bindChromeActions(actions: ShortcutActions): void {
  bindShortcuts(actions)
  document.getElementById('zoom-in')!.addEventListener('click', actions.zoomIn)
  document.getElementById('zoom-out')!.addEventListener('click', actions.zoomOut)
  document.getElementById('fit')!.addEventListener('click', actions.fit)
  document.getElementById('details-close')!.addEventListener('click', actions.deselect)
  bindPopover(document.getElementById('help')!)
  bindPopover(document.getElementById('credits')!)
}

export interface WebShell {
  paint(selection: Selection): void
  setHud(visible: boolean): void
}

/** Files start wider; an explicit width choice belongs to the panel, not its content. */
export function createDetailsExpansion() {
  let choice: boolean | undefined
  return {
    expanded(fileOpen: boolean): boolean { return choice ?? fileOpen },
    toggle(fileOpen: boolean): void { choice = !(choice ?? fileOpen) },
  }
}

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface MapFrame {
  x: number
  y: number
  width: number
  height: number
}

/** The camera frame is either the whole map or the safe area between visible chrome. */
export function mapFrame(
  map: Rect,
  header: Rect,
  hierarchy: Rect,
  details: { left: number; hidden: boolean },
  hudVisible: boolean,
): MapFrame {
  if (!hudVisible) return { x: 0, y: 0, width: map.width, height: map.height }
  const x = hierarchy.right - map.left + 12
  const y = header.bottom - map.top + 12
  const right = details.hidden ? map.width : details.left - map.left - 12
  return {
    x,
    y,
    width: Math.max(right - x, 1),
    height: Math.max(map.height - y - 12, 1),
  }
}

/** Owns shell visibility; selection remains the only authority for inspector visibility. */
export function createWebShell(
  root: HTMLElement,
  hierarchyContent: HTMLElement,
  hierarchyToggle: HTMLButtonElement,
  details: HTMLElement,
  map: HTMLElement | SVGSVGElement,
): WebShell {
  let hierarchyOpen = true
  let previousSelection: Selection = { kind: 'none' }
  const expansion = createDetailsExpansion()
  const expand = details.querySelector<HTMLButtonElement>('#details-expand')!

  const paintExpansion = (): void => {
    const expanded = expansion.expanded(details.classList.contains('file-open'))
    root.classList.toggle('details-expanded', expanded)
    expand.setAttribute('aria-expanded', String(expanded))
    expand.title = expanded ? 'Collapse details' : 'Expand details'
    expand.setAttribute('aria-label', expand.title)
  }
  expand.addEventListener('click', () => {
    expansion.toggle(details.classList.contains('file-open'))
    paintExpansion()
  })

  const paintHierarchy = (): void => {
    root.classList.toggle('hierarchy-collapsed', !hierarchyOpen)
    hierarchyContent.toggleAttribute('inert', !hierarchyOpen)
    hierarchyContent.setAttribute('aria-hidden', String(!hierarchyOpen))
    hierarchyToggle.setAttribute('aria-expanded', String(hierarchyOpen))
    hierarchyToggle.setAttribute('aria-label', hierarchyOpen ? 'Collapse hierarchy' : 'Expand hierarchy')
  }

  hierarchyToggle.addEventListener('click', () => {
    hierarchyOpen = !hierarchyOpen
    paintHierarchy()
  })
  paintHierarchy()

  return {
    setHud(visible) {
      root.classList.toggle('hud-hidden', !visible)
    },
    paint(selection) {
      paintExpansion()
      if (selection.kind !== previousSelection.kind || primarySelection(selection) !== primarySelection(previousSelection)) {
        details.scrollTop = 0
      }
      previousSelection = selection
      const open = ownsDetails(selection)
      const ownedFocus = details.contains(document.activeElement)
      root.classList.toggle('details-hidden', !open)
      details.toggleAttribute('inert', !open)
      details.setAttribute('aria-hidden', String(!open))
      if (!open && ownedFocus) map.focus({ preventScroll: true })
    },
  }
}

export const detailsPanelCss = `
  /* The dock reserves the normal map frame; its reader expands over that frame. */
  #details-dock { position: absolute; top: 74px; bottom: 12px; right: 12px; width: var(--details-column); z-index: 6; pointer-events: none; }
  #details {
    position: absolute; inset: 0 0 0 auto; width: 100%; min-height: 0;
    overflow: auto; padding: 22px 24px; pointer-events: auto;
    opacity: 1; transform: translateX(0); visibility: visible;
    transition: opacity var(--chrome-motion) var(--chrome-ease), transform var(--chrome-motion) var(--chrome-ease), width var(--chrome-motion) var(--chrome-ease), visibility 0s linear 0s;
  }
  body.details-hidden #details {
    opacity: 0; transform: translateX(calc(100% + 12px)); visibility: hidden; pointer-events: none;
    transition: opacity var(--chrome-motion) var(--chrome-ease), transform var(--chrome-motion) var(--chrome-ease), visibility 0s linear var(--chrome-motion);
  }
  body.details-expanded #details { width: calc(100vw - var(--hierarchy-inset) - 36px); }
  body.details-expanded #details:not(.file-open) > :is(.meta, h1, .tabs, .body, .flow-back) { max-width: 640px; margin-left: auto; margin-right: auto; }
  #details > .meta { padding-right: 76px; min-height: 32px; }
  #details > .details-controls { position: sticky; top: 0; height: 0; flex-shrink: 0; order: -2; z-index: 2; }
  #details.file-open > .details-controls { margin: 0 24px; }
  #details-expand, #details-close {
    position: absolute; top: -10px; width: 32px; height: 32px; padding: 0;
    display: grid; place-items: center; border: 1px solid var(--hairline);
    border-radius: var(--control-radius); background: color-mix(in srgb, var(--paper) 35%, transparent);
  }
  #details-close { right: -12px; }
  #details-expand { right: 28px; }
  #details-expand:hover, #details-close:hover { background: var(--hover); }
  #details-expand .collapse-arrows, #details-expand[aria-expanded="true"] .expand-arrows { display: none; }
  #details-expand[aria-expanded="true"] .collapse-arrows { display: block; }
  #details.file-open > .file-toolbar { margin-right: 96px; }
  #details.file-open .file-context { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (min-width: 1800px) {
    body.details-expanded #details { width: 960px; }
  }
  @media (max-width: 1024px) {
    #details-dock { position: fixed; width: min(var(--details-column), calc(100vw - 24px)); }
    body.details-expanded { min-width: 0; }
    body.details-expanded #details { width: calc(100vw - 24px); }
  }
  @media (max-width: 600px) {
    body.details-expanded #header { grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; padding: 0 8px; }
    body.details-expanded #stats, body.details-expanded #map-controls, body.details-expanded .header-utilities { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #details, body.details-hidden #details { transition: none; }
  }
`
