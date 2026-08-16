export type C4Kind = 'person' | 'system' | 'container' | 'component'
export type Origin = 'observed' | 'planned' | 'missing'
export type SemanticLevel = 'context' | 'containers' | 'components'
export type DisplayRole =
  | 'card'
  | 'hidden'
  | 'system-boundary'
  | 'container-boundary'

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

export interface ArchitectureElement {
  id: string
  kind: C4Kind
  name: string
  description: string
  parentId: string | null
  external: boolean
  group?: string
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
  code: CodeReference[]
  origin: Origin
  plan?: string
}

export interface AnnotatedRelationship {
  source: string
  target: string
  description: string
  technology: string
  origin: Origin
  plan?: string
}

export interface AnnotatedArchitectureModel {
  plans: string[]
  elements: AnnotatedElement[]
  relationships: AnnotatedRelationship[]
}

export interface WorldElement extends AnnotatedElement {
  bounds: Bounds
}

export interface WorldRelationship extends AnnotatedRelationship {
  id: string
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
}

export interface ProjectedElement extends WorldElement {
  display: DisplayRole
  cellBounds: Bounds
}

export interface ProjectedGroup extends WorldGroup {
  cellBounds: Bounds
}

export interface ProjectedRelationship extends WorldRelationship {
  cellRoute: Point[]
  cellLabel: Pick<Bounds, 'x' | 'y' | 'width'> | null
  displaySource: string
  displayTarget: string
}

export interface MapCamera {
  zoom: number
  centerX: number
  centerY: number
}

export interface WorldProjection {
  level: SemanticLevel
  currentId: string | null
  fitZoom: number
  camera: MapCamera
  viewport: Bounds
  elements: ProjectedElement[]
  groups: ProjectedGroup[]
  relationships: ProjectedRelationship[]
}

export interface ProjectionOptions {
  /** The map pane interior; the camera projects the world into these cells. */
  viewport: Bounds
  level?: SemanticLevel
  currentId?: string
  camera?: MapCamera
  lockCamera?: boolean
}
