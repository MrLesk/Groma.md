import type { AnnotatedElement, ArchitectureFinding, ArchitectureFindingInstance, ArchitectureGraph } from '../../../types.ts'
import type { SourcePayload } from '../../source/read.ts'
import { compareOperations, comparisonReader, duplicateGroups, operationSource } from './model.ts'
import { choice, node, sourceColumn } from './view.ts'

interface Options {
  host: HTMLElement
  close(): void
  world(): ArchitectureGraph
  revision(): string | undefined
  readSource(element: string, file: string, revision?: string): Promise<SourcePayload>
  navigate(owner: string, file?: string, line?: number): void
}

/** Duplicate review owns comparisons; the shared project dialog owns navigation and dismissal. */
export function createDuplicatesControl(options: Options) {
  const panel = options.host
  const reader = comparisonReader<[string, string]>()
  let owner = ''
  let match = ''
  let selected: string | undefined
  let pair: [number, number] = [0, 1]

  function component(instance: ArchitectureFindingInstance): AnnotatedElement | undefined {
    return options.world().elements.find(element => element.id === instance.owner && element.kind === 'component')
  }

  function navigate(instance: ArchitectureFindingInstance, source: boolean): void {
    const element = component(instance)
    if (element === undefined) return
    options.close()
    options.navigate(element.representationId, source ? instance.file : undefined, source ? instance.startLine : undefined)
  }

  async function read(instance: ArchitectureFindingInstance): Promise<string> {
    const element = component(instance)
    if (element === undefined) throw new Error(`No component owns ${instance.file}`)
    const payload = await options.readSource(element.representationId, instance.file, options.revision())
    return operationSource(payload.source, instance)
  }

  function comparison(finding: ArchitectureFinding): HTMLElement {
    const section = node('section')
    const selectors = node('div', '', 'duplicate-filters')
    const entries: [string, string][] = finding.instances.map((instance, index) => [String(index), `${instance.name} · ${instance.file}:${instance.startLine}`])
    for (const side of [0, 1] as const) {
      selectors.append(choice(side === 0 ? 'Left occurrence' : 'Right occurrence', entries, String(pair[side]), value => {
        pair[side] = Number(value)
        if (pair[0] === pair[1]) pair[1 - side] = Number(entries.find(([id]) => Number(id) !== pair[side])![0])
        paint()
      }))
    }
    const left = finding.instances[pair[0]]!
    const right = finding.instances[pair[1]]!
    const body = node('div', 'Loading source', 'duplicate-comparison')
    section.append(selectors, body)
    void reader.read(async () => Promise.all([read(left), read(right)]), result => {
      if (result instanceof Error) { body.textContent = result.message; return }
      const lines = compareOperations(result[0], result[1], [left.startLine, right.startLine])
      body.replaceChildren(
        sourceColumn(left, component(left)?.title, lines[0], source => navigate(left, source)),
        sourceColumn(right, component(right)?.title, lines[1], source => navigate(right, source)),
      )
    })
    return section
  }

  function filters(findings: readonly ArchitectureFinding[]): HTMLElement {
    const owners = new Set(findings.flatMap(finding => finding.instances.flatMap(instance => instance.owner === undefined ? [] : [instance.owner])))
    const entries: [string, string][] = options.world().elements.filter(element => owners.has(element.id)).map(element => [element.id, element.title])
    const row = node('div', '', 'duplicate-filters')
    row.append(
      choice('Component', [['', 'All components'], ...entries], owner, value => { owner = value; paint() }),
      choice('Match', [['', 'All matches'], ['exact', 'Same structure'], ['similar', 'Similar']], match, value => { match = value; paint() }),
    )
    return row
  }

  function candidate(finding: ArchitectureFinding): HTMLElement {
    const row = node('button', '', 'duplicate-row')
    row.type = 'button'
    row.setAttribute('aria-pressed', String(finding.id === selected))
    row.append(node('span', finding.title), node('span', finding.match === 'exact' ? 'Same structure' : 'Similar'), node('span', `${finding.instances.length} copies`))
    row.addEventListener('click', () => { selected = finding.id; pair = [0, 1]; paint() })
    return row
  }

  function paint(): void {
    reader.invalidate()
    const findings = options.world().findings
    const groups = duplicateGroups(findings ?? [], owner, match)
    if (!groups.some(finding => finding.id === selected)) { selected = groups[0]?.id; pair = [0, 1] }
    const list = node('div', '', 'duplicate-list')
    list.append(...groups.map(candidate))
    panel.replaceChildren(filters(findings ?? []), node('p', `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`, 'pane-label'), list)
    const finding = groups.find(item => item.id === selected)
    if (finding !== undefined) panel.append(comparison(finding))
    else panel.append(node('p', findings === undefined ? 'No duplicate findings available for this view.' : 'No matching duplicate groups.'))
  }

  return {
    show() { panel.hidden = false; paint() },
    hide() { panel.hidden = true; reader.invalidate() },
    refresh() {
      reader.invalidate()
      owner = ''
      selected = undefined
      pair = [0, 1]
      if (!panel.hidden) paint()
    },
  }
}
