"""Read the declarations, constants and imports HTTP facts resolve across modules, and the scopes and bindings
every Python worker rule counts."""
import ast
from collections import Counter
import re

METHODS = ("get", "post", "put", "patch", "delete", "head", "options", "trace")
METHOD_TOKEN = re.compile(r"^[A-Z][A-Z-]*$")
PATH_TEXT = re.compile(r"^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$")
DEPTH = 4
# Text the source computes, and a value it reads from configuration, such as an environment variable.
COMPUTED = object()
CONFIGURED = object()
ENVIRONMENT = ("os.environ.get", "os.getenv")
SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)
FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)


def module_path(file):
    """Dotted import path of a scanned file."""
    parts = file[:-len(".py")].split("/")
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def binding_names(node):
    """Names one node binds: a Name it stores to or deletes, which covers assignment, augmented assignment, `for`,
    `with`, walrus and unpacking targets, and a def or class name, an import alias, or an except or match capture.

    The Python worker's scope and constant rules all count bindings through this one function.
    """
    if isinstance(node, ast.Name):
        return [] if isinstance(node.ctx, ast.Load) else [node.id]
    if isinstance(node, ast.alias):
        return [(node.asname or node.name).split(".")[0]]
    return [item for item in (getattr(node, "name", None), getattr(node, "rest", None)) if isinstance(item, str)]


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


def scope_nodes(scope):
    """Every node that runs in a scope: its statements and their contents, stopping at nested functions, lambdas
    and classes, which run in their own scopes."""
    nodes, pending = [], list(statements(scope))
    while pending:
        node = pending.pop()
        nodes.append(node)
        if not isinstance(node, SCOPES):
            pending.extend(ast.iter_child_nodes(node))
    return nodes


def assigned_values(tree):
    """The value each target of a plain assignment, annotated assignment or `with` item receives."""
    assigned = {target: node.value for node in ast.walk(tree) if isinstance(node, (ast.Assign, ast.AnnAssign))
                for target in (node.targets if isinstance(node, ast.Assign) else [node.target])}
    assigned.update((node.optional_vars, node.context_expr) for node in ast.walk(tree)
                    if isinstance(node, ast.withitem) and node.optional_vars is not None)
    return assigned


def base_url_facts(tree, assigned):
    """What a module says about base_url, which usually holds a client's own base address.

    `classes` maps each class to its base_url bindings: those in its body and its methods' `self.base_url` stores.
    `stores` lists every other `.base_url` store, such as `client.base_url = ...`, which may set any client's base.
    `reads` maps each `self.base_url` a method reads to its class. A binding is its value for a plain assignment,
    otherwise None.
    """
    classes, reads, claimed = {}, {}, set()
    for scope in (node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)):
        classes[scope] = [assigned.get(node) for node in scope_nodes(scope) if "base_url" in binding_names(node)]
        for method in scope.body:
            if not isinstance(method, FUNCTIONS) or not method.args.args:
                continue
            receiver = method.args.args[0].arg
            for node in ast.walk(method):
                if (isinstance(node, ast.Attribute) and node.attr == "base_url"
                        and isinstance(node.value, ast.Name) and node.value.id == receiver):
                    if isinstance(node.ctx, ast.Load):
                        reads[node] = scope
                    else:
                        classes[scope].append(assigned.get(node))
                        claimed.add(node)
    stores = [assigned.get(node) for node in ast.walk(tree) if isinstance(node, ast.Attribute)
              and node.attr == "base_url" and not isinstance(node.ctx, ast.Load) and node not in claimed]
    return {"classes": classes, "stores": stores, "reads": reads}


def local_imports(tree):
    """Imports that can run in the module scope, including branches and repeated star imports."""
    imports = []
    for node in scope_nodes(tree):
        if isinstance(node, ast.Import):
            imports.extend((alias.name if alias.asname else alias.name.split(".")[0], None)
                           for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            spec = "." * node.level + (node.module or "")
            imports.extend((spec, alias.name) for alias in node.names)
    return imports


def read_module(file, tree, identities, shadowed):
    """Everything HTTP facts need from one module: its declarations, constants, imports and calls.

    `shadowed` holds the Name nodes that read a function's own binding, such as a parameter, so they never
    resolve to the module name they share.
    """
    assigned = assigned_values(tree)
    module = {"file": file, "path": module_path(file), "package": file.endswith("__init__.py"),
              "identities": identities, "shadowed": shadowed, "assigned": assigned,
              "base_url": base_url_facts(tree, assigned), "definitions": {}, "values": {}, "imports": {},
              "local_imports": local_imports(tree),
              "bindings": Counter(name for node in ast.walk(tree) for name in binding_names(node)),
              "calls": [node for node in ast.walk(tree) if isinstance(node, ast.Call)]}
    for node in tree.body:
        if isinstance(node, (*FUNCTIONS, ast.ClassDef)):
            module["definitions"][node.name] = node
        elif isinstance(node, (ast.Assign, ast.AnnAssign)) and node.value is not None:
            for target in (node.targets if isinstance(node, ast.Assign) else [node.target]):
                if isinstance(target, ast.Name):
                    module["values"][target.id] = node.value
        elif isinstance(node, ast.Import):
            for alias in node.names:
                module["imports"][alias.asname or alias.name.split(".")[0]] = (
                    alias.name if alias.asname else alias.name.split(".")[0], None)
        elif isinstance(node, ast.ImportFrom):
            spec = "." * node.level + (node.module or "")
            for alias in node.names:
                module["imports"][alias.asname or alias.name] = (spec, alias.name)
    # Only a name the module binds exactly once is a constant.
    for name in [name for name, count in module["bindings"].items() if count > 1]:
        module["values"].pop(name, None)
    return module


class Sources:
    """The scanned modules, addressed by dotted import path."""

    def __init__(self, modules):
        self.modules = modules
        self.paths = {}
        for module in modules.values():
            self.paths.setdefault(module["path"], []).append(module)
        self.classes = {scope: module for module in modules.values() for scope in module["base_url"]["classes"]}
        self.base_url_stores = [(module, value) for module in modules.values()
                                for value in module["base_url"]["stores"]]

    def ancestors(self, scope, seen=()):
        """The classes in the scanned source that a class inherits from."""
        found = set()
        for base in scope.bases:
            resolved = resolve(self, self.classes[scope], base)
            parent = resolved[2] if resolved is not None and resolved[0] == "class" else None
            if parent in self.classes and parent not in seen:
                found |= {parent, *self.ancestors(parent, (*seen, scope))}
        return found

    def class_base_url(self, module, node):
        """(module, value) of the one plain assignment to base_url that `self.base_url` reads, or None.

        Every base_url binding of the class, its subclasses and every class they inherit from in the scanned source
        counts, and so does every `.base_url` store outside a class's own methods, since it may set any client's base.
        """
        scope = module["base_url"]["reads"].get(node)
        if scope is None:
            return None
        # The method runs on instances of the class and its subclasses, which inherit from all their bases.
        instances = {scope} | {other for other in self.classes if scope in self.ancestors(other)}
        family = instances | {ancestor for member in instances for ancestor in self.ancestors(member)}
        bindings = [(self.classes[member], value) for member in family
                    for value in self.classes[member]["base_url"]["classes"][member]]
        bindings += self.base_url_stores
        return bindings[0] if len(bindings) == 1 and bindings[0][1] is not None else None

    def candidates(self, path):
        """Every scanned module with this dotted path, or whose path ends with it."""
        return self.paths.get(path) or [module for key, modules in self.paths.items()
                                        if key.endswith(f".{path}") for module in modules]

    def lookup(self, path):
        """The one scanned module this dotted path names, when it names exactly one."""
        found = self.candidates(path)
        return found[0] if len(found) == 1 else None

    def relative(self, spec, module):
        """Resolve a relative import spec against the module that writes it."""
        up = len(spec) - len(spec.lstrip("."))
        parts = module["path"].split(".") if module["path"] else []
        if not module["package"]:
            parts = parts[:-1]
        parts = parts[:len(parts) - (up - 1)] if up > 1 else parts
        rest = spec[up:]
        target = ".".join([*parts, *([rest] if rest else [])])
        return self.lookup(target) if target else None

    def module(self, spec, module):
        return self.relative(spec, module) if spec.startswith(".") else self.lookup(spec)


def resolve(sources, module, node, depth=0):
    """What a name or attribute chain refers to: an operation, a class, a named value or a module."""
    if depth > DEPTH:
        return None
    if isinstance(node, ast.Name):
        return None if node in module["shadowed"] else resolve_name(sources, module, node.id, depth)
    if not isinstance(node, ast.Attribute):
        return None
    owner = resolve(sources, module, node.value, depth + 1)
    if owner is None or owner[0] != "module":
        return None
    found = resolve_name(sources, owner[1], node.attr, depth + 1)
    if found is not None:
        return found
    nested = sources.lookup(f"{owner[1]['path']}.{node.attr}")
    return None if nested is None else ("module", nested)


def resolve_name(sources, module, name, depth=0):
    """Follow one module's name, through its imports, to what declares it."""
    if depth > DEPTH:
        return None
    definition = module["definitions"].get(name)
    if definition is not None:
        identity = module["identities"].get(definition)
        return ("operation", module, identity) if identity is not None else ("class", module, definition)
    if name in module["values"]:
        return ("value", module, name, module["values"][name])
    imported = module["imports"].get(name)
    if imported is None:
        return None
    spec, original = imported
    target = sources.module(spec, module)
    if original is None:
        return None if target is None else ("module", target)
    found = None if target is None else resolve_name(sources, target, original, depth + 1)
    if found is not None:
        return found
    # `from package import module` names a submodule the package itself does not declare.
    nested = sources.module(spec + original if spec.endswith(".") else f"{spec}.{original}", module)
    return None if nested is None else ("module", nested)


def value_key(sources, module, node):
    """The (file, name) identity of the variable an expression refers to."""
    found = resolve(sources, module, node)
    return None if found is None or found[0] != "value" else (found[1]["file"], found[2])


def imported_chain(module, node):
    """Dotted text of a name or attribute chain the module imports, or None when it starts elsewhere."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name) or node in module["shadowed"]:
        return None
    imported = module["imports"].get(node.id)
    if imported is None:
        # A local name, parameter or builtin is not the library the chain seems to name.
        return None
    if imported[1] is None:
        parts.append(imported[0])
    else:
        parts.append(imported[1] if imported[0].startswith(".") else f"{imported[0]}.{imported[1]}")
    return ".".join(reversed(parts))


def constructor(node):
    """The constructor name a call writes, such as Flask or APIRouter."""
    if not isinstance(node, ast.Call):
        return None
    callee = node.func
    if isinstance(callee, ast.Attribute):
        return callee.attr
    return callee.id if isinstance(callee, ast.Name) else None


def keyword_value(call, name):
    for keyword in call.keywords:
        if keyword.arg == name:
            return keyword.value
    return None


def argument(call, index, name):
    if len(call.args) > index:
        return call.args[index]
    return keyword_value(call, name)


def configuration_read(module, node):
    """Whether an expression reads configuration: an environment variable, a Django setting or a base_url attribute."""
    if isinstance(node, ast.Subscript):
        return imported_chain(module, node.value) == "os.environ"
    if isinstance(node, ast.Call):
        return imported_chain(module, node.func) in ENVIRONMENT
    if isinstance(node, ast.Attribute):
        return node.attr == "base_url" or imported_chain(module, node.value) == "django.conf.settings"
    return False


def text_parts(sources, module, node, depth=0):
    """A string expression as literal text pieces, configuration reads and computed marks."""
    if depth > DEPTH:
        return [COMPUTED]
    if isinstance(node, ast.Constant):
        return [node.value] if isinstance(node.value, str) else [COMPUTED]
    if isinstance(node, ast.JoinedStr):
        return [part for value in node.values for part in text_parts(sources, module, value, depth + 1)]
    if isinstance(node, ast.FormattedValue) and node.conversion == -1 and node.format_spec is None:
        # `f"{name}"` is the text of name.
        return text_parts(sources, module, node.value, depth + 1)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return [*text_parts(sources, module, node.left, depth + 1),
                *text_parts(sources, module, node.right, depth + 1)]
    if isinstance(node, (ast.Name, ast.Attribute)):
        found = resolve(sources, module, node)
        if found is not None and found[0] == "value":
            return text_parts(sources, found[1], found[3], depth + 1)
    assigned = sources.class_base_url(module, node) if isinstance(node, ast.Attribute) else None
    if assigned is not None:
        # A client's own base_url assigned exactly once: its text, a host included, or a configuration read.
        parts = text_parts(sources, assigned[0], assigned[1], depth + 1)
        if COMPUTED not in parts:
            return parts
    return [CONFIGURED] if configuration_read(module, node) else [COMPUTED]


def literal_text(sources, module, node):
    """The exact text of a string expression, or None when the source computes any part of it."""
    parts = text_parts(sources, module, node)
    return "".join(parts) if all(isinstance(part, str) for part in parts) else None
