export interface WorkSourceReadiness {
  status: 'found' | 'missing'
  install?: string
}

export interface WorkChecklistItem {
  text: string
  checked: boolean
}

export interface WorkComment {
  body: string
  createdAt: string
  author: string
}

export interface WorkItem {
  id: string
  title: string
  status: string
  assignees: string[]
  references: string[]
  modifiedFiles: string[]
  acceptanceCriteriaCompleted: number
  acceptanceCriteriaCount: number
  updatedAt: string
}

export interface WorkItemDetails {
  id: string
  description: string
  acceptanceCriteria: WorkChecklistItem[]
  definitionOfDone: WorkChecklistItem[]
  implementationPlan: string
  implementationNotes: string
  comments: WorkComment[]
}

export interface WorkSnapshot {
  statuses: string[]
  defaultStatus: string
  items: WorkItem[]
}

export interface WorkSource {
  read(): Promise<WorkSnapshot>
  readItem(id: string): Promise<WorkItemDetails>
  watch(onChange: () => void): { close(): void }
}

export interface WorkSourcePlugin {
  id: string
  readiness(): WorkSourceReadiness
  create(repositoryRoot: string): WorkSource
}

export const EMPTY_WORK_SNAPSHOT: WorkSnapshot = {
  statuses: [],
  defaultStatus: '',
  items: [],
}

export const EMPTY_WORK_SOURCE: WorkSource = {
  read: async () => EMPTY_WORK_SNAPSHOT,
  readItem: async id => { throw new Error(`Task not found: ${id}`) },
  watch: () => ({ close() {} }),
}
