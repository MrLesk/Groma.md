// Renders a quote with the invoice wording changed.

export function renderQuote(quote, currency) {
  const lines = quote.lines.map(line => line.label + ' x ' + line.count)
  const total = quote.lines.reduce((amount, line) => amount + line.price * line.count, 0)
  return {
    heading: 'Quote ' + quote.number,
    body: lines.join('\n'),
    total: total.toFixed(2) + ' ' + currency,
  }
}
