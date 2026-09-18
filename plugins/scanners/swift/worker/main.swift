import Foundation
import SwiftParser
import SwiftParserDiagnostics
import SwiftSyntax

do {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    let request = try JSONDecoder().decode(Request.self, from: input)
    var result: [FileEvidence] = []
    var errors: [String] = []
    for file in request.files {
        let url = URL(fileURLWithPath: request.root).appendingPathComponent(file)
        let source = try String(contentsOf: url, encoding: .utf8)
        let tree = Parser.parse(source: source)
        if tree.hasError {
            let converter = SourceLocationConverter(fileName: file, tree: tree)
            for diagnostic in ParseDiagnosticsGenerator.diagnostics(for: tree) {
                let location = converter.location(for: diagnostic.position)
                errors.append("\(file):\(location.line):\(location.column): \(diagnostic.message)")
            }
        } else {
            result.append(Evidence(file: file, source: source, tree: tree).read(tree))
        }
    }
    if !errors.isEmpty {
        FileHandle.standardError.write(Data(("SWIFT_SOURCE_INVALID\n" + errors.joined(separator: "\n") + "\n").utf8))
        exit(2)
    }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    FileHandle.standardOutput.write(try encoder.encode(result))
} catch {
    FileHandle.standardError.write(Data(("SWIFT_SCAN_FAILED: \(error)\n").utf8))
    exit(1)
}
