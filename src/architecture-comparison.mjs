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

function relationshipEndpointKey(relationship) {
  return [
    relationship.sourceId,
    relationship.targetId,
  ].join('\0')
}

function comparisonDescription(description) {
  return description.replace(/\r?\n/g, ' ')
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
    description: comparisonDescription(element.description),
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

function comparisonMove(
  observedElement,
  plannedElement,
  observedById,
  plannedById,
) {
  if (observedElement.parentId === plannedElement.parentId) {
    return null
  }

  return {
    observedParentId: observedElement.parentId,
    observedParentName: observedById.get(observedElement.parentId)?.name
      ?? observedElement.parentId
      ?? 'Top level',
    plannedParentId: plannedElement.parentId,
    plannedParentName: plannedById.get(plannedElement.parentId)?.name
      ?? plannedElement.parentId
      ?? 'Top level',
  }
}

function groupedRelationships(model) {
  const grouped = new Map()

  for (const relationship of model.relationships) {
    const content = relationshipContent(relationship)
    const key = relationshipEndpointKey(content)
    const relationships = grouped.get(key) ?? []
    relationships.push(content)
    grouped.set(key, relationships)
  }
  for (const relationships of grouped.values()) {
    relationships.sort((left, right) => {
      return compareStrings(relationshipKey(left), relationshipKey(right))
    })
  }

  return grouped
}

function comparedRelationship(comparisonStatus, observed, planned) {
  const displayed = planned ?? observed

  return {
    ...displayed,
    comparisonStatus,
    observed,
    planned,
  }
}

function compareRelationships(observedModel, plannedModel) {
  const observedByEndpoint = groupedRelationships(observedModel)
  const plannedByEndpoint = groupedRelationships(plannedModel)
  const endpointKeys = new Set([
    ...observedByEndpoint.keys(),
    ...plannedByEndpoint.keys(),
  ])
  const relationships = []

  for (const endpointKey of [...endpointKeys].sort(compareStrings)) {
    const observed = [...(observedByEndpoint.get(endpointKey) ?? [])]
    const planned = [...(plannedByEndpoint.get(endpointKey) ?? [])]
    const unmatchedObserved = []
    const unmatchedPlanned = [...planned]

    for (const observedRelationship of observed) {
      const exactIndex = unmatchedPlanned.findIndex(plannedRelationship => {
        return relationshipKey(plannedRelationship)
          === relationshipKey(observedRelationship)
      })
      if (exactIndex === -1) {
        unmatchedObserved.push(observedRelationship)
        continue
      }

      const [plannedRelationship] = unmatchedPlanned.splice(exactIndex, 1)
      relationships.push(comparedRelationship(
        comparisonStatuses.unchanged,
        observedRelationship,
        plannedRelationship,
      ))
    }

    const replacementCount = Math.min(
      unmatchedObserved.length,
      unmatchedPlanned.length,
    )
    for (let index = 0; index < replacementCount; index += 1) {
      relationships.push(comparedRelationship(
        comparisonStatuses.modification,
        unmatchedObserved[index],
        unmatchedPlanned[index],
      ))
    }
    for (const observedRelationship of unmatchedObserved.slice(replacementCount)) {
      relationships.push(comparedRelationship(
        comparisonStatuses.removal,
        observedRelationship,
        null,
      ))
    }
    for (const plannedRelationship of unmatchedPlanned.slice(replacementCount)) {
      relationships.push(comparedRelationship(
        comparisonStatuses.addition,
        null,
        plannedRelationship,
      ))
    }
  }

  const statusOrder = new Map([
    [comparisonStatuses.modification, 0],
    [comparisonStatuses.unchanged, 1],
    [comparisonStatuses.removal, 2],
    [comparisonStatuses.addition, 3],
  ])
  return relationships.sort((left, right) => {
    const endpointComparison = compareStrings(
      relationshipEndpointKey(left),
      relationshipEndpointKey(right),
    )
    if (endpointComparison !== 0) return endpointComparison

    const statusComparison = statusOrder.get(left.comparisonStatus)
      - statusOrder.get(right.comparisonStatus)
    return statusComparison !== 0
      ? statusComparison
      : compareStrings(relationshipKey(left), relationshipKey(right))
  })
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
          observedParentId: null,
          plannedParentId: plannedElement.parentId,
        }
      }
      if (!plannedElement) {
        return {
          ...observedElement,
          comparisonStatus: comparisonStatuses.removal,
          observedParentId: observedElement.parentId,
          plannedParentId: null,
        }
      }

      const move = comparisonMove(
        observedElement,
        plannedElement,
        observedById,
        plannedById,
      )
      return {
        ...plannedElement,
        observedParentId: observedElement.parentId,
        plannedParentId: plannedElement.parentId,
        ...(move ? { comparisonMove: move } : {}),
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

  return {
    revision: plannedModel.revision,
    elements,
    relationships: compareRelationships(observedModel, plannedModel),
  }
}
