# Codex scanner validation

Date: 8 September 2026. Scanner source: Groma
`6d465f8909f00beb163128ae93f8e66a15c1b0e8`.
Target: [openai/codex at d6489472f3c15e87d2d7763a5fde033545c530f8][codex].
Machine-readable measurements: [codex-validation.json](codex-validation.json).

## Result

**The unchanged prototype rejects the full Codex repository.** This is a genuine
supported-input gap, not a missing dependency installation or an invalid Rust file.
A physical source file is compiled by two different Cargo packages, and the
prototype cannot assign both package placements to its one physical inventory item.

An explicitly reduced 145-member workspace control completed, emitted identical
observations in three fresh processes, and worked through the real Groma registry
and reconciliation. It is **not a successful full-Codex scan**. The control yielded
2,383 Rust files, 25,668 operations, 175,669 invocation sets, and 7,297 fully resolved
sets. No supplied named callback bindings were established; Groma derived no map
relationships. This is structural coverage, not a complete architecture discovery.

No scanner, SDK, core, installation, or relationship-selection source was changed
for this experiment. The previous production-readiness qualification still applies.

## Pinned inputs and execution policy

The target checkout contains 7,488 tracked files, including 3,895 `.rs` files and
153 `Cargo.toml` files. Its main `codex-rs/Cargo.toml` explicitly lists 146 workspace
members and declares edition 2024; `codex-rs/rust-toolchain.toml` requests Rust
1.95.0. These are source declarations, not installed or executed target toolchains.

The worker was the **existing prebuilt Linux x64 CI package** from Groma workflow
run [34168019279][package-run], not a new build tuned to Codex. Its executable
SHA-256 is:

```text
947734b05bc5db01058f0b51e378b5fbbcf1f7ba03079140d1b1492e8ac8c9d6
```

It reports `rust / syn-syntax / 2.0.106/groma-0.1.0`. The scanner does not install or
use Codex's declared toolchain. No target dependency restore, build script,
procedural macro, application, or test was executed. TypeScript scanning used
Groma's installed checker; Codex's npm packages were not installed.

The full-input run and pinned checkout acquisition are recorded in
[experiment workflow 34194154000][experiment]. A successful workflow means the
experiment captured its results, **not** that scanning Codex succeeded. Raw exit
codes and zero-byte failure output were preserved. The verification-only workflow
lives on `research/rust-codex-validation`; scanner implementation remains on
`research/rust-scanner-prototype`.

The original checkout remained clean. All 7,488 tracked paths were hashed for the
local integrity record. A separate disposable copy was used for Groma integration;
`groma init` added its normal instructions to `AGENTS.md` there. All tracked Rust
sources, Cargo manifests and lockfiles remained unchanged in both copies.

## Full repository and full workspace: rejected

Both normal entry points failed consistently in three fresh CI processes each:

| Input | Exit | Standard output | Elapsed until failure | Peak native RSS |
| --- | ---: | ---: | ---: | ---: |
| Repository root | 1 | 0 bytes | 1.88–1.90 s | 303,352–303,408 KiB |
| `codex-rs/` workspace | 1 | 0 bytes | 1.90–1.91 s | 302,220–302,400 KiB |

These are **failure timings**, not completed scan throughput. A further local run
reproduced the repository-root error. No file, operation, or relationship counts
are reported as a completed observation for either full input.

```text
Rust scan failed: multiple packages own source file: codex-rs/exec-server/src/proto/codex.exec_server.relay.v1.rs
```

### Why this is a real source-model issue

[The execution server][relay-main] includes the generated file through:

```rust
#[path = "proto/codex.exec_server.relay.v1.rs"]
mod generated;
```

[The test-support package][relay-support] includes the same physical file through:

```rust
#[path = "../../src/proto/codex.exec_server.relay.v1.rs"]
mod relay_proto;
```

`exec-server/tests/support` is an explicitly listed workspace **package with a
library target**, not merely an integration-test target. Skipping `[[test]]`
targets does not exclude that member. The failure originates in the prototype's
`Index::symbol` / module file-registration placement checks.

Production needs to distinguish **physical file identity**, **membership in one
or more compilation units**, and **one curated architectural owner**. A shared
file must not become two physical inventory entries, and arbitrary package order
must not silently decide its architecture meaning. This fits the existing C4/OKF
boundary: compiler memberships are supporting facts; persisted components and
linked descriptions remain curated architecture. No new C4 level or stored raw
compiler graph is proposed here.

## Reduced-workspace control: not full Codex support

The experiment wrote a temporary `codex-rs/Groma.research.Cargo.toml` alongside the
original workspace manifest. Its contents were byte-identical except for removing
one explicit member line: `"exec-server/tests/support"`. It retained the remaining
145 members, inherited metadata, and dependency declarations. The scanner was
pointed at it with an untracked `.groma-rust.json`:

```json
{"manifests":["codex-rs/Groma.research.Cargo.toml"]}
```

No tracked source or original manifest was edited. Both temporary files were
removed after testing. Ancillary Cargo roots elsewhere in the repository were
also outside this explicitly selected workspace control. Cargo itself was not
run against the alternative manifest; this is a controlled scanner input, not a
recommendation to alter Codex's workspace or a general Cargo workaround.

| Measurement | Reduced control |
| --- | ---: |
| Package scopes | 145 |
| Physical Rust files | 2,383 |
| Bytes in those source files | 32,144,811 |
| Operations | 25,668 |
| Invocation sets | 175,669 |
| Fully resolved invocation sets | 7,297 |
| Unresolved invocation sets | 168,372 |
| Supplied named callback bindings | 0 |
| Temporary source relationships | 14,569 |
| Diagnostics | 32 |
| Native JSON output | 42,346,735 bytes |

The three complete local runs took **11.82, 12.72 and 11.65 seconds**, with peak
RSS of **756,208, 756,372 and 756,368 KiB**, respectively (about 739 MiB).
All output bytes matched, with SHA-256:

```text
77b8236e997ff499f70ec020d4f17205834ec07e0174dcc1de83214938d386b6
```

These are release-worker measurements in the local Linux x64 container, with fresh
processes but filesystem caches not flushed. They are not directly comparable to
the CI machine's failure timings. An earlier second control attempt was interrupted
by the orchestration tool's command timeout before emitting output. Its empty
partial files are retained in the evidence and excluded from completed-run counts;
the three listed runs completed with the unchanged worker and unchanged limits.

The 4.15% resolved fraction is **not precision, recall, or runtime coverage**.
Unexpanded macros, method resolution and excluded bodies mean the emitted
invocations are not every Rust invocation. The remaining 1,512 tracked `.rs` paths
must not all be classified as missed production code: the tracked total also
includes tests and other out-of-scope sources. The 14,569 source relationships are
not 14,569 architecture collaborations.

Diagnostics explicitly include unresolved `cfg_attr` module selection in the TUI
terminal probe and voice-host modules, plus unexpanded macro evidence. The current
scan summary does not present this complete coverage information to the user.

### Source witnesses

The emitted records were compared with their pinned source sites, not just counts:

| Source call | Observation |
| --- | --- |
| CLI `load_exec_server_config`, `cli/src/main.rs:2163` | Resolves `find_codex_home` to `core/src/config/mod.rs`. |
| Core wrapper `find_codex_home`, `core/src/config/mod.rs:4788` | Separately resolves its call to `utils/home-dir/src/lib.rs`; the active wrapper is not erased as an alias. |
| TUI `run_main`, `tui/src/lib.rs:1013` | Resolves `startup_orchestration::run_main_inner` to `tui/src/startup_orchestration.rs`. This is source call evidence, not a proof of future polling or task scheduling. |
| Execution `start_thread`, `exec/src/lib.rs:1323` | Leaves `client.request_typed(...)` unresolved, despite a typed `&InProcessAppServerClient` parameter and a visible implementation. |

These witnesses confirm useful supported paths and a practical limitation. They
are a small source review, not compiler-validation of every resolved target.

## Actual Groma integration

The existing source-mode CLI, Bun 1.4.1, and unchanged staged scanner package were
used on the disposable Codex copy. The successful control went through package
registration, the real registry, the adapter's SDK validation, and reconciliation.

| Result | Observation |
| --- | ---: |
| Owned Rust files | 2,383 |
| Owned TypeScript/JavaScript files | 730 |
| Total owned source files in one world | 3,113 |
| Initial architecture elements | 3,452 |
| Architecture relationships | 0 |
| Initial source-mode `groma scan` | 17.17 s |
| Repeated source-mode `groma scan` | 17.81 s |

**711 of the 730 TypeScript/JavaScript files are generated protocol schema files**
in `codex-rs/app-server-protocol/schema/typescript/`. This proves mixed-language
inventory and reconciliation, not discovery of a TypeScript frontend or transport
between independently running services. The initial 3,452 elements are uncurated
scan output, not an approved responsibility-level architecture.

The repeated control scan left all **3,455 map/configuration files byte-identical**.
After removing the reduced-input selection, a real `groma scan` of the full Codex
repository failed with the shared-file error and again left every one of those
3,455 files unchanged. A failed observation therefore did not overwrite the
existing map with partial TypeScript or partial Rust results.

Zero relationships is consistent with Groma's current supplied-named-callback
selection rule and this observation's zero supported callback bindings. The test
did not author relationships to make the output appear more complete. Browser
rendering and watch latency were not tested. These source-mode timings are not a
fresh compiled-Groma or OS portability certification.

## Additional scope checks

Scanning `codex-rs/core/` directly fails because the prototype does not recover
ancestor workspace metadata. It reports an unresolved/defaulted edition as 2015,
although the actual workspace edition is 2024. Cargo supports inherited workspace
metadata; this is a discovery/diagnostic limitation in the prototype, not evidence
that Codex uses Rust 2015. See [Cargo workspace inheritance][inheritance].

The genuinely standalone `tools/argument-comment-lint/` package scans without the
workspace control: 3 files, 23 operations, 172 invocation sets, all unresolved, and
identical bytes in three runs (0.02–0.03 s). This small auxiliary tool is not a
substitute benchmark for Codex's main Rust application.

## Reproduction

Use a fresh pinned checkout and the prebuilt package identified above. Run the
native worker on the repository root and on `codex-rs/`, retaining stderr and exit
codes rather than parsing an empty failure as an observation:

```sh
git clone https://github.com/openai/codex.git codex
git -C codex checkout d6489472f3c15e87d2d7763a5fde033545c530f8
/absolute/path/to/bin/groma-rust-scanner "$PWD/codex" > full.json 2> full.stderr
```

The control can be reproduced without changing a tracked manifest:

```python
from pathlib import Path
import subprocess

root = Path("codex").resolve()
worker = "/absolute/path/to/bin/groma-rust-scanner"
config = root / ".groma-rust.json"
manifest = root / "codex-rs/Groma.research.Cargo.toml"
original = (root / "codex-rs/Cargo.toml").read_bytes()
member = b'    "exec-server/tests/support",\n'
assert original.count(member) == 1
assert not config.exists() and not manifest.exists()
try:
    manifest.write_bytes(original.replace(member, b""))
    config.write_text('{"manifests":["codex-rs/Groma.research.Cargo.toml"]}\n')
    for run in range(1, 4):
        with open(f"control-{run}.json", "wb") as output:
            subprocess.run([worker, str(root)], stdout=output,
                           check=True, timeout=120)
finally:
    config.unlink(missing_ok=True)
    manifest.unlink(missing_ok=True)
```

Do not leave that reduced configuration enabled and describe its map as complete.
The downloadable experiment archive contains raw observations, timings, exit codes,
source hashes, inspected witnesses and before/after map verification records.

## Consequences for production

The immediate full-workspace blocker is shared-source membership versus single
file placement. Member selection must also preserve inherited workspace metadata.
After those discovery issues, production semantic analysis still needs typed
method targets, explicit macro/cfg coverage and a clearly visible analysis profile.
The measured 42.3 MB exchange and roughly 739 MiB native RSS make larger-corpus
end-to-end and incremental measurements necessary before promising interactive
performance. The existing 64 MiB adapter output bound was not exceeded here.

The result strengthens the case for evaluating a pinned rust-analyzer integration,
not for advertising this syntax resolver as production-ready. Its build-script and
procedural-macro controls must be configured explicitly; richer semantics must not
silently execute project code. See [rust-analyzer configuration][ra-config]. No
rust-analyzer comparison or new inference rule was implemented in this pass.

[codex]: https://github.com/openai/codex/tree/d6489472f3c15e87d2d7763a5fde033545c530f8
[package-run]: https://github.com/MrLesk/Groma.md/actions/runs/34168019279
[experiment]: https://github.com/MrLesk/Groma.md/actions/runs/34194154000
[relay-main]: https://github.com/openai/codex/blob/d6489472f3c15e87d2d7763a5fde033545c530f8/codex-rs/exec-server/src/relay_proto.rs
[relay-support]: https://github.com/openai/codex/blob/d6489472f3c15e87d2d7763a5fde033545c530f8/codex-rs/exec-server/tests/support/relay.rs
[inheritance]: https://doc.rust-lang.org/cargo/reference/workspaces.html#the-package-table
[ra-config]: https://rust-analyzer.github.io/book/configuration.html
