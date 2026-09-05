import { disclosureChevron } from './sidebar-row.ts'

/** One foldable heading shared by the hierarchy pane's sections. */
export function sectionHeading(
  name: string,
  expanded: boolean,
  onToggle: () => void,
): HTMLButtonElement {
  const heading = document.createElement('button')
  heading.type = 'button'
  heading.className = 'section tree-section'
  heading.dataset.id = `section:${name}`
  heading.append(disclosureChevron(), document.createTextNode(name))
  heading.setAttribute('aria-expanded', String(expanded))
  heading.addEventListener('click', onToggle)
  return heading
}
