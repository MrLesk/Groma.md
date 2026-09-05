import type { DraftInput } from '../../../authoring.ts'

export interface RelateDialogEnds {
  source: string
  target: string
  sourceTitle: string
  targetTitle: string
}

/** The sentence of a new relation: how the source uses the target, and through what. */
export function createRelateDialog(add: (input: DraftInput) => Promise<void>) {
  const dialog = document.createElement('dialog')
  dialog.id = 'relate-dialog'
  dialog.className = 'verb-dialog'
  dialog.innerHTML = '<form><h1></h1>'
    + '<label>Description<input name="description" required></label>'
    + '<label>Technology<input name="technology" required></label>'
    + '<p class="error" role="status"></p>'
    + '<div class="actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save draft</button></div></form>'
  document.body.append(dialog)

  const form = dialog.querySelector('form')!
  const heading = form.querySelector('h1')!
  const description = form.elements.namedItem('description') as HTMLInputElement
  const technology = form.elements.namedItem('technology') as HTMLInputElement
  const error = form.querySelector<HTMLElement>('.error')!
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
  let ends: RelateDialogEnds | undefined

  form.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (ends === undefined) return
    submit.disabled = true
    error.textContent = ''
    try {
      await add({
        kind: 'relation',
        name: ends.source,
        relation: ends.target,
        description: description.value,
        technology: technology.value,
      })
      dialog.close()
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    } finally {
      submit.disabled = false
    }
  })

  return {
    close: () => dialog.close(),
    open(next: RelateDialogEnds): void {
      ends = next
      heading.textContent = `Draft relationship: ${next.sourceTitle} to ${next.targetTitle}`
      form.reset()
      error.textContent = ''
      dialog.showModal()
      description.focus()
    },
  }
}
