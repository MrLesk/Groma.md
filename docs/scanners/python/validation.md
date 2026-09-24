# Python scanner local qualification

Executed on 13 September 2026 on macOS arm64 with Python 3.14.3, Bun 1.4.1,
Node 24.13.0 and pnpm 10.28.2. The candidate was
`@groma/scanner-python@0.1.0`. These are local results, not a claim that the
package has been published or exercised on Linux or Windows.

## Projects and results

| Project | Cloned revision | Python files | Python operations | Unresolved Python calls | Combined unique source files |
| --- | --- | ---: | ---: | ---: | ---: |
| [FastAPI full-stack template](https://github.com/fastapi/full-stack-fastapi-template) | `cb740b656d7a0a6c5e12c7bf8e50343ec94ee9c7` | 28 | 74 | 424 | 130 |
| [marimo](https://github.com/marimo-team/marimo) | `1793fe560831387febc83979461baf2be71a93d8` | 1,551 | 13,221 | 45,861 | 2,824 |

Both projects combine Python with React and TypeScript. FastAPI exercises a
nested backend project beside a frontend; marimo exercises a larger Python
notebook application and a multi-package frontend. Counts reflect the scanner's
documented source scope, including unignored examples and development files.
They do not claim an architectural component for each responsibility.

Both packed-plugin Python-only scans passed. Their second scans created zero
records and refreshed 28 and 1,551 components respectively. After adding the
local TypeScript and React packages, both combined scans passed without scanner
failures. The compiled groma.md binary repeated those combined scans with zero
new records, refreshing 130 and 2,824 components respectively. Inspection of the
saved Code references found no source file assigned to more than one component.
React inspected 70 and 622 files respectively; these overlap TypeScript files,
so scanner file counts must not simply be added together.

Python returned its `PYTHON_SYNTAX_ONLY` diagnostic. React reported unsupported
bindings through its existing diagnostics. Python framework routing, dependency
injection, cross-language HTTP interactions and runtime call targets were not
inferred. No application servers, databases or full application test suites
were started. Project source and dependency lockfiles were not changed; groma.md
initialization added its own configuration and agent-instruction entries.

## Reproduce the local package checks

The retained workspace is `/tmp/groma-python-qualification`, containing both
clones, the tarball, unpacked package, observations and CLI logs. Temporary files
may be removed by the operating system. From the groma.md repository:

```sh
bun plugins/scanners/python/build.ts /tmp/groma-python-qualification/package
cd /tmp/groma-python-qualification/package
npm pack --ignore-scripts --pack-destination /tmp/groma-python-qualification
```

The tarball contains only the manifest, bundled entry, Python worker and MIT
license. It has no runtime npm dependencies or installation scripts. It was
unpacked into each clone's `tools/python-scanner` directory. `/tools/` and
`/.groma/` were added to each clone's local `.git/info/exclude` so validation
artifacts are outside the source inventory. From each clone:

```sh
groma init 'Python qualification' --directory .groma
groma scanner add ./tools/python-scanner
groma scanner check
groma scan
groma scan
```

Frontend preparation used the project's existing lockfile:
`bun install --frozen-lockfile --ignore-scripts` in FastAPI's `frontend`, and
`pnpm install --frozen-lockfile --ignore-scripts` at marimo's root. Python
project dependencies were not installed.

TypeScript and React packages were built with their existing `build.ts` entry
points, copied into each clone's excluded `tools` directory, then added:

```sh
groma scanner add ./tools/typescript-scanner
groma scanner add ./tools/react-scanner
groma scanner discover --json
groma scan
```

CLI development runs used `bun /path/to/groma3/src/cli.ts`. After `bun run build`,
`/path/to/groma3/dist/groma scan` repeated the combined scans on both clones.

| Artifact | SHA-256 |
| --- | --- |
| Packed Python candidate | `445fcbef4d07a0edb2184aafccaf40604b11b37749b688330f43607b45b3b10a` |
| Locally compiled groma.md | `9ebee468f37f4124e444c715e5efa8d1551d28b378edbb3174fadc6100494272` |

## Repository and release checks

`bun test test-bun/python-scanner.test.ts` passed four concurrent tests with
28 assertions. Fixtures prove deterministic evidence, nested ownership,
function ownership, UTF-16 positions with Unicode and CRLF, exclusion boundaries,
source-only projects, failure without partial output and no source execution.

`bun run check` passed Biome, TypeScript, 16 Node tests and 311 Bun tests.
Six existing opt-in Go/Rust tests were skipped. `bun run build`, frozen-lockfile
installation and `git diff --check` also passed.

The shared release script includes Python in staging, assembly, publication and
catalog refresh. The same portable worker is shipped for all targets. CI and
release validation select Python 3.14 for the fixture tests. Only the local
Python package build and pack were exercised here; the complete five-platform
release workflow and public npm installation remain release-time checks.
The package's first npm publication and trusted-publisher setup follow the
[existing publishing procedure](../publishing.md).

## v0.3.2 package validation

On 14 September 2026, the position test also checked a Unicode U+2028 character
inside a string, with CRLF source lines. The worker uses Python source line
boundaries and preserves the original line endings. The regression failed
before this correction and passed after it.

The corrected package was built, packed, and installed into both retained
qualification projects. Combined Python, TypeScript, and React scans passed:
FastAPI created zero records and refreshed 130; marimo created zero records
and refreshed 2,824. The package SHA-256 is
`0326650983bf0d04b2b98ae67e171320667c64ae8815b9ec7acffa7ef39a9b4c`.
The archive is `/tmp/groma-scanner-python-0.1.0.tgz`.

The full repository check passed: lint, type checks, 16 Node tests and 312 Bun
tests, with six existing optional native-tool tests skipped. The four Python
tests passed with 28 assertions.

[CI run 34814084303](https://github.com/MrLesk/Groma.md/actions/runs/34814084303)
passed repository checks and standalone builds on Linux, macOS, and Windows.
The position fixture normalizes checked-out line endings before it writes CRLF,
so Windows checkouts do not add blank source lines. This CI evidence covers the
fixture tests on all three systems; the two full project scans remain macOS checks.
