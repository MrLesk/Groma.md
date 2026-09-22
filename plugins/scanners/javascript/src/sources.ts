import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { projectFiles } from '../../projects.ts'

const SOURCE = /\.(?:js|mjs|cjs|jsx)$/
const MINIFIED_NAME = /\.min\.(?:js|mjs|cjs|jsx)$/
/** Minified output packs statements into very long lines; authored JavaScript stays far below this. */
const MINIFIED_LINE_LENGTH = 500
const BANNERED_SINGLE_LINE_LENGTH = 400

export interface JavaScriptSource {
  file: string
  text: string
}

export function isJavaScriptFile(file: string): boolean {
  return SOURCE.test(file)
}

/** A `.min.js` name states the file is minified output. */
export function hasMinifiedName(file: string): boolean {
  return MINIFIED_NAME.test(path.posix.basename(file))
}

/** Minified text with any other name, such as a vendored bundle, is recognized by its line length. */
export function isMinifiedText(text: string): boolean {
  // License and generator headers are not part of the compact code whose line length we measure.
  const banner = /^(?:\s*\/\*[\s\S]*?\*\/)+\s*/.exec(text)?.[0]
  const code = text.slice(banner?.length ?? 0).trimEnd()
  const lines = code.split('\n')
  const threshold = banner !== undefined && lines.length === 1 ? BANNERED_SINGLE_LINE_LENGTH : MINIFIED_LINE_LENGTH
  return code.length / lines.length >= threshold
}

/** Tracked, unignored authored sources. Minified files are not authored source and are left out. */
export async function javaScriptSources(root: string): Promise<JavaScriptSource[]> {
  const files = await projectFiles(root, file => isJavaScriptFile(file) && !hasMinifiedName(file))
  const sources: JavaScriptSource[] = []
  for (const file of files) {
    const text = await readFile(path.join(root, file), 'utf8')
    if (!isMinifiedText(text)) sources.push({ file, text })
  }
  return sources
}
