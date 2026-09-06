import type { ArchitectureFlow, ArchitectureGraph } from '../../../types.ts'
import { paragraph } from '../atoms/text.ts'
import { chromeButton } from '../atoms/button.ts'
import type { FlowRef } from '../../flows.ts'
import type { WebFlowRef } from './state.ts'

function button(label: string, action: () => void): HTMLButtonElement {
  const control = document.createElement('button')
  control.type = 'button'
  control.className = 'link'
  control.textContent = label
  control.addEventListener('click', action)
  return control
}

function stepControl(label: string, action: () => void): HTMLButtonElement {
  const control = chromeButton(label)
  control.addEventListener('click', action)
  return control
}

export function paintFlowDetails(
  host: HTMLElement,
  flow: ArchitectureFlow,
  active: FlowRef,
  world: ArchitectureGraph,
  onStep: (step: number | undefined) => void,
  onInspect: (id: string) => void,
): void {
  host.querySelector('h1')!.textContent = flow.title
  host.querySelector('.meta')!.textContent = 'Flow'
  host.querySelector('.tabs')!.replaceChildren()
  const body = host.querySelector('.body')!
  body.replaceChildren()
  if (flow.description) body.append(paragraph('description', flow.description))
  for (const prose of flow.overview.split('\n\n')) body.append(paragraph('overview', prose))
  const controls = document.createElement('div')
  controls.className = 'flow-controls'
  const previous = stepControl('Previous', () => onStep(Math.max(0, (active.step ?? 1) - 1)))
  previous.disabled = active.step === undefined || active.step === 0
  const next = stepControl('Next', () => onStep((active.step ?? -1) + 1))
  next.disabled = active.step === flow.steps.length - 1
  const clear = stepControl('Clear focus', () => onStep(undefined))
  clear.disabled = active.step === undefined
  controls.append(previous, next, clear)
  body.append(controls)
  const names = new Map(world.elements.map(element => [element.id, element.title]))
  const list = document.createElement('ol')
  flow.steps.forEach((step, index) => {
    const row = document.createElement('li')
    row.className = 'flow-step'
    row.classList.toggle('active', active.step === index)
    const action = button(step.action, () => onStep(index))
    action.setAttribute('aria-current', active.step === index ? 'step' : 'false')
    const ends = document.createElement('div')
    ends.className = 'flow-ends'
    ends.append(button(names.get(step.source) ?? step.source, () => onInspect(step.source)), '→',
      button(names.get(step.target) ?? step.target, () => onInspect(step.target)))
    row.append(action, ends)
    list.append(row)
  })
  body.append(list)
}

/** The reader returns to its origin; endpoint inspection returns to the same flow. */
export function paintFlowReturn(
  host: HTMLElement, active: WebFlowRef | undefined, readingFlow: boolean,
  world: ArchitectureGraph, onSelect: (id: string) => void, onBack: () => void,
): void {
  host.querySelector('.flow-back')?.remove()
  if (active === undefined) return
  const origin = world.elements.find(element => element.representationId === active.returnTo)
  if (readingFlow && origin === undefined) return
  const back = chromeButton(readingFlow ? `Back to ${origin!.title}` : 'Back to flow', { glyph: '←' })
  back.addEventListener('click', readingFlow ? () => onSelect(origin!.representationId) : onBack)
  back.classList.add('flow-back')
  host.querySelector('.meta')!.before(back)
}
