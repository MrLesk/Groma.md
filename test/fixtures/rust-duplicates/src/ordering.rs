use std::cmp::Ordering::{self, *};

pub fn rank(order: Ordering) -> u32 {
    match order {
        Less => 1,
        Equal => 2,
        Greater => 3,
    }
}

pub fn reverse_rank(order: Ordering) -> u32 {
    match order {
        Greater => 1,
        Equal => 2,
        Less => 3,
    }
}
