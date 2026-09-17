use crate::Order;

pub fn invoice_total(order: &Order) -> f64 {
    let subtotal: f64 = order.lines.iter().map(|line| line.price * line.quantity as f64).sum();
    let discount = if order.loyal { subtotal * 0.1 } else { 0.0 };
    subtotal - discount + order.shipping
}
