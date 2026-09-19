import type { GitFileChange, GitRange } from '../history/git-state.ts'
import type { AnnotatedArchitectureModel } from '../types.ts'

export type ChangeStatus = 'added' | 'edited' | 'removed'
export type ComparisonPresentation = 'changes' | 'before' | 'after'
export interface ChangedFile extends GitFileChange {
  beforeOwner?: string
  afterOwner?: string
  shared?: boolean
}
export interface ElementChange {
  id: string
  status: ChangeStatus
  reasons: string[]
  previousParent?: string | null
}
export interface RelationshipChange { id: string; status: ChangeStatus }
export interface ChangeSet {
  range: GitRange
  files: ChangedFile[]
  elements: ElementChange[]
  relationships: RelationshipChange[]
}
export interface Comparison extends ChangeSet {
  before: AnnotatedArchitectureModel
  after: AnnotatedArchitectureModel
}

/** Scope affects evidence, never the selected versions. Task references are not evidence. */
export function scopeChanges(changes: ChangeSet, paths?: readonly string[]): ChangeSet {
  if (paths === undefined) return changes
  const scope = new Set(paths)
  const files = changes.files.filter(file => scope.has(file.file) || (file.previousFile !== undefined && scope.has(file.previousFile)))
  const owners = new Set(files.flatMap(file => [file.beforeOwner, file.afterOwner].filter((id): id is string => id !== undefined)))
  return { ...changes, files, elements: changes.elements.filter(element => owners.has(element.id)).map(element => element.status === 'edited' ? { ...element, reasons: ['Code'], previousParent: undefined } : element), relationships: [] }
}
