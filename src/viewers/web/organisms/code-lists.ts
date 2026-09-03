import type { CodeReference } from '../../../types.ts'
import { fileTypeOf } from '../../../sheet/measure.ts'
import type { CodeDeclaration, CodeFile } from '../../source/structure.ts'

function countFact(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function fileFacts(reference: CodeReference): string {
  const facts = [fileTypeOf(reference.file)]
  if (reference.lines !== undefined) facts.push(`${reference.lines} lines`)
  if (reference.dependencies !== undefined) facts.push(countFact(reference.dependencies, 'dependency', 'dependencies'))
  if (reference.dependents !== undefined) facts.push(countFact(reference.dependents, 'dependent', 'dependents'))
  if (reference.symbol !== undefined) facts.push(reference.symbol)
  facts.push(reference.scanner)
  return facts.join(' · ')
}

export function fileList(references: CodeReference[], onSource: (file: string) => void): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'file-groups'
  for (const reference of references) {
    const item = document.createElement('li')
    const file = document.createElement('button')
    file.type = 'button'
    file.className = 'link source-file'
    file.textContent = reference.file
    file.setAttribute('aria-label', `Open source ${reference.file}`)
    file.addEventListener('click', () => onSource(reference.file))
    const extra = document.createElement('span')
    extra.className = 'ghost'
    extra.textContent = fileFacts(reference)
    item.append(file, extra)
    list.append(item)
  }
  return list
}

function codeFacts(entry: boolean, scope: string, line: number, kind?: string): string {
  return [entry ? 'entry' : undefined, scope, kind, `line ${line}`]
    .filter(fact => fact !== undefined)
    .join(' · ')
}

function codeEntry(
  file: string,
  name: string,
  line: number,
  facts: string,
  callable: boolean,
  onSource: (file: string, line?: number) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'code-entry'
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'link code-declaration'
  link.textContent = callable ? `${name}()` : name
  link.setAttribute('aria-label', `Open ${name} in ${file} at line ${line}`)
  link.addEventListener('click', () => onSource(file, line))
  const meta = document.createElement('span')
  meta.className = 'ghost'
  meta.textContent = facts
  row.append(link, meta)
  return row
}

function declarationItem(
  file: string,
  declaration: CodeDeclaration,
  onSource: (file: string, line?: number) => void,
): HTMLElement {
  const item = document.createElement('li')
  item.append(codeEntry(
    file,
    declaration.name,
    declaration.line,
    codeFacts(declaration.entry, declaration.scope, declaration.line, declaration.kind === 'class' ? 'class' : undefined),
    declaration.kind === 'function',
    onSource,
  ))
  if (declaration.kind === 'class' && declaration.members.length > 0) {
    const members = document.createElement('ul')
    members.className = 'code-members'
    for (const member of declaration.members) {
      const child = document.createElement('li')
      child.append(codeEntry(
        file,
        member.name,
        member.line,
        codeFacts(member.entry, member.scope, member.line),
        true,
        onSource,
      ))
      members.append(child)
    }
    item.append(members)
  }
  return item
}

export function codeList(files: readonly CodeFile[], onSource: (file: string, line?: number) => void): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'file-groups'
  for (const file of files) {
    const group = document.createElement('li')
    const name = document.createElement('div')
    name.className = 'code-file-name'
    name.textContent = file.file
    const declarations = document.createElement('ul')
    for (const declaration of file.declarations) {
      declarations.append(declarationItem(file.file, declaration, onSource))
    }
    group.append(name, declarations)
    list.append(group)
  }
  return list
}
