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

The SDK reuses Core's runtime types and implementation. It does not introduce a
second resolver, lifecycle, or semantic path. Staged Phase 0 continuation is an
internal Host bootstrap primitive and is intentionally absent from this public
surface.

Package acquisition, trust, enablement, loading, exact locks, and project configuration
belong to the Official Host and are not implemented by this SDK.

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
