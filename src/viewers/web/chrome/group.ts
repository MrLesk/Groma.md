import type { EditArchitectureInput, RemoveInput } from '../../../authoring.ts'
import type { ZoneAddress } from '../iso/map.ts'

/** A pressed zone opens this: rename every member, or dissolve the group. */
export function createGroupDialog(
  edit: (input: EditArchitectureInput) => Promise<void>,
  remove: (input: RemoveInput) => Promise<void>,
) {
  const dialog = document.createElement('dialog')
  dialog.id = 'group-dialog'
  dialog.className = 'verb-dialog'
  dialog.innerHTML = '<form><h1></h1>'
    + '<label>Name<input name="title" required></label>'
    + '<p class="error" role="status"></p>'
    + '<div class="actions"><button type="button" data-cancel>Cancel</button><button type="button" data-dissolve>Dissolve</button><button type="submit">Rename</button></div></form>'
  document.body.append(dialog)

  const form = dialog.querySelector('form')!
  const heading = form.querySelector('h1')!
  const title = form.elements.namedItem('title') as HTMLInputElement
  const error = form.querySelector<HTMLElement>('.error')!
  let group: ZoneAddress | undefined

  const attempt = async (write: () => Promise<void>): Promise<void> => {
    error.textContent = ''
    try {
      await write()
      dialog.close()
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : String(cause)
    }
  }
  form.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
  form.querySelector('[data-dissolve]')!.addEventListener('click', () => {
    if (group !== undefined) void attempt(() => remove({ id: group!.address }))
  })
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (group !== undefined) void attempt(() => edit({ id: group!.address, title: title.value }))
  })

  return {
    open(next: ZoneAddress): void {
      group = next
      heading.textContent = `Group ${next.name}`
      title.value = next.name
      error.textContent = ''
      dialog.showModal()
      title.select()
    },
  }
}
