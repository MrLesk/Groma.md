mod shared;
pub fn provider() -> u8 { 2 }
fn main() { assert_eq!(shared::run(), 2); }
