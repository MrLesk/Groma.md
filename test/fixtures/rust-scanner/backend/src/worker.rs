pub struct Hooks { pub opened: fn() }
pub fn run(hooks: Hooks) { (hooks.opened)(); }
