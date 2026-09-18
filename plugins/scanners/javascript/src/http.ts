import type { ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import ts from 'typescript'
import { urlContext } from '../../http-values.ts'
import type { FileEvidence } from './evidence.ts'
import { httpEndpoints } from './http-endpoints.ts'
import { httpRequest } from './http-requests.ts'

/**
 * The compiler's own name resolution for one file, as a program holding only that file: imports and
 * the runtime's globals resolve to nothing, as everything outside the file does for this scanner.
 */
function fileChecker(source: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, types: [], noEmit: true }
  const host: ts.CompilerHost = {
    getSourceFile: name => name === source.fileName ? source : undefined,
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '',
    getCanonicalFileName: name => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: name => name === source.fileName,
    readFile: () => undefined,
  }
  return ts.createProgram([source.fileName], options, host).getTypeChecker()
}

/**
 * The HTTP facts one file states, named against the operations its evidence already recorded. The
 * shared readers resolve names with the compiler over this one file, so a value from another file is
 * one the scan cannot see.
 */
export async function javaScriptHttpFacts(source: ts.SourceFile, evidence: FileEvidence): Promise<{
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
}> {
  const context = urlContext(ts, fileChecker(source), [source], true)
  return {
    httpEndpoints: await httpEndpoints(context, source, evidence),
    httpRequests: evidence.calls.flatMap(call => {
      const request = httpRequest(context, call)
      return request === undefined ? [] : [{ operation: evidence.operationAt(call), ...request }]
    }),
  }
}
