---
id: GROM-62
title: Serve the embedded web blueprint from the compiled binary
status: Done
assignee:
  - '@claude'
created_date: '2026-07-19 22:27'
updated_date: '2026-07-19 22:47'
labels:
  - web
  - first-run
milestone: m-4
dependencies: []
references:
  - MANIFESTO.md
  - DEVELOPMENT.md
  - src/host/contracts.ts
  - src/application/contracts.ts
priority: high
type: feature
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The manifesto names the web interface as the primary human experience, and DEVELOPMENT.md already approves Bun's embedded HTTP server and React as the web stack while deferring it. Alex has decided to un-defer the first slice: a groma web command that starts a loopback-only embedded HTTP server from the single compiled binary and serves an interactive React and Tailwind application shell whose assets are fully embedded at build time. The server exposes only bounded read endpoints that go through the same shared application operations as the CLI (roots, children, exact component, search), keeping one semantic path and no second mutation surface. The Web Viewer and Editor component (ent_ad1dd07bc1ef8d50b7a774bc9da3d9d1) records this direction: it uses the application service only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma web starts an HTTP server bound to 127.0.0.1 only, prints the URL, opens the browser only in an interactive terminal, runs until SIGINT or SIGTERM, and then exits cleanly with a bounded result; --port selects the port and 0 requests an ephemeral one
- [x] #2 The served application shell, its React runtime, and its Tailwind-built stylesheet are embedded in the compiled binary; serving makes no filesystem read of source assets and no network request beyond the loopback listener
- [x] #3 GET endpoints for roots, children, exact component, and search call the shared application operations with the same bounded limits as the CLI, return deterministic JSON, and reject invalid limits, unknown routes, and non-GET methods with structured errors
- [x] #4 When the workspace is missing or unrecovered the API answers with a structured diagnostic instead of crashing, matching CLI semantics
- [x] #5 Responses carry restrictive headers: a Content-Security-Policy that only allows same-origin content and no-store caching
- [x] #6 A new web source boundary is enforced by check:boundaries: web may depend only on application contracts, host surface contracts, and itself; cli may depend on web; no other layer may import web
- [x] #7 Tailwind CSS is generated at build time by the pinned toolchain into a gitignored artifact; bun ci plus bun run check passes from a clean checkout, and the compiled binary black-box verification covers groma web serving the shell and one bounded read
- [x] #8 DEVELOPMENT.md documents the web boundary, the build step, and moves the embedded web surface out of Deliberately Deferred; README mentions groma web under what works today
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add react and react-dom as bundled dependencies and @types/react, @types/react-dom, tailwindcss, and @tailwindcss/cli as pinned dev tooling; generate src/web/client/styles.generated.css (gitignored, prettier-ignored) from the Tailwind source via a scripts/build-web-css.ts step wired into the build script and check chain.
2. Create the src/web boundary: assets.ts holds the static HTML-bundle import; server.ts exposes serveWebBlueprint({cancellation, frontend, onReady, operations, port}) that binds Bun.serve to 127.0.0.1 with routes for the embedded frontend plus GET /api/roots, /api/children, /api/component, and /api/search backed by the injected shared ApplicationOperations, CLI-equivalent bounds (limit 1-100, search text 1-256), no-store and CSP headers on API responses, a CSP meta tag on the document, structured 404/405/400 errors, and clean shutdown on abort.
3. Extend the boundary checker: new web layer may depend on application, host, and web; cli gains web; host keeps its explicit previous set; verified by check:boundaries.
4. Extend the CLI: parser and contracts accept web [--port <0-65535>] (default 4766), help documents it, surface.ts dispatches it as a long-running command like scan (result survives stop), the frontend loads via a literal dynamic import so ordinary CLI runs never touch the bundle, and program.ts emits the ready line in plain format, opens the browser only on an interactive terminal, and emits the bounded served result after shutdown; workspace-missing answers with a run-groma-init diagnostic.
5. Tests: web server tests with stub operations and stub frontend cover route wiring, bounds rejection, unknown routes, method rejection, headers, workspace-unavailable diagnostics, and abort shutdown; CLI tests cover parsing, workspace-missing, and a full serve-stop cycle through an injected signal source; the compiled smoke gains a groma web black-box check serving the shell and one bounded read.
6. Update DEVELOPMENT.md (boundary table, web css build step, un-defer the embedded web surface) and README (groma web under what works today); typecheck gains tsconfig.web.json for the DOM client.
Supported boundary: loopback-only read surface; mutations, editing, live update push, and replacing bare groma remain out of scope; Bun fullstack compile of the HTML import was probe-verified on this host including behind a dynamic import.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented src/web (new enforced boundary: web depends on application and host contracts; cli gained web): server.ts serves the loopback-only Bun server with bounded GET routes through injected shared ApplicationOperations, reusePort disabled so a second instance fails loudly, structured 400/404/405/500 diagnostics, no-store/CSP/nosniff headers on API responses and a same-origin CSP meta tag on the document (Bun HTML-bundle routes cannot carry custom headers). assets.ts holds the HTML-bundle import loaded via literal dynamic import only when the web command runs. Client shell is React 19 with a Tailwind 4 theme of the brand tokens; the stylesheet is generated by the pinned toolchain into a gitignored artifact by scripts/web-stylesheet.ts, wired into build-web-css, every compileStandalone call, and the check chain. CLI: web [--port] parsed with 0-65535 validation (default 4766, the groma keypad digits), long-running like scan, ready line in plain format, browser open only on an interactive terminal, bounded served result after SIGINT.
Validation: bun run check green (423 tests) including the extended compiled smoke that black-box-verifies groma web serving the embedded shell and a bounded read; web server tests cover routing, bounds, headers, method and route rejection, read-failure diagnostics, and port-conflict diagnostics; CLI tests cover parsing, workspace-missing, and a full serve-fetch-SIGINT cycle. Browser verification of the compiled binary on the self-blueprint workspace showed the embedded shell reading generation 141 with 17 roots. Notable debugging: the host validates signal-source shape exactly (extra test hook property produced invalid-host-signal-source), and same-process double Bun.serve does not conflict unless reusePort is false.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web now serves an interactive web surface embedded entirely in the compiled single binary: a loopback-only Bun HTTP server exposing the React and Tailwind application shell plus bounded read-only JSON endpoints (roots, children, component, search) through the same shared application operations as the CLI. Verified with 423 passing tests, a new compiled black-box smoke that serves the shell and a bounded read from the binary, and browser verification against Groma's own blueprint at generation 141.
<!-- SECTION:FINAL_SUMMARY:END -->
