/**
 * The open states of a path search, least priority first: a binary heap in parallel typed arrays, so queuing a state
 * allocates nothing. A state may be queued again with a lower priority; the search skips the entries of a state it
 * has already closed.
 */
export class SearchQueue {
  private states = new Int32Array(1024)
  private priorities = new Float64Array(1024)
  size = 0

  push(state: number, priority: number): void {
    if (this.size === this.states.length) this.grow()
    let index = this.size++
    while (index > 0) {
      const parent = (index - 1) >>> 1
      if (this.priorities[parent]! <= priority) break
      this.states[index] = this.states[parent]!
      this.priorities[index] = this.priorities[parent]!
      index = parent
    }
    this.states[index] = state
    this.priorities[index] = priority
  }

  /** Removes and returns the state with the least priority. */
  pop(): number {
    const top = this.states[0]!
    const end = --this.size
    if (end === 0) return top
    const state = this.states[end]!
    const priority = this.priorities[end]!
    let index = 0
    while (index * 2 + 1 < end) {
      let child = index * 2 + 1
      if (child + 1 < end && this.priorities[child + 1]! < this.priorities[child]!) child += 1
      if (priority <= this.priorities[child]!) break
      this.states[index] = this.states[child]!
      this.priorities[index] = this.priorities[child]!
      index = child
    }
    this.states[index] = state
    this.priorities[index] = priority
    return top
  }

  private grow(): void {
    const states = new Int32Array(this.states.length * 2)
    const priorities = new Float64Array(this.priorities.length * 2)
    states.set(this.states)
    priorities.set(this.priorities)
    this.states = states
    this.priorities = priorities
  }
}
