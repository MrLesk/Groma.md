/** Local motion and DOM updates for the task summary, never the whole details pane. */
function animateChange(node: HTMLElement, added: boolean, offset = 0, changed = true): void {
  for (const animation of node.getAnimations()) animation.cancel()
  node.animate([
    { opacity: added ? 0 : 1, transform: `translateY(${offset || (added ? 6 : 0)}px)`, backgroundColor: changed ? 'color-mix(in srgb, var(--highlight) 14%, transparent)' : 'transparent' },
    { opacity: 1, transform: 'translateY(0)', backgroundColor: 'transparent' },
  ], { duration: 360, easing: 'ease-out' })
}

export function updateTaskText(node: HTMLElement, text: string, animate: boolean): void {
  if (node.textContent === text) return
  node.textContent = text
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) animateChange(node, false)
}

function nodeKey(node: Node, index: number): string {
  return node instanceof HTMLElement && node.dataset.taskKey !== undefined
    ? node.dataset.taskKey : `${node.nodeName}:${index}`
}

function updateNode(current: Node, next: Node): Node {
  if (current.nodeName !== next.nodeName) return next
  if (!(current instanceof HTMLElement) || !(next instanceof HTMLElement)) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue
    return current
  }
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name)
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value)
  }
  current.onclick = next.onclick
  updateChildren(current, next)
  return current
}

/** Keys belong to task sections and rows; unmodified buttons keep focus and their DOM identity. */
function updateChildren(current: HTMLElement, next: HTMLElement): void {
  const previous = new Map([...current.childNodes].map((node, index) => [nodeKey(node, index), node]))
  for (const [index, child] of [...next.childNodes].entries()) {
    const key = nodeKey(child, index)
    const old = previous.get(key)
    const result = old === undefined ? child : updateNode(old, child)
    const at = current.childNodes[index] ?? null
    if (at !== result) current.insertBefore(result, at)
    if (old !== undefined && result !== old) current.removeChild(old)
    previous.delete(key)
  }
  for (const node of previous.values()) current.removeChild(node)
}

/** Preserve the same task's summary and animate only changed rows and their layout movement. */
export function updateTaskSummary(host: HTMLElement, next: HTMLElement): void {
  const body = host.querySelector<HTMLElement>('.body')!
  const current = body.firstElementChild as HTMLElement | null
  if (current === null || current.dataset.taskId !== next.dataset.taskId) {
    body.replaceChildren(next)
    return
  }
  const scrollTop = host.scrollTop
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches
  const selector = 'h2, p, li, .task-diff-source'
  const before = new Map([...current.querySelectorAll<HTMLElement>(selector)].map(node => [node, {
    html: node.innerHTML, top: node.offsetTop, checked: node.dataset.checked,
  }]))
  updateChildren(current, next)
  host.scrollTop = scrollTop
  if (!animate) {
    for (const animation of current.getAnimations({ subtree: true })) animation.cancel()
    return
  }
  for (const node of current.querySelectorAll<HTMLElement>(selector)) {
    const old = before.get(node)
    const offset = old === undefined ? 0 : old.top - node.offsetTop
    const changed = old?.html !== node.innerHTML
    if (changed || offset !== 0) animateChange(node, old === undefined, offset, changed)
    if (old !== undefined && old.checked !== node.dataset.checked) {
      node.querySelector('.criterion-mark')?.animate([
        { transform: 'scale(0.6)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' },
      ], { duration: 320, easing: 'ease-out' })
    }
  }
}
