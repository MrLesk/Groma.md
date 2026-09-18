function formatOrder(order) {
  return order.id + ': ' + order.total
}

var renderOrder = function (order) {
  document.title = formatOrder(order)
}
