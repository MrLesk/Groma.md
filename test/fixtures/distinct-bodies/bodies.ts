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

declare function measure(...values: unknown[]): number

export function talkPath(id: string, page: number): number {
  return `/talks/${id}?page=${page + 1}`.length + page * 2
}

export function speakerPath(id: string, page: number): number {
  return `/speakers/${id}?page=${page + 1}`.length + page * 2
}

export function isWord(value: string, limit: number): boolean {
  return /^[a-z]+$/.test(value) && value.length > limit
}

export function isNumber(value: string, limit: number): boolean {
  return /^[0-9]+$/.test(value) && value.length > limit
}

export function optionalTotal(order: { total: number }, fee: number): number {
  return order?.total * 2 + fee + 10
}

export function requiredTotal(order: { total: number }, fee: number): number {
  return order.total * 2 + fee + 10
}

export function spreadMeasure(values: number[], limit: number): number {
  return measure(...values) + limit * 2 + 10
}

export function listMeasure(values: number[], limit: number): number {
  return measure(values) + limit * 2 + 10
}

export function entryMeasure(table: Record<string, number>, key: string): number {
  return measure(table[key]) * 2 + 10
}

export function pairMeasure(table: Record<string, number>, key: string): number {
  return measure(table, key) * 2 + 10
}

class Tariff {
  base(amount: number): number {
    return amount
  }
}

export class Fee extends Tariff {
  charge(amount: number): number {
    return this.base(amount) * 3 + 10
  }
}

export class Levy extends Tariff {
  charge(amount: number): number {
    return super.base(amount) * 3 + 10
  }
}

export function recordOrRetry(value: number, limit: number): number {
  try {
    measure(value, limit)
  } catch {
    measure(limit, value)
  }
  return limit
}

export function recordThenRetry(value: number, limit: number): number {
  try {
    measure(value, limit)
  } finally {
    measure(limit, value)
  }
  return limit
}
