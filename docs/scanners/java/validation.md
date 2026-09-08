# Java scanner validation

TASK-326.4 reuses `Declarations.java`, `Uses.java`, `Json.java`, `Main.java`, the
adapter/package structure and independent semantic fixtures from
`origin/research/java-scanner-prototype`. The prototype's manual source/JAR
configuration and bundled-runtime delivery were replaced by Maven model export
and the consumer's installed JDK. The research branch's Petclinic experiment
established that Maven classpath resolution and compiler attribution are separate
from proving Spring runtime relationships. That distinction remains unchanged.

## Focused behavior

```sh
GROMA_TEST_MAVEN=/absolute/path/to/mvn bun test test-bun/java-scanner.test.ts
bunx biome lint plugins/scanners/java test-bun/java-scanner.test.ts
bun run typecheck
```

The independent fixture tests overload identity, an active wrapper, unresolved
interface dispatch, exclusion of synthetic record operations, deferred method
references, failed attribution, missing JDK/Maven, Maven-selected custom source
roots, repeated deterministic output and Java 25 flexible constructor bodies.
Every test owns its temporary files and worker. The Maven integration case needs
prepared plugin dependencies and is selected by `GROMA_TEST_MAVEN`; compiler tests
require the installed JDK. No automated test reads callforpapers or live Groma
architecture.

## Acceptance project

On 8 September 2026, a temporary copy of callforpapers was prepared without its
Git metadata, architecture state, node_modules or build output. The original
project was not changed. Its own wrapper selected Maven 3.9.15, running Oracle
JDK 25.0.1 on macOS arm64. The preparation command was:

```sh
./mvnw -B -ntp help:effective-pom -Doutput=/tmp/groma-java-effective.xml \
  dependency:build-classpath -Dmdep.outputFile=/tmp/groma-java-classpath.txt \
  -DincludeScope=compile
```

Maven preparation succeeded in 2 minutes 10 seconds. No broad build or annotation
processing was needed. The plugin's offline scan returned 665 Java main-source
files, 6,794 operations and 17,760 invocation observations. These counts describe
coverage, not the accuracy of unreviewed runtime relationships.

Compiled Groma was built with `bun scripts/build.ts /tmp/groma-java-acceptance-bin`.
The temporary project was initialized, the built Java package added through
`groma scanner add`, and `groma scan` completed with Java and embedded TypeScript.
The Java portion therefore runs through the real compiled module host, without
requiring a runtime TypeScript dependency or compiling the worker at installation.

CompanyResource's call to CompanyService.mergeCompanies is an unresolved virtual
invocation. This is intentional: compiler type binding does not prove the
concrete Spring receiver. The scanner preserves the source inventory needed for
curation without inventing a Java/Angular HTTP relationship.

The separate `plugins/scanners/java/smoke.ts` consumer check is designed for the
same release journey on macOS, Linux and Windows. Only the locally executed
platform may be claimed as passed; Windows command quoting is additionally
covered by a unit test. Platform execution and public publication remain under
TASK-326.7.

## Compiled export correction

The initial compiled scan passed with both Java and TypeScript, but that did not
prove exported Code details. Coordinator review later reproduced an export
failure: the separate source-structure reader created a TypeScript API client
without the bundled worker path and attempted to read `/$bunfs/package.json`.
The scanner's worker selection was already correct. The reader now reuses the
same `typescriptWorkerPath` helper, with no build or scanner-evidence change.

The Java consumer smoke now includes the existing independent one-function
TypeScript fixture and checks its parsed declarations in the exported snapshot.
It reproduced the failure against the old binary and passed against the fixed
binary. All six focused source-reader tests passed. The fixed compiled
callforpapers scan created no new component and refreshed 1,195 source components;
its export completed with 1,200 elements, 451 parsed TypeScript source files and
1,195 source reads. The reviewed artifact is
`/tmp/groma-java-review-export-fixed`, built with
`bun scripts/build.ts /tmp/groma-java-export-fixed`. These local results do not
replace Windows/Linux consumer qualification.
