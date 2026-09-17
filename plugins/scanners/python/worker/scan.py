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


NODE_TOKENS = {ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.MatMult: "@", ast.Div: "/", ast.Mod: "%",
               ast.Pow: "**", ast.LShift: "<<", ast.RShift: ">>", ast.BitOr: "|", ast.BitXor: "^",
               ast.BitAnd: "&", ast.FloorDiv: "//", ast.And: "and", ast.Or: "or", ast.Not: "not",
               ast.Invert: "~", ast.UAdd: "+", ast.USub: "-", ast.Eq: "==", ast.NotEq: "!=", ast.Lt: "<",
               ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">=", ast.Is: "is", ast.IsNot: "is not", ast.In: "in",
               ast.NotIn: "not in", ast.Return: "return", ast.If: "if", ast.IfExp: "if", ast.For: "for",
               ast.AsyncFor: "for", ast.comprehension: "for", ast.While: "while", ast.Raise: "raise",
               ast.Try: "try", ast.TryStar: "try", ast.ExceptHandler: "except", ast.With: "with",
               ast.AsyncWith: "with", ast.Await: "await", ast.Yield: "yield", ast.YieldFrom: "yield",
               ast.Assign: "=", ast.AugAssign: "=", ast.AnnAssign: "=", ast.NamedExpr: ":=", ast.Delete: "del",
               ast.Assert: "assert", ast.Break: "break", ast.Continue: "continue", ast.Call: "call",
               ast.Starred: "*"}
SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


def statements(scope):
    """Code that runs in a scope; a docstring is documentation, like a comment."""
    if isinstance(scope, ast.Lambda):
        return [scope.body]
    return scope.body[1:] if ast.get_docstring(scope, clean=False) is not None else scope.body


def parameters(scope):
    if isinstance(scope, ast.ClassDef):
        return []
    args = scope.args
    return [item.arg for item in [*args.posonlyargs, *args.args, args.vararg, *args.kwonlyargs, args.kwarg]
            if item is not None]


def children(node):
    for field, value in ast.iter_fields(node):
        if field == "annotation":
            continue
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, ast.AST):
                yield item


def local_names(scope):
    """Names a scope binds: parameters and every binding outside nested scopes.

    A function does not bind names it declares `global` or `nonlocal`. Known simplifications: comprehension
    variables share the function's scope, and names bound in a class body are visible to methods nested in it.
    """
    names = set(parameters(scope))
    declared = set()
    pending = list(statements(scope))
    while pending:
        node = pending.pop()
        if isinstance(node, (ast.Global, ast.Nonlocal)):
            declared.update(node.names)
        elif isinstance(node, ast.Name) and not isinstance(node.ctx, ast.Load):
            names.add(node.id)
        elif isinstance(node, ast.alias):
            names.add((node.asname or node.name).split(".")[0])
        else:
            # Definitions, except handlers and match captures bind a string name or rest.
            names.update(item for item in (getattr(node, "name", None), getattr(node, "rest", None))
                         if isinstance(item, str))
        if not isinstance(node, SCOPES):
            pending.extend(children(node))
    return names - declared


def node_token(node):
    """The token a node adds before its children: an attribute or keyword name, an operator or a keyword."""
    if isinstance(node, ast.Attribute):
        return f".{node.attr}"
    if isinstance(node, ast.keyword):
        return "**" if node.arg is None else f"k.{node.arg}"
    return NODE_TOKENS.get(type(node))


class BodyTokens:
    """Binding-normalized tokens of one operation body: local names become slots in order of appearance."""

    def __init__(self):
        self.tokens = []
        self.bindings = []
        self.count = 0

    def slot(self, identifier):
        for names, slots in reversed(self.bindings):
            if identifier in names:
                if identifier not in slots:
                    slots[identifier] = self.count
                    self.count += 1
                return f"${slots[identifier]}"
        return identifier

    def enter(self, node):
        # Only parameters and statements belong to a body; decorators, defaults and annotations do not.
        self.bindings.append((local_names(node), {}))
        for name in parameters(node):
            self.slot(name)
        for statement in statements(node):
            self.walk(statement)
        self.bindings.pop()

    def walk(self, node):
        if isinstance(node, SCOPES):
            self.tokens.append("class" if isinstance(node, ast.ClassDef) else "fn")
            self.enter(node)
            return
        if isinstance(node, ast.Name):
            self.tokens.append(self.slot(node.id))
            return
        if isinstance(node, ast.Constant):
            self.tokens.append(repr(node.value))
            return
        token = node_token(node)
        if token is not None:
            self.tokens.append(token)
        for child in children(node):
            self.walk(child)


def body_tokens(function):
    body = BodyTokens()
    body.enter(function)
    return body.tokens


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
        # Every def is a named operation; lambdas and module or class code never become operations.
        self.operations.append({"id": identity, "file": self.file, "name": name,
                                "position": self.position(node), "startLine": node.lineno,
                                "endLine": node.end_lineno, "tokens": body_tokens(node)})
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


def read_source(file):
    with tokenize.open(file) as stream:
        encoding = stream.encoding
    with open(file, encoding=encoding, newline="") as stream:
        return stream.read()


def scan(files):
    roots, memberships = source_roots(files)
    observation = {"schemaVersion": 1,
                   "scanner": {"id": "python", "technology": "python", "engine": "python-ast",
                               "engineVersion": sys.version.split()[0]},
                   "roots": roots, "files": [], "operations": [], "invocations": [],
                   "diagnostics": [{"severity": "info", "code": "PYTHON_SYNTAX_ONLY",
                                    "message": "Python syntax evidence only: call targets, imports, decorators and framework wiring are not resolved."}]}
    for file, owner in memberships.items():
        source = read_source(file)
        tree = ast.parse(source, filename=file)
        # Validate scope rules too, but never execute the resulting code object.
        compile(tree, file, "exec")
        evidence = Evidence(file, source)
        evidence.visit(tree)
        observation["files"].append({"file": file, "roots": [owner], "symbols": evidence.symbols})
        observation["operations"].extend(evidence.operations)
        observation["invocations"].extend(evidence.invocations)
    return observation


FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)


def visibility(name, member):
    """Python visibility comes from the name alone; dunder names are public."""
    if not name.startswith("_") or (name.startswith("__") and name.endswith("__")):
        return "public"
    if member and not name.startswith("__"):
        return "protected"
    return "private"


def is_property_accessor(function):
    """A property, cached property, or property getter, setter or deleter is an accessor, not a method."""
    return any((isinstance(decorator, ast.Name) and decorator.id in ("property", "cached_property"))
               or (isinstance(decorator, ast.Attribute)
                   and decorator.attr in ("getter", "setter", "deleter", "cached_property"))
               for decorator in function.decorator_list)


def outline_declarations(tree, symbols):
    """Source outline of the statements directly in a module body."""
    def symbol(name, line, owner=None):
        # The scan names a method `Class.method`, so a member's Code link uses that form.
        qualified = name if owner is None else f"{owner}.{name}"
        return {"name": name, "line": line, "visibility": visibility(name, owner is not None),
                "entry": qualified in symbols}

    declarations = []
    for node in tree.body:
        if isinstance(node, FUNCTIONS):
            declarations.append({"kind": "function", **symbol(node.name, node.lineno)})
        elif isinstance(node, ast.ClassDef):
            members = [symbol(item.name, item.lineno, owner=node.name) for item in node.body
                       if isinstance(item, FUNCTIONS) and not is_property_accessor(item)]
            declarations.append({"kind": "type", **symbol(node.name, node.lineno), "members": members})
        elif isinstance(node, (ast.Assign, ast.AnnAssign)) and isinstance(node.value, ast.Lambda):
            # Only a lambda bound directly to a name; wrapped values such as partial(...) are not functions.
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            declarations.extend({"kind": "function", **symbol(target.id, target.lineno)}
                                for target in targets if isinstance(target, ast.Name))
    return declarations


def outline(references):
    files = []
    for reference in references:
        file = reference["file"]
        declarations = outline_declarations(ast.parse(read_source(file), filename=file), set(reference["symbols"]))
        if declarations:
            files.append({"file": file, "declarations": declarations})
    return files
