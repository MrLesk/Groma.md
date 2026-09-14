# Python scanner

The official `@groma/scanner-python` plugin reads Python source through the
standard library's `ast` parser. It requires Git and Python 3.11 or newer;
the selected interpreter must understand the project's syntax. It does not
import project modules, execute source, install dependencies, or evaluate
`setup.py`. [Python parser documentation](https://docs.python.org/3/library/ast.html).

## Install and scan

For a published release:

```sh
groma scanner add @groma/scanner-python
groma scanner check
groma scan
```

For local development, build a runnable package from the Groma repository,
copy that package into the consumer repository, and add its relative path:

```sh
bun plugins/scanners/python/build.ts /tmp/python-scanner
# In the consumer repository, after copying the folder to tools/python-scanner:
groma scanner add ./tools/python-scanner
groma scanner check
groma scan
```

The default executable is `python3` on Unix and `python` on Windows. To select
another interpreter, set `settings.python` on the Python entry in the existing
`scanners.json`, for example `{"python": "/path/to/python3.14"}`. An executable
name resolves through PATH; a relative executable path resolves from the
repository root. Groma launches it in isolated mode. No project environment
or installed Python packages are needed for syntax analysis.

## Source evidence

The scanner reads Git-tracked and unignored untracked `.py` files. It excludes
shared generated/dependency directories, `.venv`, `venv`, `__pycache__`, `test`,
`tests`, `test_*.py`, `*_test.py`, and `conftest.py`. It scans neither `.pyi`
stubs nor notebooks. Configure additional exclusions through the shared
Groma scanner settings.

`pyproject.toml`, `setup.py`, `setup.cfg`, and `requirements.txt` identify source
projects. A file belongs to its nearest containing project; nested project roots
retain their parent links. Source outside those declarations belongs to one
repository source group. A `pyproject.toml` project name supplies the root name
when present; otherwise the directory name is used. These are source groupings,
not evaluated Python distributions. Discovery reads these declarations without
loading the plugin. Source-only repositories can add the plugin explicitly.

Each file has one record with named classes and functions, including methods,
async functions and nested declarations. Functions also provide operations and
exact UTF-16 source positions. Calls in their bodies identify the owning
operation, call position, line and member name when present. Every call target
is unresolved: Python runtime binding is outside this parser's evidence.
Decorators, defaults, annotations, module/class initialization, lambdas and
lazy generator expressions do not provide invocation evidence. Imports,
framework wiring, concrete callbacks and normalized body tokens are not
analyzed. This version produces no derived call relationships or duplicate-body
findings. Every observation includes a `PYTHON_SYNTAX_ONLY` diagnostic.

Source is parsed and compiled for syntax and scope validation, but the code
object is never executed. Invalid source or project TOML fails the whole Python
observation. Other healthy scanners follow Groma's existing failure isolation.
Install the interpreter required by the source and correct reported errors
before scanning again. Readiness checks source availability and the interpreter;
full syntax validation happens during the scan.

## Architecture meaning

Python roots, symbols and operations are temporary scanner evidence. They add
no OKF record type or C4 containment level. Groma core owns initial placement
and preserves curated file ownership. Ordinary Markdown and OKF readers see
the existing architecture records and Code links with scanner ID `python`.
Framework dependencies and imports alone do not establish C4 collaborations.
The same rules apply across Python projects, without assuming a web framework
or directory layout.

See [local qualification](validation.md) for exercised projects and limitations.
