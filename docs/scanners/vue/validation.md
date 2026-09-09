# Vue scanner validation

## Qualified example

The approved witness is [vuejs/repl](https://github.com/vuejs/repl/tree/9b5bc873415bbc6fcba6080b9402d140175d5b03)
commit `9b5bc873415bbc6fcba6080b9402d140175d5b03`, package version 4.7.2.
Its unchanged pnpm lock installs Vue 3.5.18 and TypeScript 5.9.2. Scanner
analysis uses private TypeScript 5.9.3, Vue language-core 3.3.11, Volar
TypeScript 2.4.28 and compiler-dom 3.5.42. Compiler-sfc 3.5.42 is a
build-time declaration dependency.

| Evidence | Original source | UTF-16 offset |
| --- | --- | --- |
| Emitting function | `src/codemirror/CodeMirror.vue`, `emitChangeEvent`, line 42 | 918 |
| Emit call | Same file, `emit('change', editor.getValue())`, line 43 | 928 |
| Binding | `src/editor/CodeMirrorEditor.vue`, `@change="onChange"`, line 54 | 1178 |
| Handler function | Same parent file, `onChange`, line 15 | 414 |

The source observation contains 37 files and two concrete event bindings.
The qualified interaction runs from the CodeMirror source to its parent editor
adapter. These counts describe this snapshot, not coverage requirements.

## Executed checks

Both the independent fixture and the real project completed the normal
compiled-Groma discovery, init, exact-package install, readiness, scan and
export journey. The local registry served an actual `npm pack` artifact;
its download was observed. The package ran alongside embedded TypeScript 7.1.
The real project was an isolated clone; the modified source and template were
restored byte for byte after validation.

The real project's 43 architecture documents and the fixture's eight documents
remained byte-identical across repeated scans after curation. Source emission
removal and template binding removal independently removed the selected
callback while preserving ownership. A malformed SFC failed the enabled scan
and left every previous architecture document unchanged. Restoring the original
files restored the derived callback.

The real project's `src/utils.ts` and the fixture's `receiver.ts` each retained
one physical owner with both `typescript` and `vue` Code provenance. The four
concurrent fixture tests passed with 27 assertions. They cover original UTF-16
positions, imported handler identity shared with TypeScript, explicit unsupported
handler expressions, authored relationship preservation, observer-order
independence, actual SFC watch dispatch, source edits and failed-scan preservation.
Scanner source/build/smoke lint and repository type checking passed.

## Reproduce

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/vue/build.ts
bun test --timeout 20000 test-bun/vue-scanner.test.ts
bunx biome lint plugins/scanners/vue/src plugins/scanners/vue/build.ts plugins/scanners/vue/smoke-compiled.ts test-bun/vue-scanner.test.ts
bun run typecheck
bun plugins/scanners/vue/smoke-compiled.ts /path/to/compiled-groma /path/to/disposable-prepared-project /path/to/evidence repl
```

Use `fixture` as the final argument for a copy of `test/fixtures/vue-output`
with `receiver.ts.fixture` renamed to `receiver.ts`, Vue dependencies installed,
and Git initialized. Both projects need fresh Groma state. The artifact journey
also requires a fresh cache for the prototype `@groma/scanner-vue@0.1.0`
candidate so it can verify a download rather than reuse an earlier build.
The runner changes only these disposable projects and restores edited sources.

## Release limits

Execution used macOS arm64, Bun 1.4.1 and compiled Groma. Public publication,
public package naming, and Windows/Linux execution remain separate release
gates. No additional-platform or public-availability claim is made.
The coordinator approved the real map, including the curated CodeMirror
responsibility and the direction and Vue provenance of its callback. Cold
simplicity, implementer specification/quality and final full-context reviews
passed without required changes. The shared `bun run check` passed: 110 Node
tests and 398 Bun tests passed, seven existing tooling-dependent tests were
skipped, and no tests failed. The Vue watcher test passed in that shared suite.
Six pre-existing complexity warnings remain.

One earlier focused watcher run timed out after 20 seconds. Two traced runs
showed normal event dispatch, and the restored test then passed both focused
and shared checks. No assertions or timeouts were changed, and no retries
were added. The isolated timeout has no established root cause; the
investigation remains recorded in TASK-326.10.
