# Groma Plugin SDK

`groma/plugin-sdk` is the supported authoring boundary for built-in and third-party
plugins. `groma/plugin-sdk/conformance` is the separate reusable verification surface.
Plugin packages import these public subpaths, never files under Groma's `src/core`,
`src/host`, or other implementation layers. The authoring subpath does not re-export
the conformance suite.

The SDK intentionally stays small:

- `pluginRuntimeApiVersion` and `PluginRegistration` describe one runtime plugin;
- `pluginSdkApiVersion`, `pluginPackageManifestApiVersion`, and
  `PluginPackageManifest` describe the exact public/package contract;
- `definePlugin()` and `definePluginPackage()` are build-time authoring aids that
  preserve supported version literals;
- `checkPluginPackageCompatibility()` validates a bounded package declaration before
  any entry point is loaded;
- `groma/plugin-sdk/conformance` exports `runPluginConformanceSuite()`, which checks
  deterministic results, lifecycle, cancellation, declared cardinality, and
  caller-supplied provider behavior without depending on a test runner;
- that subpath also exports `createPluginRuntimeConformanceFixture()`, giving package
  authors the same runtime fixture used to prove official contributions.

## Blind scanner authoring

`scannerCapability` is the frozen multiple-provider declaration for
`groma.scanners/v1` at exact capability version `1.0.0`. A scanner implements the
`groma.scanner/v1` `Scanner` contract and receives one Host-assembled `ScannerRequest`.
The request contains only:

- the immutable project/source/epoch/scope observation-session descriptor;
- bounded canonical data-only scanner configuration;
- cancellation;
- scoped, read-only project-resource enumeration and reads; and
- the one-way observation sink for batches, heartbeats, completion, and failure.

It contains no blueprint entities, curated intent, aliases, bindings, reconciliation
decisions, session inspection, snapshot read, canonical mutation, filesystem write, or
coordination authority. `complete()` deliberately returns only `Result<void>` to the
scanner; the Host retains the completed evidence snapshot for reconciliation.

Every resource request names one declared scope and a project-relative resource inside
that scope's declared root. Page size, depth, cursor, resource text, page characters,
and read bytes are bounded before the provider is called. Pages must contain strictly
resource-ordered unique entries within the requested subtree and scope, and a continued
page must advance its bounded control-free cursor. Provider results are exact bounded
`Result` variants. Bytes are copied into fresh caller-owned storage; pages, entries,
diagnostics, configuration, and the public request are defensively copied and frozen.
Provider throws, rejections, non-native promises, malformed results, oversized output,
and observation-sink throws become stable SDK-owned failures without exposing private
thrown values.

Enumeration depth counts directory descent below the requested resource, matching the
official local resource provider. The requested resource and each immediate child are
depth zero, grandchildren are depth one, and so on, regardless of whether an entry is a
directory, file, link, or other resource. A `maxDepth: 0` result may therefore list
immediate children but may not descend into a child directory. Returned entries beyond
the requested depth are rejected even if a provider accepted the bounded request.

Cancellation fails closed. Once cancellation is requested—or its callback fails or
returns a non-boolean—the SDK will not invoke resource providers or the observation
sink. The Host still owns ending the Core observation session. Scanner `scan()` callback
containment and session orchestration belong to the runtime/Host rather than this
authoring facade.

`createScannerRequest()` canonicalizes this narrow authority boundary. Its optional
scanner bounds and observation-session bounds let a Host apply the same accepted scope
contract on both sides. Extra input properties are ignored and never survive the
canonical result; only known enumerable data descriptors are inspected. This authority
narrowing is not a security sandbox: scanner plugins are trusted code running with the
user's permissions.

The SDK reuses Core's runtime types and implementation. It does not introduce a
second resolver, lifecycle, or semantic path. Staged Phase 0 continuation is an
internal Host bootstrap primitive and is intentionally absent from this public
surface.

Schema-owning plugins may contribute `CanonicalSchemaMigrationContribution` as a
multiple-provider `canonicalSchemaMigratorCapabilityId` capability. Its stable value is
`groma.schema-migrators/v1`. A contribution declares exact schema tokens, integer document
versions, and version-increasing migrator edges. It never receives a store or write
capability. The Host keeps it inert until explicit status, preview, or apply work;
Application chooses one bounded path and contains callback failure or
malformed/nondeterministic bytes before Persistence prepares a transaction.
Contribution, schema, and migrator declarations are plain records: required fields must be own,
enumerable data properties. Prototype methods are outside the runtime contract.

Package acquisition, trust, enablement, loading, exact locks, and project configuration
belong to the Official Host and are not implemented by this SDK.

The official CLI exposes the narrow authoring convenience
`groma package scaffold <destination> --name <package-name> --plugin <plugin-id>
--provides <capability-id>`. It generates one self-contained Phase 1 entry plus a test
using this public conformance subpath. Scaffold output uses only erased type imports from
the authoring subpath; it does not treat repository source modules or Host loading code
as an SDK.

## Package metadata and compatibility

Package-manager metadata and the SDK manifest have different jobs. A package registry
or `package.json` may advertise a release and its entry points for discovery. That
metadata is not trusted runtime compatibility evidence. Before an entry point executes,
the Host must obtain the exact six-field envelope accepted by
`checkPluginPackageCompatibility()` as inert static JSON/data. The envelope must be
readable without evaluating a plugin entry point or any arbitrary package module:

```json
{
  "apiVersion": "groma.package/v1",
  "name": "@acme/groma-platform",
  "plugins": ["./plugins/ownership.js", "./plugins/policy.js"],
  "runtimeApiVersion": "groma.plugin/v1",
  "sdkApiVersion": "groma.sdk/v1",
  "version": "1.4.0"
}
```

Exactness describes the canonical result: the SDK reads only those six required
enumerable data properties and returns a fresh frozen envelope containing no others.
It never enumerates keys on a package-controlled in-memory object; unknown source
properties are ignored and cannot influence or survive canonicalization. The official
local Host reads this envelope from package-root `groma.package.json` and requires that
source JSON document itself to contain exactly the six fields, with no duplicate or
unknown keys, before passing its data to this bounded checker.

Compatibility tokens and the exact package version are bounded to 128 characters.
Every plugin entry is a bounded relative package subpath. Each segment starts with an
ASCII alphanumeric character; later characters may also use dot, underscore, or
hyphen, but a segment cannot end with a dot. Traversal, empty or dot segments, percent
encoding, URL query or fragment syntax, controls, backslashes, leading punctuation,
and platform-ambiguous trailing dots are rejected rather than normalized.

`definePluginPackage()` only helps TypeScript authors preserve the supported literals
while a build step emits that static data. Importing and calling the helper is not a
Host discovery or compatibility-checking mechanism.

The official local Host reconciles this envelope with its exact lock before execution.
Every declared plugin path identifies a Phase 1 module with one named `plugin` export
containing a `PluginRegistration`. The Host verifies the locked static-manifest and
entry-module bytes and an exact full-user-permissions trust grant before importing that
module. The initial local Host accepts an entry of at most 4 MiB and evaluates those
already-read bytes as one immutable in-memory module. That entry may use Bun-compatible
TypeScript syntax and absolute `node:` built-ins, but it must be bundled or otherwise
self-contained: relative and bare runtime imports are unsupported. Type-only SDK imports
are compatible when the package build erases them.

Exact entry evaluation is not a security sandbox. Trusted code has full user permissions
and can use absolute URL imports, computed dynamic imports, filesystem APIs, subprocesses,
and other runtime facilities to execute effects or secondary code outside the entry
lock. Acquisition and lock formats remain Host concerns rather than SDK contracts.
