interface Order { id: string; total: number }
interface Observer { next(order: Order): void }
interface Feed { subscribe(observer: Observer): void }
declare class Subscriber { constructor(observer: Observer) }

export function watch(orders: Feed, refunds: Feed): Subscriber {
  orders.subscribe({
    next: (order: Order) => {
      if (order.total > 100) console.warn('large order', order.id)
      if (order.total <= 0) console.error('empty order', order.id)
    },
  })
  refunds.subscribe({
    next(order: Order) {
      if (order.total > 100) console.warn('large order', order.id)
      if (order.total <= 0) console.error('empty order', order.id)
    },
  })
  return new Subscriber({
    next(order: Order) {
      if (order.total > 100) console.warn('large order', order.id)
      if (order.total <= 0) console.error('empty order', order.id)
    },
  })
}

export const handlers = {
  next: (order: Order) => {
    if (order.total > 100) console.warn('large order', order.id)
    if (order.total <= 0) console.error('empty order', order.id)
  },
}

export function reportOrder(order: Order): void {
  if (order.total > 100) console.warn('large order', order.id)
  if (order.total <= 0) console.error('empty order', order.id)
}
