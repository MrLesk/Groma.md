---
id: GROM-55
title: Simplify delegation and review guidance
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 12:25'
updated_date: '2026-07-19 12:33'
labels: []
dependencies: []
references:
  - /Users/alex/projects/chief-of-staff.md
  - AGENTS.md
modified_files:
  - AGENTS.md
priority: high
type: docs
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Encode Alex process decision that repeated review should narrow the promise and simplify the implementation rather than accumulate machinery or bureaucracy. Keep the generic collaboration rule separate from Groma-specific semantic boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The generic playbook requires subtraction-first recovery, judgment-based review blocking, a two-cycle stop, four-part delegation briefs, and one implementer plus one fresh complete-batch reviewer without statistics or product state
- [x] #2 Groma guidance preserves the manifesto and shortest first-use path, requires an explicit supported semantic boundary for complex work, and rejects general runtime proof as a default interpretation of fail-closed behavior
- [x] #3 Contradictory or overcomplicated loop-breaker and delegation language is replaced rather than layered with more process
- [x] #4 A fresh reviewer confirms both documents are concise, internally consistent, and materially simpler
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the generic delegation and advisory-loop language with one concise subtraction-first rule set. 2. Add the Groma-specific semantic-boundary rule near delivery and PR guidance. 3. Review both documents for contradictions and verify the Groma diff with one fresh complete-batch reviewer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: chief-of-staff guidance replaced the old three-cycle/Claude circuit breaker and reduced the affected playbook; AGENTS.md now defines Groma supported semantic boundaries without weakening the manifesto or first-use path; git diff --check passed; one fresh complete-batch reviewer approved with no findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced overcomplicated review-loop and delegation guidance with concise subtraction-first rules, judgment-based blocking, a two-cycle stop, four-field briefs, and one implementer plus one complete-batch reviewer. Added the Groma-specific semantic boundary and verified both documents as internally consistent and materially simpler.
<!-- SECTION:FINAL_SUMMARY:END -->
