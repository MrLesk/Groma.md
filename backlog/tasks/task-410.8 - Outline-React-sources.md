---
id: TASK-410.8
title: Outline React sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 18:37'
labels: []
dependencies: []
references:
  - react-src-index
modified_files:
  - plugins/scanners/react/src/index.ts
  - test/fixtures/react-outline/profile.tsx
  - test/fixtures/react-outline/groma/index.md
  - test/fixtures/react-outline/groma/project.md
  - test/fixtures/react-outline/groma/systems/studio/system.md
  - test/fixtures/react-outline/groma/systems/studio/containers/web/container.md
  - >-
    test/fixtures/react-outline/groma/systems/studio/containers/web/components/profile.md
  - test-bun/react-scanner.test.ts
  - docs/scanners/react/index.md
parent_task_id: TASK-410
type: feature
ordinal: 464000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React-owned files show no declarations. The React scanner carries its own compiler tooling and must not depend on the TypeScript scanner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 React-owned files show their components, classes with methods and top-level functions, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The React scanner documentation describes the outline.
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
1. React index.ts: readCodeStructure passes the React package's pinned TypeScript 6.0.3 to the shared plugins/scanners/typescript-outline.ts for every reference; React Code holds only TSX sources, which the compiler parses by extension. Components are top-level functions or function literals bound directly to top-level names; wrapped values such as memo(...) are not listed; class components are types with their methods.
2. Fixture test/fixtures/react-outline: one TSX source (helper, arrow and function components, a memo-wrapped component, a class component with static, protected and instance methods) and a groma tree whose component Code lists the source under typescript (with a symbol) and react.
3. Tests in test-bun/react-scanner.test.ts through the built package: the outline rules and lines; parity with the TypeScript reference on the fixture; core returns one outline for the co-owned file, keeping the TypeScript link's entry mark.
4. Document the outline in docs/scanners/react/index.md.
5. Isolated bun run check, React build, specification and quality self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
React's readCodeStructure passes its pinned TypeScript 6.0.3 to the shared plugins/scanners/typescript-outline.ts (from TASK-410.7) for every reference; React Code holds only TSX sources, parsed as TSX by extension, so no filter is needed. Core already outlines a co-owned file once with the lowest configured scanner id ('react' before 'typescript') and the symbols of all its links.
Fixture test/fixtures/react-outline: profile.tsx (non-exported helper, exported arrow and function components, a memo-wrapped component, a class component with static, protected and instance methods) and a groma tree whose component Code lists profile.tsx under typescript with symbol Profile and under react. No package.json, so the repository's own React scan never selects it; .tsx is outside the root tsc and Biome globs.
Verification: bun test --timeout 20000 test-bun/react-scanner.test.ts 11 pass. The built package lists initials private, Avatar and Profile public (Profile entry), Counter with label, increment protected and render, and not the memo-wrapped Badge, each at its name line; its outline equals the TypeScript reference outline on the same file; core returns one outline for the co-owned file with Profile marked entry from the TypeScript link. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 389 pass, 24 skip, 0 fail). bun plugins/scanners/react/build.ts built dist/package with the shared outline bundled against ./typescript.cjs.

Cold review corrections (coordinator decisions), applied: a comment records that React filters no reference because every file it owns is a TSX source; the parity assertion now loops over the fixture source and test/fixtures/typescript-outline/outline.ts, so the package's 6.0.3 compiler is compared with the reference on namespaces, export lists, overloads, private names, constructors, interfaces and enums; the React page states that a file whose only component is a memo(...) value has no declarations and is left out of the outline while its Code file still appears.
Verification after corrections: bun test --timeout 20000 test-bun/react-scanner.test.ts 11 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 392 pass, 24 skip, 0 fail). bun plugins/scanners/react/build.ts succeeded in that worktree.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
React-owned TSX files now show their source outline. The React scanner implements readCodeStructure by passing its pinned TypeScript 6.0.3 to the shared plugins/scanners/typescript-outline.ts, so components (top-level functions and function literals bound to a top-level name, never memo(...) values), class components with their methods and other top-level functions and types appear with name, line and visibility. Verified with test/fixtures/react-outline and test-bun/react-scanner.test.ts: the built package's outline of the fixture source, parity with the TypeScript reference on that source and on test/fixtures/typescript-outline/outline.ts, and one outline with the TypeScript link's entry mark for a file React and TypeScript both own. Isolated bun run check exit 0 and the React package build both passed. Documented in docs/scanners/react/index.md.
<!-- SECTION:FINAL_SUMMARY:END -->
