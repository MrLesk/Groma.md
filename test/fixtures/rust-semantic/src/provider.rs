pub fn run() {}
pub struct Worker;
impl Worker {
    pub fn create() -> Self { Self }
    pub fn work(&self) { run(); }
}
pub trait Service { fn send(&self); }
impl Service for Worker { fn send(&self) {} }
