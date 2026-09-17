use crate::Order;

pub fn quote_total(basket: &Order) -> f64 {
    let subtotal: f64 = basket.lines.iter().map(|line| line.price * line.quantity as f64).sum();
    let discount = if basket.loyal { subtotal * 0.2 } else { 0.0 };
    subtotal - discount
}
