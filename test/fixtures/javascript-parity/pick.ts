export function pick(items: string[], index: number): string {
  let position = index
  position++
  const value = items[(position + 1) * 2]
  if (typeof value === 'string') {
    return value.toUpperCase()
  } else {
    return 'none'
  }
}

export class Picker {
  first: string

  constructor(items: string[]) {
    this.first = items[0]
  }
}
