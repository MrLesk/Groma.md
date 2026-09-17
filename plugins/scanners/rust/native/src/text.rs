use ra_ap_syntax::TextSize;

/// Zero-based UTF-16 offset, the unit the observation contract counts.
pub fn position(text: &str, offset: TextSize) -> usize {
    text[..usize::from(offset)].encode_utf16().count()
}

/// One-based line.
pub fn line(text: &str, offset: TextSize) -> usize {
    text[..usize::from(offset)].bytes().filter(|byte| *byte == b'\n').count() + 1
}
