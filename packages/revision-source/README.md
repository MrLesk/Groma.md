# Revision source

A source discovers Git states. It does not read architecture, calculate file
changes, paint a map, or supply work records.

The browser-safe contract exports GitState, GitRange, display entries, opaque
cursors, source readiness and the RevisionSource lifecycle:

1. readiness returns enabled/ready state, supported collections, optional
   repository choices and a source-owned setup or error message.
2. list returns one page for a collection, search and optional state.
3. resolve returns an exact target SHA and an optional proposed base SHA.
   Success means both commits exist in the local Git object database.
4. configure is optional and stores only non-secret local enablement and
   repository selection.
5. close cancels owned work and releases source-owned resources.

Entry IDs and cursors are opaque to the host. Branch names are display context;
a resolved SHA is snapshot identity. The application composition point injects
sources into the web host. Local Git is built in; GitHub is optional.
