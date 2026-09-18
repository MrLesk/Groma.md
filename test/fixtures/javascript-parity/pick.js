export function pick(items, index) {
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
  constructor(items) {
    this.first = items[0]
  }
}
