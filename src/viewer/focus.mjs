export function nextFocusPath(currentFocusPath, elementId, kind) {
  if (kind === 'system') {
    return [elementId]
  }
  if (kind === 'container') {
    return [currentFocusPath[0], elementId].filter(Boolean)
  }

  return [...currentFocusPath]
}
