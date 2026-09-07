import type { ArchitectureFinding, ArchitectureFindingInstance, CodeReference } from '../../../types.ts'
import {
  copiesOf,
  type OperationCopies,
} from '../../../architecture-findings.ts'
import type { CodeDeclaration, CodeFile } from '../../source/structure.ts'
import { sidebarBranches } from './sidebar-row.ts'

function countFact(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function fileFacts(reference: CodeReference): string {
  const facts: string[] = []
  if (reference.lines !== undefined) facts.push(`${reference.lines} lines`)
  if (reference.dependencies !== undefined) facts.push(countFact(reference.dependencies, 'dependency', 'dependencies'))
  if (reference.dependents !== undefined) facts.push(countFact(reference.dependents, 'dependent', 'dependents'))
  if (reference.symbol !== undefined) facts.push(reference.symbol)
  facts.push(reference.scanner)
  return facts.join(' · ')
}

interface CodeGroup {
  file: string
  reference?: CodeReference
  declarations: readonly CodeDeclaration[]
}

function groupedCode(
  references: readonly CodeReference[],
  structure: readonly CodeFile[],
): CodeGroup[] {
  const byFile = new Map(structure.map(file => [file.file, file.declarations]))
  const seen = new Set<string>()
  const groups: CodeGroup[] = []
  for (const reference of references) {
    if (seen.has(reference.file)) continue
    seen.add(reference.file)
    groups.push({
      file: reference.file,
      reference,
      declarations: byFile.get(reference.file) ?? [],
    })
  }
  for (const file of structure) {
    if (seen.has(file.file)) continue
    seen.add(file.file)
    groups.push({ file: file.file, declarations: file.declarations })
  }
  return groups
}

function codeFacts(entry: boolean, scope: string, line: number, kind?: string): string {
  return [entry ? 'entry' : undefined, scope, kind, `line ${line}`]
    .filter(fact => fact !== undefined)
    .join(' · ')
}

let expandedCopiesKey: string | undefined

function copiesKey(elementId: string, file: string, name: string, line: number): string {
  return `${elementId}:${file}:${line}:${name}`
}

function closeCopies(list: HTMLElement): void {
  for (const mark of list.querySelectorAll('.code-copies-mark')) mark.setAttribute('aria-expanded', 'false')
  for (const panel of list.querySelectorAll('.code-copies')) panel.remove()
}

function warningIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2.2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  triangle.setAttribute('d', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3')
  const stem = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  stem.setAttribute('d', 'M12 9v4')
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  dot.setAttribute('d', 'M12 17h.01')
  svg.append(triangle, stem, dot)
  return svg
}

function copiesPanel(
  copies: OperationCopies,
  following: readonly boolean[],
  callable: boolean,
  context: CopiesContext,
): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'code-copies'
  copies.copies.forEach((copy, index) => {
    list.append(copyItem(copy, [...following, index < copies.copies.length - 1], callable, context))
  })
  if (copies.similar) {
    const note = document.createElement('li')
    note.className = 'ghost'
    note.textContent = 'not identical'
    list.append(note)
  }
  return list
}

interface CopiesContext {
  findings: readonly ArchitectureFinding[]
  elementId: string
  list: HTMLElement
  onSource: (file: string, line?: number) => void
}

function copyItem(
  copy: ArchitectureFindingInstance,
  following: readonly boolean[],
  callable: boolean,
  context: CopiesContext,
): HTMLElement {
  return codeEntry(
    copy.file,
    copy.name,
    copy.startLine,
    `${copy.file}:${copy.startLine}`,
    callable,
    following,
    undefined,
    context,
  )
}

function copiesMark(
  key: string,
  copies: OperationCopies,
  host: HTMLElement,
  following: readonly boolean[],
  callable: boolean,
  context: CopiesContext,
): HTMLButtonElement {
  const mark = document.createElement('button')
  mark.type = 'button'
  mark.className = 'code-copies-mark'
  mark.append(warningIcon(), 'possible duplicates')
  mark.setAttribute('aria-expanded', 'false')
  mark.addEventListener('click', event => {
    event.stopPropagation()
    const open = expandedCopiesKey !== key
    expandedCopiesKey = open ? key : undefined
    closeCopies(context.list)
    if (!open) return
    host.append(copiesPanel(copies, following, callable, context))
    mark.setAttribute('aria-expanded', 'true')
  })
  return mark
}

function codeEntry(
  file: string,
  name: string,
  line: number,
  facts: string,
  callable: boolean,
  following: readonly boolean[],
  copies: OperationCopies | undefined,
  context: CopiesContext,
): HTMLElement {
  const host = document.createElement('li')
  const row = document.createElement('div')
  row.className = 'code-entry'
  const tree = document.createElement('div')
  tree.className = 'code-tree'
  tree.setAttribute('aria-hidden', 'true')
  tree.append(...sidebarBranches(following))
  const main = document.createElement('div')
  main.className = 'code-entry-main'
  const named = document.createElement('div')
  named.className = 'code-entry-name'
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'link code-declaration'
  link.textContent = callable ? `${name}()` : name
  link.setAttribute('aria-label', `Open ${name} in ${file} at line ${line}`)
  link.addEventListener('click', () => context.onSource(file, line))
  named.append(link)
  const key = copiesKey(context.elementId, file, name, line)
  if (copies !== undefined) named.append(copiesMark(key, copies, host, following, callable, context))
  const meta = document.createElement('span')
  meta.className = 'ghost'
  meta.textContent = facts
  main.append(named, meta)
  row.append(tree, main)
  host.append(row)
  if (copies !== undefined && expandedCopiesKey === key) {
    host.append(copiesPanel(copies, following, callable, context))
    host.querySelector('.code-copies-mark')?.setAttribute('aria-expanded', 'true')
  }
  return host
}

function memberItem(
  file: string,
  member: { name: string; line: number; scope: string; entry: boolean },
  following: readonly boolean[],
  context: CopiesContext,
): HTMLElement {
  const copies = copiesOf(context.findings, file, member.name, member.line)
  return codeEntry(
    file,
    member.name,
    member.line,
    codeFacts(member.entry, member.scope, member.line),
    true,
    following,
    copies,
    context,
  )
}

function declarationItem(
  file: string,
  declaration: CodeDeclaration,
  follows: boolean,
  context: CopiesContext,
): HTMLElement {
  const copies = copiesOf(context.findings, file, declaration.name, declaration.line)
  const host = codeEntry(
    file,
    declaration.name,
    declaration.line,
    codeFacts(declaration.entry, declaration.scope, declaration.line, declaration.kind === 'class' ? 'class' : undefined),
    declaration.kind === 'function',
    [follows],
    copies,
    context,
  )
  if (declaration.kind === 'class' && declaration.members.length > 0) {
    const members = document.createElement('ul')
    members.className = 'code-members'
    declaration.members.forEach((member, index) => {
      members.append(memberItem(
        file,
        member,
        [follows, index < declaration.members.length - 1],
        context,
      ))
    })
    host.append(members)
  }
  return host
}

function fileRow(group: CodeGroup, onSource: (file: string, line?: number) => void): HTMLElement {
  const file = document.createElement('button')
  file.type = 'button'
  file.className = 'link source-file'
  file.textContent = group.file
  file.setAttribute('aria-label', `Open source ${group.file}`)
  if (group.reference !== undefined) file.title = fileFacts(group.reference)
  file.addEventListener('click', () => onSource(group.file))
  return file
}

export function codeList(
  references: readonly CodeReference[],
  structure: readonly CodeFile[],
  findings: readonly ArchitectureFinding[],
  elementId: string,
  onSource: (file: string, line?: number) => void,
): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'file-groups'
  const context: CopiesContext = { findings, elementId, list, onSource }
  for (const group of groupedCode(references, structure)) {
    const item = document.createElement('li')
    item.className = 'code-file'
    item.append(fileRow(group, onSource))
    if (group.declarations.length > 0) {
      const methods = document.createElement('ul')
      methods.className = 'code-methods'
      group.declarations.forEach((declaration, index) => {
        methods.append(declarationItem(
          group.file,
          declaration,
          index < group.declarations.length - 1,
          context,
        ))
      })
      item.append(methods)
    }
    list.append(item)
  }
  return list
}
