import type { ArchitectureSearch } from '../../search.ts'
import type { TerminalViewModel } from './model.ts'
import { syncTree } from './navigation.ts'
import type { ViewerState } from './navigation.ts'
import { levelFor } from './navigation-spatial.ts'
import type { AnnotatedElement, TerminalLevel } from '../../types.ts'

export type SearchInput =
  | { type: 'open' }
  | { type: 'char'; char: string }
  | { type: 'delete' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'accept' }
  | { type: 'cancel' }

export interface SearchState {
  query: string
  index: number
  matches: AnnotatedElement[]
  /** The view to restore when search is cancelled. */
  before: { level: TerminalLevel; currentId?: string }
}

/** The current match drives selection live; no match leaves the view alone. */
function followMatch(world: TerminalViewModel, state: ViewerState): ViewerState {
  const search = state.search
  if (!search) return state
  const match = search.matches[search.index]
  if (!match) return state
  return syncTree(world, {
    ...state,
    level: levelFor(match),
    currentId: match.representationId,
  })
}

export function reduceSearch(
  world: TerminalViewModel,
  architectureSearch: ArchitectureSearch,
  state: ViewerState,
  input: SearchInput,
): ViewerState {
  if (input.type === 'open') {
    return {
      ...state,
      search: {
        query: '',
        index: 0,
        matches: [],
        before: { level: state.level, currentId: state.currentId },
      },
    }
  }
  const search = state.search
  if (!search) return state
  if (input.type === 'char' || input.type === 'delete') {
    const query = input.type === 'char'
      ? search.query + input.char
      : search.query.slice(0, -1)
    const matches = architectureSearch.find(query).map(result => result.element)
    return followMatch(world, {
      ...state,
      search: { ...search, query, matches, index: 0 },
    })
  }
  if (input.type === 'next' || input.type === 'previous') {
    const count = search.matches.length
    if (count === 0) return state
    const step = input.type === 'next' ? 1 : -1
    const index = (search.index + step + count) % count
    return followMatch(world, { ...state, search: { ...search, index } })
  }
  if (input.type === 'accept') {
    return { ...state, search: undefined }
  }
  return syncTree(world, {
    ...state,
    search: undefined,
    level: search.before.level,
    currentId: search.before.currentId,
  })
}
