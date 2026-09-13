import type { ArchitectureGraph } from '../../../types.ts'
import type { SourcePayload } from '../../source/read.ts'
import { createSettingsDialog } from '../atoms/settings-dialog.ts'
import { createDuplicatesControl } from '../duplicates/control.ts'

export const projectReviewControl = '<button id="duplicates-toggle" class="chrome-button" type="button" aria-label="Project review" title="Project review" aria-haspopup="dialog" aria-expanded="false" aria-controls="project-review"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></button>'

export const projectReviewCss = `
  #duplicates-toggle { width: 32px; height: 32px; padding: 0; justify-content: center; color: var(--muted); position: relative; }
  #duplicates-toggle[data-findings="true"]::after { content: ''; position: absolute; top: 3px; right: 3px; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  #project-review h2 { font-size: 13px; margin: 0; }
`

interface Options {
  world(): ArchitectureGraph
  revision(): string | undefined
  readSource(element: string, file: string, revision?: string): Promise<SourcePayload>
  navigate(owner: string, file?: string, line?: number): void
}

/** Project review owns findings; plugin configuration lives in Settings. */
export function createProjectReview(options: Options) {
  const toggle = document.getElementById('duplicates-toggle')!
  const popup = createSettingsDialog('project-review', 'Project review', '<h2 id="duplicates-title">Potential duplicates</h2><section id="duplicates-panel" aria-labelledby="duplicates-title"></section>', { onClose: () => duplicates.hide() })
  const duplicates = createDuplicatesControl({ ...options, host: popup.dialog.querySelector<HTMLElement>('#duplicates-panel')!, close: popup.close })
  function paintIndicator() {
    const count = options.world().findings?.length ?? 0
    toggle.dataset.findings = String(count > 0)
    toggle.title = count ? `Project review · ${count} duplicate ${count === 1 ? 'group' : 'groups'}` : 'Project review'
    popup.dialog.querySelector('h2')!.textContent = `Potential duplicates${count ? ` · ${count}` : ''}`
  }
  toggle.addEventListener('click', () => { popup.open(toggle); duplicates.show() })
  paintIndicator()
  return { refresh() { duplicates.refresh(); paintIndicator() } }
}
