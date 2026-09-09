import type { MapView } from '../layers/orbit.ts'

const views: { value: MapView; label: string; title: string }[] = [
  { value: 'iso', label: 'Iso', title: 'Isometric' },
  { value: '2d', label: '2D', title: '2D overhead' },
  { value: 'layers', label: 'Layers', title: 'Layers (F2)' },
]

export function mapViewControl(): string {
  return `<fieldset id="map-view"><legend>Map view</legend>${views.map(view =>
    `<label title="${view.title}"><input type="radio" name="map-view" value="${view.value}" aria-label="${view.title}"${view.value === 'iso' ? ' checked' : ''}><span>${view.label}</span></label>`,
  ).join('')}</fieldset>`
}

/** Native radio keys and clicks share the same presentation action as F2. */
export function bindMapView(host: HTMLElement, choose: (view: MapView) => void): (view: MapView) => void {
  const inputs = [...host.querySelectorAll<HTMLInputElement>('input')]
  for (const input of inputs) {
    input.addEventListener('change', () => choose(input.value as MapView))
  }
  return view => {
    for (const input of inputs) input.checked = input.value === view
  }
}

export const mapViewCss = `
  #map-view { display: flex; margin: 0; padding: 0; border: 1px solid var(--hairline); border-radius: var(--control-radius); }
  #map-view legend, #map-view input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  #map-view label { display: flex; position: relative; cursor: pointer; }
  #map-view span { display: grid; place-items: center; min-height: 30px; padding: 0 9px; border-radius: 4px; }
  #map-view label:hover span { background: var(--hover); }
  #map-view input:checked + span { background: var(--ink); color: var(--paper); }
  #map-view input:focus-visible + span { outline: 2px solid var(--highlight); outline-offset: 2px; }
`
