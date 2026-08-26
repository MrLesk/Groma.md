import type { TerminalLevel, WorkItem, WorkSnapshot } from '../../../types.ts'
import { touchedElements } from '../../../work/pins.ts'
import type { TerminalViewModel } from '../model.ts'
import { visibleEndpointFor, type TerminalProjection } from '../projection.ts'

export interface WorkPresentationSnapshot {
  focus: 'architecture' | 'hierarchy' | 'details'
  details: boolean
  detailsScroll: number
  actionCursor?: string
}

export type WorkSelection =
  | { state: 'waiting' }
  | { state: 'selected'; taskId: string }
  | { state: 'cleared' }

export interface WorkFocus {
  selection: WorkSelection
  before: WorkPresentationSnapshot
}

export interface WorkGroup {
  status: string
  items: WorkItem[]
}

export interface WorkAnchor {
  elementId: string
  count: number
  active: boolean
}

export interface WorkMap {
  anchors: WorkAnchor[]
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
  const order = [...active, work?.defaultStatus, terminal].filter((status): status is string => {
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

export function initialWorkFocus(
  work: WorkSnapshot | undefined,
  before: WorkPresentationSnapshot,
): WorkFocus {
  const taskId = workGroups(work).flatMap(group => group.items)[0]?.id
  return {
    selection: taskId === undefined ? { state: 'waiting' } : { state: 'selected', taskId },
    before,
  }
}

export function moveWorkFocus(
  work: WorkSnapshot | undefined,
  focus: WorkFocus,
  step: -1 | 1,
): WorkFocus {
  const items = workGroups(work).flatMap(group => group.items)
  if (items.length === 0) return { ...focus, selection: { state: 'cleared' } }
  const current = items.findIndex(item => item.id === selectedWorkId(focus))
  const index = current < 0
    ? 0
    : Math.max(0, Math.min(items.length - 1, current + step))
  return { ...focus, selection: { state: 'selected', taskId: items[index]!.id } }
}

export function reconcileWorkFocus(
  work: WorkSnapshot | undefined,
  focus: WorkFocus | undefined,
): WorkFocus | undefined {
  if (focus === undefined) return undefined
  if (focus.selection.state === 'cleared') return focus
  const task = selectedWorkItem(work, focus)
  if (focus.selection.state === 'selected') {
    return task === undefined ? { ...focus, selection: { state: 'cleared' } } : focus
  }
  const taskId = workGroups(work).flatMap(group => group.items)[0]?.id
  return taskId === undefined
    ? focus
    : { ...focus, selection: { state: 'selected', taskId } }
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

export function projectWork(
  model: TerminalViewModel,
  projection: TerminalProjection,
  focus: WorkFocus | undefined,
): WorkMap {
  const visible = new Map(projection.items.flatMap(item => {
    return item.representationId === undefined ? [] : [[item.representationId, item] as const]
  }))
  const elements = new Map(model.elements.map(element => [element.representationId, element]))
  const visibleElementId = (id: string): string | undefined => {
    return visibleEndpointFor(id, visible, elements, undefined)?.representationId
  }
  const selected = selectedWorkItem(model.work, focus)
  const touched = new Set((selected === undefined ? [] : touchedElements(selected, model))
    .map(visibleElementId)
    .filter((id): id is string => id !== undefined))
  const anchors = new Map<string, WorkAnchor>()
  for (const item of itemsOf(model.work)) {
    const exact = touchedElements(item, model)[0]
    const elementId = exact === undefined ? undefined : visibleElementId(exact)
    if (elementId === undefined) continue
    const current = anchors.get(elementId)
    if (current === undefined) {
      anchors.set(elementId, { elementId, count: 1, active: item.id === selected?.id })
    } else {
      current.count += 1
      current.active ||= item.id === selected?.id
    }
  }
  return { anchors: [...anchors.values()], touched }
}
