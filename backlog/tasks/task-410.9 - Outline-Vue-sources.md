---
id: TASK-410.9
title: Outline Vue sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 18:44'
labels: []
dependencies: []
references:
  - scanners-typescript-outline
  - vue-src-index
modified_files:
  - plugins/scanners/typescript-outline.ts
  - plugins/scanners/vue/src/outline.ts
  - plugins/scanners/vue/src/index.ts
  - test/fixtures/vue-outline/Profile.vue
  - test/fixtures/vue-outline/greeting.ts
  - test/fixtures/vue-outline/groma/index.md
  - test/fixtures/vue-outline/groma/project.md
  - test/fixtures/vue-outline/groma/systems/studio/system.md
  - test/fixtures/vue-outline/groma/systems/studio/containers/web/container.md
  - >-
    test/fixtures/vue-outline/groma/systems/studio/containers/web/components/profile.md
  - test-bun/vue-scanner.test.ts
  - docs/scanners/vue/index.md
parent_task_id: TASK-410
type: feature
ordinal: 465000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vue single-file components show no declarations. The Vue scanner already reads single-file components with the Vue compiler.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Vue-owned files, including single-file component scripts, show their functions, classes and methods, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Vue scanner documentation describes the outline.
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
1. Extend plugins/scanners/typescript-outline.ts with outlineDeclarations(ts, block): it outlines one block of source text (a file, or one Vue script block) and takes topLevelPrivate for a block that exports nothing. readTypeScriptOutline keeps reading whole files through it.
2. New plugins/scanners/vue/src/outline.ts: for a .vue file, parse the single-file component with the SFC parser @vue/language-core already exports (no project, tsconfig or Volar program), then outline each script block with the Vue package's own TypeScript 5.9.3. The block is parsed inside the .vue text with everything around it blanked except newlines, so every line is the line of the .vue file itself; the block's lang attribute selects the dialect. A <script setup> block exports nothing, so its top-level declarations are private, while its members keep TypeScript member visibility. Other owned script files are outlined directly; templates and stylesheets are skipped.
3. Vue index.ts: readCodeStructure delegates to that module.
4. Fixture test/fixtures/vue-outline: Profile.vue with a <script lang=ts> block (exported class with methods, non-exported function) and a <script setup lang=ts> block, plus greeting.ts, and a groma tree whose component Code lists Profile.vue and greeting.ts under vue and greeting.ts under typescript with a symbol.
5. Tests in test-bun/vue-scanner.test.ts through the built package: the .vue outline with its file lines and script setup visibility; parity with the TypeScript reference on greeting.ts and test/fixtures/typescript-outline/outline.ts; core returns one outline for the co-owned greeting.ts, here from the TypeScript scanner (lowest scanner id), carrying the symbol the vue link names.
6. Document the outline, script setup and the shared-file rule in docs/scanners/vue/index.md.
7. Isolated bun run check, Vue build, specification and quality self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The shared plugins/scanners/typescript-outline.ts gained outlineDeclarations(ts, block), which outlines one block of source text and accepts topLevelPrivate for a block that exports nothing; readTypeScriptOutline now reads whole files through it, so Angular and React behavior is unchanged. plugins/scanners/vue/src/outline.ts parses a single-file component with the parser @vue/language-core already exports (no project, tsconfig, Volar program or new dependency), outlines the <script> and <script setup> blocks in source order, and keeps each block inside the .vue text with everything before it blanked except line breaks, so declarations report the line they occupy in the .vue file without offset arithmetic. The block's lang attribute names the dialect; a <script setup> block exports nothing, so its top-level declarations are private while members keep TypeScript member visibility. Templates and stylesheets, which Vue also owns, are skipped.
Fixture test/fixtures/vue-outline: Profile.vue (a <script lang=ts> block with a non-exported function and an exported class with constructor, public and protected methods, and a <script setup lang=ts> block with a function and a ref binding), greeting.ts, and a groma tree whose component Code lists Profile.vue under vue, greeting.ts under vue with symbol greeting, and greeting.ts under typescript.
Verification: bun test --timeout 20000 test-bun/vue-scanner.test.ts 8 pass. The built package outlines Profile.vue as initials private (line 2), Members public (line 6) with constructor, initials and protected first (lines 7, 9, 13), and save private (line 25) from the script setup block; its outline of greeting.ts and of test/fixtures/typescript-outline/outline.ts equals the TypeScript reference outline. Through core, the co-owned greeting.ts is outlined once by the TypeScript scanner (lowest scanner id) and carries entry from the symbol only the vue link names, with Profile.vue first in Code order. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 433 pass, 25 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded in that worktree with the outline and the single-file component parser bundled.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Vue-owned scripts now show their source outline, single-file components included. The shared plugins/scanners/typescript-outline.ts can outline one block of source text, and the new plugins/scanners/vue/src/outline.ts parses a .vue file with the parser @vue/language-core exports, outlines its <script> and <script setup> blocks with the Vue package's own TypeScript 5.9.3, reports the lines the declarations occupy in the .vue file, and treats <script setup> top-level declarations as private because that block exports nothing. Verified with test/fixtures/vue-outline and test-bun/vue-scanner.test.ts: the built package's outline of the single-file component, parity with the TypeScript reference on a plain script and on the shared outline fixture, and one outline for a script Vue and TypeScript both own, carrying the symbol only the vue link names. Isolated bun run check exit 0 and the Vue package build both passed. Documented in docs/scanners/vue/index.md.
<!-- SECTION:FINAL_SUMMARY:END -->
