---
id: GROM-45
title: Self-scan Groma and preserve its curated architecture
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 19:50'
labels: []
milestone: m-3
dependencies:
  - GROM-32
  - GROM-43
  - GROM-49
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - groma
priority: high
type: task
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use Groma’s public CLI to reconcile the seven unambiguous internal package and source-boundary observations from its built-in TypeScript/Bun scanner with the existing curated self-blueprint. Preserve curated stable identities and intent across rescans while leaving third-party and Node observations visibly separate. This is a bounded self-dogfood curation fixture, not a benchmark, matcher expansion, bulk-curation API, or new semantic path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The seven internal observations groma, core, host, persistence, standard-model, plugin-sdk, and cli are merged through the existing public component merge operation into their unambiguous curated counterparts
- [x] #2 A following scan migrates evidence bindings and evidence relationship projections to the curated survivors, while canonical relationships preserve old references through durable aliases without recreating any merged automatic component
- [x] #3 Every curated survivor retains its pre-merge stable identity, name, intent, containment, and curated members and relationships
- [x] #4 Third-party and Node module observations remain separate evidence-backed external components rather than being guessed into curated architecture
- [x] #5 An unchanged rescan and bounded blueprint/component reads are deterministic and expose curated architecture beside supporting implementation evidence
- [x] #6 The canonical diff contains only intentional durable aliases, retired automatic intent files, survivor scanner-owned relationships, refreshed evidence bindings and projections, and transaction state produced by public operations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Capture the pre-merge blueprint and exact component revisions through bounded public reads. 2. Merge each of the seven internal observations into its curated counterpart with the compiled public CLI. 3. Rescan twice and inspect aliases, survivor details, evidence, relationships, externals, component count, and byte stability. 4. Review the canonical diff for only operation-produced state, then run proportional repository validation. 5. Complete exactly two Terra xhigh reviews and one Claude review before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Used the compiled public CLI to merge seven scanner-created internal observations into existing curated components: groma -> Official Host, core -> Core, host -> Default Host, persistence -> Canonical Persistence, standard-model -> Standard Model, plugin-sdk -> Plugin SDK and Conformance, and cli -> CLI Surface. Each merge used the observed component’s exact public revision.

The following scan completed with 65 records and migrated all seven evidence bindings and evidence relationship projections to survivor IDs. Canonical relationships created before or during merge retain old endpoint IDs where semantically unchanged and resolve through the durable aliases, matching the public merge contract that old references survive canonical supersession. The blueprint shrank from 58 to 51 components and from 24 to 17 roots: the nine curated roots plus eight evidence-backed externals (@babel/parser, yaml, and six node: modules). No internal automatic name remains. Exact pre/post comparison proved all seven survivor component documents retained identity, name, intent, containment, members, and curated metadata; alias reads return each survivor with its supporting evidence.

A second unchanged scan was byte-identical at generation 131 with canonical digest 3d457570a639583d4ad2649b436479a4d5817856c33230485f0310952c365bbc. The canonical diff is net -37 lines across operation-owned state: seven durable aliases, seven retired automatic intent files, scanner-owned import relationships on survivors, refreshed evidence bindings/projections, and the transaction generation. Full bun run check passed: formatting, TypeScript, architecture boundaries, 406 tests / 2,702 assertions, build, smoke, and compiled crash recovery.

Pre-PR review completed with exactly two independent Terra xhigh passes and one local Claude pass. Both Terra reviews found no actionable issue and independently confirmed alias resolution, evidence attachment, curated-state preservation, external separation, and use of the existing semantic path. Claude identified imprecise wording that could imply every canonical relationship target was rewritten; the task now distinguishes normalized evidence projections from canonical old references intentionally preserved through durable aliases. No manual canonical rewrite or new mechanism was introduced.
<!-- SECTION:NOTES:END -->
