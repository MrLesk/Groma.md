# Vue scanner

The Vue scanner adds single-file component (SFC) event bindings to Groma's
TypeScript scanner evidence. Its bundled compiler tools read local source
without project dependencies. The scanner reads each selected project's
`tsconfig.json`; it does not execute application code.

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/vue/build.ts
```

In the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/vue/dist/package
groma scan
```

The package bundles Vue language-core 3.3.11, Volar TypeScript 2.4.28,
Vue compiler-dom 3.5.42 and its own TypeScript 5.9.3. Compiler-sfc 3.5.42
provides build-time declarations only. The build
pins compiler imports to that TypeScript installation. The separate TypeScript scanner uses its own 7.1 SDK. Compiler libraries and Vue helper declarations
ship in the package; no consumer build or installation script is required.

[Vue language tools](https://github.com/vuejs/language-tools) supply project
configuration, SFC parsing, template code generation and original-source
mappings. [Volar](https://github.com/volarjs/volar.js) integrates the generated
code with the TypeScript checker, which resolves component imports and handler
function identities. The scanner translates these facts into the existing
supplied-callback evidence contract; it has no separate name or type resolver.

## Supported interaction

### External source blocks

A `.vue` file can explicitly name local external script, template, and style
files with `src="./file"` or `src="../file"`, as described in the
[Vue SFC specification](https://vuejs.org/api/sfc-spec#src-imports).
The scanner reports those direct companions as one source unit. Core assigns
one component when ownership is unambiguous and preserves curated membership
on repeats. Code details expose the `.vue` file and every companion.
Imports from the script, global styles, transitive stylesheet imports, and
similarly named neighboring files do not extend that association.

Inline blocks create no extra files. External scripts cannot be combined with
`script setup`; Vue's [script setup restrictions](https://vuejs.org/api/sfc-script-setup#restrictions)
still apply. External block association does not add Options API or external
template event inference; the inline interaction rule below remains unchanged.
Edits to JavaScript, TypeScript, HTML, CSS, SCSS, Sass, Less, and Stylus companions
trigger the existing shared scanner refresh.

### Inline event bindings

The qualified example is Vue REPL's CodeMirror `change` event bound to the
parent's `onChange` function. A static imported SFC must use a typed
`defineEmits` declaration assigned to a constant. A call to that same symbol
must supply a declared literal event name inside a source function. The parent
template must bind the event directly to one source function declaration or
constant function expression. Imported TypeScript functions use the same rule.
See [Vue component events](https://vuejs.org/guide/components/events).

The observation records the emitting function, literal emit call, concrete
template attribute and supplied handler. All positions refer to the original
physical source, as zero-based UTF-16 offsets; lines are one-based. The nearest
function owns a nested emit call. Repeated scans are deterministic.

Unresolved, dynamic or unsupported bindings produce `unsupported-vue-binding`
diagnostics and no certain relationship. This revision does not support
Options API events, runtime `defineEmits` arrays, dynamic components, dynamic
event names, handler expressions or modifiers, state stores, routing, server
frameworks or arbitrary event mutation. Compiler syntax/template errors fail
the scan and preserve the previous complete map. Readiness errors explain
invalid configuration or source syntax. Typed event names are read from the
local `defineEmits` type literal; missing Vue types do not erase that evidence.

Vue contributes `vue` Code provenance for configured source files. Shared core
keeps one physical-file owner, interprets complementary and conflicting
observations, and writes readable relationship rows. `.vue` and TypeScript
edits participate in the existing scan watcher.

In OKF, the result is ordinary source links and relationship Markdown. An SFC
is source evidence; it does not automatically define a C4 responsibility or
add a containment level. Groma's existing ownership and relationship model
owns that interpretation. No new architecture metadata is added.

See [fresh-checkout validation](../fresh-checkout-validation.md) for the pinned project and executed release
checks. This prototype package name does not imply public publication.

## Source outline

The scanner outlines every script it owns in a component's Code with the
TypeScript rules of the [source outline contract](../creating-a-plugin.md#source-outline):
top-level functions and types (classes, interfaces, enums), including namespace
contents, and each type's constructors and methods. Every declaration has its
line and visibility, and `entry` marks the names the Code links give. Templates
and stylesheets have no outline.

A single-file component is read with the Vue single-file component parser: the
`<script>` and `<script setup>` blocks are outlined in source order, each in the
dialect its `lang` attribute names, and every declaration reports the line it
occupies in the `.vue` file. A `<script setup>` block exports nothing, because
its top-level bindings are the component's own API for its template, so its
top-level declarations are private; members keep their TypeScript visibility.
The package's own TypeScript parses each block alone, without `tsconfig.json`,
dependencies or compilation.

Core outlines each file once. For a script that the TypeScript scanner also
owns, the scanner with the lowest id among the file's Code links outlines it,
there TypeScript, with the symbols of all those links.

## Nested projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` and Vue source
files belonging to that package, outside nested packages. Declaration files and
inactive fixtures with a `.fixture` suffix do not qualify. Packages with only
framework tooling dependencies are skipped. No matching project produces no evidence. Each compiler uses that project's configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
Source and nested package/configuration changes use the shared scanner watch flow.
