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
        // Swift source is UTF-8; name the file so it can be corrected or excluded.
        guard let source = String(data: try Data(contentsOf: url), encoding: .utf8) else {
            errors.append("\(file): source is not valid UTF-8")
            continue
        }
        let tree = Parser.parse(source: source)
        let invalid = tree.hasError ? ParseDiagnosticsGenerator.diagnostics(for: tree).filter { !versionGated($0.node) } : []
        if invalid.isEmpty {
            result.append(Evidence(file: file, source: source, tree: tree).read(tree))
        } else {
            let converter = SourceLocationConverter(fileName: file, tree: tree)
            for diagnostic in invalid {
                let location = converter.location(for: diagnostic.position)
                errors.append("\(file):\(location.line):\(location.column): \(diagnostic.message)")
            }
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
