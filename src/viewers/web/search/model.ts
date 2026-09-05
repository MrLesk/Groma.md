import type { WorkItem } from '@groma/work-source'
import Fuse from 'fuse.js/basic'

import { createArchitectureSearch, type ArchitectureSearchResult } from '../../../search.ts'
import type { AnnotatedElement } from '../../../types.ts'

export type WebSearchResult =
  | ({ kind: 'architecture' } & ArchitectureSearchResult)
  | { kind: 'task'; task: WorkItem; score: number }

function taskIndex(tasks: readonly WorkItem[]) {
  return new Fuse(tasks, {
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'id', weight: 0.3 },
    ],
  })
}

/** Combines core architecture search with summaries supplied by an optional work plugin. */
export function createWebSearch(elements: readonly AnnotatedElement[], tasks: readonly WorkItem[]) {
  const architecture = createArchitectureSearch(elements)
  let work = taskIndex(tasks)

  return {
    updateTasks(tasks: readonly WorkItem[]) {
      work = taskIndex(tasks)
    },
    find(query: string): WebSearchResult[] {
      const pattern = query.trim()
      if (pattern.length === 0) return []
      const results: WebSearchResult[] = [
        ...architecture.find(pattern).map(result => ({ kind: 'architecture' as const, ...result })),
        ...work.search(pattern).map(({ item, score }) => ({ kind: 'task' as const, task: item, score: score! })),
      ]
      return results.sort((left, right) => left.score - right.score)
    },
  }
}
