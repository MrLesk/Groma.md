// Renders an invoice for a customer.

export function renderInvoice(invoice, currency) {
  const lines = invoice.lines.map(line => line.label + ' x ' + line.count)
  const total = invoice.lines.reduce((amount, line) => amount + line.price * line.count, 0)
  return {
    heading: 'Invoice ' + invoice.number,
    body: lines.join('\n'),
    total: total.toFixed(2) + ' ' + currency,
  }
}
