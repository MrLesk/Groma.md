import { heading, paragraph } from '../atoms/text.ts'
import type { EditArchitectureInput } from '../../../authoring.ts'
import { message } from './editable.ts'

/** What the edit verb changes from the pane; the id is the selected element's. */
export type MeaningEdit = Pick<EditArchitectureInput, 'title' | 'description' | 'overview' | 'technology' | 'parent'>

export interface ParentOption {
  id: string
  title: string
}

export interface SelectionWrites {
  members: { id: string; title: string }[]
  onGroup: (name: string) => Promise<void>
  onCombine: (survivor: string) => Promise<void>
}

/** The write hooks an element pane gets on the current revision of a live map. */
export interface PaneWrites {
  onRead?: () => void
  onRemove?: () => Promise<void>
  onAccept?: () => Promise<void>
  onEdit?: (input: MeaningEdit) => Promise<void>
  parents?: readonly ParentOption[]
  /** Present while several components are selected on a live map. */
  selection?: SelectionWrites
}

/** The write hooks a relationship pane gets on the current revision of a live map. */
export interface RelationWrites {
  onRead?: () => void
  onAccept?: () => Promise<void>
  onEdit?: (input: { description?: string; technology?: string }) => Promise<void>
  onRemove?: () => Promise<void>
}

/** A matched ghost becomes stable through the same accept input as the CLI. */
export function paintAcceptControl(body: Element, accept: () => Promise<void>): void {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'accept'
  button.textContent = 'Accept'
  const error = paragraph('error', '')
  error.setAttribute('role', 'status')
  button.addEventListener('click', async () => {
    error.textContent = ''
    button.disabled = true
    try {
      await accept()
    } catch (cause) {
      error.textContent = message(cause)
      button.disabled = false
    }
  })
  const box = document.createElement('div')
  box.className = 'selection-writes accept'
  box.append(button, error)
  body.append(box)
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
