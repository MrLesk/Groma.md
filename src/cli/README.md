# Command-line surface

The Iteration 1A CLI is a one-shot adapter over the shared application operations
assembled by the official host. It does not read Markdown intent documents, resource
locators, or the transaction journal directly.

Run `groma --help` for the complete command grammar. Create and update accept one
bounded UTF-8 JSON application request envelope from `--input <path>`, `--input -`, or
`--stdin`. Existing parent changes use `component reparent`; update deliberately rejects
parent changes through the application contract. Every read requires an explicit page
limit and returns one page only. Cursors are printed but never followed implicitly.
Optional component `label`, `summary`, and `iconDomain` values use this same JSON path;
updates clear them with explicit `null`, and reads return their canonical values without
resolving `iconDomain` or making a network request.
`component merge <obsolete-id> --into <survivor-id> --revision <obsolete-revision>` is
the explicit supersession boundary. It removes the obsolete component and preserves its
stable references through a canonical alias while leaving the survivor identity and
intent unchanged. Reads by an older ID return the current survivor. Renames, updates,
and reparenting do not create aliases.
Command output is buffered up to one MiB; an oversized page becomes a typed
`cli-output-bound-exceeded` failure rather than partial or streamed output, so callers
can retry with a smaller explicit page.

Projection-backed raw blueprint reads use the shared application path:

```text
groma blueprint export --limit N [--cursor C]
groma blueprint search <text> --limit N [--cursor C]
groma blueprint traverse <id> --direction incoming|outgoing|both --depth N [--relation-type T] --limit N [--cursor C]
```

Blueprint search treats its first fixed positional value as text even when it begins
with `--`; options are parsed only from the remaining arguments.

The CLI accepts opaque cursors up to 4,096 characters so every cursor emitted by the
official graph query engine can be resumed. It does not parse, rewrite, or auto-follow
them. Plain and JSON formats serialize the same semantic result object, including exact
generation, `hasMore`, and continuation information.

Each `blueprint export` item contains one canonical component and all of that source
component's outgoing depth-1 relationships. To export the complete current blueprint,
consume only `blueprint export` pages until `hasMore` is false, preserving one generation
and passing the emitted component cursor unchanged. A stale generation or
same-generation projection mismatch requires restarting from the first page. Internal
relationship paging stays inside the shared bounded operation; no relationship cursor or
composite cursor is exposed. `blueprint search` and `blueprint traverse` remain
independent exploration commands rather than phases of export.

`--format json` is the stable machine-facing envelope. Each response has `command`,
`exitCode`, `ok`, and `result`; object keys are emitted canonically. Plain output is
deterministic, contains no ANSI styling or prompts, and quotes component-controlled text.
Explicit JSON help and version requests use the same envelope instead of switching back
to plain text.
The exact plain-text grammar remains provisional through Iteration 2 so the human
experience can improve without changing the application contracts or JSON envelope.

## Local plugin packages

The complete supported local-path surface is `package scaffold`, `add`, `inspect`,
`enable`, `disable`, and `remove`; `groma --help` shows the exact grammar. Blueprint scope is the
default. `--personal` keeps declaration and trust state outside the repository and only
permits `groma.presentation.*` capability declarations. Add and inspect read the exact
static `groma.package.json` document without importing package code. Enable is the code
execution boundary and requires `--trust-full-user-permissions` unless an unchanged,
location-bound exact grant already exists.
Local registrations cannot use the Host-reserved `official.*` plugin namespace. Disable
retains an unchanged exact-byte trust grant for later re-enable; remove is the explicit
revocation boundary and prunes grants after every package entry has been disabled.

`package scaffold` creates one minimal Phase 1 plugin at an explicit portable `./`
destination contained by the current workspace. The returned destination can be passed
unchanged to blueprint `package add`; the Host-owned `groma/` state tree is reserved.
The author supplies the package name, plugin ID, and one or more `--provides` capability
IDs; Groma derives exact version `1.0.0` and single-provider cardinality rather than
emitting unused placeholders. The generated package has an exact `groma.package.json`,
a self-contained TypeScript entry with only an erased `groma/plugin-sdk` type import,
package metadata, and a Bun test using `groma/plugin-sdk/conformance`. Generation uses a
private same-parent staging directory, reserves the destination without replacement,
and moves the static manifest last, so package add cannot recognize an incomplete tree. An
invalid identity, SDK-shadowing `groma` package name, reserved `official.*` ID, duplicate
or default-Host-conflicting contribution, existing destination, or failed write leaves
the requested destination unchanged when its exact identity remains Host-owned. If
another process changes that identity, Groma refuses to recursively delete unknown data.
Abrupt process termination may leave a markerless destination that must be removed before
retrying.
The generated peer dependency makes the public `groma` package an explicit test
prerequisite. Before a registry release, `bun add --dev --no-save
groma@file:/path/to/groma`
supplies a local checkout's public exports without writing scaffold metadata; the
end-to-end verification uses that same package-manager path rather than importing a
private source file.

The initial executable entry is a bounded bundled/self-contained module. TypeScript
syntax and `node:` built-ins are supported, while relative and bare runtime imports are
not; the Host and SDK READMEs document this exact-byte compatibility boundary.

Persisted local-plugin trust and execution currently fail closed on Windows with
`plugin-package-trust-root-unattested`, because this delivery has no bounded Windows ACL
owner attestor. A fresh Windows workspace without enabled local plugins or an existing
plugin user-data root still starts normally; POSIX trust behavior is unchanged.

Package commands use a management-only Host composition: previously enabled entries are
not loaded or started. Inspect reports manifest or enabled-entry drift without executing
it, and disable/remove remain available as recovery operations when ordinary startup
would fail closed.

`migrate status`, `migrate preview`, and `migrate apply` are the explicit canonical schema
surface. Status reports the floor, observed versions, mixed state, and per-resource path
completeness without invoking migrators. Preview lists every resource and deterministic
path but writes nothing. Apply is the only migration write boundary and uses one durable
transaction; ordinary component and bare commands never repair or rewrite older schemas.

Remote npm, Git, and URL sources return the stable
`remote-plugin-package-acquisition-out-of-scope` diagnostic before source filesystem
access. Package state commands write only `groma/groma.yaml`, `groma/packages.lock`, and
the Host-owned user-data file. Scaffold writes its new destination, including that new
package's metadata. Package state commands never edit an observed project's `package.json`,
lockfiles, or dependency tree. Package mutations canonically reserialize the Groma-owned
sections of `groma/groma.yaml`; YAML comments and hand formatting are not preserved. If a
package-state replacement may have committed or coordination release fails after a write,
the command returns `plugin-package-state-indeterminate` in exit class 6 so automation
does not retry blindly. Recovery compares `groma/groma.yaml` and `groma/packages.lock`,
then uses `package disable` or `package remove` without loading package code only when
those selections differ. Personal state is verified with `package inspect --personal`;
a not-found result confirms that removal committed.

Exit classes are stable:

| Code | Class                                                 |
| ---: | ----------------------------------------------------- |
|    0 | Success                                               |
|    2 | Invalid invocation or structured input                |
|    3 | Workspace or persisted package-state failure          |
|    4 | Command, package-source, or revision validation       |
|    5 | Provider, graph-query, or host infrastructure failure |
|    6 | Indeterminate semantic or package commit              |
|  130 | SIGINT or generic cancellation                        |
|  143 | SIGTERM                                               |

Signal handling stops command-result publication and completes host cleanup promptly.
The shared 1A application operations do not expose a mid-operation cancellation seam,
so an already-started bounded read or mutation is allowed to settle rather than being
force-aborted during local transaction publication.

With no command, an uninitialized workspace prints the exact `groma init` next step and
does not create files. An initialized interactive terminal receives a bounded hierarchy
overview. Each overview node derives `displayText` through the Standard Model's
`label`-then-`name`-then-stable-ID fallback while retaining canonical identity and name
separately. The overview reads at most 10 roots, 10 children per visited component, four
descendant levels, 50 components, and 50 queries, and reports truncation instead of
following continuation cursors. Bare non-interactive use prints help.
