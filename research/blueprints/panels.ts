import type { Blueprint, Draft, Project } from './model.ts'
import { bindingIssues, candidates } from './placement.ts'
import { button, escapeHtml as e } from './view.ts'

const heading = (overline: string, title: string): string => `<div class="panel-head"><span class="eyebrow">${overline}</span><h1>${e(title)}</h1></div>`
const section = (title: string, body: string): string => `<section class="panel-section"><h2>${title}</h2>${body}</section>`
const prose = (text: string): string => `<p class="prose">${e(text)}</p>`
export function catalogue(blueprint: Blueprint): string {
  return `${heading('Library / research fixture', 'Blueprints')}<div class="panel-body">
    <div class="search-box"><span>⌕</span><input id="catalogue-search" aria-label="Search blueprints" placeholder="Search by outcome"></div>
    <div class="catalogue-filters"><span class="pill">All · 1</span><span class="muted">Payments</span></div>
    <article class="blueprint-card" id="catalogue-card">
      <div class="card-preview" aria-hidden="true"><div class="mini-node">Checkout</div><div class="mini-line">↓</div><div class="mini-node ghost">Payment preferences</div><div class="mini-caption">EXISTING → NEW RESPONSIBILITY</div></div>
      <span class="eyebrow">Component pattern · Release ${e(blueprint.release)}</span><h2>${e(blueprint.title)}</h2>${prose(blueprint.outcome)}
      <div class="card-counts"><div><strong>${blueprint.roles.length}</strong>Bindings</div><div><strong>${blueprint.parts.length}</strong>New part</div><div><strong>${blueprint.relationships.length}</strong>Planned links</div></div>
      <div class="actions">${button('Copy blueprint', 'copy', 'secondary')}${button('Use blueprint →', 'use', 'primary')}</div>
    </article>
    <p id="no-results" hidden>No matching blueprint.</p>
    ${section('Expects', blueprint.roles.map(role => `<div class="compact-row"><span>${e(role.title)}</span><span class="muted">${e(role.kind)}</span></div>`).join(''))}
    ${section('Requirements', `<ul class="requirements">${blueprint.requirements.map(r => `<li>${e(r)}</li>`).join('')}</ul>`)}
    <div class="inline-actions">${button('Inspect Markdown', 'inspect', 'text-button')}${button('Blueprint text', 'show-text', 'text-button')}</div>
    <p class="scope-note">One bundled example. No account, public catalogue, ratings or network requests.</p>
  </div>`
}
export function bindingPanel(project: Project, blueprint: Blueprint, bindings: Record<string, string>): string {
  const issues = bindingIssues(project, blueprint, bindings)
  return `${heading('Placement / nothing saved', 'Bind to your architecture')}<div class="panel-body">
    <div class="pattern-title"><span class="draft-glyph"></span><div><strong>${e(blueprint.title)}</strong><div class="muted">Blueprint release ${e(blueprint.release)} → ${e(project.title)}</div></div></div>
    ${prose(blueprint.outcome)}
    <div class="stepper"><b>1 Bind</b><span>2 Preview</span><span>3 Create draft</span></div>
    ${blueprint.roles.map(role => `<div class="binding-field"><label for="bind-${e(role.key)}">${e(role.title)}<span>${role.kind === 'container' ? 'Parent of new part' : `Existing ${role.kind}`}</span></label>
      <select id="bind-${e(role.key)}" data-bind="${e(role.key)}" aria-label="Bind ${e(role.title)}"><option value="">Choose an existing ${e(role.kind)}…</option>${candidates(project, role).map(node => `<option value="${e(node.id)}" ${bindings[role.key] === node.id ? 'selected' : ''}>${e(node.title)}</option>`).join('')}</select>
      <p class="binding-purpose">${e(role.purpose)}</p></div>`).join('')}
    ${section('Adds', blueprint.parts.map(part => `<div class="new-part"><span class="draft-glyph"></span><div><strong>${e(part.title)}</strong><p>New component · no source evidence</p></div></div>`).join(''))}
    <div class="notice ${issues.length ? 'attention' : ''}" role="status">${issues.length ? issues.map(e).join('<br>') : 'All bindings selected. Review them in the map before creating the draft.'}</div>
  </div><footer class="panel-footer">${button('Cancel', 'cancel', 'secondary')}${button('Preview placement →', 'preview', 'primary', issues.length ? 'disabled' : '')}</footer>`
}
export function draftPanel(project: Project, draft: Draft, preview: boolean): string {
  const title = (id: string): string => [...project.elements, ...draft.parts].find(node => node.id === id)?.title ?? id
  return `${heading(preview ? 'Placement / nothing saved' : 'Independent local draft', draft.title)}<div class="panel-body">
    <div class="status-line"><span class="pill ${preview ? '' : 'success'}">${preview ? 'PREVIEW' : 'SAVED IN FIXTURE'}</span><span class="muted">From blueprint release ${e(draft.blueprint.release)}</span></div>
    ${prose(draft.outcome)}
    ${preview ? '<div class="stepper"><span>1 Bind</span><b>2 Preview</b><span>3 Create draft</span></div>' : ''}
    <div class="impact-summary"><div><strong>${draft.parts.length}</strong>New component</div><div><strong>${draft.relationships.length}</strong>Planned links</div><div><strong>0</strong>Current edits</div></div>
    ${section('Uses your existing architecture', draft.blueprint.roles.map(role => `<div class="bound-row"><span class="muted">${e(role.title)}</span><span>→</span><strong>${e(title(draft.bindings[role.key]))}</strong></div>`).join(''))}
    ${section('New part', draft.parts.map(part => `<div class="new-part"><span class="draft-glyph"></span><div><strong>${e(part.title)}</strong><p>Inside ${e(title(part.parent!))}</p><p>${e(part.overview)}</p></div></div>`).join(''))}
    ${section('Planned relationships', draft.relationships.map(r => `<div class="relationship"><div>${e(title(r.source))}<span>→</span>${e(title(r.target))}</div><p>${e(r.description)}</p><span class="muted small">Mechanism not specified · design intent</span></div>`).join(''))}
    ${section('Requirements', `<ul class="requirements">${draft.requirements.map(r => `<li>${e(r)}</li>`).join('')}</ul>`)}
    <div class="notice">${preview ? 'Creating this draft does not rename, move, merge or overwrite current architecture. It does not create code.' : 'No source match has been established. Saving a draft does not verify implementation or accept its planned relationships.'}</div>
  </div><footer class="panel-footer">${preview
    ? button('← Change bindings', 'bindings', 'secondary') + button('Create draft', 'create', 'primary')
    : button('Copy original intent', 'copy-draft', 'secondary') + button('Blueprints', 'catalogue', 'primary')}</footer>`
}
export function currentPanel(project: Project, id: string): string {
  const node = project.elements.find(element => element.id === id)
  if (!node) return heading('Current architecture', project.title)
  return `${heading(`Current ${node.kind} / read-only`, node.title)}<div class="panel-body">${prose(node.overview)}
    ${section('Source evidence', node.code.length ? node.code.map(ref => `<p class="file-row">${e(ref.file)}</p>`).join('') : '<p class="muted">No source evidence in this fixture.</p>')}
    ${section('Draft participation', project.drafts.filter(d => Object.values(d.bindings).includes(id)).map(d => `<div class="compact-row"><span>${e(d.title)}</span><code>${e(d.id)}</code></div>`).join('') || '<p class="muted">No draft participation.</p>')}
    <div class="notice">Blueprint placement leaves this record unchanged. Participation is stored on each fixture draft, not written onto the component.</div>
  </div><footer class="panel-footer">${button('Back to blueprint work', 'back', 'primary')}</footer>`
}
