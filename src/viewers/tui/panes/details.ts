import { TextAttributes } from '@opentui/core'

import { actionCaption, outgoingActions } from '../../relationship-text.ts'
import { kindLabel } from '../../atoms/kind.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import { parentOfElements, promotedPeer } from '../../relationship-text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { TerminalViewModel } from '../model.ts'
import { KEYS_BOX } from '../keys.ts'
import { selectionFlows, selectionRelationships, type DetailsTab } from '../navigation.ts'
import { workRowId, workRows, workRowSelection, type WorkListSettings } from '../work/model.ts'
import { workListLines } from './hierarchy.ts'
import { taskFileRows } from './code.ts'
import type {
  AnnotatedElement,
  ArchitectureFlow,
  AnnotatedRelationship,
  WorkChecklistItem,
  WorkItem,
  WorkItemDetails,
} from '../../../types.ts'
import type { TaskFileDiff } from '../../source/diff-lines.ts'
import type { CodeDeclaration, CodeFile } from '../../source/structure.ts'
import { accent, bold, chunk, dim, kindMark, plain, styleRow, wrap, type Line, type PaneLines } from './text.ts'

export const DETAILS_TABS: readonly DetailsTab[] = ['what', 'how', 'tasks']
export const DETAILS_TAB_NAMES: Record<DetailsTab, string> = { what: 'What', how: 'How', tasks: 'Tasks' }

type Elements = ReadonlyMap<string, AnnotatedElement>

function heading(theme: ViewerTheme, value: string, width: number): Line {
  return [dim(theme, `${value} ${'─'.repeat(Math.max(0, width - value.length - 1))}`)]
}

function technologyRows(theme: ViewerTheme, element: AnnotatedElement, width: number): Line[] {
  const technology = (element.technology ?? '').split(',').map(part => part.trim()).filter(part => part.length > 0)
  if (technology.length === 0) return []
  return [[], heading(theme, 'Technology', width), [plain(theme, technology.join(' · '))]]
}

/** A function with its parentheses, a class, or a member: its line and what it is. */
function declarationRows(theme: ViewerTheme, file: string, declaration: CodeDeclaration, width: number, actionCursor: string | undefined, indent = ''): PaneLines {
  const facts = [declaration.entry ? 'entry' : undefined, declaration.scope, declaration.kind === 'class' ? 'class' : undefined, `line ${declaration.line}`].filter(fact => fact !== undefined).join(' · ')
  const name = declaration.kind === 'function' ? `${declaration.name}()` : declaration.name
  const key = `${file}:${declaration.line}`
  const lines: Line[] = [styleRow(theme, [plain(theme, `${indent}${name}`), dim(theme, ` · ${facts}`)], width, false, key === actionCursor)]
  let cursor = key === actionCursor ? 0 : undefined
  if (declaration.kind === 'class') {
    for (const member of declaration.members) {
      const memberKey = `${file}:${member.line}`
      if (memberKey === actionCursor) cursor = lines.length
      lines.push(styleRow(theme, [plain(theme, `${indent}  ${member.name}()`), dim(theme, ` · ${member.scope} · line ${member.line}`)], width, false, memberKey === actionCursor))
    }
  }
  return { lines, cursor }
}

/** Each file with its line count, then its declarations in authored order once the structure is read. */
function codeRows(theme: ViewerTheme, element: AnnotatedElement, width: number, structure: readonly CodeFile[] | undefined, actionCursor: string | undefined): PaneLines {
  if (element.code.length === 0) return { lines: [] }
  const lines: Line[] = [[], heading(theme, 'Code', width)]
  let cursor: number | undefined
  const seen = new Set<string>()
  for (const reference of element.code) {
    if (seen.has(reference.file)) continue
    seen.add(reference.file)
    const count = reference.lines === undefined ? '' : ` · ${reference.lines} lines`
    lines.push([plain(theme, reference.file), dim(theme, count)])
    for (const declaration of structure?.find(file => file.file === reference.file)?.declarations ?? []) {
      const rows = declarationRows(theme, reference.file, declaration, width, actionCursor, '  ')
      if (rows.cursor !== undefined) cursor = lines.length + rows.cursor
      lines.push(...rows.lines)
    }
  }
  return { lines, cursor }
}

function howLines(theme: ViewerTheme, element: AnnotatedElement, width: number, actionCursor: string | undefined, structure: readonly CodeFile[] | undefined): PaneLines {
  const code = codeRows(theme, element, width, structure, actionCursor)
  const technology = technologyRows(theme, element, width)
  return { lines: [...technology, ...code.lines], cursor: code.cursor === undefined ? undefined : technology.length + code.cursor }
}

interface RelationshipRow {
  relationship: AnnotatedRelationship
  outgoing: boolean
  peer: AnnotatedElement | undefined
}

/** The selection's relationships in pick order, each with the peer it points at or arrives from. */
function relationshipRows(element: AnnotatedElement, world: TerminalViewModel, byId: Elements): RelationshipRow[] {
  const parentOf = parentOfElements(world.elements)
  const outgoing = new Set(outgoingActions(element.representationId, world).map(relationship => relationship.id))
  return selectionRelationships(world, element.representationId).map(relationship => {
    const isOutgoing = outgoing.has(relationship.id)
    const peerId = isOutgoing ? relationship.target : promotedPeer(relationship, element.representationId, parentOf)?.peerId ?? relationship.source
    return { relationship, outgoing: isOutgoing, peer: byId.get(peerId) }
  })
}

function relationshipLines(theme: ViewerTheme, row: RelationshipRow, byId: Elements, width: number, lit: boolean, atCursor: boolean): Line[] {
  const arrow = row.outgoing ? '→ ' : '← '
  const caption = actionCaption(row.relationship, row.outgoing, id => byId.get(id)?.title)
  const rest = caption.detail === '' ? '' : ` · ${caption.detail}`
  const peerMark: Line = row.outgoing || row.peer === undefined ? [] : [kindMark(theme, row.peer.kind, row.peer.external), plain(theme, ' ')]
  const markWidth = peerMark.length === 0 ? 0 : 2
  // The lit row names both ends beneath it; Enter on it follows the relationship there.
  const ends = lit
    ? wrap(`${byId.get(row.relationship.source)?.title ?? row.relationship.source} → ${byId.get(row.relationship.target)?.title ?? row.relationship.target}`, width - 2)
      .map(line => [dim(theme, `  ${line}`)])
    : []
  if (arrow.length + markWidth + caption.title.length + rest.length <= width) {
    return [styleRow(theme, [dim(theme, arrow), ...peerMark, plain(theme, caption.title), dim(theme, rest)], width, lit, atCursor), ...ends]
  }
  return [
    styleRow(theme, [dim(theme, arrow), ...peerMark, plain(theme, caption.title)], width, lit, atCursor),
    ...wrap(caption.detail, width - arrow.length).map(line => styleRow(theme, [dim(theme, `${' '.repeat(arrow.length)}${line}`)], width, lit, false)),
    ...ends,
  ]
}

function childRows(theme: ViewerTheme, element: AnnotatedElement, byId: Elements, width: number): Line[] {
  if (element.children.length === 0) return []
  return [[], heading(theme, 'Children', width), ...element.children.map(childId => {
    const child = byId.get(childId)
    return child === undefined ? [plain(theme, childId)] : [kindMark(theme, child.kind, child.external), plain(theme, ` ${child.title}`)]
  })]
}

/** Component task groups browse and open records without owning map filters. */
function componentTaskLines(theme: ViewerTheme, element: AnnotatedElement, world: TerminalViewModel, width: number, actionCursor: string | undefined, settings?: WorkListSettings): PaneLines {
  const rows = workRows(world, settings, element.representationId)
  const row = rows.find(row => workRowId(row) === actionCursor)
  return workListLines(theme, width, rows, row === undefined ? { state: 'cleared' } : workRowSelection(row), undefined, true, false)
}

function flowChoiceLines(theme: ViewerTheme, title: string, width: number, active: boolean, atCursor: boolean): Line[] {
  return wrap(title, width - 2).map((line, index) => styleRow(theme,
    [plain(theme, `${index === 0 ? (active ? '☑ ' : '☐ ') : '  '}${line}`)], width, active, atCursor))
}

function whatLines(theme: ViewerTheme, element: AnnotatedElement, world: TerminalViewModel, byId: Elements, width: number, activeActionId: string | undefined, actionCursor: string | undefined): PaneLines {
  const lines: Line[] = element.overview ? [[], ...wrap(element.overview, width).map(row => [plain(theme, row)])] : []
  let cursor: number | undefined
  const rows = relationshipRows(element, world, byId)
  if (rows.length > 0) lines.push([], heading(theme, 'Relationships', width))
  for (const row of rows) {
    const atCursor = row.relationship.id === actionCursor
    if (atCursor) cursor = lines.length
    const active = row.relationship.id === activeActionId
    lines.push(...relationshipLines(theme, row, byId, width, active, atCursor))
  }
  const flows = selectionFlows(world, element.representationId)
  if (flows.length > 0) lines.push([], heading(theme, 'Flows', width))
  for (const flow of flows) {
    const atCursor = flow.id === actionCursor
    if (atCursor) cursor = lines.length
    lines.push(...flowChoiceLines(theme, flow.title, width, flow.id === activeActionId, atCursor))
  }
  lines.push(...childRows(theme, element, byId, width))
  return { lines, cursor }
}

/** The selected element under one tab: its kind line, then meaning or evidence. */
export function detailsLines(
  theme: ViewerTheme,
  element: AnnotatedElement,
  world: TerminalViewModel,
  width: number,
  tab: DetailsTab,
  activeActionId: string | undefined,
  actionCursor: string | undefined,
  structure: readonly CodeFile[] | undefined,
  workList?: WorkListSettings,
): PaneLines {
  const byId: Elements = new Map(world.elements.map(item => [item.representationId, item]))
  const head: Line = [
    kindMark(theme, element.kind, element.external),
    chunk(` ${kindLabel(element.kind, element.external)}`, theme.foreground, element.external ? TextAttributes.DIM : 0),
    dim(theme, ' · '),
    chunk(element.origin, theme[element.origin], TextAttributes.BOLD),
  ]
  const body = tab === 'tasks'
    ? componentTaskLines(theme, element, world, width, actionCursor, workList)
    : tab === 'how'
    ? howLines(theme, element, width, actionCursor, structure)
    : whatLines(theme, element, world, byId, width, activeActionId, actionCursor)
  return {
    lines: [head, ...body.lines],
    ...(body.cursor === undefined ? {} : { cursor: body.cursor + 1 }),
  }
}

/** The complete authored scenario, with the selected step as the reading cursor. */
export function flowLines(theme: ViewerTheme, world: TerminalViewModel, flow: ArchitectureFlow, selectedStep: number | undefined, width: number): PaneLines {
  const lines: Line[] = [...wrap(flow.title, width).map(row => [bold(theme, row)]), []]
  if (flow.description) lines.push(...wrap(flow.description, width).map(row => [bold(theme, row)]), [])
  lines.push(...wrap(flow.overview, width).map(row => [plain(theme, row)]), [])
  const titles = new Map(world.elements.map(element => [element.id, element.title]))
  let cursor: number | undefined
  flow.steps.forEach((step, index) => {
    const active = selectedStep === index
    if (active) cursor = lines.length
    lines.push(...wrap(`${index + 1}. ${step.action}`, width).map(row => [active ? accent(theme, row) : plain(theme, row)]))
    const ends = `${titles.get(step.source) ?? step.source} → ${titles.get(step.target) ?? step.target}`
    lines.push(...wrap(ends, width - 2).map(row => [dim(theme, `  ${row}`)]), [])
  })
  return { lines, cursor }
}

/** A task summary starts with its title before execution facts. */
export function taskLines(theme: ViewerTheme, item: WorkItem, width: number): Line[] {
  const lines: Line[] = wrap(item.title, width).map(row => [bold(theme, row)])
  if (item.acceptanceCriteriaCount > 0) {
    lines.push([], heading(theme, `Acceptance criteria · ${item.acceptanceCriteriaCompleted} of ${item.acceptanceCriteriaCount}`, width))
  }
  return [...lines, ...taskExecutionLines(theme, item, width).lines]
}

function taskExecutionLines(theme: ViewerTheme, item: WorkItem, width: number, details?: WorkItemDetails, files?: TaskFileDiff[]): PaneLines {
  const lines: Line[] = [[], heading(theme, 'Execution', width), [accent(theme, [item.status, ...item.assignees].join(' · '))]]
  lines.push(...prose(theme, 'Plan', details?.implementationPlan ?? '', width))
  const ids: (string | undefined)[] = lines.map(() => undefined)
  for (const [title, values] of [['Modified files', item.modifiedFiles], ['References', item.references]] as const) {
    if (values.length === 0) continue
    lines.push([], heading(theme, title, width))
    ids.push(undefined, undefined)
    for (const value of values) {
      const rows = title === 'Modified files'
        ? taskFileRows(theme, value, files?.find(file => file.file === value), width)
        : wrap(value, width).map(row => [plain(theme, row)])
      lines.push(...rows)
      ids.push(...rows.map(() => value))
    }
  }
  return { lines, ids }
}

/** The project profile, read-only: its description, then the overview. */
export function profileLines(theme: ViewerTheme, project: ProjectProfile, width: number): Line[] {
  const description = project.description === undefined ? [] : wrap(project.description, width).map(row => [dim(theme, row)])
  return [...description, ...(description.length === 0 ? [] : [[]]), ...wrap(project.overview, width).map(row => [plain(theme, row)])]
}

/** The keys box: every key the viewer handles, its label bold and its meaning dim beside it. */
export function keysLines(theme: ViewerTheme, width: number): Line[] {
  const labelWidth = Math.max(...KEYS_BOX.map(row => row.label.length)) + 2
  return KEYS_BOX.flatMap(row => wrap(row.meaning, Math.max(1, width - labelWidth)).map((line, index) => [
    bold(theme, (index === 0 ? row.label : '').padEnd(labelWidth)),
    dim(theme, line),
  ]))
}

function checklist(theme: ViewerTheme, title: string, items: readonly WorkChecklistItem[], width: number): Line[] {
  if (items.length === 0) return []
  const done = items.filter(item => item.checked).length
  return [[], heading(theme, `${title} · ${done} of ${items.length}`, width), ...items.flatMap(item => {
    return wrap(item.text, width - 2).map((row, index) => [plain(theme, index === 0 ? (item.checked ? '✓ ' : '○ ') : '  '), (item.checked ? dim : plain)(theme, row)])
  })]
}

function prose(theme: ViewerTheme, title: string, value: string, width: number): Line[] {
  if (value.trim() === '') return []
  return [[], heading(theme, title, width), ...value.split('\n').flatMap(paragraph => paragraph === '' ? [[]] : wrap(paragraph, width).map(row => [plain(theme, row)]))]
}

/** Task definition precedes execution, files, notes and comments in both opening paths. */
function taskRecordContent(theme: ViewerTheme, item: WorkItem, details: WorkItemDetails | undefined, width: number, files?: TaskFileDiff[]): PaneLines {
  const lines: Line[] = wrap(item.title, width).map(row => [bold(theme, row)])
  if (details === undefined) return { lines }
  const definition = [
    ...lines,
    ...prose(theme, 'Description', details.description, width),
    ...checklist(theme, 'Acceptance criteria', details.acceptanceCriteria, width),
    ...checklist(theme, 'Definition of Done', details.definitionOfDone, width),
  ]
  const execution = taskExecutionLines(theme, item, width, details, files)
  return {
    lines: [...definition, ...execution.lines,
      ...prose(theme, 'Notes', details.implementationNotes, width),
      ...details.comments.flatMap(comment => prose(theme, comment.author, comment.body, width))],
    ids: [...definition.map(() => undefined), ...execution.ids!],
  }
}

/** The visible reading cursor moves through prose and links without skipping either. */
export function taskRecordView(theme: ViewerTheme, item: WorkItem, details: WorkItemDetails | undefined, width: number, row: number | undefined, files?: TaskFileDiff[]): PaneLines {
  const content = taskRecordContent(theme, item, details, width, files)
  return { ...content, cursor: row, lines: content.lines.map((line, index) => index === row
    ? styleRow(theme, line, width, false, true) : line) }
}
