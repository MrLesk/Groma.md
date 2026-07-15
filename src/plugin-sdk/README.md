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
