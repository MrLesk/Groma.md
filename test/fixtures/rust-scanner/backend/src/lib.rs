mod api;
mod provider;
mod worker;
pub fn boot() { worker::run(worker::Hooks { opened: api::display }); }
pub fn direct() { api::display(); }
