# Java prototype verification

Task: TASK-324. Recorded 7 September 2026 (UTC). See the
[usage guide](index.md) and [research conclusions](research.md).

## Tested environment and delivery

Local Linux x64, Bun 1.4.1, Node 22.16.0, OpenJDK 21.0.11, Groma 0.2.0.
The tests exercised the opt-in package, not an embedded Java scanner or a
published npm release. JDK 21 is also provisioned by the existing CI matrix.
The packaged isolated-PATH smoke is added for Linux/macOS; Windows source
conformance remains in the normal test suite, but its runtime package and
isolated delivery are not certified here.

The code has no new third-party Java dependency. The precompiled worker was
15,970 bytes in this build. A Linux x64 runtime package, packed offline using
npm, was approximately 39.8 MB compressed and 113.1 MB unpacked (decimal units).
Its runtime legal notices are real files, not npm-omitted symlinks. Public
runtime licensing, signing, vulnerability/update policy and platform artifacts
remain release work.

## Objective checks

| Check | Observed result |
| --- | --- |
| `bun test --timeout 20000 test-bun/java-scanner.test.ts` | 10 passed, 0 failed; 47 expectations |
| `bun run check` | Passed: 110 Node tests, 365 Bun tests; typecheck and lint passed with six pre-existing complexity warnings |
| `bun run build` | Built `dist/groma` |
| `bun scripts/smoke-compiled-build.ts dist/groma 0.2.0` | Exit 0 on final standalone invocation |
| `bun plugins/scanners/java/build.ts --runtime` | Produced prebuilt adapter/JAR and linked runtime |
| `npm pack --ignore-scripts --offline` in staged package | Created 157-file platform tarball |
| `bun scripts/smoke-java-scanner.ts dist/groma <extracted-package>` | Passed using the **extracted npm tarball**, not only the staging directory |
| Commons Lang + Petclinic worker output through shared parser | Both valid; adapter output equals raw parsed output |
| Same projects through staged runtime package | Complete object equality with source adapter output |

One combined check/build/web-smoke shell invocation reached the container's
120-second command watchdog after the check/build had completed. The existing
web smoke emitted no diagnostic before termination. A diagnostic copy reached
all stages successfully; the unchanged maintained script then exited 0 in its
own 30-second-bounded invocation. No retry or timeout change was added to the
repository to hide this; no definitive cause was established. An earlier
20-second tool invocation had likewise been too short for the full suite.
These interruptions are not represented as successful test runs.

The ten concurrent language tests cover canonical overload targets, preserved
wrappers, unknown interface/default dispatch, exact final/super dispatch,
unused imports, separate lambdas/initializers, deferred method references,
records and synthetic-tree suppression, no `.class` output, strict missing-type
failure, zero partial stdout, source limits, unsupported release/JPMS rejection,
opt-in behavior, absent worker/runtime, disabled annotation processors, no build
wrapper execution, Java 8/11/21 platform APIs, path escape/unknown-field rejection,
and forced worker termination. Fixtures and subprocesses are test-local; the
compiled worker artifact is immutable during the suite.

The compiled-delivery smoke provides a PATH containing only Git. It unsets Java
home/launcher options and uses a temporary home/project. It compares complete
observations, registers the local package with the actual binary, scans five
source files into seven records, verifies two scans produce byte-identical
architecture, then introduces a missing dependency and verifies the old
architecture remains byte-identical. It does not claim browser rendering review,
registry authentication coverage or Windows execution.

## Public repositories: pinned inputs

Clones were made on an isolated GitHub Actions runner and transferred as a
workspace because direct networking from the local analysis container was
blocked. The source snapshots were not modified except for a local scanner
manifest. Neither repository was copied into Groma's source tree.

| Repository | Exact commit | Selected source roots | Target |
| --- | --- | --- | --- |
| [Apache Commons Lang](https://github.com/apache/commons-lang) | `7aa6bfe4c584d26d65bb6b58905bb5d156c37d04` | `src/main/java` | Java 8, empty dependency classpath |
| [Spring Petclinic](https://github.com/spring-projects/spring-petclinic) | `818c4136ea971c21674525f9053de0d9c7ad8cfe` | `src/main/java` | Java 17, 89 compile-classpath JARs |

The source-list SHA-256 values (sorted newline-delimited relative paths) were:

```text
Commons Lang: ee50b8571ab4ceb2c2d2e66c890abdd66e67c8c1b939edd83da59fd427cb5912
Petclinic:    6cc078e1eb42b4d9b4db0db9e028518ecee2f9f900b2fd47b9a62825f1478280
```

Petclinic without its dependencies failed with exit 2 and **zero stdout**.
In a separate trusted build-model preparation step, the runner executed:

```sh
mvn -B -ntp \
  org.apache.maven.plugins:maven-dependency-plugin:3.11.0:build-classpath \
  -DincludeScope=compile -Dmdep.outputFile=/absolute/path/classpath.txt
```

The resulting 89 JARs were transferred with SHA-256 checksums and all checksums
were verified locally. The checksum manifest itself had SHA-256
`433bb8a9c0ed4a6bce7b946e1e9b12be71c1d8d2c510d9e3cf0a4923273e398f`.
The exact list accompanies the downloadable evidence bundle. This demonstrates
a deliberately trusted Maven step, **not** that loading arbitrary Maven builds
is harmless or that project-model acquisition is implemented in the plugin.

## Measurements

| Observation | Commons Lang | Petclinic |
| --- | ---: | ---: |
| Files | 264 | 30 |
| Source operations | 5,602 | 103 |
| Invocation sites | 10,859 | 243 |
| Sites with supported known source target | 3,998 | 9 |
| Unresolved sites | 6,861 | 234 |
| Distinct directed source-file reference pairs | 987 | 100 |
| Deferred method references | 116 | 1 |
| First measured worker wall time | 6.88 s | 1.07 s |
| Peak worker RSS | 352,588 KiB | 172,020 KiB |

These are one-run wall/RSS observations of fresh JVM processes; filesystem cache
state was not controlled. They exclude checkout/dependency resolution, Groma UI,
other language workers and architecture reconciliation. Follow-up full adapter
calls took 6.23 s and 1.05 s respectively in this environment. They are not an
accuracy score or a promise about larger repositories. No labeled call-graph
ground truth or million-line benchmark was constructed.

Direct worker reproduction after checkout and source-set preparation:

```sh
# In the selected Java checkout. Set GROMA_WORKER to the built worker.jar.
find src/main/java -name '*.java' | LC_ALL=C sort > /tmp/java-sources.txt
# Commons Lang: RELEASE=8, CLASSPATH=''
# Petclinic: RELEASE=17, CLASSPATH=the exported platform-delimited JAR list
/usr/bin/time -v java -Xmx1024m -jar "$GROMA_WORKER" \
  "$PWD" "$RELEASE" "$CLASSPATH" \
  < /tmp/java-sources.txt > /tmp/java-observation.json
```

A normal plugin invocation consumes `groma-java.json`; the raw worker command is
an analysis experiment, not the proposed end-user interface. See the usage guide
for local package registration and the manifest shape.

## Reviews and unresolved gates

The implementer's specification review found objective evidence for all four
prototype acceptance criteria. Quality review preserved strict source-target
semantics and corrected omitted runtime-license symlinks before packing; no
core inference, shared schema or C# changes were made. Two Groma components were
curated through its CLI: Java scanner and Java scanner delivery. Java worker
source remains outside the repository's embedded TypeScript ownership scan;
this branch does not force all Groma contributors to enable its experimental
Java scanner merely to assign those files.

The repository's separate-agent cold simplicity and full-context complexity
reviews have **not** been performed in this environment. The task remains In
Progress for that review rather than being marked Done from passing tests alone.
Production gates are listed in the research report; no unsupported framework,
project type, platform or scale is promoted to supported status by these tests.
