public struct Future {
    var storage = 0
#if compiler(>=6.4)
    var value: Int {
        borrow { storage }
        mutate { &storage }
    }
#endif
}
