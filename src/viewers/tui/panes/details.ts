import { TextAttributes } from '@opentui/core'

import { actionCaption, outgoingActions, travelledBy } from '../../action-path.ts'
import { kindLabel } from '../../atoms/kind.ts'
import type { ProjectProfile } from '../../../project-profile.ts'
import { parentOfElements, promotedPeer } from '../../relationship-text.ts'
import type { ViewerTheme } from '../atoms/theme.ts'
import { flowEndpointLabel, type ProjectedFlowStep } from '../flow.ts'
import type { DetailsTab } from '../navigation.ts'
import type {
  AnnotatedElement,
  AnnotatedRelationship,
  ArchitectureGraph,
  WorkItem,
} from '../../../types.ts'
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

function codeRows(theme: ViewerTheme, element: AnnotatedElement, width: number): Line[] {
  if (element.code.length === 0) return []
  const files = new Set(element.code.map(reference => reference.file)).size
  const measure: Line[] = (element.codeLines ?? 0) > 0
    ? [[dim(theme, `${files} ${files === 1 ? 'file' : 'files'} · ~${element.codeLines} lines`)]]
    : []
  return [[], heading(theme, 'Code', width), ...measure, ...element.code.flatMap(reference => [
    [plain(theme, reference.file)],
    [dim(theme, reference.symbol === undefined ? reference.scanner : `${reference.symbol} · ${reference.scanner}`)],
  ])]
}

function howLines(theme: ViewerTheme, element: AnnotatedElement, world: ArchitectureGraph, width: number, activeActionId: string | undefined, actionCursor: string | undefined): PaneLines {
  const lines: Line[] = [...technologyRows(theme, element, width), ...codeRows(theme, element, width)]
  let cursor: number | undefined
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

/** Outgoing commands first, then everything that points at the element or its promoted parent. */
function relationshipRows(element: AnnotatedElement, world: ArchitectureGraph, byId: Elements): RelationshipRow[] {
  const parentOf = parentOfElements(world.elements)
  const incoming = world.relationships.filter(relationship => {
    return promotedPeer(relationship, element.representationId, parentOf)?.outgoing === false
  })
  return [
    ...outgoingActions(element.representationId, world).map(relationship => ({ relationship, outgoing: true, peer: byId.get(relationship.target) })),
    ...incoming.map(relationship => ({
      relationship,
      outgoing: false,
      peer: byId.get(promotedPeer(relationship, element.representationId, parentOf)?.peerId ?? relationship.source),
    })),
  ]
}

function relationshipLines(theme: ViewerTheme, row: RelationshipRow, byId: Elements, width: number, lit: boolean, atCursor: boolean): Line[] {
  const arrow = row.outgoing ? '→ ' : '← '
  const caption = actionCaption(row.relationship, row.outgoing, id => byId.get(id)?.title)
  const rest = caption.detail === '' ? '' : ` · ${caption.detail}`
  const peerMark: Line = row.outgoing || row.peer === undefined ? [] : [kindMark(theme, row.peer.kind, row.peer.external), plain(theme, ' ')]
  const markWidth = peerMark.length === 0 ? 0 : 2
  if (arrow.length + markWidth + caption.title.length + rest.length <= width) {
    return [styleRow(theme, [dim(theme, arrow), ...peerMark, plain(theme, caption.title), dim(theme, rest)], width, lit, atCursor)]
  }
  return [
    styleRow(theme, [dim(theme, arrow), ...peerMark, plain(theme, caption.title)], width, lit, atCursor),
    ...wrap(caption.detail, width - arrow.length).map(line => styleRow(theme, [dim(theme, `${' '.repeat(arrow.length)}${line}`)], width, lit, false)),
  ]
}

function childRows(theme: ViewerTheme, element: AnnotatedElement, byId: Elements, width: number): Line[] {
  if (element.children.length === 0) return []
  return [[], heading(theme, 'Children', width), ...element.children.map(childId => {
    const child = byId.get(childId)
    return child === undefined ? [plain(theme, childId)] : [kindMark(theme, child.kind, child.external), plain(theme, ` ${child.title}`)]
  })]
}

function whatLines(theme: ViewerTheme, element: AnnotatedElement, world: ArchitectureGraph, byId: Elements, width: number, activeActionId: string | undefined, actionCursor: string | undefined): PaneLines {
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
  return { lines, cursor }
}

/** The selected element under one tab: its kind line, then meaning or evidence. */
export function detailsLines(
  theme: ViewerTheme,
  element: AnnotatedElement,
  world: ArchitectureGraph,
  width: number,
  tab: DetailsTab,
  activeActionId: string | undefined,
  actionCursor: string | undefined,
): PaneLines {
  const byId: Elements = new Map(world.elements.map(item => [item.representationId, item]))
  const head: Line = [
    kindMark(theme, element.kind, element.external),
    chunk(` ${kindLabel(element.kind, element.external)}`, theme.foreground, element.external ? TextAttributes.DIM : 0),
    dim(theme, ' · '),
    chunk(element.origin, theme[element.origin], TextAttributes.BOLD),
  ]
  const body = tab === 'how'
    ? howLines(theme, element, world, width, activeActionId, actionCursor)
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
