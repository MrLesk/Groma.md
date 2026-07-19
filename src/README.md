# Source Layout

The source tree follows the dependency directions documented in
[DEVELOPMENT.md](../DEVELOPMENT.md): each directory here is one architectural boundary,
and each boundary gets a local README before it gets implementation, so later tasks add
code intentionally instead of treating an empty directory as an API.

`plugin-sdk/` is the only public authoring boundary. Scanner packages may import the
`groma/plugin-sdk` package export; they never import implementation paths from any other source
boundary.
