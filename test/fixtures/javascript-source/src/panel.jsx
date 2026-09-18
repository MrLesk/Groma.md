import { subtotal } from './totals.cjs'

export function CartPanel({ lines }) {
  const total = subtotal(lines)
  return (
    <section className="cart-panel">
      <output>{total}</output>
    </section>
  )
}
