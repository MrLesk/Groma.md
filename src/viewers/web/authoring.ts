import { createRelateDialog } from './chrome/relate.ts'
import type { WebDataSource } from './data.ts'
import type { MeaningEdit, PaneWrites, RelationWrites } from './organisms/details.ts'

export interface AuthoringDependencies {
  /** True on the current revision of a live map, the only place writes are offered. */
  live: () => boolean
  drafts: () => readonly string[]
  titleOf: (id: string) => string
  repaint: () => void
}

/** The write hooks the panes get, and the armed relation: Relate to waits for the next element click to be the target. */
export function createAuthoring(data: WebDataSource, deps: AuthoringDependencies) {
  const { add, edit, remove } = data
  const dialog = add === undefined ? undefined : createRelateDialog(add)
  let armed: string | undefined

  function disarm(): void {
    armed = undefined
    document.body.classList.remove('relating')
  }

  function paneWrites(selectedId: string): PaneWrites {
    if (armed !== undefined && armed !== selectedId) disarm()
    if (!deps.live()) return {}
    return {
      ...(remove === undefined ? {} : { onRemove: () => remove({ id: selectedId }) }),
      ...(edit === undefined ? {} : { onEdit: (input: MeaningEdit) => edit({ id: selectedId, ...input }), drafts: deps.drafts() }),
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

  return { paneWrites, relationWrites, takeTarget, disarm }
}
