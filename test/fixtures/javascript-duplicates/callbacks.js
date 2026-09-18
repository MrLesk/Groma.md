// Identical handlers supplied as call arguments.

export function watchOrders(orders) {
  orders.subscribe({ next: order => report(order.id, order.total, order.status) })
}

export function watchQuotes(quotes) {
  const open = quotes.filter(quote => quote.open)
  open.subscribe({ next: quote => report(quote.id, quote.total, quote.status) })
  return open.length
}
