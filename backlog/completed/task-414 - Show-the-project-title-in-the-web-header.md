---
id: TASK-414
title: Show the project title in the web header
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-16 23:18'
labels: []
dependencies: []
references:
  - shell
  - render
modified_files:
  - src/viewers/web/chrome/stats.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
  - src/viewers/web/selection.ts
type: bug
ordinal: 469000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web header names the project with the title of the first internal C4 system (`paintWorldStats` in `src/viewers/web/chrome/stats.ts`). A repository with several systems therefore presents one system as the project: callforpapers, titled "Call for Papers" in `groma/project.md`, shows "Conference website".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The live web header shows the title from `groma/project.md` instead of a system title.
- [x] #2 The header updates when the project title changes while the map is open.
- [x] #3 A static export shows the same project title.
- [x] #4 The C4 counts and the other header controls remain available.
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
1. Pass the loaded project profile (already in every live, historical, and published map payload and refreshed by the architecture watch when groma/project.md changes) from render.ts into the header painter.
2. paintHeaderSummary (src/viewers/web/chrome/stats.ts) names the project with the profile title and keeps the internal C4 counts; it reads only world elements and the project title.
3. primarySystem, used only for the initial selection, lives with the other selection helpers in src/viewers/web/selection.ts.
4. Update the web viewer header description in docs/viewers/web/index.md (project title and C4 counts).
5. Verify in a temporary fixture repository with several systems: live header shows the project.md title, changes after editing the title while open, and a groma export page shows the same title; counts and header controls remain. Run bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow: every map payload (live, historical, published) already carries the project profile from loadMapRoot, and the live architecture watch republishes it when groma/project.md changes. render.ts now passes that profile to paintWorldStats, which names the project with project.title and keeps the internal C4 counts. primarySystem remains only for the initial selection. The header now depends on the project profile instead of an internal system, so an initialized empty world also shows its project title with zero counts.

Verification (scratchpad copy of test/fixtures/large-world, four internal systems, git-initialized; groma web on port 4791, Chrome DevTools):
- Live: header showed 'Large world architecture' / '4 systems · 20 containers · 300 components' while Catalog was selected; Search, Revision, Fit, zoom, Settings, Theme, Help, About present.
- Live update: changing the title line in groma/project.md to 'Renamed live project' updated the header after about 2.2 s in the same document (no reload); counts unchanged.
- Export: groma export (after adding stub files for the fixture's code references, which export reads) served statically on port 4792; body data-delivery=published, header showed 'Renamed live project' with the same counts and the published header controls.
- Both servers stopped after verification.
Docs: docs/viewers/web/index.md header sentence now names the project title from project.md and the system, container, and component counts.

bun run check (two runs, the second a few minutes later): Biome lint passed with pre-existing diagnostics outside this task (php build.ts, vue-scanner test, iso-map test); typecheck failed only in files other agents are changing (packages/scanner CodeName scope; src/viewers/tui navigation-details, panes/details, panes/view; web/organisms/code-lists; test-bun inspect-details, navigation, tui-source). bun run test: node 16/16 pass; Bun 201 pass, 33 fail, all from the in-progress relationship-text export (actionCaption), inspect-details, and architecture-findings/lint changes. No diagnostic or failure refers to the files changed here.

Cold review (no must-fix findings) applied without behavior change: primarySystem moved to src/viewers/web/selection.ts; the header painter was renamed paintHeaderSummary, narrowed to Pick<ArchitectureGraph, 'elements'> and Pick<ProjectProfile, 'title'>, and documents that the header stays empty only when no Groma package is loaded. render.ts stays at 500 lines.
Isolated verification: detached worktree at HEAD 37a8a7c1 with only this task's diff applied; bun install --frozen-lockfile passed (under 1 s); bun run check passed in 27 s (Biome: 1 warning and 2 infos in untouched files; typecheck clean; node 16 pass, Bun 360 pass, 0 fail). Worktree removed and pruned.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web header now names the project with the title from groma/project.md instead of the first internal system's title. render.ts passes the payload's project profile to paintHeaderSummary, which keeps the internal system, container, and component counts; primarySystem moved to the selection helpers for the initial selection only. The web viewer docs describe the header accordingly.

Verified in Chrome on a git-initialized copy of the four-system large-world fixture: the live header showed the project title and counts with other header controls present; editing the title in project.md updated the header in about 2 s without a reload; a groma export served statically showed the same title and counts. bun run check passed in an isolated worktree with only this task's changes (node 16 pass, Bun 360 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
