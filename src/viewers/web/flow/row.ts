import type { FlowRef } from '../../flows.ts'

export interface FlowRowData {
  flow: FlowRef
  title: string
}

export const flowRowCss = `
  .flow-row {
    display: flex; align-items: center; gap: 7px; width: 100%;
    min-height: 30px; padding: 5px 14px; border: 0; background: transparent;
    color: inherit; font: inherit; text-align: left;
  }
  .flow-row:hover { background: var(--hover); }
  .flow-check {
    display: grid; width: 12px; height: 12px; flex: 0 0 12px;
    place-items: center; border: 1px solid var(--muted); font-size: 9px; line-height: 1;
  }
  .flow-row.active .flow-check { border-color: var(--highlight); background: color-mix(in srgb, var(--highlight) 85%, transparent); color: var(--on-colour); }
  .flow-row.active .flow-check::after { content: ''; width: 3px; height: 6px; border-right: 1px solid currentColor; border-bottom: 1px solid currentColor; transform: translateY(-1px) rotate(45deg); }
  .flow-row .name { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .flow-step { padding: 8px 0; }
  .flow-step > button { text-align: left; }
  .flow-step.active { color: var(--highlight); }
  .flow-ends { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
  .flow-controls { display: flex; gap: 12px; margin: 12px 0; }
`

export function flowRow(row: FlowRowData, active: FlowRef | undefined, onToggle: (flow: FlowRef) => void): HTMLButtonElement {
  const selected = active?.id === row.flow.id
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'flow-row'
  button.setAttribute('aria-pressed', String(selected))
  button.setAttribute('aria-label', row.title)
  button.title = row.title
  button.classList.toggle('active', selected)
  const check = document.createElement('span')
  check.className = 'flow-check'
  check.setAttribute('aria-hidden', 'true')
  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = row.title
  button.append(check, name)
  button.addEventListener('click', () => onToggle(row.flow))
  return button
}
