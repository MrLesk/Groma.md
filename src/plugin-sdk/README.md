# Groma Plugin SDK

`groma/plugin-sdk` is the supported authoring boundary for built-in and third-party
plugins. Plugin packages import this subpath, never files under Groma's `src/core`,
`src/host`, or other implementation layers.

The SDK intentionally stays small:

- `pluginRuntimeApiVersion` and `PluginRegistration` describe one runtime plugin;
- `pluginSdkApiVersion`, `pluginPackageManifestApiVersion`, and
  `PluginPackageManifest` describe the exact public/package contract;
- `definePlugin()` and `definePluginPackage()` preserve supported version literals;
- `checkPluginPackageCompatibility()` validates a bounded package declaration before
  any entry point is loaded;
- `runPluginConformanceSuite()` is runner-agnostic and checks deterministic results,
  lifecycle, cancellation, declared cardinality, and caller-supplied provider behavior;
- `createPluginRuntimeConformanceFixture()` gives package authors the same runtime
  fixture used to prove official contributions.

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
`checkPluginPackageCompatibility()`:

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

Compatibility tokens and the exact package version are bounded to 128 characters.
Every plugin entry is a bounded relative package subpath composed only of conservative
ASCII alphanumeric, dot, underscore, and hyphen segments. Traversal, empty or dot
segments, percent encoding, URL query or fragment syntax, controls, backslashes, and
platform-ambiguous trailing dots are rejected rather than normalized.

The future Host package manager must reconcile discovery metadata, this canonical
envelope, and its exact lock before execution. The SDK does not choose the envelope's
materialization or lock format; that remains GROM-24 scope.
