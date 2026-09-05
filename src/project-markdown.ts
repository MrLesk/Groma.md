import { parseMarkdown } from 'comark'
import type { ElementNode as ComarkElement, Node as ComarkNode } from 'comark'

export type MarkdownStyle = 'strong' | 'emphasis' | 'code' | 'link'

export interface MarkdownSpan {
  text: string
  styles: MarkdownStyle[]
}

export interface MarkdownBlock {
  marker?: string
  spans: MarkdownSpan[]
}

function isElement(node: ComarkNode): node is ComarkElement {
  return Array.isArray(node) && typeof node[0] === 'string'
}

const childrenOf = (node: ComarkElement): ComarkNode[] => node.slice(2) as ComarkNode[]

function spansOf(
  nodes: readonly ComarkNode[],
  styles: readonly MarkdownStyle[] = [],
): MarkdownSpan[] {
  return nodes.flatMap(node => {
    if (typeof node === 'string') {
      if (node === '') return []
      return [{ text: node, styles: [...styles] }]
    }
    if (!isElement(node)) return []
    const style: MarkdownStyle | undefined = node[0] === 'strong' ? 'strong'
      : node[0] === 'em' ? 'emphasis'
        : node[0] === 'code' ? 'code'
          : node[0] === 'a' ? 'link'
            : undefined
    const nextStyles = style === undefined || styles.includes(style) ? styles : [...styles, style]
    return spansOf(childrenOf(node), nextStyles)
  })
}

function blocksOf(nodes: readonly ComarkNode[]): MarkdownBlock[] {
  return nodes.flatMap(node => {
    if (typeof node === 'string') return node.trim() === '' ? [] : [{ spans: spansOf([node]) }]
    if (!isElement(node)) return []
    if (node[0] === 'p') return [{ spans: spansOf(childrenOf(node)) }]
    if (/^h[1-6]$/.test(node[0])) return [{ spans: spansOf(childrenOf(node), ['strong']) }]
    if (node[0] === 'pre') return [{ spans: spansOf(childrenOf(node), ['code']) }]
    if (node[0] === 'blockquote') {
      return blocksOf(childrenOf(node)).map(block => ({ ...block, marker: '›' }))
    }
    if (node[0] === 'ul' || node[0] === 'ol') {
      let index = 0
      return childrenOf(node).flatMap(child => {
        if (!isElement(child) || child[0] !== 'li') return []
        index += 1
        return [{ marker: node[0] === 'ol' ? `${index}.` : '•', spans: spansOf(childrenOf(child)) }]
      })
    }
    return [{ spans: spansOf(childrenOf(node)) }]
  }).filter(block => block.spans.some(span => span.text.trim() !== ''))
}

/** Project prose reduced to the rich text that the SVG title plate can paint. */
export async function parseProjectMarkdown(source: string): Promise<MarkdownBlock[]> {
  return blocksOf((await parseMarkdown(source)).nodes)
}
