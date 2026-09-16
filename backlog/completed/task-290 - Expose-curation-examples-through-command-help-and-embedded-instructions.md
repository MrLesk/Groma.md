---
id: TASK-290
title: Expose curation examples through command help and embedded instructions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:18'
updated_date: '2026-09-05 22:24'
labels: []
dependencies: []
references:
  - agent-instructions
  - commands
  - instructions
documentation:
  - docs/agent-instructions/index.md
  - docs/component-markdown.md
modified_files:
  - docs/agent-instructions/index.md
  - src/cli.ts
  - src/instructions.ts
type: enhancement
ordinal: 329000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents should be able to discover the existing curation rules from CLI help and the embedded instruction guide. Explain container combine and child reparenting, concise descriptions versus overview prose, an executable flow example with endpoint-link resolution and actor grouping, and the supported scanner coverage and exclusions. Use the existing help and instruction delivery paths. Document current behavior only; do not add ownership correction, preview, scanner behavior or architecture concepts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Command help uses ordinary language for description and overview and directs readers to complete curation examples through an available CLI instruction command.
- [x] #2 The embedded guide shows a container combine, explains moved child ownership and existing empty-record restrictions, and places structural decisions before authored meaning.
- [x] #3 The embedded guide includes a complete flow command example, states its existing relationship prerequisites, explains endpoint paths relative to the flow document, and explains actor grouping in the browser.
- [x] #4 The embedded guide describes actual current scanner coverage and exclusions without inventing an include/exclude helper or changing scanner behavior.
- [x] #5 Examples and help are verified through their shipped CLI entry points; meaningful authoring examples are exercised against temporary architecture, and bun run check passes.
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
1. Keep the existing embedded curation guide as the single source of detailed agent examples; use command help and the human Authoring guide to point to it. 2. Document the actual combine restrictions and child movement, distinguish short descriptions from overview prose, and add one flow example using existing actor/component relationships and links relative to the flow record. 3. Explain current TypeScript file coverage and exclusions without changing scanning or inventing a configuration command. 4. Verify rendered CLI help and instructions, exercise the combine and flow examples in temporary architecture, then run the repository check and self specification/quality plus the required full-context review. OKF/C4: descriptions remain standard metadata, overviews ordinary Markdown, flows supporting scenario knowledge over existing C4 relationships, and containers/components retain current boundaries; no new model or stored field is introduced.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented through the existing embedded curation guide, with short pointers from draft/add/edit help and the human instruction catalog. Added source inspection order, precise container-combine and move restrictions, short description versus Markdown overview, one complete flow command with link base and actor grouping, and current scanner coverage. No scanner or authoring behavior changed. Executed the exact container example in a temporary freshly scanned TypeScript project: the absorbed container was removed while its child kept its ID and Code path under the surviving parent. Executed the exact flow and description examples in a copied minimal fixture: the flow loaded with both ordered relationships and distinct metadata/body text. Manually inspected shipped draft/add/edit help, authoring instructions, agent-instructions curation and scanner list. Self specification/quality/simplicity review found no blocking findings: one existing detailed guide owns the examples, help only points to it, and all source files remain at or below 500 lines. Full repository check is running.

Final full-context complexity review passed with no material recommendations: the existing embedded guide remains the single owner of detailed examples, and CLI help adds only short pointers. Final bun run check passed 106 Node and 310 Bun tests, zero failures; lint and typecheck completed with seven existing warnings outside this task. The guide documents currently supported structural restrictions; the separate discussion about overwriting annotations has not changed product behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Curation examples and scanner coverage are available through groma agent-instructions curation, linked from draft/add/edit help and human instructions. Help uses ordinary language for short descriptions and full overviews. The guide demonstrates container combine, child reparenting, flow link resolution and actor grouping, and explains current move/combine restrictions. Executed the exact combine, flow and description examples in temporary projects; verified shipped CLI output and the full 416-test check. Specification, quality and full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
