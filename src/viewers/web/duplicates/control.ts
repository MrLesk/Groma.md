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
  const detail = node('section', '', 'duplicate-detail')
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

  function comparison(finding: ArchitectureFinding, row?: HTMLElement): HTMLElement {
    const section = node('section')
    const selectors = node('div', '', 'duplicate-filters')
    const entries: [string, string][] = finding.instances.map((instance, index) => [String(index), `${instance.name} · ${instance.file}:${instance.startLine}`])
    for (const side of [0, 1] as const) {
      selectors.append(choice(side === 0 ? 'Left occurrence' : 'Right occurrence', entries, String(pair[side]), value => {
        pair[side] = Number(value)
        if (pair[0] === pair[1]) pair[1 - side] = Number(entries.find(([id]) => Number(id) !== pair[side])![0])
        showComparison(finding)
      }))
    }
    const left = finding.instances[pair[0]]!
    const right = finding.instances[pair[1]]!
    const body = node('div', 'Loading source', 'duplicate-comparison')
    section.append(selectors, body)
    void reader.read(async () => Promise.all([read(left), read(right)]), result => {
      if (result instanceof Error) body.textContent = result.message
      else {
        const lines = compareOperations(result[0], result[1], [left.startLine, right.startLine])
        body.replaceChildren(
          sourceColumn(left, component(left)?.title, lines[0], source => navigate(left, source)),
          sourceColumn(right, component(right)?.title, lines[1], source => navigate(right, source)),
        )
      }
      row?.scrollIntoView({ block: 'start' })
    })
    return section
  }

  function showComparison(finding: ArchitectureFinding, row?: HTMLElement): void {
    reader.invalidate()
    detail.replaceChildren(comparison(finding, row))
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
    row.setAttribute('aria-expanded', String(finding.id === selected))
    const arrow = node('span', '›', 'duplicate-arrow')
    arrow.setAttribute('aria-hidden', 'true')
    row.append(arrow, node('span', finding.title), node('span', finding.match === 'exact' ? 'Same structure' : 'Similar'), node('span', `${finding.instances.length} copies`))
    row.addEventListener('click', () => {
      selected = selected === finding.id ? undefined : finding.id
      pair = [0, 1]
      reader.invalidate()
      detail.remove()
      for (const button of panel.querySelectorAll('.duplicate-row')) button.setAttribute('aria-expanded', String(button === row && selected !== undefined))
      if (selected === undefined) return
      row.after(detail)
      showComparison(finding, row)
      row.scrollIntoView({ block: 'start' })
    })
    return row
  }

  function groupList(groups: readonly ArchitectureFinding[]): HTMLElement {
    const list = node('div', '', 'duplicate-list')
    for (const finding of groups) {
      list.append(candidate(finding))
      if (finding.id === selected) { list.append(detail); showComparison(finding) }
    }
    return list
  }

  function paint(): void {
    reader.invalidate()
    const findings = options.world().findings
    const groups = duplicateGroups(findings ?? [], owner, match)
    if (!groups.some(finding => finding.id === selected)) { selected = undefined; pair = [0, 1] }
    const list = groupList(groups)
    const toolbar = node('div', '', 'duplicate-toolbar')
    const count = groups.length === findings?.length ? String(groups.length) : `${groups.length} of ${findings?.length ?? 0}`
    const heading = node('h2', `Potential duplicates · ${count}`)
    heading.id = 'duplicates-title'
    toolbar.append(heading, filters(findings ?? []))
    panel.replaceChildren(toolbar, list)
    if (groups.length === 0) list.append(node('p', findings === undefined ? 'No duplicate findings available for this view.' : 'No matching duplicate groups.'))
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
