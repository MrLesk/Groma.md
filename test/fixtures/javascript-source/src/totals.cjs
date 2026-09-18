function subtotal(lines) {
  let amount = 0
  for (const line of lines) amount += line.price * line.count
  return Math.round(amount)
}

module.exports = { subtotal }
