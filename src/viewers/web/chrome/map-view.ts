import type { MapView } from '../iso/view-motion/presentation.ts'

const views: { value: MapView; label: string; title: string; icon: string }[] = [
  { value: 'iso', label: 'Iso', title: 'Isometric', icon: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5m-9 5v8M12 3v10"/>' },
  { value: '2d', label: '2D', title: '2D overhead', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 11h16m-9 0v9"/>' },
  { value: 'layers', label: 'Layers', title: 'Layers (F2)', icon: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>' },
]

export function mapViewControl(): string {
  return `<div id="map-view" class="floating-map-bar" role="tablist" aria-label="Map view"><span class="view-indicator" aria-hidden="true"></span>${views.map(view =>
    `<button type="button" role="tab" data-view="${view.value}" title="${view.title}" aria-label="${view.title}" aria-controls="map" aria-selected="${view.value === 'iso'}" tabindex="${view.value === 'iso' ? 0 : -1}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${view.icon}</svg><span>${view.label}</span></button>`,
  ).join('')}</div>`
}

/** Clicks and arrow keys use the same presentation action as F2. */
export function bindMapView(host: HTMLElement, choose: (view: MapView) => void): (view: MapView) => void {
  const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const indicator = host.querySelector<HTMLElement>('.view-indicator')!
  let selectedView: MapView | undefined
  function placeIndicator() {
    const tab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')!
    if (!tab.offsetWidth) return
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`
    indicator.style.width = `${tab.offsetWidth}px`
  }
  new ResizeObserver(placeIndicator).observe(host)
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => choose(tab.dataset.view as MapView))
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key]
      if (next === undefined) return
      event.preventDefault()
      event.stopPropagation()
      tabs[next]!.focus()
      tabs[next]!.click()
    })
  }
  return view => {
    if (view === selectedView) return
    selectedView = view
    for (const tab of tabs) {
      const selected = tab.dataset.view === view
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
    }
    placeIndicator()
  }
}

export const mapViewCss = `
  #map-view {
    position: absolute; top: 74px; z-index: 7; width: fit-content; margin: 0 auto; padding: 5px; gap: 2px;
  }
  #map-view .view-indicator {
    position: absolute; left: 0; top: 5px; height: 34px; border-radius: 20px; background: var(--ink); pointer-events: none;
    box-shadow: 0 1px 4px #0002; transition: transform 340ms cubic-bezier(.22, 1, .36, 1), width 340ms cubic-bezier(.22, 1, .36, 1);
  }
  #map-view button { position: relative; z-index: 1; transition: color 180ms ease; display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 0; border-radius: 20px; color: var(--muted); }
  #map-view svg { width: 16px; height: 16px; flex: none; }
  #map-view button:hover { color: var(--ink); }
  #map-view [aria-selected="true"], #map-view [aria-selected="true"]:hover { color: var(--paper); }
  @media (prefers-reduced-motion: reduce) {
    #map-view .view-indicator, #map-view button { transition: none; }
  }
`
