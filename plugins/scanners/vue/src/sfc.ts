import { parse as parseSfc } from '@vue/language-core'

export interface SfcScript {
  /** Name whose extension selects the dialect, from the block's `lang` attribute. */
  fileName: string
  /** The block inside the file's own text, so every offset and line is the file's own. */
  text: string
  /** A `<script setup>` block exports nothing; its bindings are the component's own API. */
  setup: boolean
}

/**
 * The `<script>` and `<script setup>` blocks of a single-file component, in source order. Everything
 * before a block becomes blank space, keeping line breaks, so the compiler reads the file's own lines.
 */
export function sfcScripts(file: string, text: string): SfcScript[] {
  const { descriptor } = parseSfc(text)
  const blocks = [
    ...(descriptor.script ? [{ block: descriptor.script, setup: false }] : []),
    ...(descriptor.scriptSetup ? [{ block: descriptor.scriptSetup, setup: true }] : []),
  ].sort((left, right) => left.block.loc.start.offset - right.block.loc.start.offset)
  return blocks.map(({ block, setup }) => ({
    fileName: `${file}.${block.lang ?? 'js'}`,
    text: text.slice(0, block.loc.start.offset).replace(/[^\n]/g, ' ') + block.content,
    setup,
  }))
}
