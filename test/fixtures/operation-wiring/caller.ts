import { send as receive } from './api.ts'
import { run } from './worker.ts'

export function start(): string {
  receive('direct')
  return run({ deliver: receive })
}
