# Swift scanner validation

## Cross-platform package work

On 19 September 2026, the 0.1.2 build and release path was extended to Linux
x64/arm64 and Windows x64/arm64, alongside macOS arm64. The 0.1.0 and 0.1.1
packages are macOS-only.

Local verification used Apple Swift 6.3.3 on macOS arm64 and the official
`swift:6.3.3-noble` Linux arm64 and x64 images. Each Linux package was then run
in an Ubuntu 24.04 container containing Bun 1.4.1, Git and system libraries, with
no Swift toolchain installed and networking disabled. Both preserved the fixture's
two source files, 22 operations, 16 unresolved calls, UTF-16 positions and method
outlines across repeated scans. The x64 containers used Docker's CPU emulation
on the Apple Silicon host.

The four Swift integration tests passed on macOS (47 assertions), including
installed-package isolation and watch updates. A separate assembly regression
verified that all five hosts retain their worker and runtime assets in the
combined package. The local repository check passed with 608 Bun tests and no
failures; 36 tests requiring optional scanner artifacts were skipped. All 16 Node
tests passed. A packaged macOS 0.1.2 build also passed the shared fresh-checkout
test (7 assertions), and `npm pack` included its worker, metadata and notices.

The [native CI run](https://github.com/MrLesk/Groma.md/actions/runs/35472816372)
at commit `8cae781f` built and tested all five release hosts successfully, including
Windows x64 and arm64. Each host passed all four Swift integration tests
(47 assertions) and all twelve shared fresh-checkout scanner tests (92 assertions).
The Swift tests check declaration and function evidence, UTF-16 positions, outlines,
source watches and installed execution without Swift on PATH. The isolated branch
passed all 16 Node tests and 601 Bun tests, with 36 optional artifact tests skipped.

Windows packages build the pinned SwiftSyntax source into the worker. Installed
scanning does not resolve packages or invoke the compiler. The actual five-host artifacts
were assembled with the release script; every worker and runtime library was
preserved byte-for-byte, and executable permissions were restored.

The combined npm tarball installed offline and passed all four Swift integration
tests (47 assertions) from that installation. It contains all five workers and
their runtime libraries, licenses and notices; its compressed size is about 138 MB.

The [ordinary CI run](https://github.com/MrLesk/Groma.md/actions/runs/35473844959)
at commit `6aa4178a` passed repository checks on Linux and macOS. Windows built the
Swift package and passed all four Swift tests and all 16 Node tests. Its full Bun
suite had 594 passes, 41 optional skips and two failures in unchanged tests: a Java
Gradle assertion expected Unix path separators, and a Python test exceeded its
20-second limit. The Python timeout cause was not established by this work.
Those failures did not affect the native Swift package qualification. TASK-451
corrected the path assertion and measured the Python interpreter startup cost to
set the test concurrency to two. The [final CI run](https://github.com/MrLesk/Groma.md/actions/runs/35505469431)
at commit `8f7285f9` passed the complete repository checks and standalone builds
on Windows, Linux and macOS, with all existing assertions and time limits retained.

## Cross-platform npm release

[`@groma/scanner-swift@0.1.2`](https://www.npmjs.com/package/@groma/scanner-swift/v/0.1.2)
was published on 20 September 2026 with all five native workers. The public
tarball is 137,637,542 bytes. Registry integrity matches the qualified artifact:

```text
sha512-Xeq3m2CLnJsHQn0ACT56MrUlnRat8HfzR5umx0w7l6yiZTf4ujzJ6Tbnw2i1Jmp7SvJzzKopCQb2HzArwRuUxw==
```

A fresh npm installation passed all four Swift integration tests (47 assertions).
The published Groma 0.3.3 CLI also installed the scanner by its exact npm version
in a disposable project containing the Swift fixture. Readiness passed and two
scans produced byte-identical architecture Markdown without changing source bytes.
A second project restored the copied scanner selection through `groma scanner install`
and passed the same readiness and repeat-scan checks. This consumer check ran on
macOS arm64; the five native CI jobs above qualify the other packaged workers.

## Firefox for iOS benchmark

The benchmark uses [Mozilla Firefox for iOS](https://github.com/mozilla-mobile/firefox-ios)
at commit `35d384c766b5e3091b9df970e4365cf66d9795b9`. It is a Swift-first
application with JavaScript, Python, shell scripts and Objective-C. No project
dependencies were installed and no application build or project script ran.

## Recorded run

Measured on 17 September 2026, on macOS arm64, using Apple Swift 6.3.3
(`swiftlang-6.3.3.1.3`) to build the scanner package. Installed scans use the
packaged SwiftParser/SwiftSyntax libraries without invoking the compiler.
These are local elapsed times, not a comparison across machines.

Tracked source inventory:

| Language | Files | Bytes |
| --- | ---: | ---: |
| Swift | 3,186 | 19,594,520 |
| JavaScript (`.js`, `.mjs`) | 101 | 1,392,439 |
| Python | 62 | 245,377 |
| Shell | 28 | 80,543 |
| Objective-C | 4 | 17,872 |
| C-family headers | 16 | 11,217 |
| Ruby | 1 | 3,264 |

Swift observation:

| Measurement | Result |
| --- | ---: |
| Scanned Swift files | 3,182 |
| Declaration symbols | 38,758 |
| Operations, including module and anonymous bodies | 42,960 |
| Comparable named bodies | 29,388 |
| Call sites | 132,735 |
| Certain call targets | 0 |
| First / repeat observation | 4.286 / 4.627 seconds |
| Outlines for all 3,182 files | 4.909 seconds |
| Top-level outline declarations | 7,933 |

The four omitted Swift paths are `Package.swift` build declarations at the
root, `BrowserKit`, `MozillaRustComponents` and `focus-ios/BlockzillaPackage`.
All other tracked Swift paths parsed, including the filename
`BrowserKit/Tests/MenuKitTests/.swift`. That filename exposed an empty-title
bug in core source naming; standard filename parsing fixes both initial
reconciliation and subsequent reads.

Both observations were identical. The scanner reported one informational
`SWIFT_SOURCE_SCOPE` diagnostic and no syntax failures. The source fingerprint
before and after scanning was
`c234b7d434ae01a24fe197aa02ca923d8b497497d5515fad94802dccdd3dbccb`.
The hash includes sorted tracked source paths and contents for the language
extensions measured by the benchmark script.

## Mixed-language Groma flow

With the local Swift and Python packages installed, two complete `groma scan`
runs took 36.118 and 34.776 seconds. The resulting Code records covered 3,182
Swift and 56 Python files. Python applies its own documented source exclusions.
The first run created 3,244 architecture elements; the second created none and
refreshed 3,238 file records. Both reported 2,390 lint findings.

The complete generated Markdown was byte-identical between scans, with hash
`60a0791f0a600ea1824163f21d8c7cbd06c02707169daecfe27779be6b27ea8e`.
The tracked checkout had no changes after the scan. Initialization instructions
are separate from source scanning and were restored to the pinned checkout
before this comparison.

JavaScript and Objective-C are part of the inventory, but were not scanned in
this run. Unresolved Swift calls do not establish cross-language relationships
or architecture arrows. Lint findings are candidates for review, not verified
defects. Parser coverage and repeatability do not prove that a generated map
matches a human-curated architecture.

## Reproduce

Run from the Groma repository on macOS 14 or later. Building the scanner needs
a Swift toolchain with SwiftParser and SwiftSyntax host libraries; scanning
the installed package does not.

```sh
git clone https://github.com/mozilla-mobile/firefox-ios.git /tmp/firefox-ios
git -C /tmp/firefox-ios checkout 35d384c766b5e3091b9df970e4365cf66d9795b9
bun plugins/scanners/swift/build.ts /tmp/scanner-swift
bun scripts/benchmark-swift-scanner.ts /tmp/firefox-ios /tmp/scanner-swift
```

For the mixed-language flow, build the Python package with its documented
builder, then run `groma init` in the clone and add both local package paths
using `groma scanner add`. Run `groma scan` twice. Compare the sorted paths and
contents of generated `.groma/**/*.md` files and inspect `git diff` to separate
initialization changes from source changes.

Independent concurrent fixtures cover UTF-16 offsets, conditional syntax,
outlines, lexical body normalization, unresolved calls, invalid syntax,
curated ownership and live source edits. The installed package test runs with
only Git on PATH and verifies that parser libraries load from the package.
A release assembly probe also removed the worker executable bit before
assembly and successfully ran the restored worker afterwards. Other host
platforms are outside this result.

## Public release verification

[`@groma/scanner-swift@0.1.0`](https://www.npmjs.com/package/@groma/scanner-swift/v/0.1.0)
was published on 17 September 2026 for macOS arm64. The public tarball is
3,305,777 bytes and includes the worker, five parser libraries, adapter,
licenses and documentation. Its integrity matches the tested release artifact:

```text
sha512-CmAFWtQlvOJF/H3IhuI/VoVH9XOqElGvwLMsGaUBi3KwdmacUOl7SRgbWEqM7MA8iLOdz8KNy15iSGvL55+rOw==
```

The independently downloaded npm package passed all four Swift integration
tests (47 assertions), including execution without language tools and live
source watching. The full repository check passed with 425 Bun tests and
16 Node tests; 25 optional package tests were skipped.

Consumer verification used the published `groma.md@0.3.3` CLI, installed in a
temporary directory separately from the development checkout. On a fresh
pinned Firefox clone with an empty home and scanner cache:

```sh
groma init 'Firefox Swift npm benchmark' --directory .groma
groma scanner add @groma/scanner-swift
groma scanner check
groma scan
groma scan
```

Name resolution saved `@groma/scanner-swift@0.1.0`. Both scans covered 3,182
Swift files, reported 2,269 lint candidates, and produced identical Markdown;
the repeat created no elements. Tracked source bytes were unchanged.
These Swift-only consumer scans are separate from the mixed-language
development-checkout measurements above. Groma 0.3.3 accepts the package by
name; automatic Swift recommendations require the updated official catalog.

A second clone with another empty home and cache received only the shared
`.groma/scanners.json` selection. `groma scanner install` restored the exact
npm version and `groma scanner check` passed. Two scans again covered all
3,182 Swift files, produced identical Markdown within that checkout, and
preserved tracked source bytes. Full CLI scan times were 32.854/41.249 seconds
in the first checkout and 34.548/43.596 seconds in the restored checkout;
the two checkout runs overlapped, so these are completion evidence rather
than isolated performance measurements.

npm trusted publishing is configured for `MrLesk/Groma.md`, workflow
`release.yml`. The trust configuration was read back successfully. This
verifies the npm configuration; the first release was published from the
maintainer login, not through a GitHub Actions run.
