use crate::Task;

pub struct Scheduler;

impl Scheduler {
    pub fn ready_to_run(item: &Task) -> bool {
        let pending = item.blockers.iter().filter(|parent| parent.status != "done").count();
        item.status == "todo" && pending == 0 && item.assignee.is_some()
    }
}

pub fn finished(item: &Task) -> bool {
    item.status == "done"
}
