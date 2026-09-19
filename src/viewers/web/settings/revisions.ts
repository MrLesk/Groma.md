import type { WebDataSource } from '../data.ts'
import type { RevisionSourceState } from '@groma/revision-source'
import { escaped } from '../atoms/escape.ts'

/** Source-owned readiness and repository choices inside the existing Plugins settings. */
export function revisionSettings(data: WebDataSource, host: HTMLElement) {
  let generation = 0
  function row(state: RevisionSourceState) {
    const options = '<option value="">Choose repository</option>' + (state.repositories ?? []).map(repository =>
      '<option value="' + escaped(repository.id) + '"' + (repository.id === state.repository ? ' selected' : '') + '>' + escaped(repository.label) + '</option>').join('')
    return '<fieldset data-source="' + escaped(state.id) + '"><legend>' + escaped(state.label) + '</legend>'
      + '<label><input type="checkbox"' + (state.enabled ? ' checked' : '') + '> Enabled</label>'
      + '<select aria-label="' + escaped(state.label) + ' repository">' + options + '</select>'
      + '<div role="status">' + escaped(state.message ?? (state.ready ? 'Ready' : 'Disabled')) + '</div></fieldset>'
  }
  async function refresh() {
    if (!data.readRevisionSources) return
    const ticket = ++generation
    try {
      const sources = await data.readRevisionSources()
      if (ticket !== generation) return
      host.innerHTML = '<h3>Revision sources</h3>' + sources.filter(source => source.configurable).map(row).join('')
    } catch (error) { if (ticket === generation) host.textContent = error instanceof Error ? error.message : String(error) }
  }
  host.addEventListener('change', async event => {
    const field = (event.target as Element).closest<HTMLFieldSetElement>('fieldset[data-source]')
    if (!field || !data.changeRevisionSource) return
    const enabled = field.querySelector('input')!.checked
    const repository = field.querySelector('select')!.value || undefined
    field.disabled = true
    try {
      await data.changeRevisionSource(field.dataset.source!, { enabled, repository })
      await refresh()
    } catch (error) {
      field.querySelector('[role="status"]')!.textContent = error instanceof Error ? error.message : String(error)
      field.disabled = false
    }
  })
  return { refresh }
}

export const revisionSettingsCss = `
  #revision-settings h3 { font-size: 12px; margin: 20px 0 12px; }
  #revision-settings fieldset { border: 1px solid var(--hairline); border-radius: var(--chrome-radius); margin: 12px 0; padding: 12px; display: grid; gap: 12px; }
  #revision-settings legend { font-size: 12px; padding: 0 6px; }
  #revision-settings select { background: var(--paper); color: var(--ink); border: 1px solid var(--hairline); border-radius: var(--control-radius); padding: 8px; font: inherit; max-width: 100%; }
  #revision-settings [role="status"] { color: var(--muted); font-size: 11px; white-space: pre-wrap; }
`
