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

## Source outline

The web and terminal maps list a PHP file's declarations under the
[shared outline rules](../creating-a-plugin.md#source-outline). The scanner
parses the file with the bundled parser and lists what is declared directly in
the file or in a braced or unbraced `namespace` block:

- functions, including a function declared directly inside
  `if (!function_exists('name')) { ... }` when the guard names that function;
- closures and arrow functions assigned directly to a variable, listed under
  the variable name, such as `$format`;
- classes, interfaces, traits, and enums, with every method as a member,
  including static, abstract, and interface methods and `__construct`.

Top-level declarations are `public`. Members are `private` or `protected` when
declared so, and `public` otherwise. Properties, constants, enum cases, trait
`use` statements, and declarations inside functions, methods, or other
control-flow blocks are not listed. A declaration is marked as
an entry when the component's Code names its scan symbol, such as
`Shop\OrderService` or `Shop\OrderService::store`.

## Compared operations

`groma lint` and scan findings compare PHP operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to:

- functions with a body, including functions declared inside other bodies;
- methods with a body, including constructors and methods of anonymous classes.

Parameters and local variables become slots from their first use, because PHP
variables have function scope. `$this`, superglobals, names declared `global`,
and static properties such as `self::$count` keep their names. A closure body
sees only the variables it imports with `use`; an arrow function body sees the
enclosing variables.

These named operations are not compared:

- closures and arrow functions, including those assigned to a variable or to an
  array key. This is a PHP exception to the shared rule; the scanner treats every
  closure and arrow function as an anonymous callback.

Top-level code and property and constant initializers are not operations and
are not compared.

## Validation

Independent fixtures cover declarations, mixed PHP/HTML, nested function
ownership, exact source locations, unresolved calls, invalid syntax, discovery
without Composer, repeat scans, live source edits, identical,
near-duplicate and renamed bodies found by `groma lint`, and the source outline
of PHP files beside a TypeScript file in one component. The fresh-checkout
package check removes language tools from PATH and blocks JavaScript network
access.
See [local qualification](validation.md) for the Call for Papers example.
