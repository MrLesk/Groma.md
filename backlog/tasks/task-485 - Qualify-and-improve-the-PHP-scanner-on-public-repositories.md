---
id: TASK-485
title: Qualify and improve the PHP scanner on public repositories
status: Done
assignee:
  - '@codex'
created_date: '2026-09-22 20:32'
updated_date: '2026-09-22 21:02'
labels: []
dependencies: []
references:
  - scanners-projects
  - php-src-index
modified_files:
  - test-bun/php-scanner.test.ts
  - plugins/scanners/projects.ts
  - test-bun/php-http.test.ts
  - plugins/scanners/php/src/syntax.ts
  - plugins/scanners/php/src/http-endpoints.ts
  - plugins/scanners/php/src/http.ts
  - plugins/scanners/php/src/http-routes.ts
  - plugins/scanners/php/src/index.ts
  - plugins/scanners/php/src/entries.ts
  - docs/scanners/php/index.md
  - docs/scanners/discovery.md
ordinal: 566000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository PHP scanner exercise after the Python pass. Scan diverse public PHP projects to find real source, routing, client, and lifecycle edge cases; fix verified scanner failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public PHP repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported PHP scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the PHP scanner changes.
- [x] #4 Temporary repository clones are removed after PHP qualification and the results are reported to Alex before work starts on another scanner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build the PHP scanner package and have ten read-only agents clone ten distinct public PHP repositories into separate task-owned temporary directories. Each agent records the commit, exact scan result, and a minimal reproduction for any suspected defect.
2. Compare findings with the PHP scanner guide and existing tests. Fix verified defects in source or HTTP evidence in the PHP scanner; any Groma core change must express a language-neutral rule. Record test authority, wrong result, and coverage gap before adding tests.
3. Re-run affected repositories and bun run check, review simplicity and quality, run the final full-context complexity review, remove the temporary clones, report the PHP result, and pause before another scanner.

Test decision for shared bin source: PHP docs promise tracked/unignored source and Composer bin entries. Composer, CakePHP, and PhpSpreadsheet contain tracked first-party bin sources omitted by the shared projectFiles directory ban; an explicit composer.json bin target therefore produces no PHP entry. Existing PHP tests do not cover a bin directory. Add one small fixture case asserting the source and declared entry are present, then remove bin from the language-neutral shared directory exclusion. C# already excludes generated bin in its own selector.

Test decision for HTTP routes: The PHP guide promises Symfony Route attributes and WordPress register_rest_route methods. phpMyAdmin's unrelated Route attribute yields a false endpoint, Symfony's mapped {slug:post} yields a false constrained segment, and WordPress numeric route groups are mixed with associative options while a missing methods key defaults to GET. Existing php-http coverage has neither case. Add minimal source examples whose wrong endpoint facts are observable, then constrain attribute identity and interpret each router's syntax under its own rules.

Test decision for inherited Slim handlers: The documented Slim Type::class handler should resolve to a body in scanned source. Slim-Skeleton routes to concrete actions that inherit __invoke from an abstract parent in another PHP file, but Groma emits blockers. Existing php-http coverage only has handlers with their own body. Add one two-file source example proving the served operation is the inherited method, then resolve class ancestry in PHP evidence with ambiguity and cycle bounds.

Test decision for PHP 8.1 syntax: PHP's manual permits named arguments after unpacking, but Drupal reproduces a php-parser 3.7.0 false error and no observation. Existing syntax-failure coverage checks only truly malformed source. Add one accepted named-after-unpack case and one rejected positional-after-unpack case so the scanner can admit the valid AST without weakening its fail-closed syntax boundary.

Test decision for shared scanner exclusions: Groma's scanner registry passes a source-exclusion predicate to each scanner. PHP currently ignores it, so an excluded malformed PHP file still aborts the scan. Existing PHP test covers .gitignore but not the registry predicate. Add one minimal excluded malformed source case and pass the predicate through PHP source and Composer-manifest inventory.

Test decision for extensionless PHP commands: Composer declares bin/composer and PHP scripts can name extensionless files, but the PHP .php-only inventory ignores them. The existing bin regression covers only bin/command.php. Extend it with an extensionless Composer-declared PHP command: it must become source and an entry. Inventory only manifest-declared command paths containing a PHP opening tag, so shell commands do not enter the parser.

Test decision for Drupal routes: Drupal's scanned Route attribute extends Symfony's routing attribute and forwards its path, requirements and methods. Its HTTP endpoints disappeared when the PHP scanner correctly rejected unrelated Route names. Existing coverage has Symfony and an unrelated local attribute, but no proven framework subclass. Extend that focused case with Drupal's verified attribute identity and accept its same route contract.

Test decision for namespace route imports: the full-context review reproduced a false endpoint and a missing Symfony endpoint when separate PHP namespace blocks reuse attribute aliases, because one file-wide import map lets the last block control both. The current attribute identity test covers only one namespace. Add one two-namespace case with opposing aliases, then collect imports within each namespace scope without changing scanner or core architecture.

Test decision for extensionless command refresh: the final review found the static PHP watch pattern matches bin/console but misses another supported Composer command at tools/console. The initial command test checks scan output but not live subscription. Extend that fixture with a Composer script naming tools/console, assert it is source/entry evidence, and check the scanner's compiled watch subscription includes that path. Use the existing static watch contract to cover all declared command locations.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification review: ten public repositories were qualified at pinned commits; eight complete scans succeeded, while WordPress and Drupal full scans correctly failed closed on syntax outside the bundled PHP 8.4 parser. Controlled scans excluding only their unsupported files verified WordPress route corrections (1,852 files, 149 endpoints, 62 requests) and Drupal route/parser corrections (10,332 files, 104 endpoints, 7 requests). The supported defects have focused red-to-green tests. Quality review: source discovery belongs to PHP inventory and shared generic project selection; route parsing stays under PHP HTTP modules; core alone interprets C4 relationships. The changed flow from inventory to per-file evidence to endpoint/entry resolution is traceable, and no new function exceeds the complexity limit. Cold simplicity review found no blocker; its one-listing suggestion was applied. Verification: 17 focused PHP tests pass; bun run check passes (671 pass, 38 skip, 0 fail).

Full-context complexity review found two concrete issues: a file-wide PHP import map leaked Route aliases across namespace blocks, and the static watcher missed Composer-declared extensionless commands outside bin/. The first is fixed by namespace-local imports and receiver bindings, with an opposing-alias regression. The second is fixed by watching all unexcluded repository paths while PHP inventory still selects only supported source; a non-bin Composer script and compiled watch matcher are covered. This broad watch can cause extra PHP rescans on non-PHP edits and is documented. A targeted re-review confirmed the namespace correction; the broad watch resolves the remaining path gap.

Repository qualification (pinned HEAD; baseline package before fixes):
- Laravel laravel/laravel aa0cf127fc365a56ee016867144ddffabc2290ae: completed, 27 PHP files, one GET / route; health route and front controllers outside current evidence rules.
- Symfony symfony/demo 8d2e2ef75c3e18df173d8bf2379a14abb58c4c31: completed, 51 files, 19 endpoints; false constrained mapped parameter fixed; YAML route prefix remains outside PHP source scope.
- Slim slimphp/Slim-Skeleton 0ef01549870b3234a3a9f602904a39c3ed73f44c: completed, 31 files, 4 routes; inherited invokable handler fixed.
- WordPress WordPress/WordPress fdeab470f4b4062462cf8ccdc788f258683c2d6f: full scan blocked by parser-incompatible mixed PHP syntax; corrected false REST option blockers and missing default GET, verified with three failing files excluded.
- Composer composer/composer 56a26ff6ad41a8972aae691e82d5a36a31d4684b: completed; extensionless bin/composer now appears as source and entry.
- Guzzle guzzle/guzzle 93939470950a9b11e2e84204166ef5e048c55fe4: completed, 137 files; zero HTTP facts expected from current proved-receiver rules.
- CakePHP cakephp/app 48b1a98b8deac0d629e2afbd9d787c67a1ebb560: completed; tracked bin/cake.php now included; Cake routing outside current framework rules.
- PhpSpreadsheet PHPOffice/PhpSpreadsheet 4fc80fd9a223dde6a27a9792933124ef903e6591: completed; three bin PHP sources and declared script now included.
- phpMyAdmin phpmyadmin/phpmyadmin b442fbfd854a6ba8d511707ee2a6f566702fc744: completed; 195 false Symfony-like routes from its unrelated Route attribute now gone.
- Drupal drupal/drupal b0297e3ff8d2fcee25ce5ccdd808877d54196965: full scan blocked by 14 PHP 8.5 clone() uses; valid PHP 8.1 named-after-unpack parser error fixed, and controlled scan with only those 14 files excluded yields 10,332 files, 104 endpoints, 7 requests.

Final check: bun run check passed with 672 tests passing, 38 skipped, 0 failing after namespace and live-watch fixes. Final controlled Drupal, WordPress and Composer reruns retained their recorded results. Removed /tmp/groma-php-485 and all ten temporary clones. AC4 awaits the report to Alex; task stays In Progress until Alex confirms Done.

Reported the PHP result to Alex, including the two full-scan parser limits and removal of all temporary clones. Alex confirmed completion and requested commit, push, and the Rust scanner next.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Improved PHP source and command discovery, route and handler inference, namespace scoping, parser acceptance, and live command refresh from ten pinned public repository scans. Controlled WordPress and Drupal scans verified the fixes where their full scans hit unsupported parser syntax. All temporary clones were removed; bun run check passed with 672 passing, 38 skipped, and zero failures.
<!-- SECTION:FINAL_SUMMARY:END -->
