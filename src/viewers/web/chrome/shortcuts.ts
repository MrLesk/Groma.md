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
const mapKeys: Record<string, keyof ShortcutActions> = {
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  '_': 'zoomOut',
  '0': 'fit',
  Escape: 'deselect',
}

/** The action for `key`: the chrome toggles work everywhere, while a text field keeps the map keys for typing. */
export function shortcut(key: string, typing: boolean): keyof ShortcutActions | undefined {
  return toggles[key] ?? (typing ? undefined : mapKeys[key])
}

/** Radio buttons and checkboxes are controls, not text fields. */
function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && !target.closest('input[type="radio"], input[type="checkbox"]')
    && target.closest('input, textarea, [contenteditable]') !== null
}

/** The page's keyboard: F1 to F3 toggle chrome, the map keys move the map; browser chords stay with the browser. */
export function bindShortcuts(actions: ShortcutActions): void {
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const name = shortcut(event.key, isTextField(event.target))
    if (name === undefined) return
    event.preventDefault()
    actions[name]()
  })
}
