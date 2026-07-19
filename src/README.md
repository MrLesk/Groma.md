# Source Layout

The source tree follows the dependency direction in [ARCHITECTURE.md](../ARCHITECTURE.md): Core,
Standard Model, Application, Persistence, Host, and CLI. Each directory README states the current
boundary and deliberately absent responsibilities.

`plugin-sdk/` is the one public authoring facade. It exposes the blind scanner contract used by the
built-in TypeScript/Bun scanner; it is not a package-management or certification framework.
