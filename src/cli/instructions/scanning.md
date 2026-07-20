# Scanning

A scan looks at the code and puts what is really there onto the map without erasing
anyone's words.

## First scan

`groma init` creates the workspace and registers this repo as the default project.
`groma scan` then selects the only registered project and its built-in
TypeScript/Bun scanner automatically. When more than one project or scanner is
registered, choose explicitly with `--project <project-id>` and
`--scanner <scanner-id>`.

## What a scan does

- The scanner reads code and reports observations. It never sees the existing map,
  so it can never reorganize your architecture.
- Groma reconciles those observations with the map: evidence is refreshed, observed
  candidates appear as ordinary components, and every piece of curated intent
  survives unchanged.
- A scan over unchanged code leaves the canonical files byte-identical. Review scan
  effects like any other change: `git diff groma/`.

## What a scan never does

- It never deletes or rewrites intent. A part the scanner cannot see is reported as
  missing coverage, not removed.
- It never edits your project's source, `package.json`, or lockfiles.
- It never commits partial results: a failed or cancelled scan changes nothing.

## More codebases

`groma project add` registers additional codebases and their scanner coverage
explicitly (see `groma project add --help` for the JSON envelope). `groma project
list` shows what is registered. Unavailable projects keep their prior evidence.
