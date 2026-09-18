import { subtotal } from './totals.cjs'

export function addItem(cart, item) {
  const lines = cart.lines.concat([item])
  return { lines, total: subtotal(lines) }
}

export const removeItem = (cart, id) => {
  const lines = cart.lines.filter(line => line.id !== id)
  return { lines, total: subtotal(lines) }
}
