import Foundation

struct Request: Decodable {
    let root: String
    let files: [String]
}

struct Symbol: Encodable {
    let id: String
    let name: String
    let kind: String
}

struct Operation: Encodable {
    let id: String
    let file: String
    let name: String
    let position: Int
    var startLine: Int?
    var endLine: Int?
    var tokens: [String]?
}

struct Invocation: Encodable {
    let source: String
    let targets: [String] = []
    let unresolved = true
    let line: Int
    let position: Int
}

struct Member: Encodable {
    let name: String
    let line: Int
    let visibility: String
}

struct Declaration: Encodable {
    let kind: String
    let name: String
    let line: Int
    var visibility: String
    var members: [Member]?
}

struct FileEvidence: Encodable {
    let file: String
    var entryPoint: String?
    let symbols: [Symbol]
    let operations: [Operation]
    let invocations: [Invocation]
    var declarations: [Declaration]
}
