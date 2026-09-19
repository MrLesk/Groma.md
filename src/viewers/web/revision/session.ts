import type { WebPayload } from '../payload.ts'

/** User navigation outranks live refresh. Only its newest complete payload can be applied. */
export function createRevisionSession() {
  let generation = 0
  let explicit = false
  let pending = false
  return {
    get pending() { return pending },
    begin() { generation++; explicit = true; pending = true },
    cancel() { generation++; explicit = false; pending = false },
    async load(read: () => Promise<WebPayload>, navigation: boolean): Promise<WebPayload | undefined> {
      if (!navigation && explicit) return undefined
      const ticket = ++generation
      explicit = navigation
      pending = true
      try {
        const payload = await read()
        return ticket === generation ? payload : undefined
      } catch (error) {
        if (ticket === generation) throw error
        return undefined
      } finally {
        if (ticket === generation) { explicit = false; pending = false }
      }
    },
  }
}
