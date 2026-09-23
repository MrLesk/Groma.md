public enum Editor {}

public extension Editor {
    struct Store {
        func save() {}
    }
}

extension Editor.Store {
    func load() {
        func helper() {}
        helper()
    }
}

public struct Outer {
    public struct Inner {
        func own() {}
    }
}

private extension Outer.Inner {
    func added() {}
}

public struct Box<Element> {}

extension Box<Int> {
    func sum() {}
}

extension [Int] {
    func total() {}
}

public macro Logged() = #externalMacro(module: "Macros", type: "Logged")

struct Handle: ~Copyable {
    deinit { release(descriptor) }
}

#if false
func disabled() {}
#endif

func `default`() {}
