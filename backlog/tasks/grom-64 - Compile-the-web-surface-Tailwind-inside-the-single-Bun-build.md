---
id: GROM-64
title: Compile the web surface Tailwind inside the single Bun build
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 04:28'
updated_date: '2026-07-20 04:32'
labels:
  - web
  - build
milestone: m-4
dependencies:
  - GROM-62
references:
  - ../backlog.md/scripts/build.ts
  - scripts/standalone-compiler.ts
priority: high
type: chore
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GROM-62 generated the web stylesheet with the separate pinned Tailwind CLI into a gitignored artifact that every compile step regenerates and index.html links. Backlog.md (the sibling project) proves the simpler shape on the same Bun version: bun-plugin-tailwind processes the Tailwind source directly inside one Bun.build JS-API call that also performs the standalone compile, and bunfig [serve.static] registers the same plugin for uncompiled dev serving. Adopt that shape so the Tailwind source is linked directly, the generated artifact and the extra pipeline step disappear, and the compiler keeps exact parity with the audited CLI flags (opaque plugin import stays unresolved, compiled binary autoloads no .env, bunfig, tsconfig, or package.json).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/standalone-compiler.ts uses the Bun.build JS API with bun-plugin-tailwind, minify, allowUnresolved restricted to the fully opaque specifier, and compile options that disable dotenv, bunfig, tsconfig, and package.json autoloading, for the native and every cross-compile target
- [x] #2 src/web/client/index.html links styles.css directly; the generated stylesheet file, scripts/web-stylesheet.ts, scripts/build-web-css.ts, the web:css script, and the gitignore and prettierignore entries are removed
- [x] #3 bunfig.toml registers bun-plugin-tailwind under [serve.static] so bun run dev web serves the styled client without a pre-step; @tailwindcss/cli is removed and bun-plugin-tailwind is pinned exactly
- [x] #4 bun run check passes from a clean checkout; the compiled binary serves the fully styled interactive blueprint (verified in a browser) and a cross-compile target still builds
- [x] #5 DEVELOPMENT.md describes the single-step Tailwind compile and no longer documents the generated artifact
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Swap dev tooling: remove @tailwindcss/cli, pin bun-plugin-tailwind exactly (0.1.2, the version Backlog.md ships).
2. Rewrite compileStandalone around the Bun.build JS API: entrypoint, minify, plugins [tailwind], allowUnresolved [''] (only the audited fully opaque plugin specifier may stay unresolved, matching the previous --allow-unresolved '' flag), compile {outfile, optional target, autoloadDotenv/Bunfig/Tsconfig/PackageJson all false}, throw false with logged diagnostics; drop the web-stylesheet pre-step from the compiler.
3. Delete scripts/web-stylesheet.ts and scripts/build-web-css.ts, the web:css package script and its check-chain step, the generated css file and both ignore entries; index.html links styles.css directly.
4. Add bunfig.toml with [serve.static] plugins = ['bun-plugin-tailwind'] for uncompiled dev serving; confirm the compiled binary still refuses bunfig autoloading.
5. Update DEVELOPMENT.md (commands list and web build paragraph).
6. Verify: bun run check from the current tree, browser verification that the compiled binary serves the styled interactive blueprint, bun run dev web serves styled without any pre-step, and one cross-compile target (bun-linux-x64-baseline) builds.
Supported boundary: build tooling only; no renderer, server, or client behavior change intended.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adopted the Backlog.md build shape: compileStandalone now makes one Bun.build JS-API call with bun-plugin-tailwind, minify, allowUnresolved [''] (exact parity with the previous --allow-unresolved '' flag: only fully opaque dynamic specifiers pass through; the successful build proves the audited plugin import still passes), and compile options disabling dotenv, bunfig, tsconfig, and package.json autoloading. Deleted the two-step pipeline (web-stylesheet.ts, build-web-css.ts, web:css script, gitignored artifact, ignore entries); index.html links the Tailwind source directly; bunfig.toml registers the plugin under [serve.static] for uncompiled dev serving only.
Validation: bun run check green (427 tests incl. the compiled groma web black-box smoke), bun-linux-x64-baseline cross-compile builds, browser verification of the compiled binary showing the fully styled interactive blueprint at generation 142 (now drawing the observed web boundary plate), dev-mode curl showing plugin-processed CSS with the brand token, and a runtime probe: the compiled binary runs correctly in a directory containing a deliberately malformed bunfig.toml, proving autoload stays disabled. Nuance recorded: bun-plugin-tailwind 0.1.2 bundles its own tailwindcss (4.1.14 banner) rather than the workspace pin; both are locked in bun.lock so output stays deterministic, and the tailwindcss devDependency is kept for the token source of truth, mirroring Backlog.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web surface Tailwind now compiles inside the same single Bun.build call that produces the standalone executable, using bun-plugin-tailwind exactly as Backlog.md does: the generated-stylesheet artifact, its scripts, and the extra pipeline step are gone, dev serving styles through bunfig [serve.static], and the compiler keeps byte-level flag parity (opaque plugin import allowed, all runtime autoloading disabled, verified by a malformed-bunfig probe). Verified with the full check gate, a Linux cross-compile, and browser verification of the styled compiled binary.
<!-- SECTION:FINAL_SUMMARY:END -->
