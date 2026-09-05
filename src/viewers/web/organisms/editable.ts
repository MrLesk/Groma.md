export const editableCss = `
  #details .edit-entry, #details .edit-form button { border: 1px solid var(--hairline); border-radius: 6px;
    padding: 6px 12px; background: transparent; color: var(--ink); font: inherit; cursor: pointer; }
  #details .edit-entry { margin-bottom: 12px; }
  #details .edit-entry:hover, #details .edit-form button:hover { background: var(--hover); }
  #details .edit-form button:disabled { opacity: 0.5; cursor: default; }
  #details .edit-form { display: grid; gap: 14px; }
  #details .edit-form label { display: grid; gap: 5px; font-size: 12px; }
  #details .edit-form input, #details .edit-form textarea, #details .edit-form select {
    box-sizing: border-box; width: 100%; border: 1px solid var(--hairline); border-radius: 4px; padding: 7px;
    color: var(--ink); background: color-mix(in srgb, var(--paper) 35%, transparent); font: inherit;
  }
  #details .edit-form textarea { min-height: 140px; resize: vertical; }
  #details .edit-form :is(input, textarea, select):focus { outline: 2px solid var(--highlight); }
  #details .edit-form .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  #details .edit-form .error { margin: 0; color: var(--highlight-text); }
  #details .edit-form .error:empty { display: none; }
`

export function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export interface EditField {
  name: string
  label: string
  value: string
  multiline?: boolean
  required?: boolean
  options?: readonly { id: string; title: string }[]
}

/** A repaint of the same selection keeps its unsaved form. Another selection replaces it. */
export function isEditing(host: HTMLElement, key: string): boolean {
  return host.querySelector<HTMLFormElement>('.edit-form')?.dataset.editKey === key
}

/** One explicit edit session. Only Save calls the shared writer; Cancel and Escape leave saved data alone. */
export function editButton(
  host: HTMLElement,
  key: string,
  fields: EditField[],
  save: (changes: Record<string, string>) => Promise<void>,
  read: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Edit'
  button.className = 'edit-entry'
  button.addEventListener('click', () => {
    const form = document.createElement('form')
    form.className = 'edit-form'
    form.dataset.editKey = key
    for (const field of fields) form.append(editField(field))
    const error = document.createElement('p')
    error.className = 'error'
    error.setAttribute('role', 'status')
    const actions = document.createElement('div')
    actions.className = 'actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.textContent = 'Save'
    const close = (): void => { form.remove(); read() }
    cancel.addEventListener('click', close)
    form.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!submit.disabled) close()
    })
    form.addEventListener('submit', async event => {
      event.preventDefault()
      const values = new FormData(form)
      const changes = Object.fromEntries(fields.flatMap(field => {
        const value = String(values.get(field.name) ?? '')
        return value === field.value ? [] : [[field.name, value]]
      }))
      if (Object.keys(changes).length === 0) { close(); return }
      submit.disabled = cancel.disabled = true
      error.textContent = ''
      try { await save(changes); close() }
      catch (cause) { error.textContent = message(cause) }
      finally { submit.disabled = cancel.disabled = false }
    })
    actions.append(cancel, submit)
    form.append(error, actions)
    host.querySelector('.tabs')!.replaceChildren()
    host.querySelector('.body')!.replaceChildren(form)
    form.querySelector<HTMLElement>('input, textarea, select')?.focus()
  })
  return button
}

function editField(field: EditField): HTMLLabelElement {
  const label = document.createElement('label')
  label.textContent = field.label
  const input = field.options !== undefined ? document.createElement('select')
    : field.multiline ? document.createElement('textarea') : document.createElement('input')
  if (input instanceof HTMLSelectElement) {
    for (const option of field.options ?? []) input.add(new Option(option.title, option.id))
  }
  input.name = field.name
  input.value = field.value
  input.required = field.required === true
  label.append(input)
  return label
}
