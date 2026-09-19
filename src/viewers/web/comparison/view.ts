import type { AnnotatedArchitectureModel } from '../../../types.ts'
import type { ChangeSet, ComparisonPresentation, ElementChange, ChangedFile } from '../../../comparison/model.ts'
import type { FileDiff } from '../../source/diff-lines.ts'
import { fileRow } from '../changes/view.ts'
import { escaped } from '../atoms/escape.ts'

export const changeLabels = { added: 'Added', edited: 'Edited', removed: 'Removed' } as const
export function comparisonTree(world: AnnotatedArchitectureModel, changes: ChangeSet, presentation: ComparisonPresentation, scope?: string): string {
  const byId = new Map(world.elements.map(element => [element.id, element]))
  const byRepresentation = new Map(world.elements.map(element => [element.representationId, element]))
  const included = new Set(changes.elements.map(change => change.id))
  for (const change of changes.elements) {
    let parent = byId.get(change.id)?.parent
    while (parent) {
      const element = byRepresentation.get(parent)
      if (!element || included.has(element.id)) break
      included.add(element.id); parent = element.parent
    }
  }
  const rows = (parent: string | null, depth: number): string => world.elements
    .filter(element => element.parent === parent && included.has(element.id))
    .sort((a, b) => a.title.localeCompare(b.title)).map(element => {
      const change = changes.elements.find(change => change.id === element.id)
      return '<button type="button" class="change-tree-row" data-change-element="' + escaped(element.representationId) + '" style="--depth:' + depth + '">'
        + '<span class="change-dot ' + (change?.status ?? '') + '" aria-label="' + (change ? changeLabels[change.status] : 'Context') + '"></span>'
        + '<span>' + escaped(element.title) + '</span></button>' + rows(element.representationId, depth + 1)
    }).join('')
  const unmapped = changes.files.filter(file => !file.beforeOwner && !file.afterOwner)
  return '<div class="comparison-tree"><div class="comparison-modes" role="group" aria-label="Comparison presentation">'
    + (['changes', 'before', 'after'] as const).map(mode => '<button type="button" data-presentation="' + mode + '" aria-pressed="' + (mode === presentation) + '">' + mode[0]!.toUpperCase() + mode.slice(1) + '</button>').join('')
    + '</div><div class="comparison-counts">' + changes.elements.length + (changes.elements.length === 1 ? ' element · ' : ' elements · ') + changes.files.length + (changes.files.length === 1 ? ' file</div>' : ' files</div>')
    + (scope ? '<button class="comparison-scope" type="button" data-clear-scope>' + escaped(scope) + ' ×</button>' : '')
    + '<div class="change-legend"><span class="added">Added</span><span class="edited">Edited</span><span class="removed">Removed</span></div>'
    + rows(null, 0)
    + (changes.relationships.length ? '<h3>Relationships · ' + changes.relationships.length + '</h3>' + changes.relationships.map(change => {
      const item = world.relationships.find(item => item.id === change.id)!
      return '<button class="change-tree-row" type="button" data-change-element="' + escaped(item.id) + '"><span class="change-dot ' + change.status + '"></span><span>' + escaped((byRepresentation.get(item.source)?.title ?? item.source) + ' → ' + (byRepresentation.get(item.target)?.title ?? item.target)) + '</span></button>'
    }).join('') : '')
    + (unmapped.length ? '<h3>Unmapped files · ' + unmapped.length + '</h3>' + unmapped.map(file => '<button class="change-tree-row" type="button" data-change-file="' + escaped(file.file) + '"><span class="change-dot ' + (file.status === 'added' ? 'added' : file.status === 'deleted' ? 'removed' : 'edited') + '"></span><span>' + escaped(file.file) + '</span></button>').join('') : '')
    + (changes.files.length + changes.elements.length + changes.relationships.length === 0 ? '<p>No changes</p>' : '') + '</div>'
}

export function reasonSummary(change: ElementChange, before: AnnotatedArchitectureModel): HTMLElement {
  const reasons = document.createElement('div')
  reasons.className = 'comparison-reasons'
  const previous = change.previousParent == null ? undefined : before.elements.find(element => element.representationId === change.previousParent)?.title
  reasons.textContent = change.reasons.join(' · ') + (previous ? ' · Previously in ' + previous : '')
  return reasons
}

export function fileSummary(file: ChangedFile): FileDiff {
  return { file: file.file, previousFile: file.previousFile, status: file.status === 'renamed' ? 'modified' : file.status,
    binary: file.binary, shared: file.shared ?? false, additions: file.additions ?? 0, deletions: file.deletions ?? 0, hunks: [] }
}

export function changedFileRows(files: ChangedFile[], open: (file: string) => void): HTMLElement {
  const list = document.createElement('ul')
  list.className = 'comparison-files'
  list.append(...files.map(file => fileRow(fileSummary(file), open)))
  return list
}

export const comparisonCss = `
  .comparison-modes { display: flex; gap: 3px; padding: 4px; background: var(--hover); border-radius: var(--chrome-radius); }
  .comparison-modes button { flex: 1; padding: 7px; border: 0; border-radius: var(--control-radius); background: transparent; color: var(--muted); font: inherit; cursor: pointer; }
  .comparison-modes [aria-pressed="true"] { background: var(--paper); color: var(--ink); box-shadow: 0 1px 4px var(--hairline); }
  .comparison-counts { padding: 12px 0 8px; color: var(--muted); font-size: 10px; }
  .change-legend { display: flex; gap: 13px; padding-bottom: 12px; font-size: 10px; }
  .change-legend .added, .comparison-status.added { color: var(--change-added); }
  .change-legend .edited, .comparison-status.edited { color: var(--change-edited); }
  .change-legend .removed, .comparison-status.removed { color: var(--change-removed); }
  .change-tree-row { border: 0; background: transparent; color: var(--ink); width: 100%; padding: 8px 4px 8px calc(4px + var(--depth, 0) * 12px); display: flex; gap: 8px; align-items: center; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
  .change-tree-row:hover, .change-tree-row:focus-visible { background: var(--hover); }
  .change-tree-row > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .change-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--hairline); }
  .change-dot.added { background: var(--change-added); } .change-dot.edited { background: var(--change-edited); } .change-dot.removed { background: var(--change-removed); }
  .comparison-tree h3 { font-size: 10px; color: var(--muted); border-top: 1px solid var(--hairline); padding-top: 16px; }
  .comparison-scope { border: 1px solid var(--hairline); color: var(--ink); background: var(--hover); border-radius: var(--control-radius); padding: 6px 8px; font: inherit; margin-bottom: 12px; cursor: pointer; }
  #details .comparison-summary { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--hairline); }
  #details .comparison-status { font-size: 11px; font-weight: 600; }
  #details .comparison-reasons { font-size: 10px; color: var(--muted); margin-top: 7px; }
  #details .comparison-files { list-style: none; padding: 0; margin-top: 8px; }
`
