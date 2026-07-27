const comparisonStatuses = {
  addition: 'addition',
  modification: 'modification',
  removal: 'removal',
  unchanged: 'unchanged',
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function relationshipContent(relationship) {
  return {
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    description: relationship.description,
    technology: relationship.technology,
  }
}

function relationshipKey(relationship) {
  return [
    relationship.sourceId,
    relationship.targetId,
    relationship.description,
    relationship.technology,
  ].join('\0')
}

function outgoingRelationshipsByElement(model) {
  const outgoing = new Map()

  for (const relationship of model.relationships) {
    const relationships = outgoing.get(relationship.sourceId) ?? []
    relationships.push(relationshipContent(relationship))
    outgoing.set(relationship.sourceId, relationships)
  }
  for (const relationships of outgoing.values()) {
    relationships.sort((left, right) => {
      return compareStrings(relationshipKey(left), relationshipKey(right))
    })
  }

  return outgoing
}

/**
 * Architecture equivalence deliberately excludes revision identity, Markdown
 * paths, and any presentation/runtime fields. An element's architecture
 * content is its C4 properties plus its sorted outgoing relationship content.
 */
function architectureContent(element, outgoingRelationships) {
  return {
    kind: element.kind,
    name: element.name,
    description: element.description,
    parentId: element.parentId,
    external: element.external,
    relationships: outgoingRelationships.get(element.id) ?? [],
  }
}

function equivalentArchitectureContent(
  observedElement,
  plannedElement,
  observedOutgoing,
  plannedOutgoing,
) {
  return JSON.stringify(
    architectureContent(observedElement, observedOutgoing),
  ) === JSON.stringify(
    architectureContent(plannedElement, plannedOutgoing),
  )
}

export function compareArchitectureModels(observedModel, plannedModel) {
  const observedById = new Map(
    observedModel.elements.map(element => [element.id, element]),
  )
  const plannedById = new Map(
    plannedModel.elements.map(element => [element.id, element]),
  )
  const observedOutgoing = outgoingRelationshipsByElement(observedModel)
  const plannedOutgoing = outgoingRelationshipsByElement(plannedModel)
  const elementIds = new Set([...observedById.keys(), ...plannedById.keys()])
  const elements = [...elementIds]
    .sort(compareStrings)
    .map(elementId => {
      const observedElement = observedById.get(elementId)
      const plannedElement = plannedById.get(elementId)

      if (!observedElement) {
        return {
          ...plannedElement,
          comparisonStatus: comparisonStatuses.addition,
        }
      }
      if (!plannedElement) {
        return {
          ...observedElement,
          comparisonStatus: comparisonStatuses.removal,
        }
      }

      return {
        ...plannedElement,
        comparisonStatus: equivalentArchitectureContent(
          observedElement,
          plannedElement,
          observedOutgoing,
          plannedOutgoing,
        )
          ? comparisonStatuses.unchanged
          : comparisonStatuses.modification,
      }
    })

  const relationshipsByKey = new Map()
  for (const relationship of [
    ...observedModel.relationships,
    ...plannedModel.relationships,
  ]) {
    const content = relationshipContent(relationship)
    relationshipsByKey.set(relationshipKey(content), content)
  }

  return {
    revision: plannedModel.revision,
    elements,
    relationships: [...relationshipsByKey.values()].sort((left, right) => {
      return compareStrings(relationshipKey(left), relationshipKey(right))
    }),
  }
}
