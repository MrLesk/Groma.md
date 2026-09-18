mod callbacks;
mod formulas;
mod invoice;
mod labels;
mod ordering;
mod quote;
mod readiness;
mod scheduling;

pub struct Task {
    pub status: String,
    pub assignee: Option<String>,
    pub blockers: Vec<Task>,
}

pub struct Line {
    pub price: f64,
    pub quantity: u32,
}

pub struct Order {
    pub lines: Vec<Line>,
    pub loyal: bool,
    pub shipping: f64,
    pub total: f64,
}
