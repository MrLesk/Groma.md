export type C4Kind = 'actor' | 'system' | 'container' | 'component'
export type Origin = 'observed' | 'planned' | 'missing'
export type TerminalLevel = 'context' | 'components'

export interface Point {
  x: number
  y: number
}

export interface Bounds extends Point {
  width: number
  height: number
}

export interface CodeReference {
  scanner: string
  file: string
  symbol?: string
}

export type MarkdownNode = string | MarkdownElement
export type MarkdownElement = [
  string,
  Record<string, unknown>,
  ...MarkdownNode[],
]

export type Revision =
  | { kind: 'observed'; sourceDirectory: string }
  | { kind: 'missing'; sourceDirectory: string }
  | { kind: 'plan'; name: string; sourceDirectory: string }

export type RevisionDescriptor =
  | { kind: 'observed' }
  | { kind: 'missing' }
  | { kind: 'plan'; name: string }

export interface ArchitectureFrontmatter extends Record<string, unknown> {
  id?: unknown
  kind?: unknown
  parent?: string | null
  external?: unknown
  group?: unknown
  code?: CodeReference[]
}

export interface ArchitectureDocument {
  sourceFilename: string
  nodes: MarkdownNode[]
  frontmatter: ArchitectureFrontmatter
}

export interface RevisionRecord {
  revision: Revision
  context: ArchitectureDocument
  documents: ArchitectureDocument[]
}

export interface FilesystemAccess {
  operation: 'read-directory' | 'read-file' | 'write-file' | 'remove'
  filename: string
}

export type FilesystemAccessHandler = (access: FilesystemAccess) => void

export interface ScanCandidate {
  kind: C4Kind
  name: string
  responsibility: string
  parent?: string
  code?: CodeReference[]
}

export interface ScanResult {
  candidates: ScanCandidate[]
}

export interface ScanSummary {
  created: number
  refreshed: number
  matched: number
}

/** A Backlog task available to the viewers. */
export interface WorkItem {
  id: string
  title: string
  status: string
  assignees: string[]
  description: string
  references: string[]
  /** Repository-relative paths the task recorded as touched, oldest first. */
  modifiedFiles: string[]
  /** The acceptance criteria in order, each with its checked state. */
  criteria: { text: string; checked: boolean }[]
}

/** The Backlog workflow and tasks read together, so viewers interpret every status against the same configuration. */
export interface WorkSnapshot {
  statuses: string[]
  defaultStatus: string
  items: WorkItem[]
}

export interface WorkMarker {
  elementId: string
  taskId: string
  taskTitle: string
  assignees: string[]
}

export interface ArchitectureElement {
  id: string
  kind: C4Kind
  name: string
  description: string
  parentId: string | null
  external: boolean
  group?: string
  technology?: string
  code: CodeReference[]
  sourceFilename: string
}

export interface ArchitectureRelationship {
  sourceId: string
  targetId: string
  description: string
  technology: string
  sourceFilename: string
  targetSourceFilename: string
}

export interface ArchitectureModel {
  revision: Revision
  elements: ArchitectureElement[]
  relationships: ArchitectureRelationship[]
}

export interface AnnotatedElement {
  representationId: string
  id: string
  kind: C4Kind
  name: string
  description: string
  parent: string | null
  children: string[]
  external: boolean
  group?: string
  technology?: string
  code: CodeReference[]
  /** Total lines across the code files; absent only in hand-built worlds. */
  codeLines?: number
  origin: Origin
  plan?: string
}

export interface AnnotatedRelationship {
  id: string
  source: string
  target: string
  description: string
  technology: string
  origin: Origin
  plan?: string
}

/** Semantic architecture needed by a view before any renderer adds geometry. */
export interface ArchitectureGraph {
  elements: AnnotatedElement[]
  relationships: AnnotatedRelationship[]
}

export interface AnnotatedArchitectureModel extends ArchitectureGraph {
  plans: string[]
}

export interface WorldElement extends AnnotatedElement {
  bounds: Bounds
}

export interface WorldRelationship extends AnnotatedRelationship {
  route: Point[]
  label: Bounds | null
}

/** A named cluster of siblings; a narrative overlay, never a parent. */
export interface WorldGroup {
  id: string
  name: string
  parent: string | null
  bounds: Bounds
}

export interface ArchitectureWorld {
  bounds: Bounds
  elements: WorldElement[]
  groups: WorldGroup[]
  relationships: WorldRelationship[]
}

export interface ArchitectureViewModel extends AnnotatedArchitectureModel {
  world: ArchitectureWorld
  work?: WorkMarker[]
}
