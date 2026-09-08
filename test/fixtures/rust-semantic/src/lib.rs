mod api;
mod provider;

pub fn entry() { api::execute(); }
pub fn wrapper() { provider::run(); }
pub fn through_method(worker: &provider::Worker) { worker.work(); }
pub fn dynamic(worker: &dyn provider::Service) { worker.send(); }
pub fn callback(callback: fn()) { callback(); }
pub fn later() { let _job = || provider::run(); }
pub fn chained() { provider::Worker::create().work(); }
