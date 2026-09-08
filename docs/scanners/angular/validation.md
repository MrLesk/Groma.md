# Angular scanner validation

## Qualified example

The selected source is the CompanyMergeDialog flow in `callforpapers`.
Validation used a separate copy of the Java acceptance source snapshot
`1cb6783f3379664e3f176e72c5419064ce24dbfd`. The original project and its
Groma state were not changed. After validation, 3,171 source and dependency
configuration files matched the source copy byte for byte.

The application's unchanged frozen pnpm lock installed Angular core 21.2.19
and TypeScript 5.9.3. The scanner used its bundled Angular compiler/compiler-cli
21.2.17 and TypeScript 5.9.3. This verifies the declared Angular 21.2 application
against the pinned scanner pair without upgrading the application.

The concrete binding is:

| Evidence | Source |
| --- | --- |
| Emitting operation | `company-merge-dialog.component.ts`, arrow callback at line 84, UTF-16 offset 3069 |
| Emit call | Same file, `this.merged.emit(mergedCompany)` at line 87, offset 3162 |
| Supplied handler | `company-list.component.html`, `(merged)="onMergeComplete($event)"` at line 8, attribute offset 157 |
| Handler declaration | `company-list.component.ts`, `onMergeComplete` at offset 31830 |

All paths are under
`src/main/webapp/app/callforpaper/companies/`.
The emitter source SHA-256 is
`dbbe3d1af8bda2c06a53cbb5019abe916a2392ac6b67c90cde9780790a6c7577`.

The Angular observation contained 711 source/template files, 121 operations,
121 bound invocations, and 921 explicit unsupported-binding diagnostics.
These counts describe the inspected snapshot, not coverage requirements.
Core wrote the selected output-to-parent relationship using its existing
supplied-callback rule. No injected-service or Java/Angular HTTP relationship
was asserted by this adapter.

## Checks performed

- The built package loaded in compiled Groma alongside Java and embedded
  TypeScript 7.1. The selected emitter file retained one owner with separate
  `angular` and `typescript` Code references.
- In the acceptance copy, existing Groma curation commands combined each
  selected TypeScript file and its HTML template into one responsibility.
  The merge dialog retained its responsibility description. A repeat compiled
  scan left all 1,394 architecture documents unchanged.
- A deliberately malformed template caused the compiled scan to fail.
  All 1,394 previous documents remained byte-identical. The template was then
  restored byte for byte before export.
- The independent fixture tests load a fresh built package per test. They
  verify concrete source offsets including the arrow caller, evidence absent
  from TypeScript alone, explicit unsupported handler expressions, one curated
  owner in either observer order, actual HTML watcher dispatch, and failed-scan
  preservation.

Run the focused checks with:

```sh
bun test --timeout 20000 test-bun/angular-scanner.test.ts
bunx biome lint plugins/scanners/angular/src plugins/scanners/angular/build.ts test-bun/angular-scanner.test.ts
bun run typecheck
```

The coordinator reviewed the exported map in the browser: both selected
TypeScript/HTML pairs have one owner, the responsibility text remains intact,
and the derived interaction shows the supplied merged callback with Angular
provenance. Cold simplicity and full-context reviews passed without required
changes. The shared `bun run check` passed: 382 Bun tests passed, one Java
tooling test was skipped, and lint, type checking, and the Node suite passed.

## Release gates

The executed environment is macOS arm64 with Bun 1.4.1 and compiled Groma.
The package build and local consumer are technically qualified here.
Public package naming, publication, and actual Windows/Linux consumer runs
remain separate release gates.
This record does not claim public availability or cross-platform execution.
