export type C4Kind = 'person' | 'system' | 'container' | 'component'
export type Origin = 'observed' | 'planned' | 'missing'
export type SemanticLevel = 'context' | 'containers' | 'components'
export type DisplayRole =
  | 'card'
  | 'compact'
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

export interface ScannerRelationship {
  sourceId: string
  targetId: string
  description: string
  technology: string
  sourceRange: string
}

export interface ScannedComponent {
  id: string
  name: string
  description: string
  technology: string
  sourceRange: string
  relationships: ScannerRelationship[]
}

export interface ScannerEntryPoint {
  componentId: string
  sourceRange: string
}

export interface TypeScriptScanResult {
  contract: string
  containerId: string
  entryPoints: ScannerEntryPoint[]
  components: ScannedComponent[]
}

export interface ArchitectureElement {
  id: string
  kind: C4Kind
  name: string
  description: string
  parentId: string | null
  external: boolean
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

export interface ArchitectureWorld {
  bounds: Bounds
  elements: WorldElement[]
  relationships: WorldRelationship[]
}

export interface ArchitectureViewModel extends AnnotatedArchitectureModel {
  world: ArchitectureWorld
}

export interface ProjectedElement extends WorldElement {
  display: DisplayRole
  cellBounds: Bounds
}

export interface ProjectedRelationship extends WorldRelationship {
  cellRoute: Point[]
  cellLabel: Pick<Bounds, 'x' | 'y' | 'width'> | null
  displaySource: string
  displayTarget: string
}

export interface WorldProjection {
  level: SemanticLevel
  levelName: string
  currentId: string | null
  currentName: string
  scale: number
  viewport: Bounds
  elements: ProjectedElement[]
  relationships: ProjectedRelationship[]
}

export interface ProjectionOptions {
  width: number
  height: number
  level?: SemanticLevel
  currentId?: string
}
