# PHP scanner

The PHP scanner reads tracked and unignored `.php` files, including PHP embedded
in HTML. It does not require Composer, PHP, WordPress, project dependencies, or
application execution. Discovery matches PHP source directly, even without a
package manifest.

```sh
bun plugins/scanners/php/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/php/dist/package
groma scan
```

The package bundles [php-parser 3.7.0](https://github.com/glayzzle/php-parser/releases/tag/v3.7.0),
a JavaScript parser configured for PHP syntax through 8.4. It includes the parser
license and needs no installation scripts or downloads while scanning. This is
source syntax analysis, not a PHP runtime compatibility check. Newer syntax
outside the bundled parser is unsupported; parser errors fail the observation
rather than publish partial evidence.

## Evidence

The scanner reports one repository source root, exact PHP paths, named functions,
classes, interfaces, traits, enums, and methods. Implemented functions, methods,
closures, and arrow functions produce operation evidence with UTF-16 source
offsets. Calls and constructions within these operations remain unresolved.
Top-level executable statements are inventoried as part of their source file;
they do not create artificial functions.

The repository source root is initial placement evidence, not a claim that every
PHP file belongs to one C4 runtime boundary. Core owns architecture identity and
curation. There is no Composer autoload resolution, include execution, WordPress
hook matching, dependency resolution, or HTTP relationship inference. An import
or include does not associate files into a component. Ordinary OKF Code links
expose file ownership without adding a new architecture level or stored graph.

PHP edits and new files use the shared scanner watcher. Repeated scans preserve
one physical owner and authored architecture. Shared Git boundaries omit ignored
files and dependency/build output directories. Core applies configured source
exclusions. Test source is otherwise treated like other PHP source; projects can
exclude it explicitly.

## Validation

Independent fixtures cover declarations, mixed PHP/HTML, nested function
ownership, exact source locations, unresolved calls, invalid syntax, discovery
without Composer, repeat scans and live source edits. The fresh-checkout package
check removes language tools from PATH and blocks JavaScript network access.
See [local qualification](validation.md) for the Call for Papers example.
