// swift-tools-version: 5.9
import PackageDescription

// SwiftSyntax 603.0.2. Windows installers omit the parser development modules.
let package = Package(
    name: "GromaSwiftScanner",
    dependencies: [
        .package(url: "https://github.com/swiftlang/swift-syntax.git",
                 revision: "79e4b74a295b6eb74a8b585e3a39d29e70c1dbd1")
    ],
    targets: [
        .executableTarget(
            name: "groma-swift-scanner",
            dependencies: [
                .product(name: "SwiftParser", package: "swift-syntax"),
                .product(name: "SwiftParserDiagnostics", package: "swift-syntax"),
                .product(name: "SwiftSyntax", package: "swift-syntax")
            ],
            path: "worker"
        )
    ]
)
