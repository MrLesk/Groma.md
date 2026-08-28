interface ChromeButtonOptions {
  glyph?: string
  ariaLabel?: string
}

/** Creates the platform's compact chrome button with one shared DOM contract. */
export function chromeButton(label: string, options: ChromeButtonOptions = {}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'chrome-button'
  if (options.ariaLabel !== undefined) button.setAttribute('aria-label', options.ariaLabel)
  if (options.glyph !== undefined) {
    const glyph = document.createElement('span')
    glyph.className = 'chrome-button-glyph'
    glyph.setAttribute('aria-hidden', 'true')
    glyph.textContent = options.glyph
    button.append(glyph)
  }
  button.append(label)
  return button
}
