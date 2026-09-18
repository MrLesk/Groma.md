export function countUp(count: number, step: number, limit: number): number {
  count++
  return count * step + limit + 10
}

export function countDown(count: number, step: number, limit: number): number {
  count--
  return count * step + limit + 10
}

export function groupedSum(left: number, right: number, scale: number): number {
  return (left + right) * scale + 10
}

export function plainSum(left: number, right: number, scale: number): number {
  return left + right * scale + 10
}

export function isLabel(value: unknown, size: number): boolean {
  return typeof value === 'string' && size > 10
}

export function isLabelText(value: unknown, size: number): boolean {
  return value === 'string' && size > 10
}

export function sumUntil(values: number[], limit: number): number {
  let total = 0
  for (const value of values) {
    if (value > limit) break
    total = total + value
  }
  return total
}

export function sumBelow(values: number[], limit: number): number {
  let total = 0
  for (const value of values) {
    if (value > limit) continue
    total = total + value
  }
  return total
}

export class Invoice {
  total: number

  constructor(net: number, tax: number) {
    this.total = net * 2 + tax * 3 + 10
  }
}

export class Receipt {
  total: number

  constructor(net: number, tax: number) {
    this.total = net * 2 + tax * 3 + 10
  }
}

export function castDifference(left: number, right: number, scale: number): number {
  return (left - right as number) * scale + 10
}

export function plainDifference(left: number, right: number, scale: number): number {
  return left - right * scale + 10
}

export function chooseElse(flag: boolean, base: number): number {
  let total = base
  if (flag) {
    total = base * 2
  } else {
    total = base * 3
  }
  return total
}

export function chooseAfter(flag: boolean, base: number): number {
  let total = base
  if (flag) {
    total = base * 2
  }
  total = base * 3
  return total
}
