export type C4Kind = 'actor' | 'system' | 'container' | 'component'
export type Origin = 'observed' | 'draft'
/** The OKF lifecycle word every element document carries. */
export type ElementStatus = 'draft' | 'stable'
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
  /** Distinct scanned source files this file depends on. */
  dependencies?: number
  /** Distinct scanned source files that depend on this file. */
  dependents?: number
  /** Runtime source measurement; authored architecture never supplies it. */
  lines?: number
}

export type MarkdownNode = string | MarkdownElement
export type MarkdownElement = [
  string,
  Record<string, unknown>,
  ...MarkdownNode[],
]

export interface ArchitectureFrontmatter extends Record<string, unknown> {
  type?: unknown
  title?: unknown
  description?: unknown
  groma?: unknown
}

export interface ArchitectureDocument {
  sourceFilename: string
  body: string
  nodes: MarkdownNode[]
  frontmatter: ArchitectureFrontmatter
}

/** Every Markdown record under the Groma directory, read in one pass. */
export interface ArchitectureRecords {
  flows: ArchitectureDocument[]
  /** C4 element documents, ghosts (status draft) included. */
  documents: ArchitectureDocument[]
  /** Draft records under drafts/. */
  drafts: ArchitectureDocument[]
}

export interface FilesystemAccess {
  operation: 'read-directory' | 'read-file' | 'write-file' | 'remove'
  filename: string
}

export type FilesystemAccessHandler = (access: FilesystemAccess) => void

export interface ScanSummary {
  created: number
  refreshed: number
  matched: number
}

export type {
  WorkChecklistItem,
  WorkComment,
  WorkItem,
  WorkItemDetails,
  WorkSnapshot,
} from '@groma/work-source'

export interface ArchitectureElement {
  id: string
  kind: C4Kind
  title: string
  description?: string
  overview: string
  parentId: string | null
  external: boolean
  group?: string
  technology?: string
  code: CodeReference[]
  status: ElementStatus
  /** The draft record this element belongs to; a stable element may carry it too. */
  draft?: string
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
  elements: ArchitectureElement[]
  relationships: ArchitectureRelationship[]
}

export interface AnnotatedElement {
  representationId: string
  id: string
  kind: C4Kind
  title: string
  description?: string
  overview: string
  parent: string | null
  children: string[]
  external: boolean
  group?: string
  technology?: string
  code: CodeReference[]
  /** Total lines across the code files; absent only in hand-built worlds. */
  codeLines?: number
  /** Core decision that this element may move; absent only in hand-built worlds. */
  movable?: boolean
  origin: Origin
  draft?: string
}

export interface AnnotatedRelationship {
  id: string
  source: string
  target: string
  description: string
  technology: string
  origin: Origin
  draft?: string
}

/** Semantic architecture needed by a view before any renderer adds geometry. */
export interface ArchitectureGraph {
  flows: ArchitectureFlow[]
  elements: AnnotatedElement[]
  relationships: AnnotatedRelationship[]
}

/** A named scenario; steps reference existing relationships in their authored order. */
export interface ArchitectureFlow {
  id: string
  title: string
  description?: string
  overview: string
  sourceFilename: string
  steps: FlowStep[]
}

export interface FlowStep {
  relationshipId: string
  source: string
  target: string
  action: string
}

export interface AnnotatedArchitectureModel extends ArchitectureGraph {
  drafts: string[]
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
  flows: ArchitectureFlow[]
  bounds: Bounds
  elements: WorldElement[]
  groups: WorldGroup[]
  relationships: WorldRelationship[]
}
