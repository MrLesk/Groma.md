import { heading, paragraph } from '../atoms/text.ts'
import type { EditArchitectureInput } from '../../../authoring.ts'
import { message, paintEditable } from './editable.ts'

/** What the edit verb changes from the pane; the id is the selected element's. */
export type MeaningEdit = Pick<EditArchitectureInput, 'title' | 'description' | 'overview' | 'technology' | 'draft'>

export interface SelectionWrites {
  members: { id: string; title: string }[]
  onGroup: (name: string) => Promise<void>
  onCombine: (survivor: string) => Promise<void>
}

export interface RelateControl {
  /** True while the map waits for the target of a relation from the selected element. */
  armed: boolean
  toggle: () => void
}

/** The write hooks an element pane gets on the current revision of a live map. */
export interface PaneWrites {
  onRemove?: () => Promise<void>
  onEdit?: (input: MeaningEdit) => Promise<void>
  drafts?: readonly string[]
  relate?: RelateControl
  /** Present while several components are selected on a live map. */
  selection?: SelectionWrites
}

/** The write hooks a relationship pane gets on the current revision of a live map. */
export interface RelationWrites {
  onEdit?: (input: { description?: string; technology?: string }) => Promise<void>
  onRemove?: () => Promise<void>
}

/** What the meaning controls paint and edit. */
export interface Meaning {
  description: string
  overview: string
  technology: string[]
  draft?: string
}

/** Description and overview: read-only prose, or fields that save in place. */
export function paintMeaning(body: Element, inspected: Meaning, onEdit: PaneWrites['onEdit']): void {
  if (onEdit === undefined) {
    if (inspected.description !== '') body.append(paragraph('description', inspected.description))
    if (inspected.overview !== '') body.append(paragraph('overview', inspected.overview))
    return
  }
  paintEditable(body, {
    className: 'description', label: 'Description', value: inspected.description,
    save: description => onEdit({ description }),
  })
  paintEditable(body, {
    className: 'overview', label: 'Overview', value: inspected.overview, multiline: true,
    save: overview => onEdit({ overview }),
  })
  // Technology is edited here because the How tab, where its chips are read, exists only once an element has technology or files.
  body.append(heading('Technology'))
  paintEditable(body, {
    className: 'technology', label: 'Technology', value: inspected.technology.join(', '),
    save: technology => onEdit({ technology }),
  })
}

/** The draft records to tag the element with; a tag never comes off from here, as the CLI has no flag for it. */
export function paintDraftSelect(body: Element, inspected: Meaning, drafts: readonly string[], onEdit: (input: MeaningEdit) => Promise<void>): void {
  if (drafts.length === 0) return
  body.append(heading('Draft'))
  const select = document.createElement('select')
  select.className = 'draft'
  select.setAttribute('aria-label', 'Draft')
  const none = document.createElement('option')
  none.value = ''
  none.textContent = 'None'
  none.disabled = inspected.draft !== undefined
  select.append(none)
  for (const draft of drafts) {
    const option = document.createElement('option')
    option.value = draft
    option.textContent = draft
    select.append(option)
  }
  select.value = inspected.draft ?? ''
  const error = paragraph('error', '')
  error.setAttribute('role', 'status')
  select.addEventListener('change', async () => {
    error.textContent = ''
    select.disabled = true
    try {
      await onEdit({ draft: select.value })
    } catch (cause) {
      error.textContent = message(cause)
      select.disabled = false
    }
  })
  const box = document.createElement('div')
  box.className = 'editable draft'
  box.append(select, error)
  body.append(box)
}

/** Relate to arms the map; while armed the button says what the next click does and a second click cancels. */
export function paintRelateControl(body: Element, relate: RelateControl): void {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'relate'
  button.textContent = relate.armed ? 'Click the target' : 'Relate to'
  button.setAttribute('aria-pressed', String(relate.armed))
  button.addEventListener('click', relate.toggle)
  body.append(button)
}

/** Several selected components: name them as one group, or fold them into the survivor the person picks. */
export function paintSelectionControls(body: Element, selection: SelectionWrites): void {
  body.append(heading(`${selection.members.length} selected`))
  const box = document.createElement('div')
  box.className = 'selection-writes'
  const group = document.createElement('form')
  group.className = 'group-as'
  const name = document.createElement('input')
  name.name = 'name'
  name.required = true
  name.setAttribute('aria-label', 'Group name')
  const groupButton = document.createElement('button')
  groupButton.type = 'submit'
  groupButton.textContent = 'Group as'
  group.append(name, groupButton)
  const combine = document.createElement('form')
  combine.className = 'combine-into'
  const survivor = document.createElement('select')
  survivor.setAttribute('aria-label', 'Survivor')
  for (const member of selection.members) {
    const option = document.createElement('option')
    option.value = member.id
    option.textContent = member.title
    survivor.append(option)
  }
  const combineButton = document.createElement('button')
  combineButton.type = 'submit'
  combineButton.textContent = 'Combine into'
  combine.append(survivor, combineButton)
  const error = paragraph('error', '')
  error.setAttribute('role', 'status')
  const submit = (form: HTMLFormElement, write: () => Promise<void>): void => {
    form.addEventListener('submit', async event => {
      event.preventDefault()
      error.textContent = ''
      try {
        await write()
      } catch (cause) {
        error.textContent = message(cause)
      }
    })
  }
  submit(group, () => selection.onGroup(name.value))
  submit(combine, () => selection.onCombine(survivor.value))
  box.append(group, combine, error)
  body.append(box)
}
