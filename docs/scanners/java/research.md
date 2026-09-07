# Java scanner research and production plan

Research date: 7 September 2026 (UTC). Task: TASK-324.
[Usage](index.md) · [Experiment and verification record](validation.md).

## Decision

Use a small, out-of-process `javac` worker behind Groma's existing scanner module
contract. Distribute a precompiled JAR and adapter, with an optional
platform-specific compiler runtime. Keep project-model acquisition separate
from source analysis. Start the production product with **ordinary pure-Java
Maven projects and explicitly selected source sets**, then add Gradle through a
reviewed build-model exporter. Do not advertise universal JVM-project support.

The prototype establishes extraction, failure handling and standalone delivery.
It is not production-ready: automatic build models, useful Java relationship
selection, large-workspace caching, modern release coverage and packaged
multi-platform certification remain gates. There is no public npm release.

## What Groma actually needs

The investigation covered the manifesto, contributor/agent guidance, scanner
manual and API, relationship-inference and architecture-findings documents,
TypeScript and C# adapters, plugin registry/installation, scan reconciliation,
and compiled-delivery tests. Their responsibilities are already separated:

```text
source/build context → temporary language facts → shared core policy
                    → curated file ownership → OKF architecture Markdown
```

A scanner supplies a complete file inventory, one placement per file, local
symbols, closed relationship endpoints, optional operations/invocations, and
deterministic diagnostics. It neither reads architecture prose nor assigns C4
IDs. Files are atomic; existing curated ownership wins. Failure across any
configured scanner prevents reconciliation, so a missing classpath cannot be
interpreted as a dependency disappearing. Relevant contracts are the
[plugin guide](../creating-a-plugin.md), [evidence semantics](../evidence.md),
[shared schema](../../../packages/scanner/src/index.ts), and
[current inference rule](../../relationship-inference.md).

**The largest product constraint is not the parser.** Core currently selects
only a concretely supplied named callback, with binding location, known provider
alternatives, no unresolved alternative and one different provider owner.
Ordinary calls are not selected. Java's common controller → service → repository
pattern therefore needs both better provider evidence and a reviewed shared
selection example. Adding thousands of imports to the map would bypass the
accepted product direction, not complete Java support.

No schema expansion is necessary for this prototype. Opaque source-local IDs
identify executable operations; every target is another operation in the same
observation. Unbound alternatives stay unresolved. Body tokens are omitted,
because pretending Java identifier spelling is binding-normalized would corrupt
duplicate-code findings. Existing validation also couples ranges to tokens;
range-only export needs a separate contract decision.

## Analyzer choice

| Option | Strength for Groma | Cost or limit | Decision |
| --- | --- | --- | --- |
| JDK compiler `JavacTask` + `Trees` | Compiler-backed overload/type binding; Java source locations; no third-party Java analysis library | Requires a compiler runtime and correct compilation environment; incomplete source must not masquerade as complete evidence | Implemented baseline |
| Eclipse JDT Core | Source/binary binding environment and explicit recovery APIs; worth testing for editor-style incomplete code | Recovered bindings are incomplete, not verified implementations; more packaged dependencies | Best alternative to evaluate if strict compiler failures make watch unusable |
| JavaParser + Symbol Solver | Convenient source AST and configurable type solvers | Another parser/solver compatibility surface to validate across language versions and build contexts | Not selected without a conformance advantage |
| SootUp call-graph analysis | Explicit CHA/RTA-style target analysis | Broader target sets and analysis setup do not by themselves establish source ownership or C4 meaning | Later offline comparison, not a default startup dependency |

The [JavacTask API][javac-task] separates parse, analyze and code generation.
The worker invokes the first two only. [Trees][trees] connects source paths to
language elements. [JDT's API][jdt] documents its explicit classpath/sourcepath
environment and incomplete recovered bindings. [JavaParser][javaparser] offers
separate parsing and symbol-solver facilities. [SootUp][sootup] documents call
graph alternatives. This is an architectural assessment, **not a measured
head-to-head accuracy or performance ranking**; only the javac prototype was run.

## Three Java environments, not one

The scanner's own runtime, the source project's target platform, and the JVM
needed to evaluate its build are different concerns. The implemented worker is
compiled for JDK 21. The selected source set explicitly requests Java 8, 11, 17
or 21 through `--release`; the operator's PATH does not choose its API universe.
The [javac manual][javac] describes platform targeting and annotation-processing
controls. A Gradle build may require another JVM from the one used by the
scanner. Never change the developer's global `JAVA_HOME` to resolve that.

Production should add a separately validated Java 25 lane before claiming broad
current enterprise coverage. Preview features require explicit versioned scope,
not automatic enablement. Legacy JDK 6/7, Java EE boot-classpath peculiarities,
Android's `android.jar`, JPMS module paths and multi-release JAR behavior require
separate fixtures and support statements. Scanner-runtime upgrade and project
language-version upgrade must remain independent operations.

The linked runtime includes `java.se`, `jdk.compiler`, `jdk.zipfs`, and the
build JDK's `lib/ct.sym`. `ct.sym` is essential to the tested older-release API
checks and was copied explicitly because it was absent from the linked image.
`jdk.zipfs` supplies JAR filesystem support to the compiler, as noted in the
[compiler module documentation][compiler-module]. The initial image prioritizes
correct platform availability over minimum download size. [jlink][jlink]
provides the runtime-image mechanism; it does not solve project dependencies.

## Project-model support is a separate subsystem

### Maven first

Do not treat `pom.xml` as a flat dependency list. Parent inheritance, properties,
profiles, dependency management/BOMs, scopes, reactor projects, source roots,
generated sources, exclusions and toolchains affect the effective compilation
context. Maven's [POM][pom], [profile][profiles] and
[dependency-mechanism][maven-deps] references describe these model dimensions.
A library module is not automatically a separately deployed C4 container, and
an aggregator POM may contain no Java source at all.

A production Maven exporter should produce one explicit source-set record per
selected module/configuration, with language/API target, ordered classpath,
source/generated roots, dependency identities and model fingerprint. Resolve
reactor source relationships using those records rather than compiling every
`.java` under the checkout as one project. Keep main/test/integration-test scopes
separate. Preserve duplicate fully qualified names when they belong to distinct
compilation contexts instead of silently selecting one.

The research used Maven's [build-classpath goal][classpath] in a separate,
explicitly trusted step for Petclinic. That command is not implemented as an
automatic scanner feature and is not a full Maven model exporter. The scanner
consumes already available JARs and does not build Petclinic. Missing JARs cause
an atomic failure. Fresh-clone convenience requires an explicit dependency
resolution action with network/proxy/offline behavior, not a hidden download in
watch mode.

### Gradle second

Gradle source sets and their compile classpaths are explicit concepts in its
[Java plugin][gradle-java]. Use the [Tooling API][gradle-tooling] or a pinned
exporter to obtain the configured model; do not infer Groovy/Kotlin build-script
meaning with regular expressions. The Tooling API operates with Gradle builds
and daemons. Model acquisition must be treated as executing repository build
logic, with a trust decision, version/Java compatibility checks and bounded
process lifetime. Wrapper checksums and distribution verification belong to
that boundary. An offline flag is not a code-execution sandbox.

Initially exclude composite builds, Android variants, Kotlin/Scala/Groovy joint
compilation, custom source-set graphs and code-generating plugins unless their
actual compilation model is exported and tested. An explicit manifest can
represent a compatible Java subset; it does not certify its surrounding build.

### Annotation processors and generated code

Annotation processing is disabled twice: `-proc:none` and an empty processor
list. A regression places a throwing processor on the classpath and confirms it
never executes. No Maven/Gradle wrapper or application entry point is invoked.
The worker also snapshots parsed tree identities before attribution, avoiding
synthetic default constructors and record members added by the compiler.

[Lombok][lombok] participates in compiler processing; missing its transformations
can prevent attribution. MapStruct/JPA metamodel and other generated-code users
similarly need an explicit trusted generation/export workflow. Do not run all
processors merely to increase call counts. Distinguish compiler-created trees,
generated source selected by the operator, and authored source in a future
manifest; source provenance needs a concrete shared-contract example before
becoming another generic schema taxonomy.

## Java relationships: what can be asserted

[Java's invocation specification][jls] distinguishes compile-time selection
from runtime method lookup. Binding an overloaded interface method establishes
a declaration, not the injected implementation. The prototype therefore uses
compiler elements for identity but a separate conservative dispatch predicate
for provider targets.

| Construct | Current evidence | Required caution |
| --- | --- | --- |
| Used imports, same-package and fully qualified type/member uses | Source-file reference | Not an operation or network interaction; unused imports are ignored |
| Static/private/final call or explicit constructor | Known source operation when its authored body is selected | Reachability is not proven; external/native/generated implementations stay unknown |
| `super.method()` or direct `new T().method()` | Supported exact source target | Active wrappers remain operations; constructors do not stand in for all initializer effects |
| Interface or other overridable receiver | Unresolved invocation | One visible implementation is not a closed-world proof |
| Lambda | Separate operation and calls inside its body | Its creation does not prove invocation; argument-to-parameter propagation is not implemented |
| Method reference | Deferred source reference | Do not emit a call at reference creation; actual callback dispatch is unmodeled |
| Field and class initializer | Separate executable operation | No complete initialization-order graph is claimed |
| Inheritance, annotations and generics | Compiler-bound source references | Type compatibility does not identify a runtime object |

Generics, overload selection, boxing and varargs should be tested through
compiler-selected executable elements, never name/arity string matching.
Reflection, `MethodHandle`, `ServiceLoader`, JNI, proxies, serialization hooks,
ORM enhancement, AOP and dynamically generated classes must remain unknown
unless a reviewed model establishes their effects. Stream callbacks and
executors especially require evidence of dispatch, not merely an argument.

For Spring, start with a narrow reviewed constructor-injection example with
explicit `@Bean` factories and supported receiver origins. Extend only after
counterexamples involving profiles/conditions, qualifiers, primary/fallback
selection, collections, factories and bean mutation. Spring's
[qualifier documentation][spring-qualifiers] explains that matching narrows type
candidates rather than universally naming one bean. Its [proxy documentation][spring-proxies]
shows why the receiver can be a JDK dynamic proxy or generated subclass.
Do not claim controller → repository → database runtime communication just
because `@Repository` or `JpaRepository` appears in the source.

HTTP/RPC/message-bus joins are a later shared evidence example. They need the
receiving application identity, protocol and configuration, not equal route
strings or a matching topic name alone. Until then, human/agent-authored
relationships carry this domain meaning. Keep deployment and runtime-observation
evidence distinguishable from static possibilities.

## Results and the production implication

The two pinned repositories deliberately contrast a source-heavy library and a
framework-driven application. Commons Lang produced 3,998 known source-target
invocations out of 10,859; Petclinic produced 9 out of 243 with its correct
89-JAR classpath. All other calls remained unresolved. These ratios measure this
extractor's **coverage**, not accuracy: external library calls are included in
the unresolved denominator, and the full provider set was not manually labeled.

Single-process cold-worker commands took 6.88 seconds / 344.3 MiB peak RSS for
Commons Lang and 1.07 seconds / 168.0 MiB for Petclinic. These are observations,
not a cross-machine SLA. Subsequent complete adapter calls also matched the
packaged runtime's observations exactly. Details, source SHAs and commands are
in the [verification record](validation.md).

This evidence supports javac as a credible baseline, but rejects two shortcuts:
“successful compilation means Spring relationships are resolved” and “a medium
library proves enormous-repository performance.” No million-line benchmark,
interactive browser timing, Android test or automatic multi-module scan was run.

## Large repositories and live updates

Production should bound work by compilation context rather than arbitrary file
chunks; splitting a mutually dependent source set destroys binding context.
Analyze selected modules with bounded concurrency, reuse verified binary
summaries for unaffected dependencies, and commit only after every required
module result is complete. A failed module is not permission to delete its old
architecture or to emit a mixed partial result as complete.

Cache keys should include engine/runtime identity, target release, source
content, effective build-model identity, ordered dependency content hashes,
processor/generator policy and exclusions. Invalidate downstream consumers when
public APIs or dependencies change. Do not cache only on timestamps or paths.
Discard stale generations after concurrent edits; file capture and dependency
snapshots need consistency checks. The prototype reads live files and does not
yet provide a transactional source snapshot or an incremental cache.

Its file/heap/output/watchdog limits fail the entire observation; they do not
truncate target sets. The file list uses stdin to avoid command-line limits,
but the classpath still uses an argument and can hit OS argument-length limits.
A versioned length-delimited input protocol is preferable for production.
The 64 MiB buffer and JSON materialization also need streaming/capacity tests.
JVM startup per watch event is measurable overhead; a reusable worker is worth
considering only with reliable cancellation, isolation and memory reclamation.

## Global-tool installation and supply chain

Keep the core executable small and its TypeScript scanner embedded. Install
Java only when requested. Groma already installs exact npm scanner specs into
its shared cache and disables lifecycle scripts; its standalone executable can
host the installer through Bun's embedded runtime. Scanner packages must not
require Node, a globally installed npm/Bun, `postinstall`, or a project checkout
to compile a worker.

The prototype's concrete payload is bundled ESM + precompiled JAR + optional
platform runtime. A fresh standalone-PATH test validates source/package equality,
`scanner add`, two complete scans, and preservation after failure. The Linux x64
npm tarball was also created offline and measured at about 39.8 MB compressed /
113.1 MB unpacked. Runtime licenses are materialized rather than left as symlinks
that npm packing would omit. This is a local development payload, not a legally
or operationally certified public runtime distribution.

Recommended production interface: a canonical exact-version Java package with
platform optional dependencies, plus an explicit bring-your-own-JDK variant.
A friendly `groma scanner add java` alias and `scanner doctor java` would improve
onboarding, but **neither command is implemented by this work**. Until published,
use the real local-package commands in the [usage guide](index.md).

The managed path should install a matching runtime automatically as package
data, without modifying global Java settings or requiring administrator rights.
Separate runtime/compiler installation from project-library resolution. The
latter can require a proxy, credentials, trusted build evaluation or unavailable
private dependencies; downloading a JDK cannot solve it.

Before release, require exact artifact identities, checksums/signatures or
attestations, SBOM and vendor/license review, an update/CVE policy, corrupted
cache recovery, concurrent-install atomicity, offline mirrors and GC/uninstall
behavior. [Adoptium's archive guidance][adoptium] covers integrity verification
for its distributions; choosing a vendor does not eliminate Groma's release
responsibility. OS/CPU, glibc/musl, executable permissions and macOS signing must
be tested for each advertised package. Current Groma macOS distribution targets
Apple Silicon; do not quietly promise Intel support.

A readiness command should actually check compiler availability, platform API
support, source-set count and dependency readability without running project
code. The current `scanner list` package-presence status does not do this.
Errors should distinguish missing runtime, unsupported platform, missing
classpath, invalid source and analysis limits; the prototype's broad error
message is actionable but still coarser than this proposed doctor experience.

## Graduation gates

1. Review the current prototype and freeze the no-false-provider fixture contract.
   Add broader generic/varargs, records/compact constructors, anonymous/nested
   classes, encoding, symlink, huge-file and JVM-version conformance witnesses.
2. Implement the pure-Java Maven effective-model exporter and per-module source
   identity. Add multi-module examples with conflicting dependencies and a
   missing-module failure that preserves the old complete architecture.
3. Review one Java callback/receiver-origin example through the existing core
   semantics, or separately approve a shared direct-service-operation selection
   rule. Measure provider correctness and statement correctness independently.
4. Certify platform npm payloads and exact JDK lanes, including Java 25 support,
   trust/installation UX, package integrity and version/update policy.
5. Validate large selected workspaces, repeat-scan latency, peak aggregate memory,
   cancellation, concurrent edits, deterministic cache invalidation and offline
   operation. Then add Gradle models and framework adapters one tested scope at
   a time rather than relabeling unsupported cases as success.

These are release gates, not claims completed by TASK-324. The review branch
contains the research prototype and its current limitations intentionally.

[javac-task]: https://docs.oracle.com/en/java/javase/21/docs/api/jdk.compiler/com/sun/source/util/JavacTask.html
[trees]: https://docs.oracle.com/en/java/javase/21/docs/api/jdk.compiler/com/sun/source/util/Trees.html
[jdt]: https://help.eclipse.org/latest/topic/org.eclipse.jdt.doc.isv/reference/api/org/eclipse/jdt/core/dom/ASTParser.html
[javaparser]: https://github.com/javaparser/javaparser
[sootup]: https://soot-oss.github.io/SootUp/latest/callgraphs/
[javac]: https://docs.oracle.com/en/java/javase/21/docs/specs/man/javac.html
[jlink]: https://docs.oracle.com/en/java/javase/21/docs/specs/man/jlink.html
[compiler-module]: https://docs.oracle.com/en/java/javase/21/docs/api/jdk.compiler/module-summary.html
[jls]: https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html
[pom]: https://maven.apache.org/pom.html
[profiles]: https://maven.apache.org/guides/introduction/introduction-to-profiles.html
[maven-deps]: https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html
[classpath]: https://maven.apache.org/plugins/maven-dependency-plugin/build-classpath-mojo.html
[gradle-java]: https://docs.gradle.org/current/userguide/java_plugin.html
[gradle-tooling]: https://docs.gradle.org/current/userguide/tooling_api.html
[lombok]: https://projectlombok.org/contributing/lombok-execution-path
[spring-qualifiers]: https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired-qualifiers.html
[spring-proxies]: https://docs.spring.io/spring-framework/reference/core/aop/proxying.html
[adoptium]: https://adoptium.net/en-GB/installation/archives
