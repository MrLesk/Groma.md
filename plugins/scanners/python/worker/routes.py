"""Recognize Flask, FastAPI, Starlette and Django routing as endpoint facts.

Runs after sources.py, whose module reading and name resolution it uses.
"""
import ast
import re

# Applications serve at the root; routers and blueprints carry a prefix keyword.
APPS = ("Flask", "FastAPI", "Starlette")
ROUTERS = {"Blueprint": "url_prefix", "APIRouter": "prefix"}
REGISTRATIONS = {"register_blueprint": "url_prefix", "include_router": "prefix"}
# Flask and Django write <converter:name>; FastAPI and Starlette write {name} or {name:converter}.
PLACEHOLDER = re.compile(r"^(?:<(?:(\w+):)?([^<>:]+)>|\{([^{}:]+)(?::([^{}]+))?\})$")
# A regular expression route may only hold text with no metacharacter.
PLAIN_TEXT = re.compile(r"^[A-Za-z0-9\-._~]+$")
NAMED_GROUP = re.compile(r"^\(\?P<(\w+)>(.*)\)$")


def route_segment(part):
    """One declared route segment, or None when text and a placeholder share it."""
    match = PLACEHOLDER.match(part)
    if match is None:
        return {"kind": "literal", "value": part} if PATH_TEXT.match(part) else None
    converter, name = match[1] or match[4], match[2] or match[3]
    if not PATH_TEXT.match(name):
        return None
    return {"kind": "catch-all" if converter == "path" else "parameter", "name": name}


def route_segments(route):
    """Endpoint segments of a declared route, or None when one segment is not expressible."""
    segments = []
    for part in route.split("/"):
        if not part:
            continue
        segment = route_segment(part)
        if segment is None:
            return None
        segments.append(segment)
    return segments


def regex_segments(pattern):
    """Endpoint segments of a Django regular-expression route, or None when it holds other syntax."""
    body = pattern.strip().lstrip("^")
    body = body[:-1] if body.endswith("$") else body
    parts = [part for part in body.split("/") if part]
    segments = []
    for index, part in enumerate(parts):
        group = NAMED_GROUP.match(part)
        if group is None:
            if not PLAIN_TEXT.match(part):
                return None
            segments.append({"kind": "literal", "value": part})
        elif group[2] in (".*", ".+"):
            if index != len(parts) - 1:
                return None
            segments.append({"kind": "catch-all", "name": group[1],
                             **({"optional": True} if group[2] == ".*" else {})})
        elif "/" in group[2] or "(" in group[2]:
            return None
        else:
            segments.append({"kind": "parameter", "name": group[1]})
    return segments


def served(operation, method, path):
    """One endpoint, unless a catch-all sits before another segment."""
    if any(segment["kind"] == "catch-all" for segment in path[:-1]):
        return []
    return [{"operation": operation, "method": method, "path": path}]


def prefix_segments(sources, module, node):
    """A router's own prefix: no segments when it has none, None when the source computes it."""
    if node is None:
        return []
    route = literal_text(sources, module, node)
    return None if route is None else route_segments(route)


def collect_routers(sources):
    """Every application and router object, with the prefixes registrations add to it."""
    routers = {}
    for module in sources.modules.values():
        for name, value in module["values"].items():
            kind = constructor(value)
            if kind in APPS:
                routers[(module["file"], name)] = {"prefix": [], "registrations": []}
            elif kind in ROUTERS:
                routers[(module["file"], name)] = {
                    "prefix": prefix_segments(sources, module, keyword_value(value, ROUTERS[kind])),
                    "registrations": [],
                }
    for module in sources.modules.values():
        for call in module["calls"]:
            verb = call.func.attr if isinstance(call.func, ast.Attribute) else None
            if verb not in REGISTRATIONS or not call.args:
                continue
            key = value_key(sources, module, call.args[0])
            if key in routers:
                routers[key]["registrations"].append({
                    "parent": value_key(sources, module, call.func.value),
                    "prefix": prefix_segments(sources, module, keyword_value(call, REGISTRATIONS[verb])),
                })
    return routers


def router_prefixes(routers, key, seen=()):
    """Every complete prefix a router serves under, or None when one of them is computed."""
    router = routers[key]
    if router["prefix"] is None or key in seen:
        return None
    if not router["registrations"]:
        return [router["prefix"]]
    prefixes = []
    for registration in router["registrations"]:
        parent = registration["parent"]
        # A registrar the scanner cannot resolve, such as an application built inside a factory,
        # may itself serve under a prefix.
        outer = None if parent not in routers else router_prefixes(routers, parent, (*seen, key))
        if registration["prefix"] is None or outer is None:
            return None
        prefixes.extend([*above, *registration["prefix"], *router["prefix"]] for above in outer)
    return prefixes


def listed_methods(sources, module, node):
    """Methods a route decorator lists, or None when the source computes them."""
    if node is None:
        return []
    if not isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return None
    methods = []
    for element in node.elts:
        text = literal_text(sources, module, element)
        if text is None or not METHOD_TOKEN.match(text.upper()):
            return None
        methods.append(text.upper())
    return methods


def decorator_endpoints(sources, module, routers, decorator, operation):
    """Endpoints a route decorator declares on a known application or router."""
    if not isinstance(decorator, ast.Call) or not isinstance(decorator.func, ast.Attribute) or not decorator.args:
        return []
    verb = decorator.func.attr
    if verb != "route" and verb not in METHODS:
        return []
    key = value_key(sources, module, decorator.func.value)
    if key not in routers:
        return []
    route = literal_text(sources, module, decorator.args[0])
    segments = None if route is None else route_segments(route)
    prefixes = router_prefixes(routers, key)
    if segments is None or prefixes is None:
        return []
    if verb != "route":
        methods = [verb.upper()]
    else:
        listed = listed_methods(sources, module, keyword_value(decorator, "methods"))
        if listed is None:
            return []
        # Flask serves GET when a route lists no method.
        methods = listed or ["GET"]
    return [fact for prefix in prefixes for method in methods
            for fact in served(operation, method, [*prefix, *segments])]


def include_target(sources, module, view):
    """What an include() names: one scanned module, a module outside the scan, or an uncertainty."""
    if constructor(view) != "include" or not view.args:
        return None
    spec = literal_text(sources, module, view.args[0])
    if spec is None:
        return ("uncertain", None)
    found = sources.candidates(spec)
    if len(found) > 1:
        return ("uncertain", None)
    return ("module", found[0]) if found else ("external", None)


def url_entries(sources, module, patterns):
    """(segments, view) for each urlpatterns entry, with None segments when the route is not expressible."""
    entries = []
    for element in patterns.elts:
        kind = constructor(element)
        if kind not in ("path", "re_path", "url") or len(element.args) < 2:
            continue
        route = literal_text(sources, module, element.args[0])
        segments = None
        if route is not None:
            segments = route_segments(route) if kind == "path" else regex_segments(route)
        entries.append((segments, element.args[1]))
    return entries


def walk_patterns(sources, tables, module, prefix, seen):
    """Endpoints of one urlpatterns table, following include() into other modules."""
    endpoints = []
    for segments, view in tables[module["file"]]:
        target = include_target(sources, module, view)
        if target is not None:
            nested = target[1]
            if segments is not None and nested is not None and nested["file"] in tables and nested["file"] not in seen:
                endpoints.extend(walk_patterns(sources, tables, nested, [*prefix, *segments],
                                               {*seen, module["file"]}))
            continue
        found = resolve(sources, module, view)
        if segments is not None and found is not None and found[0] == "operation":
            # Django hands every method to the view.
            endpoints.extend(served(found[2], "*", [*prefix, *segments]))
    return endpoints


def url_tables(sources):
    """Every readable urlpatterns table, and whether another table hides part of the include graph."""
    tables = {}
    hidden = False
    for module in sources.modules.values():
        patterns = module["values"].get("urlpatterns")
        if isinstance(patterns, (ast.List, ast.Tuple)):
            tables[module["file"]] = url_entries(sources, module, patterns)
        elif module["bindings"].get("urlpatterns"):
            # A table built by addition, or bound more than once, may include any other table.
            hidden = True
    return tables, hidden


def django_endpoints(sources):
    """Endpoints of the URL tables nobody includes, so every path carries its prefixes."""
    tables, hidden = url_tables(sources)
    included = set()
    for file, entries in tables.items():
        for _, view in entries:
            target = include_target(sources, sources.modules[file], view)
            if target is None:
                continue
            if target[0] == "uncertain":
                hidden = True
            elif target[0] == "module":
                included.add(target[1]["file"])
    if hidden:
        # Without the complete include graph, a table's own path could be missing a prefix.
        return []
    return [fact for file in tables if file not in included
            for fact in walk_patterns(sources, tables, sources.modules[file], [], set())]


def served_endpoints(sources):
    """Every endpoint these modules serve."""
    routers = collect_routers(sources)
    endpoints = [fact for module in sources.modules.values()
                 for node, operation in module["identities"].items()
                 for decorator in node.decorator_list
                 for fact in decorator_endpoints(sources, module, routers, decorator, operation)]
    return [*endpoints, *django_endpoints(sources)]
