import type { AddInput } from '../../../add.ts'

export const addDialogCss = `
  #add {
    display: grid; flex: none; place-items: center; width: 28px; height: 28px; margin-right: 6px;
    border: 1px solid var(--hairline); border-radius: var(--control-radius);
    background: color-mix(in srgb, var(--paper) 35%, transparent); color: var(--muted); font-size: 16px; line-height: 1;
  }
  #add:hover { color: var(--ink); background: var(--hover); }
  body.hierarchy-collapsed #add, body[data-revision] #add { display: none; }
  #add-dialog {
    width: min(420px, calc(100vw - 32px));
    margin: auto;
    padding: 0;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 78%, transparent);
    border: 1px solid color-mix(in srgb, var(--ink) 16%, transparent);
    border-radius: var(--chrome-radius);
    box-shadow: 0 16px 48px color-mix(in srgb, var(--ink) 18%, transparent);
    backdrop-filter: blur(18px);
  }
  #add-dialog::backdrop { background: color-mix(in srgb, var(--ink) 8%, transparent); }
  #add-dialog form { display: grid; gap: 12px; padding: 20px; }
  #add-dialog h1 { margin: 0; font-size: 18px; line-height: 1.3; }
  #add-dialog label { display: grid; gap: 6px; color: var(--muted); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
  #add-dialog label[hidden] { display: none; }
  #add-dialog input, #add-dialog select, #add-dialog textarea {
    width: 100%;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 9px 10px;
    color: var(--ink);
    background: color-mix(in srgb, var(--paper) 72%, transparent);
    font: 12px/1.5 'SF Mono', ui-monospace, Menlo, monospace;
    resize: none;
  }
  #add-dialog textarea { height: 120px; }
  #add-dialog input:focus, #add-dialog select:focus, #add-dialog textarea:focus { outline: 2px solid var(--highlight); outline-offset: -1px; }
  #add-dialog .error { min-height: 1.5em; margin: -6px 0 0; color: var(--highlight-text); font-size: 11px; }
  #add-dialog .error:empty { display: none; }
  #add-dialog .actions { display: flex; justify-content: flex-end; gap: 8px; }
  #add-dialog button { border: 1px solid var(--hairline); border-radius: 6px; padding: 7px 12px; background: transparent; }
  #add-dialog button[type="submit"] { border-color: var(--accent); color: var(--accent-text); }
  #add-dialog button:disabled { opacity: 0.5; cursor: wait; }
`

/** The plus button of the hierarchy pane: one dialog declares a person, an external system, or a draft. */
export function createAddControl(button: HTMLElement, add: (input: AddInput) => Promise<void>): void {
  const dialog = document.createElement('dialog')
  dialog.id = 'add-dialog'
  dialog.innerHTML = '<form><h1>Add</h1>'
    + '<label>What<select name="thing"><option value="actor">Person</option><option value="external">External system</option><option value="draft">Draft</option></select></label>'
    + '<label>Name<input name="name" required></label>'
    + '<label class="technology" hidden>Technology<input name="technology"></label>'
    + '<label>Overview<textarea name="overview" required></textarea></label>'
    + '<p class="error" role="status"></p>'
    + '<div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Add</button></div></form>'
  document.body.append(dialog)

  const form = dialog.querySelector('form')!
  const thing = form.elements.namedItem('thing') as HTMLSelectElement
  const name = form.elements.namedItem('name') as HTMLInputElement
  const technology = form.elements.namedItem('technology') as HTMLInputElement
  const technologyField = form.querySelector<HTMLElement>('.technology')!
  const overview = form.elements.namedItem('overview') as HTMLTextAreaElement
  const error = form.querySelector<HTMLElement>('.error')!
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!

  const showFields = (): void => {
    technologyField.hidden = thing.value !== 'external'
  }
  thing.addEventListener('change', showFields)
  form.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', async event => {
    event.preventDefault()
    submit.disabled = true
    error.textContent = ''
    try {
      await add({
        thing: thing.value,
        name: name.value,
        overview: overview.value,
        ...(thing.value === 'external' && technology.value !== '' ? { technology: technology.value } : {}),
      })
      dialog.close()
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    } finally {
      submit.disabled = false
    }
  })
  button.addEventListener('click', () => {
    form.reset()
    error.textContent = ''
    showFields()
    dialog.showModal()
    name.focus()
  })
}
