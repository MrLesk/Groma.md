import { keyAction, keyTarget } from '../iso/camera.ts'

export interface ShortcutActions {
  hud(): void
  layers(): void
  debug(): void
  zoomIn(): void
  zoomOut(): void
  fit(): void
  deselect(): void
}

const toggles: Record<string, keyof ShortcutActions> = { F1: 'hud', F2: 'layers', F3: 'debug' }
const cameraActions: Record<string, keyof ShortcutActions> = {
  in: 'zoomIn',
  out: 'zoomOut',
  fit: 'fit',
  deselect: 'deselect',
}

/** The page's keyboard: F1 to F3 toggle chrome, the camera keys move the map; browser chords stay with the browser. */
export function bindShortcuts(actions: ShortcutActions): void {
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const toggle = toggles[event.key]
    const camera = toggle === undefined ? keyAction(event.key, keyTarget(event.target)) : undefined
    const name = toggle ?? (camera === undefined ? undefined : cameraActions[camera])
    if (name === undefined) return
    event.preventDefault()
    actions[name]()
  })
}
