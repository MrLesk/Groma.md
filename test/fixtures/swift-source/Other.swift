func duplicate(_ count: Int) -> Int {
    let answer = count * 2 + 7
    return answer - 1
}

func changed(_ count: Int) -> Int {
    let answer = count * 3 + 7
    return answer - 1
}

func access(_ value: Any) {
    external(value.first, label: value.second)
}

func otherAccess(_ input: Any) {
    external(input.second, label: input.first)
}

func shadow(_ input: Int) {
    let local = input
    do {
        let input = local + 1
        external(input)
    }
    external(input)
}

func conditional(_ value: Int?) {
    if let value = value { external(value) } else { external(value) }
}

func captured(_ value: Int) {
    external { [alias = value] in external(alias) }
}

#if os(Linux)
func platform() { linuxCall() }
#else
func platform() { appleCall() }
#endif

func wrapped(
    _ count: Int
) -> Int {
    let answer = count * 2 + 7
    return answer - 1
}
