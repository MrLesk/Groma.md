import type { WebDataSource } from '../data.ts'
import type { CreationKind } from './intent.ts'

type Creation = { kind: CreationKind; parent?: string; parentTitle?: string } | { kind: 'group'; members: string[] }

/** Creation collects meaning after the gesture has chosen the ownership or members. */
export function createDialog(data: WebDataSource) {
  const dialog = document.createElement('dialog')
  dialog.id = 'create-dialog'
  dialog.className = 'verb-dialog'
  dialog.innerHTML = '<form><h1></h1><label>Name<input name="name" required></label>'
    + '<label data-overview>Overview<textarea name="overview"></textarea></label>'
    + '<p class="error" role="status"></p><div class="actions">'
    + '<button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div></form>'
  document.body.append(dialog)
  const form = dialog.querySelector('form')!
  const name = form.elements.namedItem('name') as HTMLInputElement
  const overview = form.elements.namedItem('overview') as HTMLTextAreaElement
  const error = form.querySelector<HTMLElement>('.error')!
  const submit = form.querySelector<HTMLButtonElement>('[type=submit]')!
  let creation: Creation | undefined
  form.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close())
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (creation === undefined) return
    submit.disabled = true
    error.textContent = ''
    try {
      if (creation.kind === 'group') await data.add!({ thing: 'group', name: name.value, members: creation.members })
      else await data.draft!({ kind: creation.kind, name: name.value, parent: creation.parent, overview: overview.value })
      dialog.close()
    } catch (cause) { error.textContent = cause instanceof Error ? cause.message : String(cause) }
    finally { submit.disabled = false }
  })
  return {
    close: () => dialog.close(),
    open(next: Creation): void {
      creation = next
      form.reset()
      error.textContent = ''
      form.querySelector('h1')!.textContent = next.kind === 'group' ? `Group ${next.members.length} components`
        : `Draft ${next.kind}${next.parentTitle === undefined ? '' : ` in ${next.parentTitle}`}`
      form.querySelector<HTMLElement>('[data-overview]')!.hidden = next.kind === 'group'
      dialog.showModal()
      name.focus()
    },
  }
}
