# Source Layout

The source tree follows the architectural dependency direction documented in
[DEVELOPMENT.md](../DEVELOPMENT.md). Each boundary has a local README before it has
implementation so later tasks add code intentionally rather than treating an empty
directory as an API.

`plugin-sdk/` is the one intentional public authoring boundary. Plugin packages use
the `groma/plugin-sdk` package export and do not import implementation paths from any
other source boundary.
