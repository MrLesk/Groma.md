import type { PaneVisibility } from '../layout.ts'
import type { TerminalLevel, WorkItem, WorkSnapshot } from '../../../types.ts'
import { touchedElements, type WorkStage } from '../../../work/pins.ts'
import { toggleWorkStatus, workStatusFilters } from '../../../work/status-filter.ts'
import type { TerminalViewModel } from '../model.ts'
import { visibleEndpointFor, type TerminalProjection } from '../projection.ts'

export interface WorkPresentationSnapshot {
  panes: PaneVisibility
  detailsScroll: number
  actionCursor?: string
}

export type WorkSelection =
  | { state: 'waiting' }
  | { state: 'selected'; taskId: string }
  | { state: 'status'; status: string }
  | { state: 'cleared' }

export interface WorkListSettings {
  /** List expansion is independent of which statuses show on the map. */
  expanded?: string[]
  shown: string[]
}

export interface WorkFocus extends WorkListSettings {
  selection: WorkSelection
  before: WorkPresentationSnapshot
}

/** One line of the Work focus list: a status header, a toggle when a task of that status touches an element, or a task. */
export type WorkRow =
  | { kind: 'status'; status: string; count: number; toggle: boolean; expanded: boolean }
  | { kind: 'task'; item: WorkItem }

export interface WorkGroup {
  status: string
  items: WorkItem[]
}

/** The corner of a touched element: the task naming it and how many other shown tasks touch it. */
export interface WorkCorner {
  elementId: string
  taskId: string
  others: number
  stage: WorkStage
  selected: boolean
}

export interface WorkMap {
  corners: WorkCorner[]
  touched: Set<string>
}

export interface WorkView {
  level: TerminalLevel
  currentId: string
  attentionIds: string[]
}

const itemsOf = (work: WorkSnapshot | undefined): WorkItem[] => work?.items ?? []

export function workGroups(work: WorkSnapshot | undefined): WorkGroup[] {
  const items = itemsOf(work)
  if (items.length === 0) return []
  const configured = work?.statuses ?? []
  const terminal = configured.at(-1)
  const active = configured.filter(status => status !== work?.defaultStatus && status !== terminal)
  const order = [work?.defaultStatus, ...active, terminal].filter((status): status is string => {
    return status !== undefined && items.some(item => item.status === status)
  })
  for (const item of items) {
    if (!order.includes(item.status)) order.push(item.status)
  }
  return order.map(status => ({
    status,
    items: items.filter(item => item.status === status),
  }))
}

export function selectedWorkItem(
  work: WorkSnapshot | undefined,
  focus: WorkFocus | undefined,
): WorkItem | undefined {
  const taskId = selectedWorkId(focus)
  return taskId === undefined ? undefined : itemsOf(work).find(item => item.id === taskId)
}

export function selectedWorkId(focus: WorkFocus | undefined): string | undefined {
  return focus?.selection.state === 'selected' ? focus.selection.taskId : undefined
}

/** The statuses with a task that touches an element: the ones worth a toggle. */
export function mappedStatuses(model: TerminalViewModel): string[] {
  const mapped = new Set(itemsOf(model.work).filter(item => touchedElements(item, model).length > 0).map(item => item.status))
  return (model.work?.statuses ?? []).filter(status => mapped.has(status))
}

/** The statuses whose tasks show: the focus's choice, or at first every configured status but the default and final ones. */
export function shownStatuses(model: TerminalViewModel, focus: WorkListSettings | undefined): string[] {
  const work = model.work
  if (work === undefined) return []
  return focus?.shown ?? workStatusFilters(work.statuses, work.defaultStatus, []).enabled
}

export function initialWorkFocus(
  work: WorkSnapshot | undefined,
  before: WorkPresentationSnapshot,
  settings?: WorkListSettings,
): WorkFocus {
  const defaults = work === undefined ? [] : workStatusFilters(work.statuses, work.defaultStatus, []).enabled
  const expanded = settings?.expanded ?? defaults
  const groups = workGroups(work)
  const taskId = groups.filter(group => expanded.includes(group.status)).flatMap(group => group.items)[0]?.id
  return {
    selection: taskId !== undefined ? { state: 'selected', taskId } : groups[0] === undefined ? { state: 'waiting' } : { state: 'status', status: groups[0].status },
    before,
    expanded,
    shown: settings?.shown ?? defaults,
  }
}

/** The Work focus list: each status with its count and, when it is a toggle, then its tasks. */
export function workRows(model: TerminalViewModel, settings?: WorkListSettings, elementId?: string): WorkRow[] {
  const toggles = new Set(mappedStatuses(model))
  const expanded = settings?.expanded ?? shownStatuses(model, undefined)
  const work = model.work === undefined ? undefined : { ...model.work, items: model.work.items.filter(item => elementId === undefined || touchedElements(item, model).includes(elementId)) }
  return workGroups(work).flatMap(group => {
    const open = expanded.includes(group.status)
    return [
      { kind: 'status' as const, status: group.status, count: group.items.length, toggle: toggles.has(group.status), expanded: open },
      ...(open ? group.items.map(item => ({ kind: 'task' as const, item })) : []),
    ]
  })
}

export const workRowId = (row: WorkRow): string => row.kind === 'task' ? row.item.id : `status:${row.status}`

export function workRowSelection(row: WorkRow): WorkSelection {
  return row.kind === 'task' ? { state: 'selected', taskId: row.item.id } : { state: 'status', status: row.status }
}

/** Folding a task's parent returns the cursor to that header. */
export function foldWorkStatus(model: TerminalViewModel, focus: WorkFocus, status: string, open: boolean): WorkFocus {
  const expanded = new Set(focus.expanded ?? shownStatuses(model, undefined))
  if (open) expanded.add(status)
  else expanded.delete(status)
  const selected = selectedWorkItem(model.work, focus)
  return { ...focus, expanded: [...expanded], selection: !open && selected?.status === status ? { state: 'status', status } : focus.selection }
}

function rowIndex(rows: readonly WorkRow[], selection: WorkSelection): number {
  return rows.findIndex(row => selection.state === 'selected'
    ? row.kind === 'task' && row.item.id === selection.taskId
    : selection.state === 'status' && row.kind === 'status' && row.status === selection.status)
}

/** Up and Down walk the list, statuses and tasks alike. */
export function moveWorkFocus(model: TerminalViewModel, focus: WorkFocus, step: -1 | 1, elementId?: string): WorkFocus {
  const rows = workRows(model, focus, elementId)
  if (rows.length === 0) return { ...focus, selection: { state: 'cleared' } }
  const current = rowIndex(rows, focus.selection)
  const row = rows[current < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, current + step))]!
  return { ...focus, selection: workRowSelection(row) }
}

/** Shows or hides one status's tasks on the map, in the corners and in the recap marks. */
export function toggleShownStatus(focus: WorkFocus, status: string): WorkFocus {
  return { ...focus, shown: toggleWorkStatus({ available: [], enabled: focus.shown }, status).enabled }
}

export function reconcileWorkFocus(
  work: WorkSnapshot | undefined,
  focus: WorkFocus | undefined,
): WorkFocus | undefined {
  if (focus === undefined) return undefined
  if (focus.selection.state === 'cleared' || focus.selection.state === 'status') return focus
  const task = selectedWorkItem(work, focus)
  if (focus.selection.state === 'selected') {
    return task === undefined ? { ...focus, selection: { state: 'cleared' } } : focus
  }
  return initialWorkFocus(work, focus.before)
}

/** The smallest terminal scope that can show every touched element for one task. */
export function workView(
  model: TerminalViewModel,
  focus: WorkFocus | undefined,
): WorkView | undefined {
  const task = selectedWorkItem(model.work, focus)
  if (task === undefined) return undefined
  const attentionIds = touchedElements(task, model)
  if (attentionIds.length === 0) return undefined
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  const containerOf = (id: string): string | undefined => {
    let element = elements.get(id)
    while (element !== undefined && element.kind !== 'container') {
      element = element.parent === null ? undefined : elements.get(element.parent)
    }
    return element?.representationId
  }
  const containers = attentionIds.map(containerOf)
  const container = containers[0]
  const level = container !== undefined && containers.every(id => id === container)
    ? 'components'
    : 'context'
  return { level, currentId: attentionIds[0]!, attentionIds }
}

/** Every visible element's corner and the elements the selected task touches, counting only the shown statuses. */
export function projectWork(
  model: TerminalViewModel,
  projection: TerminalProjection,
  focus: WorkFocus | undefined,
  settings?: WorkListSettings,
): WorkMap {
  const visible = new Map(projection.items.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  const visibleIds = (item: WorkItem): Set<string> => new Set(touchedElements(item, model)
    .map(id => visibleEndpointFor(id, visible, elements, undefined)?.representationId)
    .filter((id): id is string => id !== undefined))
  const selected = selectedWorkItem(model.work, focus)
  const touched = selected === undefined ? new Set<string>() : visibleIds(selected)
  const shown = new Set(shownStatuses(model, focus ?? settings))
  const terminal = model.work?.statuses.at(-1)
  const stageOf = (item: WorkItem): WorkStage => item.status === model.work?.defaultStatus ? 'todo' : item.status === terminal ? 'done' : 'progress'
  const byElement = new Map<string, WorkItem[]>()
  for (const item of workGroups(model.work).flatMap(group => group.items).filter(item => shown.has(item.status))) {
    for (const elementId of visibleIds(item)) byElement.set(elementId, [...(byElement.get(elementId) ?? []), item])
  }
  const corners = [...byElement].map(([elementId, items]) => {
    const current = items.find(item => item.id === selected?.id) ?? items[0]!
    return { elementId, taskId: current.id, others: items.length - 1, stage: stageOf(current), selected: current.id === selected?.id }
  })
  return { corners, touched }
}
