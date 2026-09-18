---
id: TASK-410.1
title: Outline Java sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:37'
updated_date: '2026-09-18 17:39'
labels: []
dependencies: []
references:
  - java-src-index
modified_files:
  - plugins/scanners/java/java/md/groma/scanner/Outline.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - test/fixtures/java-outline/groma/index.md
  - test/fixtures/java-outline/groma/project.md
  - >-
    test/fixtures/java-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/java-outline/groma/systems/shop/containers/api/container.md
  - test/fixtures/java-outline/groma/systems/shop/system.md
  - test/fixtures/java-outline/src/main/java/shop/Orders.java
  - test/fixtures/java-outline/src/main/java/shop/Receipt.java
  - test/fixtures/java-outline/web/orders.ts
  - plugins/scanners/java/src/adapter.ts
  - plugins/scanners/java/src/index.ts
  - test-bun/java-outline.test.ts
  - docs/scanners/java/index.md
  - test/fixtures/java-outline/src/main/java/Greeting.java
parent_task_id: TASK-410
type: feature
ordinal: 457000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Java components show only files. The Java worker already parses sources with javac trees; the outline can come from that parse without the project classpath.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Java-owned files show their classes, interfaces, enums and records with constructors and methods, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Java scanner documentation describes the outline.
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
1. Java worker: new Outline.java and an 'outline <root>' command in Main.java. It parses the listed files with JavacTask.parse() only (no classpath, no attribution, UTF-8, syntax errors tolerated) and lists top-level classes, interfaces, enums, records and annotation types (package declarations are transparent; nested types are not listed). Members are every method and constructor in the type body, including interface and annotation signatures, static and abstract methods and compact record constructors, each overload separately; constructors are named after the type. Fields, initializers and enum constant bodies are not listed. Lines come from the name's position after modifiers, type parameters and return type. Visibility follows the contract's Java row: public, protected, private; interface and annotation members without a modifier are public; enum constructors without a modifier are private; other members and top-level types without a modifier are internal.
2. Adapter: readJavaOutline(root, references) runs the bundled runtime with the worker for existing referenced files and adds entry from each reference's symbols; the Java scanner exposes it as readCodeStructure.
3. Fixture test/fixtures/java-outline: a Groma world whose component Code holds a Java file (Java scanner) and a TypeScript file (TypeScript scanner); test-bun/java-outline.test.ts builds the Java package, adds both scanners and asserts the outline through core's readCodeStructure.
4. docs/scanners/java/index.md: Source outline section.
5. Rebuild the Java package, verify on the fixture and a real Java file, run bun run check in an isolated worktree.

Review-fix round (external cold reviews of HEAD cf8e7975):
6. Fix: the name lookup in Outline.java could match the name inside a comment (for example void /* run */ then run() on the next line), which put the type, method or constructor on the wrong line. Scan Java tokens after the modifiers, type parameters and return type, skipping comments, and take the name only where it is the next token (after a class, interface, enum or record keyword for types). The same comment skipping applies to the compact record constructor check, which a comment before the body defeated, and it keeps a compact source file's implicit type at its start (the file name in a string literal moved it). Regression cases go into test/fixtures/java-outline and test-bun/java-outline.test.ts.
7. No other TASK-410.1 findings: the second reviewer reported none.

8. Cold review of step 6: annotations written after a constructor's type parameters join the prefix the scan starts after; the docs place a compact source file's type at the line where its first field or method starts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. The worker's new 'outline <root>' command (Outline.java) parses only (JavacTask.parse, UTF-8, -proc:none, no classpath); diagnostics are collected and ignored so syntax errors keep what the parser recognized. Name lines come from the first identifier match of the name after the declaration's modifiers, type parameters and return type (SourcePositions), so annotations and multi-line return types do not shift them. readJavaOutline (adapter.ts) runs the bundled runtime with the packaged worker for referenced files that exist (a past revision may lack some), then sets entry: a type by its simple name (the scan's Code symbol form), a member by Type.member, so constructors do not become entries whenever the type is linked. The Java scanner exposes it as readCodeStructure; projectScanner passes it through unchanged.

Verification:
- bun test test-bun/java-outline.test.ts: builds the Java package, adds it and the TypeScript scanner to test/fixtures/java-outline, and reads the component outline through core readCodeStructure: files in Code order (web/orders.ts, then Orders.java); Orders (public, entry) with two constructors (public, internal), overloads place (entry via Orders.place, name on the line after a multi-line return type), protected static generic first, private audit, package count; Pricing interface members public except private base; Status enum constructor private; Receipt compact and explicit constructors internal; Audited element public; Base abstract method internal; fields, the static initializer, the nested class, the anonymous class and the enum constant body are absent.
- Packaged scanner on mockito sources (scratch clone): MockitoExtension, Mockito (76 members) and ArgumentMatchers (52) outlined in 936 ms with lines matching the source; a missing file is skipped. A compact source file lists its implicit class under the file name with its methods.
- Isolated worktree at 9b574bc5 with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 388 pass, 0 fail).
Contract note (not edited): the shared rule says entry when the reference's symbols contain the name; Java, like Python, matches members by Type.member.

Cold review fixes: documented the compact source file case (one internal type named after the file at line 1) and the real recovery limits (a syntax error drops the declarations after it; a file rejected at its first token, such as one with a byte order mark or binary content, outlines nothing, both reproduced with the worker); a compact record constructor without a modifier now takes the record's own access (JLS 8.10.4.1), verified by moving the record into test/fixtures/java-outline/src/main/java/shop/Receipt.java as a public record whose compact constructor is public while its non-canonical constructor stays package access; corrected the sourceFiles javadoc in Main.java; readJavaOutline now filters empty files before mapping.

Re-verification: bun test test-bun/java-outline.test.ts 1 pass (two Java files plus the TypeScript file, all in Code order). Isolated worktree at 318ef749 with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 434 pass, 0 fail).

Review-fix round (external cold reviews of HEAD cf8e7975): the name lookup was a first identifier match of the name anywhere after the modifiers, type parameters and return type, so a comment such as void /* run */ put run on the comment's line, a comment before a compact constructor's body hid it (the record's access was lost), and a compact source file naming itself in a string moved its type to that line. Outline.java now scans Java tokens from that point, skipping whitespace and // and /* */ comments; the name counts only when it is the next token (after class, interface, enum or record for a type), otherwise the search start is kept. The compact-constructor check uses the same skipping. Cold review of this fix: annotations written after a constructor's type parameters (public <T> then @Deprecated then Gen(T t)) belong to the modifiers but lie after the modifiers' end, so they are now part of the scanned prefix; the unused @ branch was deleted, skipBlank renamed skipSpaceAndComments, and the docs now place a compact source file's type at the line where its first field or method starts (not line 1, which is wrong when the file has imports).
Verification: test-bun/java-outline.test.ts covers a comment naming place after its return type, a commented compact constructor, a compact source file printing its own name, and an annotated generic constructor; each case fails on the HEAD worker (lines 20, internal, 2 and 15 instead of 21, public, 1 and 17). Isolated worktree at HEAD with only this task's changes: bun run check exit 0 (Biome: only existing warnings; tsc; node 16 pass; bun 515 pass, 32 env-gated skips, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Java scanner now outlines the files it owns. A new worker command parses each requested file with the bundled compiler's parser, without a classpath or type resolution, and returns top-level classes, interfaces, enums, records and annotation types with the methods and constructors in their bodies, each with name, line and visibility from the Java modifier rules (interface and annotation members public, a compact record constructor with the record's access, enum constructors private, other members and top-level types package access). Fields, initializers, nested and anonymous types and enum constant bodies are left out. The adapter marks entries from each Code link's symbols, naming a type by its simple name and a member as Type.member. Verified by test-bun/java-outline.test.ts, which builds the Java package, adds it beside the TypeScript scanner and reads test/fixtures/java-outline through core readCodeStructure; by outlining real mockito sources with the packaged scanner; and by bun run check in an isolated worktree. The Java scanner documentation describes the outline and its limits.

Review-fix round: the outline no longer takes a declaration's name from a comment or string. It scans Java tokens after the modifiers (including annotations after type parameters), type parameters and return type, skipping comments, so comments before a name keep its line and a commented compact constructor keeps the record's access; a compact source file's type sits where its first field or method starts, as the docs now say. Verified by new cases in test-bun/java-outline.test.ts that fail on the previous worker, and bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
