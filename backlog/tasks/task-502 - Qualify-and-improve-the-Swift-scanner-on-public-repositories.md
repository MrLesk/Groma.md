---
id: TASK-502
title: Qualify and improve the Swift scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:08'
updated_date: '2026-09-23 21:48'
labels: []
dependencies: []
references:
  - swift-src-index
  - src-architecture-findings
modified_files:
  - plugins/scanners/swift/src/index.ts
  - plugins/scanners/swift/worker/Evidence.swift
  - plugins/scanners/swift/worker/Outline.swift
  - plugins/scanners/swift/worker/main.swift
  - src/architecture-findings.ts
  - test/fixtures/swift-shapes/Namespaces.swift
  - test/fixtures/swift-shapes/Future.swift
  - test/fixtures/swift-shapes/Sources/Echo/main.swift
  - test/fixtures/swift-shapes/Sources/TCPClient/Client.swift
  - test/fixtures/swift-shapes/Legacy/AppDelegate.swift
  - test/fixtures/swift-shapes/Package@swift-5.9.swift
  - test/fixtures/swift-shapes/Guide.docc/Snippet.swift
  - test/fixtures/swift-source/Other.swift
  - test-bun/swift-scanner.test.ts
  - test-bun/architecture-findings.test.ts
  - docs/scanners/swift/index.md
  - docs/architecture-findings.md
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/swift/worker/Names.swift
  - plugins/scanners/swift/worker/Conditions.swift
  - plugins/scanners/swift/worker/Contract.swift
type: task
ordinal: 583000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex asked for every existing scanner to be exercised one at a time against public repositories chosen to expose edge cases. The Swift scanner has only been benchmarked on Firefox for iOS. Real Swift projects vary widely: SwiftPM packages, Xcode apps without manifests, macros, conditional compilation, generated sources, test fixtures and mixed-language code. Scan such projects, diagnose what the scanner gets wrong, and fix verified failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Swift repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Swift scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Swift scanner changes.
- [x] #4 Temporary repository clones are removed after Swift qualification and the results are reported to Alex before work starts on another scanner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build the current Swift package into the session scratchpad. Ten read-only agents each clone one public repository at its current default-branch commit under scratchpad/swift/<repo>, run probe.ts (raw observation, outlines, summary) and flow.sh (groma init, scanner add, two scans, view, lint), and report source-backed suspected defects with minimal reproductions. Repositories: swift-argument-parser, vapor, swift-composable-architecture, swift-nio, IceCubesApp, SwiftLint, swift-protobuf, wikipedia-ios, swift-collections, RxSwift.
2. Verify each report against the Swift scanner guide and the source. For each verified failure record the supported rule, the concrete wrong result and the coverage gap, then fix it in the owning Swift scanner module (adapter or worker) with the smallest focused regression. C4 interpretation stays in language-neutral core.
3. Rebuild, re-scan affected clones, run focused Swift tests and bun run check, do a subtraction pass, run the cold simplicity review and the full-context review, remove all clones, report to Alex and pause before another scanner.

Test decisions (rule and authority | wrong result | gap and smallest test):
A. Shared scanners.json exclusions remove source from every scanner (docs/scanners/index.md) | an excluded invalid Swift file fails the whole scan, reproduced on SwiftLint | the registry test excludes only a valid file; add an excluded invalid file to it.
B. SwiftPM manifests and DocC catalogs are not compiled source (Swift guide) | an invalid Package@swift-*.swift or .docc snippet fails the scan; TCA got no architecture | no coverage; the new shapes fixture holds both with invalid content.
C. A row shows copies when the operation range holds its line (architecture-findings copiesOf) | a multi-line signature row shows none; 103 of 542 rows in swift-argument-parser | fixture signatures are single-line; add a wrapped copy to Other.swift and assert copiesOf at its name line.
D. Outline contract (one entry per type per file at its declaration with its visibility; nested declarations in statements are not listed; files without declarations are omitted) | namespace-extension types lose their methods (IceCubes 146 of 148), extensions of nested types are partial and wrongly private, generic and sugar extensions split, statement-nested declarations listed, macros, deinit and escaped names wrong, #if false listed | the fixture has none of these shapes; one new fixture file and one test asserting the entries.
E. Execution entries (evidence.md) | main.swift and @UIApplicationMain entries are missing and SwiftPM executables are titled by generic type names such as Client | no entry coverage; the shapes fixture holds the three forms.
F. The compiler skips version-gated #if blocks (Swift guide) | valid swift-collections sources fail the whole scan | no coverage; the shapes fixture holds a mutate accessor under #if compiler(>=6.4).
G. Invalid source names its file (Swift guide) | a non-UTF-8 file fails with SWIFT_SCAN_FAILED and no path | the failing-source assertion covers syntax only; add Latin-1 bytes.
H. Findings are review questions about separate implementations (docs/architecture-findings.md) | a function is reported as a copy of a helper it declares (TCA, SwiftLint) | tests compare only separate operations; add nested operations plus a same-file sibling copy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ten public repositories were cloned at their default-branch commits and scanned read-only by ten agents with the pre-fix package (probe of the raw observation and outlines, then groma init, scanner add, two scans, view and lint):
- apple/swift-argument-parser cdc5f0c6e836de848699ae11f6480f2d99ac5ef1: 169 files, scan ok; 103 of 542 outline rows with copies showed none (range started at the body brace); main.swift executable missing; extension Range<Int> split from Range; local functions named as members.
- vapor/vapor cbe12f91f07c9935daafc15c34afc38b5735ea79: 270 files, scan ok; 137 rows with multi-line signatures; main.swift entry missing; 14 macro declarations absent; nested types extended in the same file got partial internal entries (33); empty outlines; Package@swift variants and non-UTF-8 files mishandled; the Development entry was titled Entrypoint.
- pointfreeco/swift-composable-architecture 377da4061db10d26337a71bb279c506bb951f50f: the whole scan failed on 5 deliberately incomplete DocC snippets (475 DocC files); lint reported functions as copies of helpers they declare (3 of 164).
- apple/swift-nio 9cb66c6d7a636fef586a93a15827eb247f1c12e9: 549 files, scan ok; 11 main.swift executables missing; @main entries titled Client and Server twice.
- Dimillian/IceCubesApp 9efcb16e720f337a401cf61c8e300dd043368282: 415 files, scan ok; types declared in namespace extensions lost 146 of 148 methods in outlines.
- realm/SwiftLint d5156105b3c58c3ca125daef7735e6515d2fd408: one invalid fixture failed the whole scan and a scanners.json exclusion could not help; a method was reported as a copy of its own closure; a symlinked fixture was scanned twice.
- apple/swift-protobuf e09be89b6b3de9157bcef8b635f7fc4c1fe28f08: 491 files, scan ok; 59.4 MB worker output against a 128 MiB cap; a crash under memory pressure reported no signal; 248 generated *.pb.swift files dominate components and lint.
- wikimedia/wikipedia-ios f37e3d1e618132866c7588ca1175bf1da8c66a24: 1,407 files, scan ok; 42 extensions of nested types, 45 anonymous deinit bodies, escaped names kept backticks.
- apple/swift-collections a66de878e87ef5a3d5d390e0f6d9002aa5541a43: the whole scan failed on valid borrow/mutate accessors inside #if compiler(>=6.4); 50 #if false blocks were listed and compared.
- ReactiveX/RxSwift 3e33f90c1bcd3cdea25bdb49bd4a594a50c3ab84: 1,018 files including 431 symlinks, which produced 411 duplicate components and 923 alias lint findings; escaped names kept backticks.
Fixed: exclusion predicate applied before parsing; Package@swift-<version>.swift and *.docc skipped; ranges start at the declaration; outlines list types declared in extensions and nested types the file extends at their declaration, merge generic and sugar extensions, skip statement-nested declarations and empty files, and list macros and deinit; main.swift, @UIApplicationMain and @NSApplicationMain are entries, named by the SwiftPM target directory under Sources or Plugins; version-gated #if compiler/swift blocks do not fail the scan; #if false is skipped; non-UTF-8 files are named; names drop backticks; local declarations are qualified by their operation; deinit is a named compared operation; the output cap is removed and a crash names its signal. Core: a body is never a copy of a body it contains (equal line ranges still compare, as on one minified line).
Rescan with the fixed package: TCA 317 files in 1.4 s with 11 entries; swift-collections 730 files in 2.0 s; swift-nio entries 5 to 16, named by target; outline members IceCubes 1,037 to 1,193, swift-nio 7,738 to 8,122, swift-protobuf 21,464 to 30,504; wrongly internal nested entries in swift-protobuf Sources dropped from 96 to the 78 genuinely internal ones.
Left unchanged: tests, examples and generated sources stay scanned by design (the JavaScript guide records this stance for JavaScript, PHP and Swift); symlinked duplicates belong to the shared repository listing; implicit getter and subscript calls, #if conditions and case patterns as calls, and chained calls without member have no visible effect while Swift calls stay unresolved; Info.plist extension principals, @main in both #if branches, same-named @main types in Xcode apps, core titles such as Main and Contents, underscore module ID collisions, case-sensitive shared directory exclusions and discovery counting Package.swift are outside this scanner.
Checks: focused Swift and findings tests 21 pass; the new assertions fail on the pre-fix package and the new findings test fails at HEAD. Complete check in an isolated worktree at HEAD with only this task's files: Biome, typecheck and 16 Node tests pass; Bun 709 pass, 43 skip, 2 fail, both 20-second timeouts in untouched Java and Python scanner tests under load average 30-40 from concurrent sessions; both pass alone with the same limit (4.8 s and 9.4 s). A repeat run is in progress.

Cold simplicity review: one blocking finding, the findings doc overclaimed (a third copy can still cluster a body with its helper); narrowed to 'not compared with each other'. Applied its non-blocking findings: removed the unused macro symbol kind, entryName uses only Sources, Context.type renamed scope, versionGated moved beside disabled, one sentence in creating-a-plugin.md, the UTF-8 test asserts by pattern instead of exact wording.
Complete check in the isolated worktree after the review changes, run twice: Biome (4 existing warnings in untouched files), typecheck and 16 Node tests pass; Bun 710 pass, 43 skip, 1 fail each run, a different load timeout each time (Swift worker build test at 60 s, then Java overloads at 20 s) under load average 35-50 from five concurrent scanner sessions. Every timed-out test passes alone with the suite limit (Swift 18.9 s, Java 10.8 s and 4.8 s, Python 9.4 s). No assertion failed in any run.
Full-context review (general-purpose agent with a written brief; the fork agent type is unavailable here): keep the approach; seven pure simplifications and one behavior decision reported to Alex, none applied.
All ten clones, probe outputs and reproductions under the session scratchpad were deleted; no clone remains.

Alex approved all seven behavior-preserving simplifications from the full-context review; applied: naming helpers moved to worker/Names.swift and #if rules to worker/Conditions.swift; one declaredName for symbols and outline entries; nested types take their enclosing default access from the same fallback as members; one callable helper for functions, initializers and deinit; the worker's entryPoint field renamed entryType; the shared outline contract lists a Swift extension body among namespace blocks instead of a Swift exception; the Swift guide describes version-gated blocks as the code treats them. The equal-line-range rule in core is unchanged pending Alex. Focused Swift, findings and native entry tests: 24 pass, 2 skipped (Go and Rust toolchains), 0 fail.

Final complete check on the refactored change, in a fresh worktree at main bc1efc3b with only this task's files and hunks: Biome (4 existing warnings in untouched files), typecheck, 16 Node tests and the Bun suite (709 pass, 43 skip, 0 fail) all pass; exit 0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the Swift scanner on ten pinned public repositories and fixed the verified failures: excluded, manifest and DocC files no longer break scans; valid version-gated syntax, #if false and non-UTF-8 files are handled; outlines list namespace-extension and extended nested types, merge generic and sugar extensions, and include macros and deinit; main.swift and UIKit/AppKit entries are recognized and named by their SwiftPM target; operation ranges start at the declaration; names are unescaped and locally qualified; and core no longer compares a body with a body it contains. TCA and swift-collections now scan instead of failing, and outlines gained up to 9,040 methods per repository. Verified with red-to-green focused tests and a complete repository check (709 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
