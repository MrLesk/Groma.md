"""Read Python syntax without importing or executing the inspected project."""
import ast
import io
import json
from pathlib import Path, PurePosixPath
import sys
import tokenize
import tomllib


def parent_project(directory, projects):
    for parent in PurePosixPath(directory).parents:
        if str(parent) in projects:
            return str(parent)
    return None


def source_roots(files):
    projects = {}
    for file in files:
        location = PurePosixPath(file)
        if location.name not in {"pyproject.toml", "setup.py", "setup.cfg", "requirements.txt"}:
            continue
        directory = str(location.parent)
        if directory in projects:
            continue
        name = location.parent.name or Path.cwd().name
        if location.name == "pyproject.toml":
            with open(file, "rb") as stream:
                metadata = tomllib.load(stream)
            name = metadata.get("project", {}).get("name", name)
        projects[directory] = {"id": directory, "kind": "project", "name": name, "file": file}
    memberships = {}
    for file in files:
        if not file.endswith(".py"):
            continue
        directory = str(PurePosixPath(file).parent)
        owner = directory if directory in projects else parent_project(directory, projects)
        if owner is None:
            owner = "."
            projects.setdefault(owner, {"id": owner, "kind": "source-group", "name": Path.cwd().name})
        memberships[file] = owner
    for directory, project in projects.items():
        parent = parent_project(directory, projects)
        if parent is not None:
            project["parent"] = parent
    return list(projects.values()), memberships


class Evidence(ast.NodeVisitor):
    def __init__(self, file, source):
        self.file = file
        self.lines = io.StringIO(source, newline="").readlines()
        self.offsets = [0]
        for line in self.lines:
            self.offsets.append(self.offsets[-1] + len(line.encode("utf-16-le")) // 2)
        self.scope = []
        self.caller = None
        self.symbols = []
        self.operations = []
        self.invocations = []

    def position(self, node):
        # Python columns count UTF-8 bytes; the observation contract counts UTF-16 units.
        prefix = self.lines[node.lineno - 1].encode("utf-8")[:node.col_offset].decode("utf-8")
        return self.offsets[node.lineno - 1] + len(prefix.encode("utf-16-le")) // 2

    def declaration(self, node, kind):
        name = ".".join([*self.scope, node.name])
        identity = f"{self.file}:{self.position(node)}"
        self.symbols.append({"id": identity, "name": name, "kind": kind})
        return identity, name

    def body(self, node, caller):
        previous = self.caller
        self.caller = caller
        self.scope.append(node.name)
        for statement in node.body:
            self.visit(statement)
        self.scope.pop()
        self.caller = previous

    def visit_ClassDef(self, node):
        self.declaration(node, "class")
        # Class initialization is not owned by an enclosing function operation.
        self.body(node, None)

    def visit_FunctionDef(self, node):
        identity, name = self.declaration(node, "function")
        self.operations.append({"id": identity, "file": self.file, "name": name,
                                "position": self.position(node)})
        # Decorators, annotations and defaults execute outside this function body.
        self.body(node, identity)

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_Lambda(self, node):
        # Anonymous operations are outside this extraction; do not give their calls to the parent.
        pass

    def visit_GeneratorExp(self, node):
        # Its body executes lazily in a separate implicit function.
        pass

    def visit_Call(self, node):
        if self.caller is not None:
            call = {"source": self.caller, "targets": [], "unresolved": True,
                    "line": node.lineno, "position": self.position(node)}
            if isinstance(node.func, ast.Attribute):
                call["member"] = node.func.attr
            self.invocations.append(call)
        self.generic_visit(node)


def scan(files):
    roots, memberships = source_roots(files)
    observation = {"schemaVersion": 1,
                   "scanner": {"id": "python", "technology": "python", "engine": "python-ast",
                               "engineVersion": sys.version.split()[0]},
                   "roots": roots, "files": [], "operations": [], "invocations": [],
                   "diagnostics": [{"severity": "info", "code": "PYTHON_SYNTAX_ONLY",
                                    "message": "Python syntax evidence only: call targets, imports, decorators and framework wiring are not resolved."}]}
    for file, owner in memberships.items():
        with tokenize.open(file) as stream:
            encoding = stream.encoding
        with open(file, encoding=encoding, newline="") as stream:
            source = stream.read()
        tree = ast.parse(source, filename=file)
        # Validate scope rules too, but never execute the resulting code object.
        compile(tree, file, "exec")
        evidence = Evidence(file, source)
        evidence.visit(tree)
        observation["files"].append({"file": file, "roots": [owner], "symbols": evidence.symbols})
        observation["operations"].extend(evidence.operations)
        observation["invocations"].extend(evidence.invocations)
    return observation
