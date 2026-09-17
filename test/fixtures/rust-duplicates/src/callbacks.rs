use crate::Order;

pub type Check = fn(&Order) -> bool;

pub const LARGE_ORDER: Check = |order| order.total > 100.0 && order.lines.len() > 2 && !order.loyal;
pub const LARGE_REFUND: Check = |refund| refund.total > 100.0 && refund.lines.len() > 2 && !refund.loyal;

pub fn count_large(orders: &[Order]) -> usize {
    let large = orders.iter().filter(|order| order.total > 100.0 && order.lines.len() > 2 && !order.loyal).count();
    let refunds = orders.iter().filter(|refund| refund.total > 100.0 && refund.lines.len() > 2 && !refund.loyal).count();
    large + refunds
}
