function subtotal(lines) {
  return lines.reduce((amount, line) => amount + weigh(line), 0)
}

function weigh(line) {
  return line.price * line.count
}

module.exports = { subtotal }
