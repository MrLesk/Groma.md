import { animateContent } from '../chrome/motion.ts'
import type { Comparison, ChangeStatus } from '../../../history/comparison.ts'
import type { ArchitectureGraph } from '../../../types.ts'
import type { LayeredScene } from '../iso/projection/separation.ts'
import { chromeButton } from '../atoms/button.ts'
import { comparisonTree, changeStatuses, changeLabels, changeMarks, isChange, nextChange, type VisibleStatus } from './tree.ts'

/** Removes filtered deletions from the projection; authored world, retained positions and bounds stay intact. */
export function filterComparisonScene(scene: LayeredScene, world: ArchitectureGraph, comparison: Comparison | undefined,
  enabled: ReadonlySet<VisibleStatus>): LayeredScene {
  if (comparison === undefined || enabled.has('removed')) return scene
  const removed = new Set(Object.values(comparison.components).filter(change => change.status === 'removed')
    .map(change => change.before!.representationId))
  for (const id of comparisonTree(world, comparison).former) removed.add(id)
  return {
    ...scene,
    buildings: scene.buildings.filter(({ building }) => !removed.has(building.representationId)),
    slabs: scene.slabs.filter(({ slab }) => !removed.has(slab.representationId)),
    islands: scene.islands.filter(({ island }) => island.element === null || !removed.has(island.element.representationId)),
    zones: scene.zones.filter(({ zone }) => zone.members.some(id => !removed.has(id))),
    routes: scene.routes.flatMap(item => {
      if (removed.has(item.route.source) || removed.has(item.route.target)) return []
      const ids = (item.route.relationshipIds ?? [item.route.id]).filter(id => comparison.relationships[id] !== 'removed')
      return ids.length === 0 ? [] : [{ ...item, route: { ...item.route, relationshipIds: ids } }]
    }),
  }
}

/** Page-local filters and selection navigation over the comparison facts already supplied by History. */
export function createComparisonControl(host: HTMLElement, select: (id: string) => void, repaint: () => void) {
  let enabled = new Set<VisibleStatus>(changeStatuses)
  let pair = ''
  let order: string[] = []
  let selected: string | undefined
  let world: ArchitectureGraph
  let comparison: Comparison | undefined
  const bar = document.createElement('div')
  bar.id = 'changes'
  bar.className = 'floating-map-bar'
  bar.setAttribute('aria-label', 'Comparison changes')
  const filters = document.createElement('div')
  filters.className = 'change-filters'
  const buttons = changeStatuses.map(status => {
    const button = chromeButton('')
    button.dataset.change = status
    button.onclick = () => {
      if (enabled.has(status)) enabled.delete(status)
      else enabled.add(status)
      repaint()
    }
    filters.append(button)
    return button
  })
  const stepper = document.createElement('div')
  stepper.className = 'change-stepper'
  const previous = chromeButton('', { glyph: '←', ariaLabel: 'Previous change' })
  const next = chromeButton('', { glyph: '→', ariaLabel: 'Next change' })
  const position = document.createElement('span')
  position.setAttribute('aria-live', 'polite')
  const step = (direction: number) => {
    const id = nextChange(order, selected, direction)
    if (id !== undefined) select(id)
  }
  previous.onclick = () => step(-1)
  next.onclick = () => step(1)
  stepper.append(previous, position, next)
  bar.append(filters, stepper)
  host.append(bar)
  document.addEventListener('keydown', event => {
    if (bar.hidden || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]')) return
    const direction = event.key.toLowerCase() === 'j' ? 1 : event.key.toLowerCase() === 'k' ? -1 : 0
    if (direction === 0) return
    event.preventDefault()
    step(direction)
  })
  function paintPosition(): void {
    const index = selected === undefined ? -1 : order.indexOf(selected)
    const label = `${index < 0 ? '—' : index + 1} / ${order.length}`
    if (position.textContent !== label) { position.textContent = label; animateContent(position) }
  }
  return {
    targets(): string[] {
      if (comparison === undefined) return []
      return Object.values(comparison.components).filter(change => isChange(change.status) && enabled.has(change.status))
        .map(change => (change.after ?? change.before)!.representationId)
    },
    get enabled(): ReadonlySet<VisibleStatus> { return enabled },
    project(scene: LayeredScene): LayeredScene { return filterComparisonScene(scene, world, comparison, enabled) },
    marks(): Comparison | undefined {
      if (comparison === undefined) return undefined
      const visible = (status: ChangeStatus) => isChange(status) && !enabled.has(status) ? 'unchanged' as const : status
      return { ...comparison,
        components: Object.fromEntries(Object.entries(comparison.components).map(([id, change]) => [id, { ...change, status: visible(change.status) }])),
        relationships: Object.fromEntries(Object.entries(comparison.relationships).map(([id, status]) => [id, visible(status)])),
      }
    },
    update(nextWorld: ArchitectureGraph, nextComparison: Comparison | undefined, destination: string | undefined, selection: string | undefined): void {
      world = nextWorld
      comparison = nextComparison
      selected = selection
      const nextPair = comparison === undefined ? '' : `${comparison.from?.id ?? ''}:${destination ?? ''}`
      if (nextPair !== pair) { enabled = new Set(changeStatuses); pair = nextPair }
      const statuses = comparison === undefined ? [] : [...Object.values(comparison.components).map(change => change.status), ...Object.values(comparison.relationships)]
      bar.hidden = !statuses.some(isChange)
      order = comparison === undefined ? [] : comparisonTree(world, comparison, enabled).order
      buttons.forEach((button, index) => {
        const status = changeStatuses[index]!
        const count = statuses.filter(item => item === status).length
        button.hidden = count === 0
        button.setAttribute('aria-pressed', String(enabled.has(status)))
        button.setAttribute('aria-label', `${changeLabels[status]}: ${count}`)
        button.title = changeLabels[status]
        button.textContent = `${changeMarks[status]} ${count}`
      })
      paintPosition()
      previous.disabled = next.disabled = order.length === 0
    },
  }
}

export const comparisonControlCss = `
  #changes { --window-inset: var(--chrome-inset, 0px); position: absolute; bottom: calc(12px + var(--window-inset)); z-index: 6; margin: 0 auto; width: fit-content; box-sizing: border-box; padding: 6px; gap: 8px; flex-wrap: wrap; justify-content: center; }
  #changes[hidden], #changes button[hidden], body.hud-hidden #changes { display: none; }
  #changes .change-filters, #changes .change-stepper { display: flex; align-items: center; gap: 3px; }
  #changes button { padding: 5px 7px; font-size: 11px; border-radius: 16px; transition: opacity var(--chrome-motion) var(--chrome-ease), background var(--chrome-motion) var(--chrome-ease); }
  #changes [data-change="added"] { color: var(--diff-added); }
  #changes [data-change="modified"] { color: var(--diff-modified); }
  #changes [data-change="removed"] { color: var(--diff-removed); }
  #changes [aria-pressed="false"] { opacity: .45; }
  #changes [aria-pressed="true"] { background: var(--hover); }
  #changes .change-stepper { font-size: 10px; font-variant-numeric: tabular-nums; }
  #changes .change-stepper span { white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { #changes, #changes button { transition: none; } }
`
