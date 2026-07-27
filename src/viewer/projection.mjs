import { compareArchitectureModels } from '../architecture-comparison.mjs'

const nodeDimensions = {
  person: { width: 250, height: 132 },
  system: { width: 280, height: 148 },
  container: { width: 250, height: 150 },
  component: { width: 190, height: 132 },
}
const boundaryLayout = {
  container: {
    minimumHeight: 610,
    childStartY: 145,
    childStepY: 220,
    bottomPadding: 80,
  },
  component: {
    systemMinimumHeight: 690,
    systemBottomPadding: 80,
    siblingStartY: 190,
    siblingStepY: 190,
    containerY: 48,
    containerMinimumHeight: 580,
    componentStartY: 154,
    componentStepY: 178,
    componentColumns: 2,
    componentBottomPadding: 70,
    selectedContainerBottomPadding: 62,
  },
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function elementNode(element, position, options = {}) {
  const dimensions = nodeDimensions[element.kind]

  return {
    id: `element:${element.id}`,
    type: 'c4',
    position,
    ...(options.parentId ? {
      parentId: options.parentId,
      extent: 'parent',
    } : {}),
    style: dimensions,
    data: {
      elementId: element.id,
      kind: element.kind,
      name: element.name,
      description: element.description,
      external: element.external,
      expandable: options.expandable === true,
      ...(element.comparisonStatus ? {
        comparisonStatus: element.comparisonStatus,
      } : {}),
    },
  }
}

function boundaryNode(element, position, dimensions, options = {}) {
  return {
    id: `boundary:${element.id}`,
    type: 'boundary',
    position,
    ...(options.parentId ? {
      parentId: options.parentId,
      extent: 'parent',
    } : {}),
    style: dimensions,
    selectable: false,
    draggable: false,
    data: {
      elementId: element.id,
      kind: element.kind,
      name: element.name,
      description: element.description,
      external: element.external,
      expandable: false,
      ...(element.comparisonStatus ? {
        comparisonStatus: element.comparisonStatus,
      } : {}),
    },
  }
}

function elementsOfKind(elements, kind) {
  return elements
    .filter(element => element.kind === kind)
    .sort((left, right) => compareStrings(left.id, right.id))
}

function stackedContentHeight({
  count,
  startY,
  stepY,
  itemHeight,
  bottomPadding,
  minimumHeight,
}) {
  if (count === 0) {
    return minimumHeight
  }

  return Math.max(
    minimumHeight,
    startY + (count - 1) * stepY + itemHeight + bottomPadding,
  )
}

function connectedContextIds(model, focalSystemId, elementsById) {
  const rootIdByElementId = new Map()

  function rootId(elementId) {
    if (rootIdByElementId.has(elementId)) {
      return rootIdByElementId.get(elementId)
    }

    const visited = []
    let element = elementsById.get(elementId)
    while (element?.parentId) {
      visited.push(element.id)
      element = elementsById.get(element.parentId)
    }

    const id = element?.id ?? null
    rootIdByElementId.set(elementId, id)
    for (const visitedId of visited) {
      rootIdByElementId.set(visitedId, id)
    }
    return id
  }

  const connectedIds = new Set()
  for (const relationship of model.relationships) {
    const sourceRootId = rootId(relationship.sourceId)
    const targetRootId = rootId(relationship.targetId)

    if (sourceRootId === focalSystemId && targetRootId !== focalSystemId) {
      connectedIds.add(targetRootId)
    }
    if (targetRootId === focalSystemId && sourceRootId !== focalSystemId) {
      connectedIds.add(sourceRootId)
    }
  }

  connectedIds.delete(null)
  return connectedIds
}

function contextNodes(
  model,
  focalSystem,
  childrenByParent,
  connectedRootIds,
) {
  const people = elementsOfKind(model.elements, 'person')
    .filter(element => connectedRootIds.has(element.id))
  const externalSystems = elementsOfKind(model.elements, 'system')
    .filter(element => {
      return element.id !== focalSystem.id && connectedRootIds.has(element.id)
    })

  return [
    ...people.map((person, index) => {
      return elementNode(person, { x: 20, y: 80 + index * 220 })
    }),
    elementNode(focalSystem, { x: 455, y: 190 }, {
      expandable: (childrenByParent.get(focalSystem.id)?.length ?? 0) > 0,
    }),
    ...externalSystems.map((system, index) => {
      return elementNode(system, { x: 930, y: 185 + index * 220 })
    }),
  ]
}

function containerNodes(
  model,
  focalSystem,
  childrenByParent,
  connectedRootIds,
) {
  const containers = (childrenByParent.get(focalSystem.id) ?? [])
    .filter(element => element.kind === 'container')
  const layout = boundaryLayout.container
  const systemBoundary = boundaryNode(
    focalSystem,
    { x: 350, y: 46 },
    {
      width: 570,
      height: stackedContentHeight({
        count: containers.length,
        startY: layout.childStartY,
        stepY: layout.childStepY,
        itemHeight: nodeDimensions.container.height,
        bottomPadding: layout.bottomPadding,
        minimumHeight: layout.minimumHeight,
      }),
    },
  )
  const people = elementsOfKind(model.elements, 'person')
    .filter(element => connectedRootIds.has(element.id))
  const otherSystems = elementsOfKind(model.elements, 'system')
    .filter(element => {
      return element.id !== focalSystem.id && connectedRootIds.has(element.id)
    })

  return [
    ...people.map((person, index) => {
      return elementNode(person, { x: 16, y: 104 + index * 232 })
    }),
    systemBoundary,
    ...containers.map((container, index) => {
      const childCount = childrenByParent.get(container.id)?.length ?? 0
      return elementNode(container, {
        x: 70,
        y: layout.childStartY + index * layout.childStepY,
      }, {
        parentId: systemBoundary.id,
        expandable: childCount > 0,
      })
    }),
    ...otherSystems.map((system, index) => {
      return elementNode(system, { x: 1010, y: 216 + index * 220 })
    }),
  ]
}

function componentNodes(
  model,
  focalSystem,
  selectedContainer,
  childrenByParent,
  connectedRootIds,
) {
  const layout = boundaryLayout.component
  const siblingContainers = (childrenByParent.get(focalSystem.id) ?? [])
    .filter(element => {
      return element.kind === 'container' && element.id !== selectedContainer.id
    })
  const components = (childrenByParent.get(selectedContainer.id) ?? [])
    .filter(element => element.kind === 'component')
  const componentRows = Math.ceil(
    components.length / layout.componentColumns,
  )
  const containerHeight = stackedContentHeight({
    count: componentRows,
    startY: layout.componentStartY,
    stepY: layout.componentStepY,
    itemHeight: nodeDimensions.component.height,
    bottomPadding: layout.componentBottomPadding,
    minimumHeight: layout.containerMinimumHeight,
  })
  const siblingContentHeight = stackedContentHeight({
    count: siblingContainers.length,
    startY: layout.siblingStartY,
    stepY: layout.siblingStepY,
    itemHeight: nodeDimensions.container.height,
    bottomPadding: layout.systemBottomPadding,
    minimumHeight: layout.systemMinimumHeight,
  })
  const systemHeight = Math.max(
    siblingContentHeight,
    layout.containerY
      + containerHeight
      + layout.selectedContainerBottomPadding,
  )
  const systemBoundary = boundaryNode(
    focalSystem,
    { x: 300, y: 34 },
    { width: 850, height: systemHeight },
  )
  const containerBoundary = boundaryNode(
    selectedContainer,
    { x: 334, y: layout.containerY },
    { width: 470, height: containerHeight },
    { parentId: systemBoundary.id },
  )
  const people = elementsOfKind(model.elements, 'person')
    .filter(element => connectedRootIds.has(element.id))
  const otherSystems = elementsOfKind(model.elements, 'system')
    .filter(element => {
      return element.id !== focalSystem.id && connectedRootIds.has(element.id)
    })

  return [
    ...people.map((person, index) => {
      return elementNode(person, { x: 10, y: 105 + index * 232 })
    }),
    systemBoundary,
    ...siblingContainers.map((container, index) => {
      return elementNode(container, {
        x: 38,
        y: layout.siblingStartY + index * layout.siblingStepY,
      }, {
        parentId: systemBoundary.id,
        expandable: (childrenByParent.get(container.id)?.length ?? 0) > 0,
      })
    }),
    containerBoundary,
    ...components.map((component, index) => {
      return elementNode(component, {
        x: 28 + (index % layout.componentColumns) * 218,
        y: layout.componentStartY
          + Math.floor(index / layout.componentColumns) * layout.componentStepY,
      }, {
        parentId: containerBoundary.id,
      })
    }),
    ...otherSystems.map((system, index) => {
      return elementNode(system, { x: 1240, y: 230 + index * 220 })
    }),
  ]
}

function relationshipEdges(model, nodes, elementsById) {
  const nodeIdByElementId = new Map(
    nodes.map(node => [node.data.elementId, node.id]),
  )
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const grouped = new Map()

  function displayedNodeId(elementId) {
    let element = elementsById.get(elementId)
    while (element) {
      const displayed = nodeIdByElementId.get(element.id)
      if (displayed) {
        return displayed
      }
      element = element.parentId ? elementsById.get(element.parentId) : null
    }
    return null
  }

  for (const relationship of model.relationships) {
    const source = displayedNodeId(relationship.sourceId)
    const target = displayedNodeId(relationship.targetId)
    if (!source || !target || source === target) {
      continue
    }

    const key = `${source}\0${target}`
    let group = grouped.get(key)
    if (!group) {
      group = { source, target, labels: [] }
      grouped.set(key, group)
    }

    const label = relationship.technology
      ? `${relationship.description} · ${relationship.technology}`
      : relationship.description
    if (!group.labels.includes(label)) {
      group.labels.push(label)
    }
  }

  return [...grouped.values()]
    .sort((left, right) => {
      return compareStrings(
        `${left.source}\0${left.target}`,
        `${right.source}\0${right.target}`,
      )
    })
    .map((group, index) => {
      const sourceName = nodeById.get(group.source).data.name
      const targetName = nodeById.get(group.target).data.name
      const accessibleLabel = `Relationship from ${sourceName} to ${targetName}: `
        + group.labels.join('; ')

      return {
        id: `relationship:${index}:${group.source}:${group.target}`,
        source: group.source,
        target: group.target,
        type: 'relationship',
        label: group.labels.join('\n'),
        ariaLabel: accessibleLabel,
        data: {
          sourceName,
          targetName,
          labels: [...group.labels],
          accessibleLabel,
        },
        markerEnd: { type: 'arrowclosed' },
      }
    })
}

function focusLevel(focusPath, focalSystemId) {
  if (focusPath.length === 0) {
    return 'context'
  }
  if (focusPath.length === 1 && focusPath[0] === focalSystemId) {
    return 'container'
  }
  if (focusPath.length === 2 && focusPath[0] === focalSystemId) {
    return 'component'
  }

  throw new TypeError('Focus must be [], [focal system], or [focal system, container]')
}

export function projectArchitectureView(
  model,
  focalSystemId,
  focusPath,
  options = {},
) {
  const projectedModel = options.observedModel
    ? compareArchitectureModels(options.observedModel, model)
    : model
  const elementsById = new Map(
    projectedModel.elements.map(element => [element.id, element]),
  )
  const childrenByParent = new Map()

  for (const element of projectedModel.elements) {
    if (!element.parentId) {
      continue
    }
    const children = childrenByParent.get(element.parentId) ?? []
    children.push(element)
    childrenByParent.set(element.parentId, children)
  }
  for (const children of childrenByParent.values()) {
    children.sort((left, right) => compareStrings(left.id, right.id))
  }

  const focalSystem = elementsById.get(focalSystemId)
  if (!focalSystem || focalSystem.kind !== 'system') {
    throw new TypeError(`Focal element "${focalSystemId}" must be a software system`)
  }
  const connectedRootIds = connectedContextIds(
    projectedModel,
    focalSystemId,
    elementsById,
  )

  const level = focusLevel(focusPath, focalSystemId)
  let nodes
  if (level === 'context') {
    nodes = contextNodes(
      projectedModel,
      focalSystem,
      childrenByParent,
      connectedRootIds,
    )
  } else if (level === 'container') {
    nodes = containerNodes(
      projectedModel,
      focalSystem,
      childrenByParent,
      connectedRootIds,
    )
  } else {
    const selectedContainer = elementsById.get(focusPath[1])
    if (
      !selectedContainer
      || selectedContainer.kind !== 'container'
      || selectedContainer.parentId !== focalSystemId
    ) {
      throw new TypeError(
        `Focused element "${focusPath[1]}" must be a container of "${focalSystemId}"`,
      )
    }
    nodes = componentNodes(
      projectedModel,
      focalSystem,
      selectedContainer,
      childrenByParent,
      connectedRootIds,
    )
  }

  return {
    level,
    focusPath: [...focusPath],
    nodes,
    edges: relationshipEdges(projectedModel, nodes, elementsById),
  }
}
