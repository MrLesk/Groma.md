/** One foldable heading shared by the hierarchy pane's sections. */
export function sectionHeading(
  name: string,
  expanded: boolean,
  onToggle: () => void,
): HTMLButtonElement {
  const heading = document.createElement('button')
  heading.type = 'button'
  heading.className = 'section'
  heading.textContent = `${expanded ? '▾' : '▸'} ${name}`
  heading.setAttribute('aria-expanded', String(expanded))
  heading.addEventListener('click', onToggle)
  return heading
}
