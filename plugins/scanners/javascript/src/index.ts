import path from 'node:path'
import { createScanObservation, type ScanDiagnostic, type ScannerPlugin } from '@groma/scanner'
import ts from 'typescript'
import { javaScriptEvidence } from './evidence.ts'
import { javaScriptHttpFacts } from './http.ts'
import { readJavaScriptOutline } from './outline.ts'
import { javaScriptFiles, javaScriptSources, type JavaScriptSource } from './sources.ts'
import { withJavaScriptEntries } from '../../entry-points/javascript.ts'
import { javaScriptEntries } from './entries.ts'

/** Each file is parsed alone, so no project configuration, dependency or build tool is needed. */
function parse(source: JavaScriptSource): ts.SourceFile {
  return ts.createSourceFile(source.file, source.text, ts.ScriptTarget.Latest, true)
}

/** Strict-mode errors on octal literals and escapes, such as `0755` or `'\033'`, which scripts outside strict mode accept. */
const SLOPPY_MODE_ONLY = new Set([1121, 1487, 1488, 1489])

/**
 * A warning at the first parse error of a file; undefined when the file parses. The public API reports parse errors
 * only through a program, together with checks that reject TypeScript-only syntax the parser still reads, such as a
 * Flow type annotation, so the parse errors are read from the pinned compiler's source file.
 */
function parseWarning(source: ts.SourceFile): ScanDiagnostic | undefined {
  const { parseDiagnostics } = source as ts.SourceFile & { parseDiagnostics: readonly ts.DiagnosticWithLocation[] }
  const first = parseDiagnostics.find(diagnostic => !SLOPPY_MODE_ONLY.has(diagnostic.code))
  if (first === undefined) return undefined
  return {
    severity: 'warning',
    code: 'JAVASCRIPT_SOURCE_INVALID',
    file: source.fileName,
    line: source.getLineAndCharacterOfPosition(first.start).line + 1,
    message: `The file does not parse, so it contributes no evidence: ${ts.flattenDiagnosticMessageText(first.messageText, ' ')}`,
  }
}

export default {
  id: 'javascript',
  watch: {
    include: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx', '**/*.html', '**/package.json', '**/angular.json'],
    exclude: [],
  },
  listSourceFiles: root => javaScriptFiles(root),
  async checkReadiness(root, _settings?, excluded?) {
    if (!(await javaScriptFiles(root, excluded)).length) {
      throw new Error('javascript: No JavaScript source files were found in the Git repository.')
    }
  },
  async scan(root, _settings?, excluded = () => false) {
    const sources = await javaScriptSources(root, excluded)
    if (!sources.length) return undefined
    const parsed = sources.map(parse)
    const warnings = parsed.map(parseWarning)
    // A file that does not parse keeps its place in the inventory but contributes no evidence.
    const readable = parsed.filter((_, index) => warnings[index] === undefined)
    // The HTTP facts name operations, so they are read before the observation collects them.
    const scanned = await Promise.all(readable.map(async source => {
      const evidence = javaScriptEvidence(source.fileName, source)
      return { file: source.fileName, evidence, facts: await javaScriptHttpFacts(source, evidence) }
    }))
    const symbols = new Map(scanned.map(({ file, evidence }) => [file, evidence.symbols]))
    return withJavaScriptEntries(root, createScanObservation({
      scanner: { id: 'javascript', technology: 'javascript', engine: 'typescript-sdk', engineVersion: ts.version },
      roots: [{ id: 'javascript-source', kind: 'source-group', name: path.basename(root) }],
      files: parsed.map(({ fileName: file }) => ({ file, symbols: symbols.get(file) ?? [], roots: ['javascript-source'] })),
      operations: scanned.flatMap(({ evidence }) => evidence.operations),
      invocations: scanned.flatMap(({ evidence }) => evidence.invocations),
      httpEndpoints: scanned.flatMap(({ facts }) => facts.httpEndpoints),
      httpRequests: scanned.flatMap(({ facts }) => facts.httpRequests),
      diagnostics: [{ severity: 'info', code: 'JAVASCRIPT_SOURCE_SCOPE',
        message: 'Source syntax only. Module loading, dynamic dispatch, framework wiring and external symbols remain unresolved.' },
      ...warnings.filter(warning => warning !== undefined)],
    }), await javaScriptEntries(root, readable), excluded)
  },
  // Every file this scanner owns is a JavaScript source, so no reference is filtered out here.
  readCodeStructure: readJavaScriptOutline,
} satisfies ScannerPlugin
