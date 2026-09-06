import type { AnnotatedRelationship, ArchitectureGraph, RelationshipConnection } from '../../../types.ts'
import { heading, paragraph } from '../atoms/text.ts'
import { editButton, isEditing } from './editable.ts'
import { relationshipCard } from './relationship-card.ts'
import { paintRemoveControl } from './remove.ts'
import { paintAcceptControl, type RelationWrites } from './writes.ts'

function connectionLabel(connection: RelationshipConnection): string {
  const claim = connection.authored ? `Authored · ${connection.status === 'draft' ? 'draft' : 'current'}` : 'Derived interaction'
  return `${connection.source} → ${connection.target} · ${claim}`
}

/** A map connection bundles claims; authoring always addresses an exact endpoint pair. */
export function paintRelationship(
  host: HTMLElement,
  relationship: AnnotatedRelationship,
  world: ArchitectureGraph,
  onSelect: (id: string, additive: boolean) => void,
  writesFor: (source: string, target: string) => RelationWrites,
): void {
  if (isEditing(host, relationship.id)) return
  const related = world.relationships.filter(row => (row.source === relationship.source && row.target === relationship.target)
    || (row.source === relationship.target && row.target === relationship.source))
  const connections = related.flatMap(row => row.connections ?? [])
  const byId = new Map(world.elements.map(item => [item.representationId, item]))
  const body = host.querySelector('.body')!
  body.replaceChildren()
  host.querySelector('h1')!.textContent = 'Relationship'
  host.querySelector('.meta')!.textContent = ''
  host.querySelector('.tabs')!.replaceChildren()
  for (const row of related) {
    const count = new Set((row.connections ?? []).filter(connection => !connection.authored)
      .map(connection => `${connection.source}\0${connection.target}`)).size
    if (count) body.append(paragraph('relationship-count', `${byId.get(row.source)!.title} → ${byId.get(row.target)!.title}: ${count} derived file interactions`))
  }
  body.append(relationshipCard({ ...relationship, source: byId.get(relationship.source)!, target: byId.get(relationship.target)! }, onSelect))
  if (connections.length === 0) return
  const select = document.createElement('select')
  select.setAttribute('aria-label', 'Connection')
  select.replaceChildren(...connections.map((connection, index) => new Option(connectionLabel(connection), String(index))))
  body.append(select)
  const details = document.createElement('div')
  body.append(details)
  function showConnection(): void {
    details.replaceChildren()
    host.querySelector('.edit-entry')?.remove()
    const connection = connections[Number(select.value)]!
    const writes = writesFor(connection.source, connection.target)
    details.append(heading(connection.authored ? 'Authored interaction' : 'Derived interaction'))
    details.append(paragraph('description', connection.description), paragraph('technology', connection.technology))
    const editable = connection.authored || !connections.some(row => row.authored
      && row.source === connection.source && row.target === connection.target)
    if (editable && writes.onEdit && writes.onRead) details.append(editButton(host, relationship.id, [
      { name: 'description', label: 'Description', value: connection.description, required: true },
      { name: 'technology', label: 'Technology', value: connection.technology, required: true },
    ], writes.onEdit, writes.onRead))
    if (connection.authored && connection.status === 'draft') {
      if (writes.onAccept) paintAcceptControl(details, writes.onAccept)
      if (writes.onRemove) paintRemoveControl(details, connection.description, writes.onRemove)
    }
  }
  select.addEventListener('change', showConnection)
  showConnection()
}
