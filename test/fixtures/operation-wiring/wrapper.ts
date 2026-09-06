import { deliver } from './provider.ts'
export function wrap(value: string): string { return deliver(value) }
