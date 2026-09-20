---
id: TASK-441
title: Keep scanner source groups from inventing architecture boundaries
status: Done
assignee:
  - '@codex'
created_date: '2026-09-19 19:25'
updated_date: '2026-09-20 16:33'
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
  - src-architecture-model
  - scene
  - map
  - organisms-details
  - render
  - camera
  - projection
  - tui-navigation
  - src-authoring
  - instructions
  - program
  - groma-local-scanner-go-groma-local-scanner-go
  - groma-rust-scanner-groma-rust-scanner
  - groma-md
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
  - test/fixtures/scanner-boundaries/groma/index.md
  - test/fixtures/scanner-boundaries/groma/project.md
  - test/fixtures/scanner-boundaries/groma/systems/boundary-lab/system.md
  - test/fixtures/scanner-boundaries/package.json
  - test/fixtures/scanner-boundaries/typescript/render.ts.fixture
  - test/fixtures/scanner-boundaries/typescript/format.ts.fixture
  - test/fixtures/scanner-boundaries/typescript/render.ts.connected
  - test/fixtures/scanner-boundaries/javascript/render.js
  - test/fixtures/scanner-boundaries/javascript/format.js
  - test/fixtures/scanner-boundaries/javascript/render.js.connected
  - test/fixtures/scanner-boundaries/python/pyproject.toml
  - test/fixtures/scanner-boundaries/python/render.py
  - test/fixtures/scanner-boundaries/python/format.py
  - test/fixtures/scanner-boundaries/python/render.py.connected
  - test/fixtures/scanner-boundaries/java/pom.xml
  - test/fixtures/scanner-boundaries/java/src/main/java/Render.java
  - test/fixtures/scanner-boundaries/java/src/main/java/Format.java
  - test/fixtures/scanner-boundaries/java/src/main/java/Render.java.connected
  - test/fixtures/scanner-boundaries/go/go.mod
  - test/fixtures/scanner-boundaries/go/render.go
  - test/fixtures/scanner-boundaries/go/format.go
  - test/fixtures/scanner-boundaries/go/render.go.connected
  - test/fixtures/scanner-boundaries/rust/Cargo.toml
  - test/fixtures/scanner-boundaries/rust/src/lib.rs
  - test/fixtures/scanner-boundaries/rust/src/format.rs
  - test/fixtures/scanner-boundaries/rust/src/lib.rs.connected
  - test/fixtures/scanner-boundaries/csharp/Labels.csproj
  - test/fixtures/scanner-boundaries/csharp/Render.cs
  - test/fixtures/scanner-boundaries/csharp/Format.cs
  - test/fixtures/scanner-boundaries/csharp/Render.cs.connected
  - test/fixtures/scanner-boundaries/php/render.php
  - test/fixtures/scanner-boundaries/php/format.php
  - test/fixtures/scanner-boundaries/php/render.php.connected
  - test/fixtures/scanner-boundaries/swift/Render.swift
  - test/fixtures/scanner-boundaries/swift/Format.swift
  - test/fixtures/scanner-boundaries/swift/Render.swift.connected
  - test/fixtures/scanner-boundaries/angular/package.json
  - test/fixtures/scanner-boundaries/angular/tsconfig.json
  - test/fixtures/scanner-boundaries/angular/label.ts.fixture
  - test/fixtures/scanner-boundaries/angular/format.ts.fixture
  - test/fixtures/scanner-boundaries/angular/label.ts.connected
  - test/fixtures/scanner-boundaries/react/package.json
  - test/fixtures/scanner-boundaries/react/tsconfig.json
  - test/fixtures/scanner-boundaries/react/label.tsx.fixture
  - test/fixtures/scanner-boundaries/react/format.ts.fixture
  - test/fixtures/scanner-boundaries/react/label.tsx.connected
  - test/fixtures/scanner-boundaries/vue/package.json
  - test/fixtures/scanner-boundaries/vue/tsconfig.json
  - test/fixtures/scanner-boundaries/vue/Label.vue
  - test/fixtures/scanner-boundaries/vue/format.ts.fixture
  - test/fixtures/scanner-boundaries/vue/Label.vue.connected
  - scripts/reproduce-scanner-boundaries.ts
  - test/fixtures/scanner-boundaries/react/format.tsx.fixture
  - src/scan-reconciler.ts
  - src/architecture-model.ts
  - src/sheet/types.ts
  - src/sheet/place.ts
  - src/sheet/compose.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/camera.ts
  - test-bun/scanner-roots.test.ts
  - src/viewers/web/iso/style.ts
  - test/fixtures/unidentified-container/groma/index.md
  - test/fixtures/unidentified-container/groma/project.md
  - test/fixtures/unidentified-container/groma/systems/catalog/system.md
  - >-
    test/fixtures/unidentified-container/groma/systems/catalog/containers/browser/container.md
  - >-
    test/fixtures/unidentified-container/groma/systems/catalog/containers/browser/components/view.md
  - >-
    test/fixtures/unidentified-container/groma/systems/catalog/components/reader.md
  - >-
    test/fixtures/unidentified-container/groma/systems/catalog/components/formatter.md
  - test-bun/unidentified-container.test.ts
  - src/curate.ts
  - test/fixtures/curation/groma/systems/shop/system.md
  - test/fixtures/curation/groma/systems/shop/containers/shop-shop/container.md
  - test/fixtures/curation/groma/systems/depot/system.md
  - >-
    test/fixtures/curation/groma/systems/depot/containers/depot-depot/container.md
  - test-bun/rename.test.ts
  - test-bun/source-relationships.test.ts
  - test-bun/scan-source-units.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/system-curation.test.ts
  - test-bun/scan-component-naming.test.ts
  - src/viewers/tui/projection-root.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/projection-container.ts
  - src/viewers/tui/navigation-spatial.ts
  - docs/component-markdown.md
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/viewers/tui/validation.md
  - src/movable.ts
  - src/removable.ts
  - docs/agent-instructions/structure.md
  - src/instructions.ts
  - src/add.ts
  - src/write-commands.ts
  - >-
    groma/systems/groma-md/containers/groma-csharpscanner-groma-csharpscanner/container.md
  - >-
    groma/systems/groma-md/containers/groma-csharpscanner-groma-csharpscanner/components/dotnet-scanner.md
  - >-
    groma/systems/groma-md/containers/groma-csharpscanner-groma-csharpscanner/components/httpevidence.md
  - >-
    groma/systems/groma-md/containers/groma-csharpscanner-groma-csharpscanner/components/program.md
  - >-
    groma/systems/groma-md/containers/groma-csharpscanner-groma-csharpscanner/components/sourceoutline.md
  - >-
    groma/systems/groma-csharpscanner/containers/groma-csharpscanner-groma-csharpscanner/components/program.md
  - >-
    groma/systems/groma-md/containers/groma-local-scanner-go-groma-local-scanner-go/container.md
  - >-
    groma/systems/groma-md/containers/groma-local-scanner-go-groma-local-scanner-go/components/outline.md
  - >-
    groma/systems/groma-md/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-http.md
  - >-
    groma/systems/groma-md/containers/groma-local-scanner-go-groma-local-scanner-go/components/worker-main.md
  - >-
    groma/systems/groma-local-scanner-go/containers/groma-local-scanner-go-groma-local-scanner-go/container.md
  - >-
    groma/systems/groma-md/containers/groma-rust-scanner-groma-rust-scanner/container.md
  - >-
    groma/systems/groma-md/containers/groma-rust-scanner-groma-rust-scanner/components/endpoints.md
  - >-
    groma/systems/groma-md/containers/groma-rust-scanner-groma-rust-scanner/components/native-src-outline.md
  - >-
    groma/systems/groma-md/containers/groma-rust-scanner-groma-rust-scanner/components/src-main.md
  - >-
    groma/systems/groma-rust-scanner/containers/groma-rust-scanner-groma-rust-scanner/container.md
  - groma/systems/groma-csharpscanner/system.md
  - groma/systems/groma-local-scanner-go/system.md
  - groma/systems/groma-rust-scanner/system.md
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
- [x] #1 With all 12 official scanners in one mixed-language project, adding a helper before its use does not leave extra application boundaries or history-dependent component placement after scanning the completed sources.
- [x] #2 Components whose container cannot be established remain visible within their known system in one Unidentified container group; source roots alone do not create C4 application containers.
- [x] #3 Selecting the group explains that Groma.md could not determine its components' container in the local and exported web viewers, without assignment controls, agent prompts, or new container commands.
- [x] #4 Existing curated component ownership, identities, authored meaning, relationships and source links survive scans; the group does not become a stored C4 application boundary.
- [x] #5 Focused checks, the real cross-scanner reproduction, bun run check, a cold simplicity review and a final full-context complexity review pass with evidence recorded.
- [x] #6 The existing C#, Go and Rust worker containers and their components live under the Groma system, preserving component identities, source ownership, authored meaning and links; separate scanner software-system records are removed.
- [x] #7 A scan with source files creates one project-named internal system only when none is declared; source roots never add further systems or override established ownership.
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
1. Use one mixed-language fixture and all 12 official scanners to compare helper-before-use, connected, repeated and fresh completed scans. Source roots remain temporary evidence and cannot create application containers or additional systems.
2. In shared core reconciliation, create one system named from the project profile only when no internal system is declared and source files exist. Preserve existing file owners. Gather placement evidence from all observations before creating components: reuse an agreed container, otherwise use its common system. Refuse a new file whose system cannot be established among several declared systems.
3. Store incomplete container placement as a component parented by its known internal system. In OKF, keep normal component Markdown, identity, meaning and source references. This is Groma profile meaning, not another C4 level. The shared sheet derives one Unidentified container zone per affected system; nothing stores a synthetic container.
4. Reuse the web detail panel for the derived group with the requested explanation and component links, without authoring controls. Reuse TUI component projection on a system surface so unknown components remain inspectable. Keep renderer operations in their existing sheet, map, details and TUI domains.
5. Remove the obsolete scan-findability curation guard. Allow described containers to move without losing their meaning, and permit code-free empty boundaries to be removed while retaining dependency and flow checks. Through the existing CLI, move the current C#/Go/Rust worker containers into groma-md and remove their old system wrappers. Preserve component IDs, ownership, content and all unrelated pending edits.
6. Update the Markdown/scanner/curation contracts and existing CLI guidance. Replace tests that depended on invented containers with explicitly declared fixture boundaries. Reuse current fixtures for conflicting placement and preserved curation.
7. Verify focused behavior, all 12 real scanners, local/static web, prescribed TUI flows, and bun run check. Check the current Groma model against snapshots and reconcile fresh source observations twice in a temporary copy. Run one cold simplicity review, implementer specification/quality reviews, and one final full-context complexity review before task finalization and a scoped commit/push.

Test authority and gaps: the user-approved staged/fresh example requires the same source to avoid history-dependent application boundaries; the real-scanner harness exposes this defect across all languages. Unknown-container projection lacked any fixture, so add one minimal known-system world with a real container beside two unplaced components and observe visibility, selection and TUI navigation. Existing scanner-root coverage chose a container by majority/lexical order, so extend it with one shared source group, overlapping groups and overlapping scanners; the tests must reject false container placement while preserving known owners. The approved first-system default requires the project title and no extra systems; test a fresh project and a new unmatched source root beside two declared systems. The requested worker correction requires moving a described container and explicitly removing its emptied system; extend the existing move test and verify meaning, ownership and repeat-scan stability. These regressions fail before their fixes. No copy, styling or documentation-inventory tests are added.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial audit: HEAD has 5 containers and 87 components; working architecture has 21 containers and 199 components, including 16 untracked containers with no body. Temporary fixture reproduces helper-before-import creation followed by permanent ownership after imports and repeat scans. C4 requires applications or data stores; OKF stores readable knowledge and does not establish runtime boundaries. Source grouping remains scanner evidence. All scanner root kind values currently flow through the same unconditional core container creation. No current active task overlaps planned scanner/core code or architecture curation; TASK-437 owns browser highlights and remains untouched.

Independent curation completed through Groma commands: 21 containers reduced to the five existing runtime containers; 199 components reduced to 104 described responsibilities. Related compiler, HTTP, adapter and browser files were combined, and 14 development/example source paths were excluded and detached. All production source ownership remains present, with no duplicate owners or blank components. Actors, external-system records and all six flows are byte-identical to the pre-change snapshot at /tmp/groma-task-441-before/groma. Authored relationships are unchanged; one derived Vue callback became internal to the combined component and was removed by scanning. Two consecutive groma scan runs created zero records and changed zero architecture files. The existing Vue scanner still fails on test/fixtures/vue-output/logic.ts before configured exclusions are applied; saved Vue evidence is retained, so this does not verify a fresh Vue scan. The overhead browser map and read-only scene inspection put actors at x=4..14.25, internal systems at x=22.75..401, and externals at x=404..446. All 21 sheet scene/composition tests pass. No scanner production code has changed yet: the first-scan policy for uncertain application boundaries is awaiting the user response to the strict-C4 versus provisional-container clarification. C4 defines applications/data stores, while OKF source knowledge and compiler project membership do not prove those boundaries. Audited all official scanner root emitters: TS import roots, framework/package roots, C#/Java project roots, Go module roots, Cargo roots, Python declarations, and JS/PHP/Swift source groups all currently reach the same unconditional boundary creation in scan-reconciler.ts.

Follow-up prompted by the map screenshot: the five-container cleanup is incomplete as a runtime model. Java adapter launches the bundled JVM with -jar worker.jar, and Swift adapter launches a bundled executable, so both have the same confirmed worker boundary as C#/Go/Rust. Their worker source is absent from the saved architecture: Java discovery only selects Maven/Gradle declarations, while Groma builds its Java worker directly with javac; Swift is not enabled in this repository scanner configuration. PHP uses php-parser inside the Groma process and correctly belongs as a component, as do JavaScript/TypeScript/framework analyzers. Python uses embedded Pyodide inside a Node worker thread; its TS host is represented, but its Python analysis modules are absent because the Python scanner is not enabled. Language does not determine C4 kind. Recommend one Groma software system containing its browser, local application and five worker application containers; source observations must not dictate separate software systems merely from package or project boundaries. This corrects the previous incomplete five-container conclusion; scanner/model implementation remains pending the first-scan boundary decision.

2026-09-20: Alex approved proceeding and explicitly requested a reproduced failure across all languages in the same project. Alex then replaced the proposed diagnostics-only treatment: components with unknown runtime placement should remain visible within their system in a special container-looking grouping. The 0.4.0 release is held while this work proceeds. No scanner or architecture-model implementation was changed before this decision; pending documentation edits remain untouched.

Reproduction built and run against all 12 current scanner packages on macOS arm64. One mixed-language fixture declares one system and no runtime containers; all 12 scanners observed their expected final source files and core assigned their evidence to runtime containers. The combined staged scan also invented three additional systems. TypeScript evidence spans five containers after helper-before-use scans versus four in a fresh completed scan; overlapping Angular/React/Vue evidence also has history-dependent placement or identity. Repeating the completed staged scan preserves the wrong result. Full observations, stored models, package versions, and both Git projects are retained at /tmp/groma-task-441-repro.rsFUUd/run-2. The first harness attempt revealed that React reports React components rather than plain TypeScript helpers; the React fixture now uses a real reusable React component, and the strict coverage check passes for all scanners. No production scanner/model behavior has changed yet.

The mixed-language reproduction is complete and its script passes focused Biome lint and TypeScript checking. bun run check passes (617 Bun tests, 36 expected skips, no failures; Node suite also passed). The standalone reproduction intentionally exits 1 on the unfixed behavior: helper-added 4 systems/11 containers/23 components; helper-connected and repeated 4/11/24; fresh completed 4/8/24. The project starts with one authored system and zero declared application/data-store boundaries. Alex clarified that container creation belongs to Groma core. A proposed CLI declaration of current containers is a separate, unconfirmed capability and has not been implemented. Keep the group-panel advice honest about existing operations; unresolved source remains visible until a justified placement is available. Production scanner, model, CLI, and viewer code remain unchanged; only the reproduction script, fixture, and this task record have changed.

Alex narrowed the approved outcome to showing unresolved components in an unidentified container. The previous proposal for copied curation instructions/manual assignment and a current-container declaration command is out of scope. Acceptance criteria now reflect this confirmed slice; the prior live-map cleanup and layout audit remain recorded as earlier work, and pending documentation/live architecture edits must remain untouched.

Implementation findings: the real 12-scanner reproduction now passes with one system, zero fabricated containers, identical staged/fresh placement and stable repeat scans. Existing curation tests assumed scans manufacture their container fixtures; replace that setup with explicit architecture under test/fixtures while keeping their ownership, move, rename and relationship assertions. The old requireScanFindable guard exists only to prevent deleted empty containers being recreated by scans; remove that obsolete guard and its refusal tests now that source roots cannot create containers. Empty source groups must likewise create no architecture. The shared model also exposes a supported-view regression: choosing a system-owned component in the TUI currently produces an empty map. Preserve its existing component inspection flow by displaying the derived group on its system surface; this is visibility, not a new assignment workflow.

Latest scope confirmation: the screenshot's C# analysis tool, Go analysis tool and Rust analysis tool are parts of Groma, not separate software systems. This is an explicit correction to the current stored architecture, in addition to the conservative scanner rule and unidentified group.

Alex clarified that the correction must address the common root cause across projects, not only regroup the saved Groma example. No repository-specific scanner rule or curation-command relaxation has been added. The current draft replaces source-root-to-container creation and uses one project-named initial system. The first-scan default is now an explicit pending design question because a repository is not inherently one C4 software system. Continue independent unidentified-group validation while this is resolved.

The current draft passes bun run check: 16 Node tests; 617 Bun tests, 36 expected skips, 0 failures. Only the two pre-existing complexity warnings remain. The mixed known/unknown-container fixture passes model, shared placement, read-only group details and TUI projection checks. Manual browser verification succeeded for both static export at port 44180 and local web viewer at 44181: group selection opens the explanation and component links, with no Edit control on the derived group. tui-test verified root summary, an ordinary container, unknown component inspection, movement to its sibling and return to the system at 120x36 and 200x60; SVG captures are in /tmp/groma-task-441-repro.rsFUUd/. Required architecture reviews and finalization remain pending the system-inference design decision.

The repeated real-scanner run after the empty-root cleanup passes for all 12 scanners: no invented systems or containers, no changed owners between staged and fresh completed sources, and a stable repeat scan. Evidence: /tmp/groma-task-441-repro.rsFUUd/run-4.

Additional root-cause reproduction: three focused scanner-roots cases now fail on the current draft. One source group spanning two authored containers, overlapping source groups, and overlapping scanners each place a new shared file under api instead of the common system. The wrong parent is selected by majority/lexical rules in shared reconciliation. These failing tests intentionally record the remaining defect; the task is not ready to finalize or release. Resolving source-to-system placement must not introduce another silent assumption. The pending user decision is whether a project with no authored system starts with one project-named system or requires a declared system. Existing pending documentation and live architecture files remain untouched.

The pending initial-system decision is resolved: yes, create one project-named system only when none is declared. Proceeding with the shared rule across all scanners.

Shared placement validation: all 12 scanners pass run-5; bun run check passes 16 Node and 621 Bun tests (36 expected skips). One new complexity warning in observationPlacements is being simplified before review; the other two warnings were already present.

The three worker containers were moved under groma-md through groma edit --parent, then their empty old systems were removed through groma remove. Audit confirms all component IDs/source owners and worker bodies preserved; every other architecture record and the pre-existing pending documentation hashes are unchanged. Fresh observations collected from the current source (C#, Go, Rust, TypeScript; other configured scanners had no applicable included source) had no scanner failures. Reconciling the corrected model in a temporary copy twice created 0/0 records, retained one groma-md system and all worker placements, and produced identical models. Evidence: /tmp/groma-task-441-repro.rsFUUd/live-rescan/report.json. Full repository check after curation-command fixes passes: 16 Node, 621 Bun tests, 36 expected skips, no new complexity warnings.

Cold simplicity review passed with no blocker, unnecessary layer, or material deletion. Accepted its one clarity suggestion: rename TUI layout operations around surface now that they can display a system's unidentified components as well as a container. Focused projection/navigation tests pass after the naming-only change. The corrected Groma static export was opened in the browser: Groma lists all three worker containers as children, and the C# worker retains its description, four components and incoming application relationship. No changes were made to the public deployed site.

Implementer specification review: AC1/2/4/7 are supported by the all-12-scanner run-5 report, scanner-root/source-unit/curation tests, and the initial-system title assertion. AC3 is supported by the fixture detail/selection tests plus manual local and static web selection with no Edit control. TUI visibility/navigation was verified through tui-test at two sizes. AC6 is supported by the moved worker records, preserved-content/ownership audit, exported UI and the two zero-creation reconciliations of current source evidence in a temporary model. The final full-context review is the remaining AC5 gate.

Implementer quality review: traced scanner entry → complete observations → initial-system/placement reconciliation → readable component Markdown → shared sheet zone → existing web details/TUI surface. Curated ownership wins before a new parent is required, and candidate guesses do not become evidence for later scanners. Source units retain established owners; no source-root kind creates C4 boundaries. Group writes are withheld. Curation preserves descriptions/children and retains concept-link/flow/dependency checks. Every new test catches a named wrong result; removed tests asserted the obsolete invented-container policy. The cold-review naming cleanup passed 24 focused tests. Final bun run check passes 16 Node and 621 Bun tests, 36 expected skips; no new complexity warning or changed source/test file over 500 lines. No blocking finding remains.

Final full-context complexity review passed with no blocking findings or material architecture change recommended. The reviewer traced the final flow, confirmed responsibilities stay grouped by domain, compared the thirteen moved worker records with HEAD, and verified the real all-scanner/live-rescan evidence. No follow-up implementation is required for this task. The supported evidence covers the twelve current scanners; no claim is made that every possible language/project has been tested.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed shared scanner reconciliation so source groups cannot invent application containers or extra systems. A first source scan starts with one project-named system only when none is declared. Existing ownership wins; conflicting containers within one system leave components visible in a derived Unidentified container group with read-only details. Local/exported web and TUI inspection use the existing domains. Removed obsolete curation restrictions needed to move the three Groma worker containers into groma-md without losing their descriptions, component identities, ownership or relationships.

Verified all 12 real scanners in one staged/fresh/repeated project; added regressions fail before the fix and pass afterward. Final bun run check: 16 Node and 621 Bun tests pass, 36 expected skips, no new complexity warnings. Manual local/static web and prescribed TUI checks pass. Current-source observations reconciled twice against the corrected model create 0/0 records and preserve one system. Cold simplicity review and final full-context complexity review pass; the optional TUI naming cleanup was applied. Pending user/other-agent documentation and architecture edits remain untouched.
<!-- SECTION:FINAL_SUMMARY:END -->
