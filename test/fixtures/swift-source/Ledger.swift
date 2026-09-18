// 🌍 UTF-16 offsets differ from UTF-8 byte positions.
import UnavailableDependency

public protocol Sending: Sendable {
    func send(_ amount: Int)
}

public struct Ledger {
    private var total = 0
    public init() {}
    public func adjusted(_ amount: Int) -> Int {
        let result = amount * 2 + 7
        return result - 1
    }
    internal func submitted(_ values: [Int]) {
        externalSubmit(values) { item in
            unavailable(item)
        }
    }
    private func local() {}
    struct Hidden {
        func nested() {}
    }
    var computed: Int { get { missingGetter() } }
}

public extension Ledger {
    func extended() { unresolvedMember() }
}

actor Queue {
    nonisolated(unsafe) static var shared: Queue?
    func push() async { await unknownAsync() }
}

public let transform = { (value: Int) -> Int in
    let result = value * 2 + 7
    return result - 1
}
