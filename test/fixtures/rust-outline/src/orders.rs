use std::fmt::Display;

pub fn place_order(id: u32) -> u32 {
    fn nested(value: u32) -> u32 {
        value
    }
    nested(id)
}

fn audit() {}

pub(crate) fn ship() {}

pub(super) fn notify() {}

pub(self) fn hide() {}

pub const ON_PLACED: fn(u32) -> u32 = |id| id + 1;
const LIMIT: u32 = 3;

pub type OrderId = u32;

pub struct Order {
    pub id: u32,
}

impl Order {
    pub fn new(id: u32) -> Self {
        Order { id }
    }

    fn load(&self) -> u32 {
        self.id
    }

    pub(crate) fn refresh(&mut self) {}
}

pub(crate) trait Store {
    fn save(&self, order: &Order);

    fn count(&self) -> usize {
        0
    }
}

impl Store for Order {
    fn save(&self, _order: &Order) {}
}

enum Status {
    Open,
    Closed,
}

impl Status {
    const DEFAULT: Status = Status::Open;

    pub fn is_open(&self) -> bool {
        matches!(self, Status::Open)
    }
}

pub union Bits {
    int: u32,
    float: f32,
}

pub mod admin {
    pub fn purge() {}

    struct Report;
}

impl crate::billing::Invoice {
    pub fn total(&self) -> u32 {
        0
    }
}

impl<T: Display> Store for T {
    fn save(&self, _order: &Order) {}
}

impl Printer {
    fn print(&self) {}
}

struct Printer;

macro_rules! handler {
    () => {
        fn generated() {}
    };
}

impl crate::billing::Invoice {
    fn discount(&self) -> u32 {
        0
    }
}

#[cfg(test)]
pub fn sample() -> Order {
    Order::new(1)
}

#[cfg(test)]
impl crate::billing::Invoice {
    pub fn gated(&self) -> u32 {
        0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture;

    #[test]
    fn places() {
        assert_eq!(place_order(1), 1);
    }
}
