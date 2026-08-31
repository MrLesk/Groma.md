import Fuse from 'fuse.js/basic'

import { compareSemanticElements } from './element-order.ts'
import type { AnnotatedElement } from './types.ts'

export interface ArchitectureSearchResult {
  element: AnnotatedElement
  /** Ancestor titles from the architecture root to the element's parent. */
  path: readonly string[]
}

export interface ArchitectureSearch {
  find(query: string): ArchitectureSearchResult[]
}

function ancestorPath(
  element: AnnotatedElement,
  byId: ReadonlyMap<string, AnnotatedElement>,
): string[] {
  const path: string[] = []
  let parent = element.parent === null ? undefined : byId.get(element.parent)
  while (parent !== undefined) {
    path.unshift(parent.title)
    parent = parent.parent === null ? undefined : byId.get(parent.parent)
  }
  return path
}

/** One semantic architecture index shared by every viewer. */
export function createArchitectureSearch(
  elements: readonly AnnotatedElement[],
): ArchitectureSearch {
  const byId = new Map(elements.map(element => [element.representationId, element]))
  const records = [...elements].sort(compareSemanticElements).map(element => {
    const path = ancestorPath(element, byId)
    return { element, path, pathText: path.join(' ') }
  })
  const fuse = new Fuse(records, {
    threshold: 0.35,
    ignoreLocation: true,
    keys: [
      { name: 'element.title', weight: 0.55 },
      { name: 'element.id', weight: 0.25 },
      { name: 'pathText', weight: 0.15 },
      { name: 'element.overview', weight: 0.05 },
    ],
  })

  return {
    find(query) {
      const pattern = query.trim()
      if (pattern.length === 0) return []
      return fuse.search(pattern).map(({ item }) => ({
        element: item.element,
        path: item.path,
      }))
    },
  }
}
