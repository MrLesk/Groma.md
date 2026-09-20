---
id: TASK-406
title: 'Model current Groma actors, external systems, and flows'
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 15:30'
updated_date: '2026-09-15 15:51'
labels: []
dependencies: []
references:
  - groma-md
  - developer
  - coding-agent
  - backlog-md
  - git
  - scanner-package-registry
  - src-cli
  - task-diff-control
  - revision-control
  - backlog-src-index
  - history-revisions
  - package
  - src-authoring
  - src-architecture-reader
  - data
  - web-server
  - src-scanner
  - scanner-registry
documentation:
  - docs/product-model.md
  - docs/component-markdown.md
  - docs/agent-instructions/index.md
modified_files:
  - groma/actors/developer.md
  - groma/externals/coding-agent.md
  - groma/externals/backlog-md.md
  - groma/externals/git.md
  - groma/externals/scanner-package-registry.md
  - groma/relationships.md
  - groma/flows/scan-project-source.md
  - groma/flows/curate-an-architecture-record.md
  - groma/flows/coding-agent-curates-architecture.md
  - groma/flows/review-a-project-task.md
  - groma/flows/review-architecture-history.md
  - groma/flows/install-a-published-scanner.md
  - groma/actors/coding-agent.md
type: task
ordinal: 452000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current Groma architecture lacks actors and external systems after an architecture rebuild, leaving readers unable to see who uses Groma, which outside systems it collaborates with, and how supported user scenarios run. Determine the correct model from current product documentation and source code, starting from first principles. Historical records are not the specification and need not be restored. Scope is architecture curation through Groma commands, not scanner or viewer implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The architecture declares the actors and external systems justified by current supported Groma usage, with clear roles, responsibilities, and evidence recorded in task notes.
- [x] #2 The model applies C4 system boundaries explicitly: actors, external systems, internal elements, and supporting scenario knowledge are distinguished; tools or dependencies are not automatically promoted to external systems.
- [x] #3 Authored directed relationships connect the selected actors and external systems to the correct current architecture elements, with accurate descriptions and interaction technologies supported by current behavior.
- [x] #4 A concise set of flows covers the principal supported user scenarios identified during investigation. Each flow explains its actor, entry point, ordered interactions, and visible result; every step resolves to an existing directed relationship without invented execution order.
- [x] #5 The records follow the existing OKF architecture profile: ordinary Markdown readers can understand the descriptions and follow links, while Groma uses existing identity, relationship, and flow semantics without new metadata or concepts.
- [x] #6 Groma loads the resulting world successfully, and the web map shows the actors, external systems, relationships, and selectable flows correctly. Existing unrelated architecture curation is preserved.
- [x] #7 Task notes explain the final model and validation evidence so a reader can understand the supported scenarios without the original conversation.
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
1. Inspect current commands, browser requests, task integration, history, and scanner installation to identify supported participants and scenarios.
2. Declare Developer and Coding agent as human and AI actors. Declare Backlog.md, Git, and Scanner package registry as external services used by Groma. Use existing OKF/C4 records and exact current element ownership.
3. Add only relationships required to explain scanning, curation, task review, history review, and scanner installation. Author ordered flows through those relationships using Groma commands; update task traceability after every write.
4. Validate the loaded model, preserve unrelated records and relationships, and inspect participants and selectable flows in the web map. Review scope and evidence, then finalize the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model rationale: C4 context distinguishes human roles from external software (https://c4model.com/diagrams/system-context). Developer covers the current human responsibilities without inventing separate organizational personas. Coding agent is an external automated CLI caller, not a human actor. Backlog owns tasks; Git supplies repository history and inventory; the configured npm-compatible registry supplies scanner releases. Built-in scanners, compiler libraries, local files, and browser rendering remain existing internal responsibilities or implementation mechanisms. OKF stores ordinary descriptions and Markdown endpoint links; Groma owns identity resolution, external placement, and ordered flow interpretation. The participant roles apply across languages; the npm-compatible registry and Git are concrete current product integrations, not universal architecture requirements. Evidence: docs/product-model.md; src/cli.ts; src/authoring.ts; plugins/work-sources/backlog/src/index.ts; src/history/revisions.ts; src/scanner/modules/package.ts and published.ts; src/viewers/web/data.ts and map-session.ts. No other task is currently In Progress. Existing uncommitted relationships must be preserved.

Validation: the current Groma model loads with Developer as one actor and Coding agent, Backlog.md, Git, and Scanner package registry as four external systems. All six flows resolve every ordered step through existing directed relationships. Browser verification used a local server with initial scanning disabled: all participants appear in the hierarchy; all six flow checkboxes open the correct detail panel; Next focuses and highlights a task-review step on the map. Cold simplicity review passed without blocking findings; removed two unnecessary scope-exclusion sentences. Implementer specification and quality review confirmed the current source paths, human versus software boundaries, CLI edit persistence, separate task-detail and diff requests, revision snapshots, and registry lookup before installation. Existing architecture documents and relationship rows were compared against the pre-task snapshot. No application source or automated tests changed, so the code test suite is not required for this architecture documentation task.

Final preservation check: 108 pre-existing Markdown records are byte-for-byte unchanged; all 42 pre-existing relationship rows remain; 14 authored rows were added. Six flows contain 23 validated directed steps. The separate full-context complexity review passed with no blocking findings or material recommendations. All architecture writes used Groma commands and were immediately recorded in task traceability. No scanner/model ownership changes or application code changes were made.

User correction: AI assistants are actors in Groma. They initiate reads, scans, planning, and curation through the same interface as people; Groma does not call an AI service. Classifying every outside software participant as an external dependency hid this product role. Backlog.md, Git, and the scanner package registry remain external systems because Groma consumes their services. Correct Coding agent to an actor while retaining its identity, CLI relationship, and existing flow. This is Groma application-profile meaning, not a claim that connection direction alone universally determines C4 type.

Correction verified: Coding agent is now a C4 Actor at groma/actors/coding-agent.md with the same coding-agent ID. Its CLI relationship and three-step flow were recreated through Groma commands with actor links. Groma loads two actors, three external systems, and the same six flows/23 steps. Browser verification shows Coding agent under ACTORS, actor details with its outgoing CLI relationship, and its flow under FLOWS FROM THIS ACTOR. The former external record is removed. Targeted implementer review found no additional changes needed for this classification correction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Developer and Coding agent as actors, plus Backlog.md, Git, and Scanner package registry as external systems used by Groma. Added 14 authored relationships and six flows with 23 validated steps. Verified browser flow selection and highlighting; confirmed Coding agent appears under Actors with its flow and outgoing CLI relationship. Existing unrelated architecture records and relationships are preserved.
<!-- SECTION:FINAL_SUMMARY:END -->
