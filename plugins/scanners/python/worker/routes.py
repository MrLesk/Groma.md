"""Recognize Flask, FastAPI, Starlette and Django routing as endpoint facts.

Runs after sources.py, whose module reading and name resolution it uses.
"""
import ast
import re

# Applications serve at the root; routers and blueprints carry a prefix keyword.
APPS = ("Flask", "FastAPI", "Starlette")
ROUTERS = {"Blueprint": "url_prefix", "APIRouter": "prefix"}
REGISTRATIONS = {"register_blueprint": "url_prefix", "include_router": "prefix"}
# These take the first registered route that matches; Flask prefers the most specific one.
ORDERED = ("FastAPI", "Starlette", "APIRouter")
# Decorators that name their methods, and calls that add one route.
ROUTE_VERBS = ("route", "api_route")
ADDED_ROUTES = ("add_api_route", "add_route")
# Flask and Django write <converter:name>; FastAPI and Starlette write {name} or {name:converter}.
PLACEHOLDER = re.compile(r"<(?:([^<>:]+):)?([^<>:]+)>|\{([^{}:]+)(?::([^{}]+))?\}")
# Converters that accept any one segment; `path` takes the rest of the path, and every other converter restricts.
PLAIN_CONVERTERS = (None, "str", "string")
# Regular-expression text with no metacharacter; a dot is literal only when escaped.
REGEX_TEXT = re.compile(r"^(?:[A-Za-z0-9_~-]|\\[.-])+$")
# A regular-expression token: an escape, a character class or one character.
REGEX_TOKEN = re.compile(r"\\.|\[\^?\]?(?:\\.|[^\]])*\]|.", re.S)
NAMED_GROUP = re.compile(r"\(\?P<(\w+)>((?:\\.|\[(?:\\.|[^\]])*\]|[^()\\\[])*)\)")
# A group pattern that never matches a slash: path characters, \d, \w and classes of them, with quantifiers.
# A range only between letters or digits, since `!-~` would include the slash.
ONE_SEGMENT = re.compile(
    r"(?:(?:[A-Za-z0-9_~-]|\\[dw.-]|\[-?(?:[A-Za-z0-9]-[A-Za-z0-9]|\\[dw.-]|[^\]^/\\-])+-?\])"
    r"(?:(?:[+*?]|\{\d+(?:,\d*)?\})\??)?)+")
ANY_SEGMENT = "[^/]+"


def catch_rest(name, constrained=False):
    """An optional catch-all; a constrained one stands for route text the format cannot state."""
    return {"kind": "catch-all", "name": name, "optional": True, **({"constrained": True} if constrained else {})}


def module_operation(file):
    """The operation of a module's own code, which registers the routes it declares at module level."""
    return f"{file}#module"


def blocker(operation, method, path):
    """A route an ordered router registers but the scanner cannot report.

    Its literal prefix and a constrained optional catch-all keep its place in the order: core never derives a row
    to it and abstains on every request it could capture first.
    """
    literal = []
    for segment in path:
        if segment["kind"] != "literal":
            break
        literal.append(segment)
    return {"operation": operation, "method": method, "path": [*literal, catch_rest("rest", constrained=True)]}


def route_segment(part):
    """One declared route segment, or None when it holds characters a path cannot."""
    found = list(PLACEHOLDER.finditer(part))
    if not found:
        return {"kind": "literal", "value": part} if PATH_TEXT.match(part) else None
    converter, name = found[0][1] or found[0][4], found[0][2] or found[0][3]
    if not PATH_TEXT.match(name):
        return None
    whole = found[0].span() == (0, len(part))
    if whole and converter == "path":
        return {"kind": "catch-all", "name": name}
    if any((match[1] or match[4]) == "path" for match in found):
        return catch_rest(name, constrained=True)
    # A typed converter, or text beside the placeholder, restricts what the segment accepts.
    constrained = not whole or converter not in PLAIN_CONVERTERS
    return {"kind": "parameter", "name": name, **({"constrained": True} if constrained else {})}


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


def regex_parts(body):
    """A route pattern split at the slashes outside its groups and character classes."""
    parts, current, depth = [], "", 0
    for token in REGEX_TOKEN.findall(body):
        depth += (token == "(") - (token == ")")
        if token == "/" and depth == 0:
            parts, current = [*parts, current], ""
        else:
            current += token
    return [part for part in [*parts, current] if part]


def regex_segment(part, last):
    """One segment of a regular-expression route, or None when it may span segments or the format cannot state it."""
    if REGEX_TEXT.match(part):
        return {"kind": "literal", "value": re.sub(r"\\(.)", r"\1", part)}
    groups = list(NAMED_GROUP.finditer(part))
    whole = len(groups) == 1 and groups[0].span() == (0, len(part))
    if whole and last and groups[0][2] in (".*", ".+"):
        return {"kind": "catch-all", "name": groups[0][1], **({"optional": True} if groups[0][2] == ".*" else {})}
    if whole and groups[0][2] == ANY_SEGMENT:
        return {"kind": "parameter", "name": groups[0][1]}
    text = NAMED_GROUP.sub("", part)
    if groups and (not text or REGEX_TEXT.match(text)) and all(
            group[2] == ANY_SEGMENT or ONE_SEGMENT.fullmatch(group[2]) for group in groups):
        # A restricting pattern, or text beside a group, limits what the segment accepts.
        return {"kind": "parameter", "name": groups[0][1], "constrained": True}
    return None


def regex_segments(pattern, endpoint):
    """Segments of a Django regular-expression route.

    A part that may span segments, or that the format cannot state, becomes a constrained optional catch-all in
    place of itself and the rest of the route. Without `$`, an endpoint also matches any continuation.
    """
    body = pattern.strip()
    body = body[1:] if body.startswith("^") else body
    closed = body.endswith("$") and not body.endswith("\\$")
    body = body[:-1] if closed else body
    parts = regex_parts(body)
    segments = []
    for index, part in enumerate(parts):
        segment = regex_segment(part, index == len(parts) - 1)
        if segment is None:
            group = NAMED_GROUP.search(part)
            return [*segments, catch_rest(group[1] if group else "rest", constrained=True)]
        segments.append(segment)
    if closed or not endpoint or (segments and segments[-1]["kind"] == "catch-all"):
        return segments
    if body.endswith("/") or not segments:
        return [*segments, catch_rest("rest")]
    # `^feed` also matches `feeds`, so the last part is not a whole segment.
    return [*segments[:-1], catch_rest("rest", constrained=True)]


def served(operation, method, path):
    """One endpoint; a catch-all before another segment spans an unknown part of the route, so it ends the path."""
    for index, segment in enumerate(path[:-1]):
        if segment["kind"] == "catch-all":
            path = [*path[:index], {**segment, "optional": True, "constrained": True}]
            break
    return {"operation": operation, "method": method, "path": path}


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
                routers[(module["file"], name)] = {"prefix": [], "registrations": [], "unknown": [],
                                                   "ordered": kind in ORDERED}
            elif kind in ROUTERS:
                routers[(module["file"], name)] = {
                    "prefix": prefix_segments(sources, module, keyword_value(value, ROUTERS[kind])),
                    "registrations": [], "unknown": [], "ordered": kind in ORDERED,
                }
    for module in sources.modules.values():
        for call in module["calls"]:
            found = registration(call)
            if found is None:
                continue
            registered, prefix, replaces = found
            key = value_key(sources, module, registered)
            parent = value_key(sources, module, call.func.value)
            if key in routers:
                routers[key]["registrations"].append({
                    "parent": parent, "prefix": prefix_segments(sources, module, prefix), "replaces": replaces,
                })
            elif parent in routers:
                # A router or application the scanner cannot resolve still serves somewhere under this prefix.
                routers[parent]["unknown"].append((module["file"], prefix_segments(sources, module, prefix) or []))
    return routers


def registration(call):
    """(registered router, prefix, whether the prefix replaces the router's own) of a registration call, or None."""
    verb = method_name(call)
    if verb in REGISTRATIONS and call.args:
        prefix = keyword_value(call, REGISTRATIONS[verb])
        # Flask's registering prefix replaces the blueprint's own; FastAPI's goes before the router's.
        return call.args[0], prefix, verb == "register_blueprint" and prefix is not None
    if verb == "mount":
        # A mounted application serves under the mount path, like an included router.
        return argument(call, 1, "app"), argument(call, 0, "path"), False
    return None


def router_prefixes(routers, key, seen=()):
    """(application file, complete prefix) for every place a router serves, or None when one prefix is computed.

    A router nobody registers serves under its own prefix, and its own file stands for the application.
    """
    router = routers[key]
    if router["prefix"] is None or key in seen:
        return None
    if not router["registrations"]:
        return [(key[0], router["prefix"])]
    prefixes = []
    for registration in router["registrations"]:
        parent = registration["parent"]
        # A registrar the scanner cannot resolve, such as an application built inside a factory,
        # may itself serve under a prefix.
        outer = None if parent not in routers else router_prefixes(routers, parent, (*seen, key))
        if registration["prefix"] is None or outer is None:
            return None
        own = [] if registration["replaces"] else router["prefix"]
        prefixes.extend((application, [*above, *registration["prefix"], *own]) for application, above in outer)
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


def route_methods(sources, module, call, verb):
    """Methods a route decorator or call serves, or None when the source computes them."""
    if verb in METHODS:
        return [verb.upper()]
    listed = listed_methods(sources, module, keyword_value(call, "methods"))
    # A route that lists no method serves GET.
    return None if listed is None else listed or ["GET"]


def ordered_fact(router, application, fact):
    """FastAPI and Starlette add routes as modules import, an order the scanner does not prove, so every route of
    one application shares a position."""
    return {**fact, "order": {"application": application, "position": 0}} if router["ordered"] else fact


def route_facts(routers, key, file, handler, segments, methods):
    """Endpoints of one route on a known router. For an ordered router, a route whose handler, path, methods or
    prefix the scanner cannot read is a blocker instead."""
    router = routers[key]
    prefixes = router_prefixes(routers, key)
    if handler is not None and segments is not None and methods is not None and prefixes is not None:
        return [ordered_fact(router, application, served(handler, method, [*prefix, *segments]))
                for application, prefix in prefixes for method in methods]
    if not router["ordered"]:
        return []
    # Without a known prefix, neither the path nor the application is known, so the route's own file stands for it.
    places = [(application, [*prefix, *(segments or [])]) for application, prefix in prefixes or []]
    return [ordered_fact(router, application, blocker(handler or module_operation(file), method, path))
            for application, path in places or [(file, [])] for method in methods or ["*"]]


def method_name(node):
    """The method a call names, such as `get` in `app.get(...)`, or None."""
    return node.func.attr if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) else None


def path_segments_of(sources, module, node):
    """Segments of a literal route argument, or None."""
    route = None if node is None else literal_text(sources, module, node)
    return None if route is None else route_segments(route)


def decorator_endpoints(sources, module, routers, decorator, operation):
    """Endpoints a route decorator declares on a known application or router."""
    verb = method_name(decorator)
    if (verb not in ROUTE_VERBS and verb not in METHODS) or not decorator.args:
        return []
    key = value_key(sources, module, decorator.func.value)
    if key not in routers:
        return []
    return route_facts(routers, key, module["file"], operation, path_segments_of(sources, module, decorator.args[0]),
                       route_methods(sources, module, decorator, verb))


def call_endpoints(sources, routers):
    """Routes a known application or router adds by a call. A host() hands every request for a host name to another
    application, so on an ordered router it blocks the whole application."""
    facts = []
    for module in sources.modules.values():
        for call in module["calls"]:
            verb = method_name(call)
            if verb not in ADDED_ROUTES and verb != "host":
                continue
            key = value_key(sources, module, call.func.value)
            if key not in routers:
                continue
            if verb == "host":
                facts.extend(route_facts(routers, key, module["file"], None, None, None))
                continue
            segments = path_segments_of(sources, module, argument(call, 0, "path"))
            found = resolve(sources, module, argument(call, 1, "endpoint"))
            handler = found[2] if found is not None and found[0] == "operation" else None
            facts.extend(route_facts(routers, key, module["file"], handler, segments,
                                     route_methods(sources, module, call, verb)))
    return facts


def unknown_registrations(routers):
    """Blockers for the routers an ordered application registers but the scanner cannot resolve."""
    blockers = []
    for key, router in routers.items():
        if not router["ordered"]:
            continue
        for file, prefix in router["unknown"]:
            # Without the application's own prefix, the path is unknown and the registering file stands for it.
            places = [(application, [*above, *prefix]) for application, above in router_prefixes(routers, key) or []]
            blockers.extend(ordered_fact(router, application, blocker(module_operation(file), "*", path))
                            for application, path in places or [(file, [])])
    return blockers


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
    """(segments, view) for each urlpatterns entry; None segments when the route is not expressible, and no view
    for an element that is not a path(), re_path() or url() call."""
    entries = []
    for element in patterns.elts:
        kind = constructor(element)
        if kind not in ("path", "re_path", "url") or len(element.args) < 2:
            entries.append((None, None))
            continue
        route = literal_text(sources, module, element.args[0])
        segments = None
        if route is not None:
            endpoint = constructor(element.args[1]) != "include"
            segments = route_segments(route) if kind == "path" else regex_segments(route, endpoint)
            if segments and not endpoint and not route.endswith("/"):
                # include() joins its route and the included routes with no separator, so its last segment runs
                # into theirs: `path("v", include(...))` with `path("posts/")` serves `/vposts/`.
                segments = [*segments[:-1], catch_rest("rest", constrained=True)]
        entries.append((segments, element.args[1]))
    return entries


def walk_patterns(sources, tables, module, prefix, seen):
    """Endpoints of one urlpatterns table in resolution order, following include() into other modules."""
    return [endpoint for segments, view in tables[module["file"]]
            for endpoint in entry_endpoints(sources, tables, module, prefix, seen, segments, view)]


def entry_endpoints(sources, tables, module, prefix, seen, segments, view):
    """The endpoints one urlpatterns entry adds; an entry the scanner cannot report is a blocker."""
    registered = module_operation(module["file"])
    if segments is None or view is None:
        return [blocker(registered, "*", prefix)]
    path = [*prefix, *segments]
    target = include_target(sources, module, view)
    if target is not None:
        nested = target[1]
        if nested is None or nested["file"] not in tables or nested["file"] in seen:
            return [blocker(registered, "*", path)]
        return walk_patterns(sources, tables, nested, path, {*seen, module["file"]})
    found = resolve(sources, module, view)
    if found is None or found[0] != "operation":
        # Such as a class-based view through as_view(), whose handlers the class may inherit.
        return [blocker(registered, "*", path)]
    # Django hands every method to the view.
    return [served(found[2], "*", path)]


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
    """Endpoints of the URL tables nobody includes, so every path carries its prefixes.

    Django takes the first pattern that matches, so each endpoint states its position in the root table's
    resolution order, with includes expanded where they stand.
    """
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
    return [{**fact, "order": {"application": file, "position": position}}
            for file in tables if file not in included
            for position, fact in enumerate(walk_patterns(sources, tables, sources.modules[file], [], set()))]


def served_endpoints(sources):
    """Every endpoint these modules serve."""
    routers = collect_routers(sources)
    endpoints = [fact for module in sources.modules.values()
                 for node, operation in module["identities"].items()
                 for decorator in node.decorator_list
                 for fact in decorator_endpoints(sources, module, routers, decorator, operation)]
    return [*endpoints, *call_endpoints(sources, routers), *unknown_registrations(routers), *django_endpoints(sources)]
