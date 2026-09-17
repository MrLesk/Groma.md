use crate::Task;

pub fn can_start(task: &Task) -> bool {
    let open_blockers = task.blockers.iter().filter(|blocker| blocker.status != "done").count();
    task.status == "todo" && open_blockers == 0 && task.assignee.is_some()
}

pub fn is_done(task: &Task) -> bool {
    task.status == "done"
}
