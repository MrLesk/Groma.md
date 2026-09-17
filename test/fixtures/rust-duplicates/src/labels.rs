pub fn split_label(label: &str, at: usize) -> String {
    let head = format!("{}:{}", &label[..at], &label[at..]);
    head.to_uppercase()
}

pub fn split_name(name: &str, cut: usize) -> String {
    let first = format!("{}:{}", &name[..cut], &name[cut..]);
    first.to_uppercase()
}
