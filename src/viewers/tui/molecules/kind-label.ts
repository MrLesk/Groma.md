import type { C4Kind } from '../../../types.ts'

export function kindLabel(element: { kind: C4Kind; external: boolean }): string {
  return element.external
    ? `EXTERNAL ${element.kind.toUpperCase()}`
    : element.kind.toUpperCase()
}
