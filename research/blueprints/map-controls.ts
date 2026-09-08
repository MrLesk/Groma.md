import type { studyMap } from './view.ts'
import type { MapView } from './map-projection.ts'

const icon = (body: string): string => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${body}</svg>`
const entries: { value: MapView; label: string; title: string; mark: string }[] = [
  { value: 'iso', label: 'Iso', title: 'Isometric', mark: icon('<path d="m10 2 7 4v8l-7 4-7-4V6Zm0 8 7-4M3 6l7 4v8"/>') },
  { value: '2d', label: '2D', title: '2D plan', mark: icon('<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 8h14M8 8v9"/>') },
  { value: 'layers', label: 'Layers', title: 'Layers (F2)', mark: icon('<path d="m10 2 8 4-8 4-8-4Zm-8 8 8 4 8-4M2 14l8 4 8-4"/>') },
]

export function installMapControls(host: HTMLElement, map: ReturnType<typeof studyMap>): void {
  host.innerHTML = `<fieldset class="view-options"><legend class="visually-hidden">Map view</legend>${entries.map(entry =>
    `<label title="${entry.title}"><input type="radio" name="map-view" value="${entry.value}" aria-label="${entry.title}"><span>${entry.mark}${entry.label}</span></label>`,
  ).join('')}</fieldset><div class="map-navigation" role="group" aria-label="Map navigation"><button type="button" data-nav="out" aria-label="Zoom out">−</button><button type="button" data-nav="fit">Fit</button><button type="button" data-nav="in" aria-label="Zoom in">+</button></div>
  <div class="orbit-navigation" role="group" aria-label="Orbit layers" hidden><button type="button" data-orbit="left" aria-label="Rotate layers left">↶</button><button type="button" data-orbit="right" aria-label="Rotate layers right">↷</button></div>`
  function refresh(): void {
    const { view } = map.snapshot()
    for (const input of host.querySelectorAll<HTMLInputElement>('input')) input.checked = input.value === view
    host.querySelector<HTMLElement>('.orbit-navigation')!.hidden = view !== 'layers'
  }
  host.addEventListener('change', event => {
    const input = event.target as HTMLInputElement
    if (input.name !== 'map-view') return
    map.choose(input.value as MapView)
    refresh()
  })
  host.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button')
    const action = button?.dataset.nav
    if (action === 'fit') map.fit()
    if (action === 'in' || action === 'out') map.zoom(action === 'in' ? 1.25 : 0.8)
    if (button?.dataset.orbit) map.rotate(button.dataset.orbit === 'left' ? -80 : 80, 0)
  })
  document.addEventListener('keydown', event => {
    if (event.key !== 'F2' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
    const target = event.target as Element
    if (document.querySelector('dialog[open]') || target.closest('textarea, select, [contenteditable], input:not([name="map-view"])')) return
    event.preventDefault()
    map.toggleLayers()
    refresh()
  })
  refresh()
}
