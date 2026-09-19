/** Browser-safe discovery contract. Sources own provider access; the host owns comparison. */
export type GitState = { kind: 'working-tree' } | { kind: 'commit'; sha: string }
export interface GitRange { base: string; target: GitState }
export interface RevisionChoice { sha: string; label: string }
export interface RevisionSelection { target: RevisionChoice; base?: RevisionChoice; url?: string }
export interface RevisionEntry {
  id: string
  title: string
  detail?: string
  sha?: string
  state?: string
  url?: string
}
export interface RevisionCollection { id: string; label: string; states?: readonly string[] }
export interface RevisionQuery { collection: string; search?: string; cursor?: string; state?: string }
export interface RevisionPage { entries: RevisionEntry[]; cursor?: string }
export interface RevisionSourceState {
  id: string
  label: string
  enabled: boolean
  ready: boolean
  message?: string
  context?: string
  configurable?: boolean
  repository?: string
  repositories?: { id: string; label: string }[]
  collections: readonly RevisionCollection[]
}
export interface RevisionSourceSettings { enabled: boolean; repository?: string }
export interface RevisionSource {
  id: string
  readiness(): Promise<RevisionSourceState>
  list(query: RevisionQuery): Promise<RevisionPage>
  /** Success means all returned commits can be read in the local object database. */
  resolve(id: string): Promise<RevisionSelection>
  configure?(settings: RevisionSourceSettings): Promise<void>
  close(): Promise<void>
}
