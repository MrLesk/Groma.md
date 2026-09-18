export function placeOrder(order) {
  return prepare(order)
}

const prepare = order => ({ ...order, ready: true })

export class OrderService {
  constructor(store) {
    this.repository = store
    this.pending = []
  }

  submit(order) {
    return this.repository.save(order, this.#limit())
  }

  #limit() {
    return this.pending.length
  }

  static total(orders) {
    return orders.length
  }

  /** @private */
  audit(order) {
    return order.id
  }

  get size() {
    return this.pending.length
  }
}
