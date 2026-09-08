import { validateBlueprint } from './model.ts'
import type { Blueprint, Draft, Element, Project, Role } from './model.ts'

export function candidates(project: Project, role: Role): Element[] {
  return project.elements.filter(element => element.status === 'stable' && (
    role.kind === 'external' ? element.external && element.kind === 'system'
      : !element.external && element.kind === role.kind))
}
/** Only explainable exact-title and single-candidate suggestions; no probability claims. */
export function suggestions(project: Project, blueprint: Blueprint): Record<string, string> {
  const result: Record<string, string> = {}
  for (const role of blueprint.roles) {
    const eligible = candidates(project, role)
    const exact = eligible.filter(element => element.title.toLowerCase() === role.title.toLowerCase())
    const chosen = exact.length === 1 ? exact[0] : eligible.length === 1 ? eligible[0] : undefined
    if (chosen) result[role.key] = chosen.id
  }
  return result
}
export function bindingIssues(project: Project, blueprint: Blueprint, bindings: Record<string, string>): string[] {
  const issues: string[] = []
  const used = new Set<string>()
  for (const role of blueprint.roles) {
    const id = bindings[role.key]
    if (!id) { issues.push(`Choose ${role.title}.`); continue }
    if (!candidates(project, role).some(element => element.id === id)) issues.push(`${role.title} is not a compatible current element.`)
    if (used.has(id)) issues.push('Distinct roles must use distinct elements in this experiment.')
    used.add(id)
  }
  if (Object.keys(bindings).some(key => !blueprint.roles.some(role => role.key === key))) issues.push('The placement contains an unknown binding.')
  return issues
}
function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'blueprint'
}
function allocate(taken: Set<string>, base: string): string {
  let id = base
  let number = 2
  while (taken.has(id)) id = `${base}-${number++}`
  taken.add(id)
  return id
}
/** Pure semantic placement: no saved architecture, evidence or view is changed here. */
export function preparePlacement(project: Project, value: Blueprint, bindings: Record<string, string>): Draft {
  const blueprint = validateBlueprint(value)
  const issues = bindingIssues(project, blueprint, bindings)
  if (issues.length) throw new Error(issues.join(' '))
  const taken = new Set([
    ...project.elements.map(element => element.id),
    ...project.relationships.map(relation => relation.id),
    ...project.drafts.flatMap(draft => [draft.id, ...draft.parts.map(part => part.id), ...draft.relationships.map(relation => relation.id)]),
  ])
  const id = allocate(taken, slug(blueprint.title))
  const endpoints = new Map(Object.entries(bindings))
  const parts = blueprint.parts.map<Element>(part => {
    const localId = allocate(taken, `${id}-${part.key}`)
    endpoints.set(part.key, localId)
    return { id: localId, kind: 'component', title: part.title, parent: bindings[part.parentRole],
      overview: part.overview, external: false, code: [], status: 'draft' }
  })
  return {
    id, title: blueprint.title, outcome: blueprint.outcome, requirements: [...blueprint.requirements],
    bindings: { ...bindings }, parts,
    relationships: blueprint.relationships.map((intent, index) => ({
      id: allocate(taken, `${id}-relation-${index + 1}`), source: endpoints.get(intent.source)!,
      target: endpoints.get(intent.target)!, description: intent.description, technology: '', origin: 'draft',
    })),
    blueprint,
  }
}
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface Placement { draft: Draft; baseline: string | null }
/** One fixture-storage write, then publish the new value. This is not a filesystem transaction. */
export function commitPlacement(storage: StoragePort, key: string, project: Project, placement: Placement): Project {
  const saved = storage.getItem(key)
  if (saved !== placement.baseline || (saved !== null && JSON.stringify(project) !== saved)) {
    throw new Error('This fixture changed in another tab. Cancel and preview again before saving.')
  }
  const rebuilt = preparePlacement(project, placement.draft.blueprint, placement.draft.bindings)
  if (JSON.stringify(rebuilt) !== JSON.stringify(placement.draft)) throw new Error('The placement changed. Review it again before saving.')
  const next: Project = { ...project, drafts: [...project.drafts, structuredClone(rebuilt)] }
  storage.setItem(key, JSON.stringify(next))
  return next
}
/** Copy the retained portable intent, never reverse-engineer source facts into a template. */
export function copyDraftIntent(draft: Draft): Blueprint {
  return validateBlueprint(draft.blueprint)
}
