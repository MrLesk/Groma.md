import { ownsDetails } from '../selection.ts'
import type { Selection } from '../selection.ts'

export interface WebShell {
  paint(selection: Selection): void
}

/** Owns the two shell transitions; selection remains the only authority for inspector visibility. */
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
