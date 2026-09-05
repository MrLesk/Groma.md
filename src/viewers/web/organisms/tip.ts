/**
 * One tooltip bubble over the map, shown above the hovered pin head or chip;
 * a bubble inside the island's strip would be clipped. The z-index lifts it
 * over the pins and the island, which come after it in the host.
 */
export const tipCss = `
  #tip {
    position: absolute; z-index: 1; transform: translate(-50%, -100%); padding: 4px 8px; border-radius: 6px;
    background: color-mix(in srgb, var(--ink) 85%, transparent); color: var(--paper); font-size: 11px; line-height: 1.3; white-space: nowrap; pointer-events: none;
  }
`

export interface Tip {
  /** Shows the node's data-tip text centred above it while the pointer is over it. */
  attach(node: HTMLElement): void
}

export function createTip(host: HTMLElement): Tip {
  const bubble = document.createElement('div')
  bubble.id = 'tip'
  bubble.hidden = true
  host.append(bubble)
  return {
    attach(node) {
      node.addEventListener('mouseenter', () => {
        const box = node.getBoundingClientRect()
        const origin = host.getBoundingClientRect()
        bubble.textContent = node.dataset.tip ?? ''
        bubble.style.left = `${box.left + box.width / 2 - origin.left}px`
        bubble.style.top = `${box.top - origin.top - 6}px`
        bubble.hidden = false
      })
      node.addEventListener('mouseleave', () => {
        bubble.hidden = true
      })
    },
  }
}
