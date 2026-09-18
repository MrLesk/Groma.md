import type { ScanHttpEndpoint, ScanHttpRequest } from '@groma/scanner'
import type ts from 'typescript'
import type { FileEvidence } from './evidence.ts'
import { httpEndpoints } from './http-endpoints.ts'
import { httpReader } from './http-reads.ts'
import { httpRequest } from './http-requests.ts'
import { fileScope } from './http-scope.ts'

/** The HTTP facts one file states, named against the operations its evidence already recorded. */
export function javaScriptHttpFacts(source: ts.SourceFile, evidence: FileEvidence): {
  httpEndpoints: ScanHttpEndpoint[]
  httpRequests: ScanHttpRequest[]
} {
  const reader = httpReader(fileScope(source))
  const context = { reader, operationAt: (node: ts.Node) => evidence.operationAt(node) }
  return {
    httpEndpoints: httpEndpoints(context, source, evidence.calls),
    httpRequests: evidence.calls.flatMap(call => httpRequest(reader, call, evidence.operationAt(call)) ?? []),
  }
}
