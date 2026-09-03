import { createGroupDialog } from './chrome/group.ts'
import { createRelateDialog } from './chrome/relate.ts'
import type { WebDataSource } from './data.ts'
import type { ZoneAddress } from './iso/map.ts'
import type { MeaningEdit, PaneWrites, ParentOption, RelationWrites, SelectionWrites } from './organisms/writes.ts'

export interface AuthoringDependencies {
  /** True on the current revision of a live map, the only place writes are offered. */
  live: () => boolean
  drafts: () => readonly string[]
  parents: () => readonly ParentOption[]
  titleOf: (id: string) => string
  repaint: () => void
}

/** The write hooks the panes get, and the armed relation: Relate to waits for the next element click to be the target. */
export function createAuthoring(data: WebDataSource, deps: AuthoringDependencies) {
  const { accept, add, edit, remove } = data
  const dialog = add === undefined ? undefined : createRelateDialog(add)
  const groupDialog = edit === undefined || remove === undefined ? undefined : createGroupDialog(edit, remove)
  let armed: string | undefined

  function disarm(): void {
    armed = undefined
    document.body.classList.remove('relating')
  }

  /** Group as and Combine into, while several components are selected. */
  function selectionWrites(ids: readonly string[]): SelectionWrites | undefined {
    if (ids.length < 2 || add === undefined || edit === undefined) return undefined
    return {
      members: ids.map(id => ({ id, title: deps.titleOf(id) })),
      onGroup: name => add({ thing: 'group', name, members: [...ids] }),
      onCombine: survivor => edit({ id: survivor, combine: ids.filter(id => id !== survivor) }),
    }
  }

  function paneWrites(selectedId: string, selectedIds: readonly string[]): PaneWrites {
    if (armed !== undefined && armed !== selectedId) disarm()
    if (!deps.live()) return {}
    const selection = selectionWrites(selectedIds)
    return {
      ...(selection === undefined ? {} : { selection }),
      ...(remove === undefined ? {} : { onRemove: () => remove({ id: selectedId }) }),
      ...(accept === undefined ? {} : { onAccept: () => accept({ id: selectedId }) }),
      ...(edit === undefined ? {} : {
        onEdit: (input: MeaningEdit) => edit({ id: selectedId, ...input }),
        drafts: deps.drafts(),
        parents: deps.parents(),
      }),
      ...(dialog === undefined ? {} : {
        relate: {
          armed: armed === selectedId,
          toggle: () => {
            if (armed === selectedId) disarm()
            else {
              armed = selectedId
              document.body.classList.add('relating')
            }
            deps.repaint()
          },
        },
      }),
    }
  }

  function relationWrites(source: string, target: string): RelationWrites {
    if (!deps.live()) return {}
    return {
      ...(edit === undefined ? {} : { onEdit: (input: { description?: string; technology?: string }) => edit({ id: source, relation: target, ...input }) }),
      ...(remove === undefined ? {} : { onRemove: () => remove({ id: source, relation: target }) }),
    }
  }

  /** True when the click was the target of an armed relation, so the dialog opens instead of a selection. */
  function takeTarget(id: string): boolean {
    if (armed === undefined || dialog === undefined) return false
    const source = armed
    disarm()
    deps.repaint()
    if (id !== source) {
      dialog.open({ source, target: id, sourceTitle: deps.titleOf(source), targetTitle: deps.titleOf(id) })
    }
    return true
  }

  /** A pressed zone opens the group dialog on the current revision of a live map; elsewhere the press selects as before. */
  function editGroup(group: ZoneAddress): boolean {
    if (!deps.live() || groupDialog === undefined) return false
    groupDialog.open(group)
    return true
  }

  return { paneWrites, relationWrites, takeTarget, disarm, editGroup }
}
