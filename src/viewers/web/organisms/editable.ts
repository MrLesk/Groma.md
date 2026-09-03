export const editableCss = `
  #details .editable { display: grid; gap: 4px; margin: 0 0 10px; }
  #details h1 .editable { margin: 0; }
  #details .editable-text {
    margin: 0 -4px; border: 0; border-radius: 4px; padding: 0 4px;
    text-align: left; color: inherit; background: transparent; font: inherit; line-height: inherit; cursor: text;
  }
  #details .editable-text:hover, #details .editable-text:focus-visible { background: var(--hover); outline: 0; }
  #details .editable-text:empty::before { content: attr(data-label); color: var(--muted); }
  #details .editable input, #details .editable textarea, #details .editable select {
    width: 100%; border: 1px solid var(--hairline); border-radius: 4px; padding: 4px 6px;
    color: var(--ink); background: color-mix(in srgb, var(--paper) 72%, transparent); font: inherit; line-height: inherit; resize: none;
  }
  #details .editable textarea { min-height: 120px; }
  #details .editable input:focus, #details .editable textarea:focus, #details .editable select:focus { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #details .editable .error { margin: 0; color: var(--highlight-text); font-size: 11px; }
  #details .editable .error:empty { display: none; }
`

export interface EditableField {
  className: string
  /** Shown in place of an empty value and as the input's accessible name. */
  label: string
  value: string
  multiline?: boolean
  save: (value: string) => Promise<void>
}

export function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/** Text that becomes its own input on click: Enter (with Cmd or Ctrl in a multiline field) or leaving saves, Escape cancels, a refusal shows under the field. */
export function paintEditable(host: Element, field: EditableField): void {
  const box = document.createElement('div')
  box.className = `editable ${field.className}`
  const text = document.createElement('button')
  text.type = 'button'
  text.className = 'editable-text'
  text.textContent = field.value
  text.dataset.label = field.label
  text.setAttribute('aria-label', `Edit ${field.label.toLowerCase()}`)
  const error = document.createElement('p')
  error.className = 'error'
  error.setAttribute('role', 'status')
  box.append(text, error)
  host.append(box)

  text.addEventListener('click', () => {
    const input: HTMLInputElement | HTMLTextAreaElement = field.multiline
      ? document.createElement('textarea')
      : document.createElement('input')
    input.value = field.value
    input.setAttribute('aria-label', field.label)
    let settled = false
    const cancel = (): void => {
      settled = true
      input.replaceWith(text)
      text.focus()
    }
    const submit = async (): Promise<void> => {
      if (settled) return
      if (input.value === field.value) {
        cancel()
        return
      }
      settled = true
      input.disabled = true
      error.textContent = ''
      try {
        await field.save(input.value)
      } catch (cause) {
        error.textContent = message(cause)
        settled = false
        input.disabled = false
        input.focus()
      }
    }
    input.addEventListener('keydown', event => {
      const key = event as KeyboardEvent
      if (key.key === 'Escape') {
        key.preventDefault()
        cancel()
      } else if (key.key === 'Enter' && (!field.multiline || key.metaKey || key.ctrlKey)) {
        key.preventDefault()
        void submit()
      }
    })
    input.addEventListener('blur', () => void submit())
    text.replaceWith(input)
    input.focus()
    if (!field.multiline) input.select()
  })
}
