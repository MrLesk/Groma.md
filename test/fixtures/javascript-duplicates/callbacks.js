// Identical handlers supplied as call arguments.

export function watchOrders(orders) {
  orders.subscribe({ next: order => report(order.id, order.total, order.status) })
}

export function watchQuotes(quotes) {
  const open = quotes.filter(quote => quote.open)
  open.subscribe({ next: quote => report(quote.id, quote.total, quote.status) })
  return open.length
}

export function watchRefunds(refunds, credits) {
  refunds.subscribe(({ next: refund => report(refund.id, refund.total, refund.status) }))
  credits.subscribe(({ next(credit) { report(credit.id, credit.total, credit.status) } }))
}
