# .NET scanner experiment

This playground tests the proposed language-neutral source-evidence boundary with C# and Roslyn. It does not infer Groma components and cannot write architecture Markdown.

## Run

Use .NET 10. The trial command exports the committed MassTransit source to a temporary directory, restores and scans that copy, then removes it. It does not write build assets into the target repository.

```sh
./experiments/dotnet-scanner/scan-masstransit.sh ../MassTransit > snapshot.json
```

The scanner starts writing JSON only after workspace work and contract validation have completed. A scanner or validation failure writes an error to stderr, returns a non-zero exit code, and leaves stdout empty. Once the final stdout write begins, normal stream behavior applies.

## Snapshot boundary

- `scopes`: MSBuild projects, identified by repository-relative project paths
- `files`: source paths and declared type symbols
- `placements`: independent evidence that a file is compiled by a project
- `relationships`: project references
- `diagnostics`: normalized MSBuild workspace warnings

Files stay atomic. A partial type therefore has the same symbol identity on several file records; the scanner does not turn those files into one architecture component. A later language-neutral projection can use this evidence together with explicit architecture rules.

## MassTransit result

Two scans of `MassTransit.sln` produced the same SHA-256 digest, `ef61bdcfb1256775ec03906b5bae7d2999a30aee397b8cce01dc77e4be386c31`:

- 56 project scopes
- 5,427 source files and placements
- 209 project-reference relationships
- 3 normalized workspace warnings
- 22 separate files declaring `MassTransitStateMachine<TInstance>`

The final runs scanned disposable exports. The target repository had the same tracked-file digest and an empty Git status before and after the experiment.

## Known boundary

This is a feasibility scanner, not a production C# adapter. Roslyn's solution load chooses the MSBuild evaluation used for each multi-targeted project. The experiment does not yet prove that conditional source files from every target framework are included. Generated sources are also outside this snapshot because they do not have stable repository source paths.
