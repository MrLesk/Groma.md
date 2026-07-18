# Automatic-blueprint aha benchmark

This document defines the Iteration 2 quality gate for the first useful Groma experience:

```text
groma init
groma scan
groma
```

The benchmark asks whether those three commands produce an understandable, locally owned,
evidence-grounded main layer within one minute. It deliberately does not define scanner output,
canonical Groma state, reconciliation, or renderer data. The verification-only contract in
[`tests/iteration-2/automatic-blueprint/`](../tests/iteration-2/automatic-blueprint/) records an
assessment of those later systems without becoming a production import.

## What is scored

An automatic blueprint may claim only architecture that a scanner can defend from observable
project evidence. The reference audits use five evidence categories:

- workspace, package, and major production source boundaries;
- public actions such as CLI commands;
- aggregate cross-boundary dependencies;
- Bun routes, including a carefully scoped absence when the complete production tree supports it;
- documentation evidence, identified as documentation rather than source observation.

Names from package metadata, literal import edges, route patterns, and explicit command
registrations are observable. Business responsibilities, conceptual domains, ownership, desired
state, and prose explanations are curated intent. Directory nesting does not by itself prove
conceptual containment. Documentation may corroborate a label or public promise, but a scanner
must retain that provenance and must not silently promote the prose to observed intent.

The audits assign their own `audit.*` fact IDs. Those IDs are benchmark bookkeeping only. They are
not scanner keys, observation IDs, canonical component IDs, or expected renderer node IDs. A
human assessor maps preserved scanner evidence to audit facts after a run; production code must
never recognize the IDs.

Historic hand-curated component, relationship, and root counts are comparison context, not
ground truth. A passing automatic map is not required to reproduce curated names, prose, counts,
or containment.

## Immutable reference audits

Each audit records a repository URL, full Git commit, and tree plus strict portable
workspace-descendant source witnesses. Witness paths use forward slashes and reject absolute or
drive-prefixed paths, backslashes, traversal and dot segments, globs, trailing separators, trailing
dots or spaces, and reserved Windows names. A witness contains the Git blob ID, a SHA-256 content
digest, and a bounded line anchor. Every complete-tree
absence or exact-set fact also records the included and excluded production scope, protected source
roots, the scoped path count and path-inventory digest, and a derivation method whose result digest
binds the ordered fact objects. The combination distinguishes a representative source excerpt from
the complete scope used to derive the fact. This makes an audit reviewable without treating the
current checkout or a self-updating golden as truth.

Source-scope patterns use relative forward-slash Git paths. Leading or trailing slashes, empty,
`.` or `..` segments, backslashes, control characters, drive prefixes, `?`, brackets, braces, `!`,
and escapes are invalid. `*` is the only within-segment wildcard; `**` is valid only as an entire
segment and matches zero or more complete path segments. Matching is case-sensitive, so the
contract has one meaning on every host. Patterns are limited to 1,024 UTF-8 bytes and 64 segments;
candidate Git paths are limited to 4,096 UTF-8 bytes and 256 segments before dynamic-programming
matching begins. The inventory is every pinned-tree blob matched by at least
one include and no exclusion, deduplicated and sorted in ascending raw UTF-8 byte order.
Every include pattern must have a literal directory prefix equal to or below a protected root under
conservative case-insensitive portable comparison. Verification also proves every include-matched
path, before exclusions, and every final inventory path is equal to or below a protected root. An
exclusion therefore cannot hide source that the audit failed to protect.
`pathInventorySha256` hashes the UTF-8 bytes of that inventory's
whitespace-free JSON string array, using ECMAScript `JSON.stringify` string escaping with no
replacer. Fact `derivation.resultSha256` uses the same encoding for the ordered `claim.objects`
array; `createBenchmarkStringArrayDigest` is the executable reference helper. The stored counts and
digests therefore make complete-tree and exact-set claims reproducible without embedding thousands
of paths in the audit.

Each audit also declares any pre-existing Groma-owned path that must be removed to create a blind
fixture. The prepared snapshot is the pinned tree after removing blobs equal to or below only those
declared paths. Its manifest contains one string per remaining blob in the exact form
`<mode> blob <blob-oid>\t<path>`, with entries sorted by `path` in ascending UTF-8 byte order. The
audit records the manifest path count and the SHA-256 of its whitespace-free JSON string array using
the same encoding as `createBenchmarkStringArrayDigest`. Groma declares `groma` because its pin
contains a curated blueprint; Backlog.md declares no pre-existing Groma state. The execution record
must repeat the repository, revision, tree, prepared path count, and prepared snapshot digest, so an
audit ID by itself cannot accidentally score a different checkout.
No declared preparation path may equal, contain, or be contained by a protected source root, fact
witness, or forbidden-claim witness. Audit preparation uses conservative case-insensitive portable
path comparison so a cleanup alias cannot delete scored evidence on another platform.

Verification in CI uses checked-in, bounded Git object proofs rather than the current checkout, a
sibling clone, the network, or the Git executable. Each proof contains the raw pinned commit object,
every tree object reachable from its root tree, and only the unique blob contents referenced by
audit witnesses. The verifier recomputes Git SHA-1 object IDs from the canonical
`<type> <byte-length>\0<bytes>` framing, follows the commit's root tree through every subtree, and
then checks witness path/OID/content/line-anchor bindings. Prepared manifests and source-scope
inventories are recomputed from that same verified tree. Regular (`100644`), executable (`100755`),
and symlink (`120000`) blobs participate; gitlinks (`160000`) do not. This is enough evidence for
the committed claims without embedding either entire repository.

The initial references are:

| Audit                   | Revision                                   | Role                                  |
| ----------------------- | ------------------------------------------ | ------------------------------------- |
| Groma                   | `66fe7c616ccb06f8dbd52cafef006cc77f864217` | Known project and self-scan reference |
| Backlog.md `v1.48.0^{}` | `da0784d41ad3807fdc34e5501afe3fa950deff94` | Held-out TypeScript/Bun reference     |

The Backlog.md tag points to package metadata version `1.47.1`; the audit records both facts
instead of rewriting one to resemble the other. The reference is public and reproducible, not
secret or externally sealed.

Refreshing an audit is a deliberate review event:

1. select and record a new immutable commit and tree;
2. inspect production source from Git objects, excluding the declared non-production scope;
3. re-audit every category, forbidden claim, witness digest, fixture-preparation declaration,
   prepared snapshot digest, and comprehension question;
4. review the audit change independently from scanner output;
5. never update expected facts from the scanner's own result.

The exact local proof-regeneration command and explicit repository arguments are documented in the
[benchmark test README](../tests/iteration-2/automatic-blueprint/README.md). Regeneration is a
generation-time Git operation; ordinary verification remains offline and object-proof-only.

## Held-out reservation

Backlog.md is reserved from scanner-specific tuning even though its audit is committed for
reproducibility. Before starting a held-out run or seeing any scored result from one, freeze the
scanner implementation, configuration, and generic rules. Project names, repository paths, audit
IDs, known route names, or other one-project exceptions are prohibited in scanner code and
configuration.

Scored output may diagnose a failure, but it may not be fed back into scanner tuning. A proposed
generic improvement must first be justified and tested on non-held-out fixtures. Only then may a
new frozen scanner be evaluated in a new held-out run. This is procedural holdout discipline, not
a claim that the committed public repository is unknowable.

## Hermetic execution record

GROM-48 will implement the black-box runner. The runner must produce the neutral assessment
record consumed by this benchmark and enforce these controls:

1. Complete the human ground-truth audit before the run. For the held-out project, freeze scanner
   code, configuration, and generic rules before starting the held-out run or receiving its scored
   results.
2. Copy the exact audited repository, revision, and tree to a fresh workspace and record that
   execution identity. Before the timer starts, remove only the audit's declared pre-existing
   Groma-owned paths. Record the declared and actually removed inventories, verify every declared
   path and all other Groma-owned state are absent before `groma init`, and recompute the prepared
   snapshot path count and digest. A missing record, undeclared cleanup, remaining prior state, or
   digest mismatch fails the run.
3. Still before timing, freeze a pre-run plan containing the prepared snapshot digest, path
   convention, complete Groma-owned output inventory, identical source-hash exclusion inventory,
   and renderer-declared main-layer budget. Record its monotonic freeze time and SHA-256 commitment.
   Hash the prepared source before execution while excluding exactly the committed output inventory.
4. Create a fresh workspace plus distinct temporary `HOME` and configuration roots, close stdin
   for every command, and deny network access at the OS or harness boundary. An application promise
   to stay offline is not sufficient.
5. Start the monotonic timer immediately before spawning `groma init`. Invoke exactly
   `groma init`, `groma scan`, and `groma`, as separate commands and in that order. Preserve each
   argument vector, exit code, stdout, stderr, monotonic start and completion timestamps, working
   directory, effective `HOME`, and effective configuration root. Every command must run in the
   attested workspace with the exact isolated environment roots.
6. Permit no AI call, helper inference, or human correction from the first spawn through scored
   output. The scanner remains blind to the audit and existing blueprint.
7. Stop the timer only when the initial main layer emits a machine-observable frozen signal.
   Freeze its artifact and all scored outputs before any evaluator sees them.
8. Hash source bytes again with the exact same exclusions. The before and after hashes must match.
9. Perform the evidence assessment and human-comprehension evaluation against the frozen outputs.

A human may prepare the ground-truth audit before execution and evaluate comprehension after the
output is frozen. Deterministic fixture preparation is a recorded, audit-declared transformation
that occurs before the timer; it is not human correction of scanner output. No human may choose,
rename, delete, or edit fixture content based on the generated map.

The one-minute interval is exact: from spawning `groma init` through the frozen initial main
layer, at most `60,000` milliseconds. Setup before the spawn and human evaluation after the freeze
do not count. Initial command timestamps use the same monotonic clock: the first start is at or
after the recorded spawn, each completion is at or after its start, every later start is at or
after the prior completion, and all completions are no later than the main-layer freeze. Invalid
timing or any nonzero initial command exit earns no first-minute points. A process failure cannot be
hidden by a later artifact.

The record describes finite command executions. A command that does not exit must be terminated by
the harness's finite process timeout; the harness records its nonzero exit code, preserved streams,
and completion timestamp. This process timeout is operational safety, not a second benchmark time
gate.

The execution record declares whether host absolute workspace and temporary roots use POSIX or
Win32 syntax. All three roots must be normalized, absolute, non-root, and pairwise disjoint under
the declared platform's comparison rules: no root may equal, contain, or be contained by another.
Win32 roots must be drive-qualified (`C:\...`) or normalized non-device UNC paths
(`\\server\share\...`); current-drive root-relative paths such as `\workspace` are not stable
absolute identities and are rejected. Both UNC authority components, server and share, are validated
before the parsed root is removed. They must be nonempty normalized components and obey the same
conservative rule as every descendant component: no dot or dot-dot component, trailing dot or
space, control or Windows-invalid character, or reserved device-name alias. Win32 comparison treats
case and trailing separator aliases as the same path. Extended/device namespaces beginning `\\?\`
or `\\.\` are rejected for all three roots rather than treated as an alternate spelling. An invalid
global root context cannot earn first-minute, repeatability, or stable-identity points.
Groma-owned output and exclusion paths use one portable syntax on every platform: sorted, exact,
nonempty, forward-slash workspace descendants with no trailing slash, `.` or `..` segment, drive
prefix, backslash, glob metacharacter, or other reserved filename character. Prefixes and globs do
not stand in for exact inventory entries. Every fact and forbidden-claim witness is an audited input,
as is every protected source root. Neither the committed nor recorded output inventory may equal,
be an ancestor of, or be a descendant of any audited input under conservative case-insensitive
portable comparison, regardless of the execution host. This protects files such as `package.json`
and `README.md`, evidence directories such as `scripts`, the production tree, and case aliases from
output exclusion.

The plan commitment is SHA-256 over UTF-8 bytes of whitespace-free JSON with this exact key order:
`gromaOwnedOutputPaths`, `pathConvention`, `preparedSourceSnapshotSha256`,
`rendererDeclaredMainLayerBudget` (`nodes`, then `relationships`), `schemaVersion`, and
`sourceHashExcludedPaths`. Arrays retain their already
validated ascending UTF-8 byte order. The commitment and freeze time are record metadata and are
not inputs to the digest. The runner must compare the committed plan to the scored execution and
presentation record so neither exclusions nor the density budget can be chosen after output is
known.

## Repeatability and identity

The runner performs at least two unchanged rescans from the exact prepared fixture. Each rescan is
one ordered record with a unique ID and consecutive ordinal. It binds the prepared snapshot digest,
the actual `groma scan` and `groma` argument vectors, exit codes, stdout, stderr, execution-context
attestations, per-command start/completion timestamps, digest-capture timestamp, and the five
digests produced by that same execution instance:

- raw observation sequence ordering;
- raw observation content;
- stable observation identities;
- stable canonical identities after reconciliation;
- exact canonical bytes.

Both commands must be present and successful for every rescan, and every rescan input digest must
match the audit's prepared fixture. Missing, duplicated, out-of-order, failed, wrong-command, or
wrong-input records earn no repeatability or identity points. Only then must each corresponding
digest remain identical across the records. Combining these checks into one digest would hide
whether ordering, observed content, identity, or canonical serialization drifted, while five
unattached digest arrays could falsely combine evidence from different executions. The contract
therefore keeps the values separate but attached to one rescan instance.

The first rescan command starts at or after the initial main-layer freeze. Each command completes at
or after its start, every next command starts at or after the prior completion, each digest-capture
timestamp is at or after its final command, and the next rescan starts at or after the prior capture.
Rescans deliberately have no 60-second scoring deadline: they measure unchanged-input stability,
while the one-minute constraint applies only to the first useful initial layer. The finite
process-timeout rule still applies to a hung rescan command.

Stable audit fact IDs do not satisfy the identity checks. The runner hashes the scanner and Groma
identities actually emitted by the system under test.

## False claims, coverage, and provenance

A false claim assessment retains the claim text and raw evidence that caused the assessor to mark
it false. It may link to predeclared audit forbidden-claim IDs; every supplied link must resolve,
and the audit's severity takes precedence over the run's bucket. Exact forbidden text is checked
against every emitted claim, including a claim reported as successfully assessed and mapped to an
audit fact. A claim placed in the noncritical bucket is therefore still critical when it links to a
critical forbidden claim. An exact match for predeclared forbidden text inherits that severity even
if the link was omitted or the claim was not placed in a false-claim bucket. Critical false claims
include invented business meaning, fabricated relationships, incorrect major boundaries, and
unsupported implemented surfaces. Explicit uncertainty is not a false claim when the map does not
assert the missing meaning.
An assessed claim that exactly matches noncritical forbidden text receives the same two-point
false-claim deduction as one noncritical false-claim record, but it is not a conjunctive failure.

Passing requires zero critical false claims and complete coverage of every audit fact marked
`required`. In particular, the audited major workspace/package/source boundaries and their
aggregate cross-boundary dependencies are conjunctive gates. A high score elsewhere cannot
compensate for missing either one.

Every in-scope automatic claim, including a claim later assessed as false, must have valid
structured evidence. Assessed and false claim IDs are globally unique and disjoint. Provenance is
complete only when the complete emitted claim inventory and the IDs with valid witnesses are the
same nonempty set.
Every recorded claim-evidence `sourcePath` uses the same strict portable workspace-descendant
syntax as audit witnesses. The scorer derives valid provenance from evidence rather than trusting
the declared valid-ID list: assessed evidence retains a required observation ID, source path, and
`source` or `documentation` provenance kind, while a false claim needs at least one evidence record
containing both observation ID and source path. Every mapped audit fact is authenticated
independently. A `documentation-evidence` fact requires documentation-kind evidence at one of that
fact's exact witness paths; every other category requires source-kind evidence at one of its exact
witness paths. One evidence record may back multiple facts only when each fact authenticates that
same path. A broad claim with evidence for only some mapped facts contributes only those facts to
coverage and receives no claim-level provenance credit. Raw scanner evidence remains available
alongside the assessment rather than being replaced by the score.

The provenance score denominator is every emitted assessed or false claim, never a self-declared
subset. An emitted claim contributes to the numerator only when its structured evidence is valid
and both declared provenance inventories contain its ID. Truncating either inventory therefore
retains the completeness failure and proportionally reduces diagnostic provenance points.

## Bounded initial main layer

The renderer commits its own node and relationship budgets for the initial main layer in the
pre-run plan. The benchmark requires positive declared limits, verifies that the scored declaration
matches the commitment, and verifies that the frozen layer stays within them. It does not choose
numeric production budgets: the renderer prototype and later density work own that product
decision.

The machine freeze signal is exact and binds the scored artifact and monotonic freeze time:
`main-layer:frozen:sha256-<artifact-sha256>:monotonic-ms-<freeze-time>`. A missing or malformed
signal, or one naming a different artifact digest or time, fails the machine-freeze gate and earns
no first-minute points.

Focus, expansion, folding, and detail views may exist, but they are unavailable during initial
comprehension scoring. The first frozen layer must expose at least one uncertainty or coverage gap
using text, shape, or both. Color may reinforce the signal but cannot be its only carrier. These
are presentation checks only; budget and view state never enter canonical meaning.

## Unaided comprehension

After the artifact is frozen, an evaluator with no prior knowledge of the project answers the
audit's predeclared questions. The evaluator receives only the frozen initial main layer: no agent,
raw JSON, source tree, focus view, expansion, evidence panel, or prose explanation.

The comprehension record includes the SHA-256 of the exact main-layer artifact shown to the
evaluator. It must equal the frozen presentation artifact digest; otherwise the result earns no
comprehension points even when the answers themselves are correct.

Only required question IDs present in both the answered and correct inventories earn comprehension
points. All required questions must be answered correctly with no critical misunderstanding.
Questions cover the major boundaries, their cross-boundary relationships, and the observable public
surfaces. The benchmark records the material shown, question IDs answered, correct IDs, and any
critical misunderstanding. It does not collect or score invented architectural prose.

## Score and conjunctive pass gates

The score is diagnostic and totals 100 points:

| Dimension                                                     | Points |
| ------------------------------------------------------------- | -----: |
| False claims                                                  |     20 |
| Required observable-fact coverage                             |     20 |
| Raw repeatability                                             |     10 |
| Observation identity, canonical identity, and canonical bytes |     15 |
| Provenance                                                    |     10 |
| First-minute completion                                       |     10 |
| Presentation budget and visible uncertainty                   |      5 |
| Unaided comprehension                                         |     10 |

`passed` is true only when every applicable gate passes. The scorer emits stable failure codes and
evidence for all failures in a fixed order; it does not stop at the first one. This prevents strong
coverage, speed, or presentation from compensating for a critical false claim, unstable identity,
mutated source, network access, hidden uncertainty, or failed comprehension.

The verification-only tests validate both immutable audits and independently break every pass
gate. Run them with:

```sh
bun test tests/iteration-2/automatic-blueprint
```

The normal `bun run check` also discovers these tests and checks this document and the JSON audits
through the repository's existing formatting scope.

## Non-goals

This benchmark does not:

- define scanner or reconciliation schemas;
- implement `groma scan`, the CLI workflow, a renderer, or the GROM-48 release harness;
- choose main-layer, focus, or expansion numeric budgets;
- define organization-scale fixtures;
- write canonical Groma state or presentation coordinates;
- infer intent from documentation or source layout;
- update its own expected facts from a scanner result.
