import type { C4Kind, CodeReference } from './types.ts'

type InvalidReference = (message: string) => never

function requiredString(
  record: Record<string, unknown>,
  field: 'scanner' | 'file',
  index: number,
  invalid: InvalidReference,
): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`code[${index}] requires ${field}`)
  }
  return value as string
}

function optionalCount(
  record: Record<string, unknown>,
  field: 'dependencies' | 'dependents',
  index: number,
  invalid: InvalidReference,
): number | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || Number(value) < 0) {
    invalid(`code[${index}] ${field} must be a non-negative integer`)
  }
  return Number(value)
}

function referenceOf(
  value: unknown,
  index: number,
  invalid: InvalidReference,
): CodeReference {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`code[${index}] must be a mapping`)
  }
  const record = value as Record<string, unknown>
  const unknownFields = Object.keys(record).filter(field => {
    return !['scanner', 'file', 'symbol', 'dependencies', 'dependents'].includes(field)
  })
  if (unknownFields.length > 0) {
    invalid(`code[${index}] has unsupported field(s): ${unknownFields.join(', ')}`)
  }
  if (record.symbol !== undefined && typeof record.symbol !== 'string') {
    invalid(`code[${index}] symbol must be a string`)
  }
  const dependencies = optionalCount(record, 'dependencies', index, invalid)
  const dependents = optionalCount(record, 'dependents', index, invalid)
  return {
    scanner: requiredString(record, 'scanner', index, invalid),
    file: requiredString(record, 'file', index, invalid),
    ...(typeof record.symbol === 'string' ? { symbol: record.symbol } : {}),
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(dependents === undefined ? {} : { dependents }),
  }
}

export function codeReferencesOf(
  code: unknown,
  kind: C4Kind,
  invalid: InvalidReference,
): CodeReference[] {
  if (code === undefined) return []
  if (kind !== 'component') invalid('only a component can declare code')
  if (!Array.isArray(code)) invalid('code must be a list')
  return (code as unknown[]).map((reference, index) => referenceOf(reference, index, invalid))
}
