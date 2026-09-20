---
id: TASK-441
title: Keep scanner source groups from inventing architecture boundaries
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-19 19:25'
updated_date: '2026-09-19 20:47'
labels: []
dependencies: []
references:
  - src-scanner
  - typescript-src-index
  - cli
  - export
  - github
  - src-list-window
  - swift-src-index
  - javascript-src-index
  - scanners-http-routes
  - scanners-typescript-operations
  - scanners-typescript-outline
  - src-http-endpoints
  - curate
  - src-cli
  - src-core
  - scanner-src-index
  - scan-evidence
  - java-src-index
  - angular-src-index
  - react-src-index
  - vue-src-index
  - php-src-index
  - scanners-projects
  - runtime
  - control
  - scanners-settings
  - web-server
  - task-diff-control
  - dotnet-scanner
  - httpevidence
  - worker-main
  - worker-http
  - src-main
  - endpoints
  - package
  - repository-listing
  - map-highlights
  - c4-filter
  - sourceoutline
  - outline
  - native-src-outline
  - groma-csharpscanner-groma-csharpscanner
  - csharp-src-index
  - go-src-index
  - rust-src-index
  - src-index
documentation:
  - docs/component-markdown.md
  - docs/scanners/creating-a-plugin.md
modified_files:
  - groma/systems/groma-md/containers/cli/components/github.md
  - groma/systems/groma-md/containers/cli/components/pull-requests-model.md
  - groma/systems/groma-md/containers/cli/components/src-gradle.md
  - groma/systems/groma-md/containers/cli/components/src-http.md
  - groma/systems/groma-md/containers/cli/components/src-http-relationships.md
  - groma/systems/groma-md/containers/cli/components/src-list-window.md
  - groma/systems/groma-md/containers/cli/components/src-values.md
  - groma/systems/groma-md/containers/cli/components/swift-build.md
  - groma/systems/groma-md/containers/cli/components/swift-src-index.md
  - groma/systems/groma-md/containers/cli/container.md
  - groma/systems/groma-md/containers/groma-md-model/components/github.md
  - >-
    groma/systems/groma-md/containers/groma-md-model/components/pull-requests-model.md
  - groma/systems/groma-md/containers/gradle/components/src-gradle.md
  - groma/systems/groma-md/containers/http/components/src-http.md
  - >-
    groma/systems/groma-md/containers/http-relationships/components/src-http-relationships.md
  - groma/systems/groma-md/containers/list-window/components/src-list-window.md
  - groma/systems/groma-md/containers/values/components/src-values.md
  - groma/systems/groma-md/containers/groma-md-build/components/swift-build.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-swift-src-index-ts/components/swift-src-index.md
  - groma/systems/groma-md/containers/gradle/container.md
  - groma/systems/groma-md/containers/http/container.md
  - groma/systems/groma-md/containers/http-relationships/container.md
  - groma/systems/groma-md/containers/list-window/container.md
  - groma/systems/groma-md/containers/values/container.md
  - groma/systems/groma-md/containers/groma-md-model/container.md
  - groma/systems/groma-md/containers/groma-md-build/container.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-swift-src-index-ts/container.md
  - groma/systems/groma-md/containers/cli/components/declarations.md
  - groma/systems/groma-md/containers/cli/components/http-bindings.md
  - groma/systems/groma-md/containers/cli/components/http-clients.md
  - groma/systems/groma-md/containers/cli/components/http-curl.md
  - groma/systems/groma-md/containers/cli/components/http-endpoints.md
  - groma/systems/groma-md/containers/cli/components/http-laravel.md
  - groma/systems/groma-md/containers/cli/components/http-order.md
  - groma/systems/groma-md/containers/cli/components/http-requests.md
  - groma/systems/groma-md/containers/cli/components/http-routers.md
  - groma/systems/groma-md/containers/cli/components/http-syntax.md
  - groma/systems/groma-md/containers/cli/components/http-url.md
  - groma/systems/groma-md/containers/cli/components/http-uses.md
  - groma/systems/groma-md/containers/cli/components/http-values.md
  - groma/systems/groma-md/containers/cli/components/javascript-src-http.md
  - groma/systems/groma-md/containers/cli/components/javascript-src-index.md
  - groma/systems/groma-md/containers/cli/components/javascript-src-outline.md
  - groma/systems/groma-md/containers/cli/components/javascript-src-tokens.md
  - groma/systems/groma-md/containers/cli/components/operations.md
  - groma/systems/groma-md/containers/cli/components/php-src-http.md
  - groma/systems/groma-md/containers/cli/components/receivers.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-checker.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-paths.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-routes.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-values.md
  - >-
    groma/systems/groma-md/containers/cli/components/scanners-typescript-operations.md
  - >-
    groma/systems/groma-md/containers/cli/components/scanners-typescript-outline.md
  - groma/systems/groma-md/containers/cli/components/sources.md
  - groma/systems/groma-md/containers/cli/components/src-evidence.md
  - groma/systems/groma-md/containers/cli/components/src-http-endpoints.md
  - groma/systems/groma-md/containers/cli/components/src-http-paths.md
  - groma/systems/groma-md/containers/cli/components/src-http-requests.md
  - groma/systems/groma-md/containers/cli/components/src-http-routes.md
  - groma/systems/groma-md/containers/cli/components/src-outline.md
  - groma/systems/groma-md/containers/cli/components/src-sfc.md
  - groma/systems/groma-md/containers/cli/components/src-syntax.md
  - groma/systems/groma-md/containers/cli/components/src-tokens.md
  - groma/systems/groma-md/containers/cli/components/vue-src-outline.md
  - groma/systems/groma-md/containers/cli/components/vue-src-tokens.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/declarations.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/http-bindings.md
  - groma/systems/groma-md/containers/syntax/components/http-clients.md
  - groma/systems/groma-md/containers/syntax/components/http-curl.md
  - groma/systems/groma-md/containers/syntax/components/http-endpoints.md
  - groma/systems/groma-md/containers/syntax/components/http-laravel.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/http-order.md
  - groma/systems/groma-md/containers/http-paths/components/http-requests.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/http-routers.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/http-syntax.md
  - groma/systems/groma-md/containers/syntax/components/http-url.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/http-uses.md
  - groma/systems/groma-md/containers/http-paths/components/http-values.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/javascript-src-http.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/javascript-src-index.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/javascript-src-outline.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/javascript-src-tokens.md
  - groma/systems/groma-md/containers/groma-md-tokens/components/operations.md
  - groma/systems/groma-md/containers/syntax/components/php-src-http.md
  - groma/systems/groma-md/containers/syntax/components/receivers.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/scanners-http-checker.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/scanners-http-paths.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/scanners-http-routes.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/scanners-http-values.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/scanners-typescript-operations.md
  - >-
    groma/systems/groma-md/containers/typescript-outline/components/scanners-typescript-outline.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/sources.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/src-evidence.md
  - >-
    groma/systems/groma-md/containers/http-paths/components/src-http-endpoints.md
  - groma/systems/groma-md/containers/http-paths/components/src-http-paths.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/components/src-http-requests.md
  - groma/systems/groma-md/containers/syntax/components/src-http-routes.md
  - groma/systems/groma-md/containers/syntax/components/src-outline.md
  - groma/systems/groma-md/containers/sfc/components/src-sfc.md
  - groma/systems/groma-md/containers/syntax/components/src-syntax.md
  - groma/systems/groma-md/containers/syntax/components/src-tokens.md
  - >-
    groma/systems/groma-md/containers/groma-md-outline/components/vue-src-outline.md
  - >-
    groma/systems/groma-md/containers/groma-md-tokens/components/vue-src-tokens.md
  - groma/systems/groma-md/containers/groma-md-outline/container.md
  - groma/systems/groma-md/containers/groma-md-tokens/container.md
  - groma/systems/groma-md/containers/http-paths/container.md
  - groma/systems/groma-md/containers/sfc/container.md
  - >-
    groma/systems/groma-md/containers/src-index-plugins-scanners-javascript-src-index-ts/container.md
  - groma/systems/groma-md/containers/syntax/container.md
  - groma/systems/groma-md/containers/typescript-outline/container.md
  - groma/systems/groma-md/containers/export/components/task-diff-updates.md
  - groma/systems/groma-md/containers/export/container.md
  - groma/systems/groma-md/containers/updates/components/task-diff-updates.md
  - groma/systems/groma-md/containers/updates/container.md
  - groma/systems/groma-md/containers/cli/components/curate.md
  - groma/systems/groma-md/containers/cli/components/curate-rename.md
  - groma/systems/groma-md/containers/cli/components/curate-rewrites.md
  - groma/systems/groma-md/containers/cli/components/movable.md
  - groma/systems/groma-md/containers/cli/components/src-cli.md
  - groma/systems/groma-md/containers/cli/components/write-commands.md
  - groma/systems/groma-md/containers/cli/components/src-core.md
  - groma/systems/groma-md/containers/cli/components/source-coverage.md
  - groma/systems/groma-md/containers/cli/components/scanner-src-index.md
  - groma/systems/groma-md/containers/cli/components/src-scanner.md
  - groma/systems/groma-md/containers/cli/components/scan-source-units.md
  - groma/systems/groma-md/containers/cli/components/scan-evidence.md
  - groma/systems/groma-md/containers/cli/components/java-src-index.md
  - groma/systems/groma-md/containers/cli/components/java-input.md
  - groma/systems/groma-md/containers/cli/components/maven.md
  - groma/systems/groma-md/containers/cli/components/missing-types.md
  - groma/systems/groma-md/containers/cli/components/angular-src-index.md
  - groma/systems/groma-md/containers/cli/components/angular-src-http.md
  - groma/systems/groma-md/containers/cli/components/components.md
  - groma/systems/groma-md/containers/cli/components/react-src-index.md
  - groma/systems/groma-md/containers/cli/components/functions.md
  - groma/systems/groma-md/containers/cli/components/react-src-http.md
  - groma/systems/groma-md/containers/cli/components/src-routes.md
  - groma/systems/groma-md/containers/cli/components/vue-src-index.md
  - groma/systems/groma-md/containers/cli/components/vue-src-http.md
  - groma/systems/groma-md/containers/cli/components/server-routes.md
  - groma/systems/groma-md/containers/cli/components/php-src-index.md
  - groma/systems/groma-md/containers/cli/components/evidence.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-clients.md
  - groma/systems/groma-md/containers/cli/components/scanners-http-url.md
  - groma/systems/groma-md/containers/cli/components/scanners-projects.md
  - groma/systems/groma-md/containers/cli/components/typescript-project.md
  - groma/systems/groma-md/containers/cli/components/http-controllers.md
  - groma/systems/groma-md/containers/cli/components/src-http-checker.md
  - groma/systems/groma-md/containers/cli/components/runtime.md
  - groma/systems/groma-md/containers/cli/components/modules.md
  - groma/systems/groma-md/containers/cli/components/session.md
  - groma/systems/groma-md/containers/export/components/control.md
  - groma/systems/groma-md/containers/cli/components/control.md
  - groma/systems/groma-md/containers/export/components/name.md
  - groma/systems/groma-md/containers/cli/components/name.md
  - groma/systems/groma-md/containers/export/components/scanners-settings.md
  - groma/systems/groma-md/containers/cli/components/web-server.md
  - groma/systems/groma-md/containers/cli/components/scanners.md
  - groma/systems/groma-md/containers/export/components/task-diff-control.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/dotnet-scanner.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/operationid.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/operationtokens.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/partialsourceunits.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/sourceproject.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/httpevidence.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/httpendpoints.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/httprequests.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/httproutes.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/httpsyntax.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-main.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-project.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/tokens.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-http.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/mounts.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/requests.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/routes.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-values.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/src-main.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/native-src-tokens.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/text.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/endpoints.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/client.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/handlers.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/patterns.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/placement.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/src-requests.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/url.md
  - groma/systems/groma-md/containers/cli/components/model.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/bodies.md
  - groma/scanners.json
  - groma/systems/groma-md/containers/cli/components/build.md
  - groma/systems/groma-md/containers/cli/components/framework-package.md
  - groma/systems/groma-md/containers/cli/components/scanner-index.md
  - groma/systems/groma-md/containers/cli/components/javascript-build.md
  - groma/systems/groma-md/containers/cli/components/php-build.md
  - groma/systems/groma-md/containers/cli/components/repository-listing.md
  - groma/systems/groma-md/containers/export/components/map-highlights.md
  - groma/systems/groma-md/containers/export/components/c4-filter.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/sourceoutline.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/components/outline.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/components/native-src-outline.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/container.md
  - groma/systems/groma-md/containers/cli/components/csharp-src-index.md
  - groma/systems/groma-md/containers/cli/components/go-src-index.md
  - groma/systems/groma-md/containers/cli/components/rust-src-index.md
  - groma/systems/groma-md/containers/cli/components/src-index.md
  - groma/relationships.md
  - README.md
priority: high
type: bug
ordinal: 514000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer saving a helper before adding its import can cause a live scan to create a permanent C4 container. Existing ownership then preserves that guess after the import appears. The current Groma map has accumulated sixteen empty container descriptions and many file-shaped components. Alex requests conservative architecture creation across all official scanners and a curated map whose actors enter from the west and external systems remain to the east.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding a helper before its import cannot leave an extra container after scanning the completed source; explicit curated ownership survives.
- [ ] #2 All official scanners and the shared reconciliation path distinguish source organization from supported application boundaries, with documented limits and focused cross-scanner evidence.
- [ ] #3 The live Groma architecture contains only justified runtime containers and coherent components, preserving existing authored meaning, flows and source links through Groma commands.
- [ ] #4 The rendered map keeps actors west of internal systems and external systems east, and its main responsibilities are readable.
- [ ] #5 Focused checks, the repository check, a cold simplicity review and a final full-context complexity review pass with evidence recorded.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit source-root production in every official scanner and the shared core boundary rules; settle treatment of source with no proven application boundary before changing that behavior. 2. Reproduce staged helper creation and preserve deliberate ownership in independent fixtures; apply the shared conservative rule across scanner outputs. 3. Repair the existing Groma map through structural commands, combining empty accidental containers into the established application and browser, then grouping new files by responsibility and describing the result. 4. Verify actors west and external systems east in the composed and rendered map, preserve flows and existing authored records, and check repeat-scan stability. 5. Run focused checks, cold simplicity review, implementer specification and quality reviews, bun run check, and the final full-context complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial audit: HEAD has 5 containers and 87 components; working architecture has 21 containers and 199 components, including 16 untracked containers with no body. Temporary fixture reproduces helper-before-import creation followed by permanent ownership after imports and repeat scans. C4 requires applications or data stores; OKF stores readable knowledge and does not establish runtime boundaries. Source grouping remains scanner evidence. All scanner root kind values currently flow through the same unconditional core container creation. No current active task overlaps planned scanner/core code or architecture curation; TASK-437 owns browser highlights and remains untouched.

Independent curation completed through Groma commands: 21 containers reduced to the five existing runtime containers; 199 components reduced to 104 described responsibilities. Related compiler, HTTP, adapter and browser files were combined, and 14 development/example source paths were excluded and detached. All production source ownership remains present, with no duplicate owners or blank components. Actors, external-system records and all six flows are byte-identical to the pre-change snapshot at /tmp/groma-task-441-before/groma. Authored relationships are unchanged; one derived Vue callback became internal to the combined component and was removed by scanning. Two consecutive groma scan runs created zero records and changed zero architecture files. The existing Vue scanner still fails on test/fixtures/vue-output/logic.ts before configured exclusions are applied; saved Vue evidence is retained, so this does not verify a fresh Vue scan. The overhead browser map and read-only scene inspection put actors at x=4..14.25, internal systems at x=22.75..401, and externals at x=404..446. All 21 sheet scene/composition tests pass. No scanner production code has changed yet: the first-scan policy for uncertain application boundaries is awaiting the user response to the strict-C4 versus provisional-container clarification. C4 defines applications/data stores, while OKF source knowledge and compiler project membership do not prove those boundaries. Audited all official scanner root emitters: TS import roots, framework/package roots, C#/Java project roots, Go module roots, Cargo roots, Python declarations, and JS/PHP/Swift source groups all currently reach the same unconditional boundary creation in scan-reconciler.ts.

Follow-up prompted by the map screenshot: the five-container cleanup is incomplete as a runtime model. Java adapter launches the bundled JVM with -jar worker.jar, and Swift adapter launches a bundled executable, so both have the same confirmed worker boundary as C#/Go/Rust. Their worker source is absent from the saved architecture: Java discovery only selects Maven/Gradle declarations, while Groma builds its Java worker directly with javac; Swift is not enabled in this repository scanner configuration. PHP uses php-parser inside the Groma process and correctly belongs as a component, as do JavaScript/TypeScript/framework analyzers. Python uses embedded Pyodide inside a Node worker thread; its TS host is represented, but its Python analysis modules are absent because the Python scanner is not enabled. Language does not determine C4 kind. Recommend one Groma software system containing its browser, local application and five worker application containers; source observations must not dictate separate software systems merely from package or project boundaries. This corrects the previous incomplete five-container conclusion; scanner/model implementation remains pending the first-scan boundary decision.
<!-- SECTION:NOTES:END -->
