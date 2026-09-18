mod a {
    pub struct Item;

    impl Item {
        pub fn from_a() {}
    }
}

mod b {
    pub struct Item;

    impl Item {
        pub fn from_b() {}
    }

    mod inner {
        use super::*;

        impl Item {
            fn from_inner() {}
        }

        impl super::Item {
            fn from_super() {}
        }
    }
}

impl a::Item {
    fn explicit() {}
}

impl crate::left::Remote {
    fn left() {}
}

impl crate::right::Remote {
    fn right() {}
}

pub struct Widget;

impl Widget {
    #[cfg(test)]
    fn fixture() {}

    fn draw(&self) {}
}

pub trait Shape {
    #[cfg(test)]
    fn probe(&self);

    fn area(&self) -> u32;
}

#[cfg(not(test))]
pub fn run() {}

#[cfg(any(test, feature = "tools"))]
pub fn tool() {}

#[cfg(all(test, unix))]
pub fn unix_only_test() {}

#[cfg(unix)]
pub struct Handle;

#[cfg(windows)]
pub struct Handle;

impl Handle {
    pub fn open() {}
}

impl Ext {
    fn plain() {}
}

impl self::Ext {
    fn stepped() {}
}
