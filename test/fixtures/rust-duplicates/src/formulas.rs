fn record(value: u32) -> u32 {
    value
}

pub fn grouped(a: u32, b: u32, c: u32) -> u32 {
    let total = (a + b) * c;
    total * 3
}

pub fn ungrouped(a: u32, b: u32, c: u32) -> u32 {
    let total = a + b * c;
    total * 3
}

pub fn shadowed(total: u32) -> u32 {
    {
        let total = total * 2;
        record(total);
    }
    assert!(total > 0);
    total + 1
}

pub fn renamed(sum: u32) -> u32 {
    {
        let doubled = sum * 2;
        record(doubled);
    }
    assert!(sum > 0);
    sum + 1
}

pub fn checked(a: u32, b: u32, c: u32) -> u32 {
    assert!((a + b) * c > 0);
    a * 3
}

pub fn unchecked(a: u32, b: u32, c: u32) -> u32 {
    assert!(a + b * c > 0);
    a * 3
}

pub fn fallback(value: u32, other: Option<u32>) -> u32 {
    if let Some(value) = other {
        record(value)
    } else {
        assert!(value > 0);
        0
    }
}

pub fn fallback_renamed(value: u32, other: Option<u32>) -> u32 {
    if let Some(found) = other {
        record(found)
    } else {
        assert!(value > 0);
        0
    }
}

pub fn required(total: u32, parsed: Option<u32>) -> u32 {
    let Some(total) = parsed else {
        assert!(total > 0);
        return 0;
    };
    total + 1
}

pub fn required_renamed(total: u32, parsed: Option<u32>) -> u32 {
    let Some(count) = parsed else {
        assert!(total > 0);
        return 0;
    };
    count + 1
}

pub fn shout(label: &str) -> usize {
    let label = format!("{}!", label);
    label.len() + 1
}

pub fn shout_renamed(label: &str) -> usize {
    let loud = format!("{}!", label);
    loud.len() + 1
}
