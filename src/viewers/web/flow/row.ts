import type { FlowRef } from '../../action-path.ts'
import { sameFlow } from './state.ts'

export interface FlowRowData {
  flow: FlowRef
  title: string
}

export const flowRowCss = `
  .flow-row {
    display: grid;
    grid-template-columns: 14px minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 30px;
    padding: 5px 14px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .flow-row:hover { background: var(--hover); }
  .flow-check {
    display: grid;
    width: 12px;
    height: 12px;
    place-items: center;
    border: 1px solid var(--muted);
    font-size: 9px;
    line-height: 1;
  }
  .flow-row.active .flow-check { border-color: var(--highlight); background: var(--highlight); color: var(--on-colour); }
  .flow-row .name { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .flow-scope { color: var(--muted); font-size: 8px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
  #details .flow-list .flow-row { padding: 7px 0; }
  #details .flow-list .flow-row + .flow-row { border-top: 1px solid var(--hairline); }
`

/** An actor-scoped row is exact; a general row represents the command's current scope. */
export function flowRowState(
  flow: FlowRef,
  active: readonly FlowRef[],
): { active: boolean; toggleTarget: FlowRef } {
  const scoped = flow.actorId !== undefined
  const activeFlow = scoped
    ? active.find(item => sameFlow(item, flow))
    : active.find(item => item.commandId === flow.commandId)
  return {
    active: activeFlow !== undefined,
    toggleTarget: scoped ? flow : activeFlow ?? flow,
  }
}

/** One flow control shared by the hierarchy and contextual details lists. */
export function flowRow(
  row: FlowRowData,
  active: readonly FlowRef[],
  actorName: (actorId: string) => string | undefined,
  onToggle: (flow: FlowRef) => void,
): HTMLButtonElement {
  const state = flowRowState(row.flow, active)
  const shownFlow = state.toggleTarget
  const scope = shownFlow.actorId === undefined
    ? 'Global'
    : `From ${actorName(shownFlow.actorId) ?? shownFlow.actorId}`

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'flow-row'
  button.setAttribute('aria-pressed', String(state.active))
  button.setAttribute('aria-label', `${row.title} · ${scope}`)
  button.title = `${row.title} · ${scope}`
  if (state.active) button.classList.add('active')

  const check = document.createElement('span')
  check.className = 'flow-check'
  check.setAttribute('aria-hidden', 'true')
  check.textContent = state.active ? '✓' : ''
  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = row.title
  const scopeLabel = document.createElement('span')
  scopeLabel.className = 'flow-scope'
  scopeLabel.textContent = scope

  button.append(check, name, scopeLabel)
  button.addEventListener('click', () => onToggle(state.toggleTarget))
  return button
}
