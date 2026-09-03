import { TextAttributes } from '@opentui/core'

import { actionCaption, outgoingActions, travelledBy } from '../../action-path.ts'
import { kindLabel } from '../../atoms/kind.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import { parentOfElements, promotedPeer } from '../../relationship-text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import type { TerminalViewModel } from '../model.ts'
import { flowEndpointLabel, type ProjectedFlowStep } from '../flow.ts'
import { KEYS_BOX } from '../keys.ts'
import { selectionRelationships, type DetailsTab } from '../navigation.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  WorkChecklistItem,
  WorkItem,
  WorkItemDetails,
} from '../../../types.ts'
import { elementWorkGroups, type WorkStage } from '../../../work/pins.ts'
import type { TaskFileDiff } from '../../source/diff-lines.ts'
import type { CodeDeclaration, CodeFile } from '../../source/structure.ts'
import { accent, bold, chunk, dim, kindMark, plain, styleRow, wrap, type Line, type PaneLines } from './text.ts'

export const DETAILS_TABS: readonly DetailsTab[] = ['what', 'how']
export const DETAILS_TAB_NAMES: Record<DetailsTab, string> = { what: 'What it does', how: 'How it\'s built' }

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

function howLines(theme: ViewerTheme, element: AnnotatedElement, world: TerminalViewModel, width: number, activeActionId: string | undefined, actionCursor: string | undefined, structure: readonly CodeFile[] | undefined): PaneLines {
  const code = codeRows(theme, element, width, structure, actionCursor)
  const lines: Line[] = [...technologyRows(theme, element, width)]
  let cursor = code.cursor === undefined ? undefined : lines.length + code.cursor
  lines.push(...code.lines)
  const travelled = travelledBy(element.representationId, world)
  if (travelled.length > 0) lines.push([], heading(theme, 'Travelled by', width))
  for (const walk of travelled) {
    const atCursor = walk.id === actionCursor
    if (atCursor) cursor = lines.length
    lines.push(styleRow(theme, [dim(theme, '→ '), plain(theme, walk.description)], width, walk.id === activeActionId, atCursor))
  }
  return { lines, cursor }
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

const STAGE_LABEL: Record<WorkStage, string> = { todo: 'To do', progress: 'In progress', done: 'Done' }

/** The tasks touching the element under To do, In progress and Done, each with its acceptance progress. */
function workRows(theme: ViewerTheme, element: AnnotatedElement, world: TerminalViewModel, width: number, actionCursor: string | undefined): PaneLines {
  const lines: Line[] = []
  let cursor: number | undefined
  if (world.work === undefined) return { lines }
  for (const group of elementWorkGroups(world.work, element.representationId, world)) {
    lines.push([], heading(theme, `${STAGE_LABEL[group.stage]} · ${group.items.length}`, width))
    for (const item of group.items) {
      const atCursor = item.id === actionCursor
      if (atCursor) cursor = lines.length
      const progress = item.acceptanceCriteriaCount > 0 ? ` ${item.acceptanceCriteriaCompleted}/${item.acceptanceCriteriaCount}` : ''
      lines.push(styleRow(theme, [bold(theme, item.id), dim(theme, progress)], width, false, atCursor))
      lines.push(...wrap(item.title, width - 2).map(row => [dim(theme, `  ${row}`)]))
    }
  }
  return { lines, cursor }
}

function whatLines(theme: ViewerTheme, element: AnnotatedElement, world: TerminalViewModel, byId: Elements, width: number, activeActionId: string | undefined, actionCursor: string | undefined): PaneLines {
  const lines: Line[] = element.overview ? [[], ...wrap(element.overview, width).map(row => [plain(theme, row)])] : []
  let cursor: number | undefined
  const rows = relationshipRows(element, world, byId)
  if (rows.length > 0) lines.push([], heading(theme, 'Relationships', width))
  for (const row of rows) {
    const atCursor = row.relationship.id === actionCursor
    if (atCursor) cursor = lines.length
    lines.push(...relationshipLines(theme, row, byId, width, row.relationship.id === activeActionId, atCursor))
  }
  lines.push(...childRows(theme, element, byId, width))
  const work = workRows(theme, element, world, width, actionCursor)
  if (work.cursor !== undefined) cursor = lines.length + work.cursor
  lines.push(...work.lines)
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
): PaneLines {
  const byId: Elements = new Map(world.elements.map(item => [item.representationId, item]))
  const head: Line = [
    kindMark(theme, element.kind, element.external),
    chunk(` ${kindLabel(element.kind, element.external)}`, theme.foreground, element.external ? TextAttributes.DIM : 0),
    dim(theme, ' · '),
    chunk(element.origin, theme[element.origin], TextAttributes.BOLD),
  ]
  const body = tab === 'how'
    ? howLines(theme, element, world, width, activeActionId, actionCursor, structure)
    : whatLines(theme, element, world, byId, width, activeActionId, actionCursor)
  return {
    lines: [head, ...body.lines],
    ...(body.cursor === undefined ? {} : { cursor: body.cursor + 1 }),
  }
}

/** A flow row under hierarchy focus: its legs, or the traced leg. */
export function flowLines(
  theme: ViewerTheme,
  step: ProjectedFlowStep | undefined,
  total: number,
  width: number,
): Line[] {
  if (step === undefined) return [[accent(theme, `${total} ${total === 1 ? 'leg' : 'legs'}`)]]
  return [
    [accent(theme, `Leg ${step.index + 1}/${step.total}`)],
    ...wrap(`${flowEndpointLabel(step.source)} → ${flowEndpointLabel(step.target)}`, width).map(row => [plain(theme, row)]),
    [],
    ...wrap(step.description, width).map(row => [plain(theme, row)]),
  ]
}

/** One Backlog task: status and assignees, title, progress, files and references. */
export function taskLines(theme: ViewerTheme, item: WorkItem, width: number): Line[] {
  const lines: Line[] = [[accent(theme, [item.status, ...item.assignees].join(' · '))], []]
  lines.push(...wrap(item.title, width).map(row => [bold(theme, row)]))
  if (item.acceptanceCriteriaCount > 0) {
    lines.push([], heading(theme, `Acceptance criteria · ${item.acceptanceCriteriaCompleted} of ${item.acceptanceCriteriaCount}`, width))
  }
  if (item.modifiedFiles.length > 0) {
    lines.push([], heading(theme, 'Modified files', width))
    for (const file of item.modifiedFiles) lines.push(...wrap(file, width).map(row => [plain(theme, row)]))
  }
  if (item.references.length > 0) {
    lines.push([], heading(theme, 'References', width))
    for (const reference of item.references) lines.push(...wrap(reference, width).map(row => [plain(theme, row)]))
  }
  return lines
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

/** The full task record: the summary, then its description, criteria, Definition of Done, plan, notes and comments. */
export function taskRecordLines(theme: ViewerTheme, item: WorkItem, details: WorkItemDetails | undefined, width: number): Line[] {
  const lines = taskLines(theme, item, width)
  if (details === undefined) return lines
  return [
    ...lines,
    ...prose(theme, 'Description', details.description, width),
    ...checklist(theme, 'Acceptance criteria', details.acceptanceCriteria, width),
    ...checklist(theme, 'Definition of Done', details.definitionOfDone, width),
    ...prose(theme, 'Plan', details.implementationPlan, width),
    ...prose(theme, 'Notes', details.implementationNotes, width),
    ...details.comments.flatMap(comment => prose(theme, comment.author, comment.body, width)),
  ]
}

/** A source file read-only: numbered lines, the opened line in the accent. */
export function sourceLines(theme: ViewerTheme, view: { file: string; line: number; text?: string }, width: number): Line[] {
  if (view.text === undefined) return [[dim(theme, view.file)]]
  const rows = view.text.split('\n')
  const gutter = String(rows.length).length
  return rows.map((row, index) => {
    const number = String(index + 1).padStart(gutter)
    const opened = index + 1 === view.line
    return [(opened ? accent : dim)(theme, `${number} `), (opened ? accent : plain)(theme, row.slice(0, Math.max(0, width - gutter - 1)))]
  })
}

/** A task's file as a unified diff: its hunks, added lines marked +, removed lines marked - and dim. */
export function diffLines(theme: ViewerTheme, view: { file: string; diff?: TaskFileDiff }, width: number): Line[] {
  const diff = view.diff
  if (diff === undefined) return [[dim(theme, view.file)]]
  const lines: Line[] = [[plain(theme, diff.file), dim(theme, ` · ${diff.status} · +${diff.additions} -${diff.deletions}`)]]
  for (const hunk of diff.hunks) {
    lines.push([], [dim(theme, hunk.header)])
    for (const line of hunk.lines) {
      const text = line.text.slice(0, Math.max(0, width - 2))
      if (line.kind === 'added') lines.push([accent(theme, '+ '), plain(theme, text)])
      else if (line.kind === 'removed') lines.push([dim(theme, '- '), dim(theme, text)])
      else lines.push([dim(theme, '  '), dim(theme, text)])
    }
  }
  return lines
}
