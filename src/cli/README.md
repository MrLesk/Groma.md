# Command-line surface

The Iteration 1A CLI is a one-shot adapter over the shared application operations
assembled by the official host. It does not read Markdown intent documents, resource
locators, or the transaction journal directly.

Run `groma --help` for the complete command grammar. Create and update accept one
bounded UTF-8 JSON application request envelope from `--input <path>`, `--input -`, or
`--stdin`. Existing parent changes use `component reparent`; update deliberately rejects
parent changes through the application contract. Every read requires an explicit page
limit and returns one page only. Cursors are printed but never followed implicitly.
Command output is buffered up to one MiB; an oversized page becomes a typed
`cli-output-bound-exceeded` failure rather than partial or streamed output, so callers
can retry with a smaller explicit page.

`--format json` is the stable machine-facing envelope. Each response has `command`,
`exitCode`, `ok`, and `result`; object keys are emitted canonically. Plain output is
deterministic, contains no ANSI styling or prompts, and quotes component-controlled text.
Explicit JSON help and version requests use the same envelope instead of switching back
to plain text.
The exact plain-text grammar remains provisional through Iteration 2 so the human
experience can improve without changing the application contracts or JSON envelope.

Exit classes are stable:

| Code | Class                                          |
| ---: | ---------------------------------------------- |
|    0 | Success                                        |
|    2 | Invalid invocation or structured input         |
|    3 | Workspace missing, incompatible, or conflicted |
|    4 | Semantic validation or revision conflict       |
|    5 | Provider or host infrastructure failure        |
|    6 | Indeterminate commit outcome                   |
|  130 | SIGINT or generic cancellation                 |
|  143 | SIGTERM                                        |

Signal handling stops command-result publication and completes host cleanup promptly.
The shared 1A application operations do not expose a mid-operation cancellation seam,
so an already-started bounded read or mutation is allowed to settle rather than being
force-aborted during local transaction publication.

With no command, an uninitialized workspace prints the exact `groma init` next step and
does not create files. An initialized interactive terminal receives a bounded hierarchy
overview. The overview reads at most 10 roots, 10 children per visited component, four
descendant levels, 50 components, and 50 queries, and reports truncation instead of
following continuation cursors. Bare non-interactive use prints help.
