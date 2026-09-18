"""Read the declarations, constants and imports HTTP facts resolve across modules."""
import ast
import re

METHODS = ("get", "post", "put", "patch", "delete", "head", "options", "trace")
METHOD_TOKEN = re.compile(r"^[A-Z][A-Z-]*$")
PATH_TEXT = re.compile(r"^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$")
DEPTH = 4
COMPUTED = object()


def module_path(file):
    """Dotted import path of a scanned file."""
    parts = file[:-len(".py")].split("/")
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def assigned_names(node):
    """Names one statement binds by assignment, including an augmented one."""
    if isinstance(node, ast.Assign):
        return [target.id for target in node.targets if isinstance(target, ast.Name)]
    if isinstance(node, (ast.AnnAssign, ast.AugAssign)):
        return [node.target.id] if isinstance(node.target, ast.Name) else []
    return []


def read_module(file, tree, identities):
    """Everything HTTP facts need from one module: its declarations, constants, imports and calls."""
    module = {"file": file, "path": module_path(file), "package": file.endswith("__init__.py"),
              "identities": identities, "definitions": {}, "values": {}, "imports": {}, "bindings": {},
              "calls": [node for node in ast.walk(tree) if isinstance(node, ast.Call)]}
    for node in ast.walk(tree):
        for name in assigned_names(node):
            module["bindings"][name] = module["bindings"].get(name, 0) + 1
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
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
        return resolve_name(sources, module, node.id, depth)
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
    if not isinstance(node, ast.Name):
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


def text_parts(sources, module, node, depth=0):
    """A string expression as literal text pieces and computed marks."""
    if depth > DEPTH:
        return [COMPUTED]
    if isinstance(node, ast.Constant):
        return [node.value] if isinstance(node.value, str) else [COMPUTED]
    if isinstance(node, ast.JoinedStr):
        return [part for value in node.values for part in text_parts(sources, module, value, depth + 1)]
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return [*text_parts(sources, module, node.left, depth + 1),
                *text_parts(sources, module, node.right, depth + 1)]
    if isinstance(node, (ast.Name, ast.Attribute)):
        found = resolve(sources, module, node)
        return text_parts(sources, found[1], found[3], depth + 1) if found is not None and found[0] == "value" else [COMPUTED]
    return [COMPUTED]


def literal_text(sources, module, node):
    """The exact text of a string expression, or None when the source computes any part of it."""
    parts = text_parts(sources, module, node)
    return "".join(parts) if all(isinstance(part, str) for part in parts) else None
