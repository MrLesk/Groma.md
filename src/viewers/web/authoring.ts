import { createGroupDialog } from './chrome/group.ts'
import type { AnnotatedArchitectureModel } from '../../types.ts'
import { createMapEditor } from './editing/gestures.ts'
import type { WebDataSource } from './data.ts'
import type { IsoMap, ZoneAddress } from './iso/map.ts'
import type { MeaningEdit, PaneWrites, RelationWrites, SelectionWrites } from './organisms/writes.ts'

export interface AuthoringDependencies {
  /** True on the current revision of a live map, the only place writes are offered. */
  live: () => boolean
  world: () => AnnotatedArchitectureModel
  repaint: () => void
}

/** Shared write operations for details and group actions. */
export function createAuthoring(host: HTMLElement, map: IsoMap, data: WebDataSource, deps: AuthoringDependencies) {
  const gestures = createMapEditor(host, map, data, () => deps.world().elements, deps.live)
  const { accept, add, edit, remove } = data
  const titleOf = (id: string): string => deps.world().elements.find(element => element.id === id)?.title ?? id
  const groupDialog = edit === undefined || remove === undefined ? undefined : createGroupDialog(edit, remove)
  /** Group as and Combine into, while several components are selected. */
  function selectionWrites(ids: readonly string[]): SelectionWrites | undefined {
    if (ids.length < 2 || add === undefined || edit === undefined) return undefined
    return {
      members: ids.map(id => ({ id, title: titleOf(id) })),
      onGroup: name => add({ thing: 'group', name, members: [...ids] }),
      onCombine: survivor => edit({ id: survivor, combine: ids.filter(id => id !== survivor) }),
    }
  }

  function paneWrites(selectedId: string, selectedIds: readonly string[]): PaneWrites {
    if (!deps.live()) return {}
    const selection = selectionWrites(selectedIds)
    return {
      onRead: deps.repaint,
      ...(selection === undefined ? {} : { selection }),
      ...(remove === undefined ? {} : { onRemove: () => remove({ id: selectedId }) }),
      ...(accept === undefined ? {} : { onAccept: () => accept({ id: selectedId }) }),
      ...(edit === undefined ? {} : {
        onEdit: (input: MeaningEdit) => edit({ id: selectedId, ...input }),
        drafts: deps.world().drafts,
        parents: deps.world().elements.filter(element => element.kind === 'container')
          .map(element => ({ id: element.id, title: element.title }))
          .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id)),
      }),

    }
  }

  function relationWrites(source: string, target: string): RelationWrites {
    if (!deps.live()) return {}
    return {
      onRead: deps.repaint,
      ...(accept === undefined ? {} : { onAccept: () => accept({ id: source, relation: target }) }),
      ...(edit === undefined ? {} : { onEdit: (input: { description?: string; technology?: string }) => edit({ id: source, relation: target, ...input }) }),
      ...(remove === undefined ? {} : { onRemove: () => remove({ id: source, relation: target }) }),
    }
  }

  /** A pressed zone opens the group dialog on the current revision of a live map; elsewhere the press selects as before. */
  function editGroup(group: ZoneAddress): boolean {
    if (!deps.live() || groupDialog === undefined) return false
    groupDialog.open(group)
    return true
  }

  return { paneWrites, relationWrites, editGroup, ...gestures }
}
