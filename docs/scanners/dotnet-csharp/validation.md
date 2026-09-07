# Prototype validation checkpoints

The reproducible commands and scope are in [the scanner guide](index.md) and
[production readiness research](production-readiness.md).

Local Linux x64 checkpoint: .NET SDK 10.0.400, runtime 10.0.11, Roslyn 5.9,
Bun 1.4.1. Seventeen .NET tests passed; the complete repository check passed
110 Node tests and 365 Bun tests. Existing six lint complexity warnings remained.

Compiled source-free package relocation passed: 6 files, 2 scopes, 19 operations,
24 invocations; 3.53 seconds for the first complete CLI scan. A repeated scan
produced identical architecture Markdown. A subsequent deliberate compilation
failure left that Markdown unchanged.

The committed CI definition is not itself proof of a successful run.
Public-repository, private-SDK-download, macOS and Windows results have not yet
been recorded at this checkpoint. No broader production coverage is claimed.
