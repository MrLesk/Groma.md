import type { ArchitectureGraph, WorkItem, WorkSnapshot } from '../../../types.ts'
import type { Selection } from '../selection.ts'
import { primarySelection } from '../selection.ts'
import { elementWorkGroups } from '../../../work/pins.ts'
import type { WebFlowRef } from '../flow/state.ts'
import type { FlowRef } from '../../flows.ts'
import { paintFlowReturn, paintFlowDetails } from '../flow/reader.ts'
import { paintRelationship } from './relationship-details.ts'
import { paintDetails, inspectDetails, type DetailsTab } from './details.ts'
import type { createAuthoring } from '../authoring.ts'
import type { SourceControl } from '../source/control.ts'
import type { TaskDiffControl } from '../task-diff/control.ts'
import type { createComparisonControl } from '../comparison/control.ts'

interface Context {
  host: HTMLElement
  world: ArchitectureGraph
  work: WorkSnapshot
  task?: WorkItem
  selection: Selection
  selectedIds: readonly string[]
  activeFlows: WebFlowRef[]
  tab: DetailsTab
  source: SourceControl
  taskDiff: TaskDiffControl
  comparison?: ReturnType<typeof createComparisonControl>
  authoring: ReturnType<typeof createAuthoring>
  select(id: string, additive?: boolean): void
  showFlows(): void
  selectFlowStep(step?: number): void
  toggleFlow(flow: FlowRef, returnTo?: string): void
  toggleTask(id: string): void
  onTab(tab: DetailsTab): void
}

/** Chooses a reader within the existing Details pane; the map owns selection. */
export function paintSelectionDetails(ctx: Context): void {
  const { host, source, taskDiff, comparison, selection, activeFlows, authoring } = ctx
  const id = primarySelection(selection)
  const world = comparison?.active ? comparison.detailWorld(id) : ctx.world
  const selected = world.elements.find(element => element.representationId === id)
  const relationship = world.relationships.find(item => item.id === id) ?? ctx.world.relationships.find(item => item.id === id)
  const activeFlow = activeFlows.at(-1)
  const painted = comparison?.paintFile() || source.paint(selected) || taskDiff.paint(ctx.task)
  paintFlowReturn(host, activeFlow, selection.kind === 'flow', world, ctx.select, ctx.showFlows, source.file !== undefined || comparison?.file !== undefined)
  if (painted) return
  const flow = world.flows.find(item => item.id === id)
  if (selection.kind === 'flow' && flow !== undefined && activeFlow !== undefined) {
    paintFlowDetails(host, flow, activeFlow, world, ctx.selectFlowStep, ctx.select)
    return
  }
  if (relationship !== undefined) {
    paintRelationship(host, relationship, ctx.world, ctx.select, authoring.relationWrites)
  } else if (selected !== undefined) {
    paintDetails(host, inspectDetails(selected, world), {
      world, onSelect: ctx.select, onToggleFlow: flow => ctx.toggleFlow(flow, selected.representationId),
      activeFlows, tab: ctx.tab, onTab: ctx.onTab,
      code: ctx.tab === 'how' ? source.code() : [], onSource: source.open,
      workGroups: selected.kind === 'component' ? elementWorkGroups(ctx.work, selected.representationId, world) : [],
      onTask: ctx.toggleTask,
      ...(comparison?.active ? {} : authoring.paneWrites(selected.id, ctx.selectedIds)),
    })
  }
  comparison?.decorate(id, ctx.tab)
}
