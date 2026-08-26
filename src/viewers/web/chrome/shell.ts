import { ownsDetails } from '../selection.ts'
import type { Selection } from '../selection.ts'

export interface WebShell {
  paint(selection: Selection): void
  setHud(visible: boolean): void
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
  details: Rect,
  hudVisible: boolean,
): MapFrame {
  if (!hudVisible) return { x: 0, y: 0, width: map.width, height: map.height }
  const x = hierarchy.right - map.left + 12
  const y = header.bottom - map.top + 12
  const right = details.left - map.left - 12
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
      const open = ownsDetails(selection)
      const ownedFocus = details.contains(document.activeElement)
      root.classList.toggle('details-hidden', !open)
      details.toggleAttribute('inert', !open)
      details.setAttribute('aria-hidden', String(!open))
      if (!open && ownedFocus) map.focus({ preventScroll: true })
    },
  }
}
