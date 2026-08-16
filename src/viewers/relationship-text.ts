/** Route text is on only while an endpoint of that relationship is selected. */
export function showsRelationshipText(
  relationship: { source: string; target: string },
  selectedId: string | null,
): boolean {
  return selectedId !== null
    && (relationship.source === selectedId || relationship.target === selectedId)
}
