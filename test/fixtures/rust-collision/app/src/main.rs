mod local;
use local::*;

fn main() {
    let value = worker::run();
    assert_eq!(value, 2);
}
