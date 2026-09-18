"""Recognize requests, httpx, aiohttp and urllib calls as request facts.

Runs after sources.py, whose module reading and name resolution it uses.
"""
import ast
from collections import Counter
import re

CLIENTS = ("requests", "httpx", "aiohttp")
SESSIONS = ("Session", "Client", "AsyncClient", "ClientSession")
URLOPEN = "urllib.request.urlopen"
REQUEST_CLASS = "urllib.request.Request"
AUTHORITY = re.compile(r"^(?:[A-Za-z][A-Za-z0-9+.\-]*:)?//[^/]*")
UNKNOWN = {"kind": "unknown"}


def session_parts(sources, module, value):
    """The base a client session constructor sets, or None when the value is not a session."""
    name = imported_chain(module, value.func) if isinstance(value, ast.Call) else None
    library, _, constructed = (name or "").rpartition(".")
    if library not in CLIENTS or constructed not in SESSIONS:
        return None
    base = keyword_value(value, "base_url")
    return [] if base is None else text_parts(sources, module, base)


def module_sessions(sources, module):
    """Client sessions the module binds once, by name."""
    return {name: parts for name, value in module["values"].items()
            if (parts := session_parts(sources, module, value)) is not None}


def operation_sessions(sources, module, operation):
    """Client sessions an operation binds: names it binds exactly once, to a recognized session constructor.

    A parameter or any other binding also counts, so a name bound twice holds no known session.
    """
    bindings = [*((name, None) for name in parameters(operation)),
                *((name, module["assigned"].get(node)) for node in scope_nodes(operation)
                  for name in binding_names(node))]
    counts = Counter(name for name, _ in bindings)
    return {name: parts for name, value in bindings
            if counts[name] == 1 and value is not None and (parts := session_parts(sources, module, value)) is not None}


def merged(parts):
    """The text pieces of a URL with neighbouring literals joined."""
    tokens = []
    for part in parts:
        if isinstance(part, str) and tokens and isinstance(tokens[-1], str):
            tokens[-1] += part
        else:
            tokens.append(part)
    return tokens


def flush(segments, pieces):
    """Add the segment the collected pieces prove."""
    if not pieces:
        return
    if pieces == [COMPUTED]:
        segments.append({"kind": "dynamic"})
        return
    if any(piece is COMPUTED for piece in pieces):
        segments.append(UNKNOWN)
        return
    text = "".join(pieces)
    segments.append({"kind": "literal", "value": text} if PATH_TEXT.match(text) else UNKNOWN)


def path_segments(tokens):
    """Request segments of a URL path, stopping at the query or fragment."""
    segments = []
    pieces = []
    for token in tokens:
        if not isinstance(token, str):
            pieces.append(COMPUTED)
            continue
        text = re.split(r"[?#]", token)
        for index, part in enumerate(text[0].split("/")):
            if index:
                flush(segments, pieces)
                pieces = []
            if part:
                pieces.append(part)
        if len(text) > 1:
            flush(segments, pieces)
            return segments
    flush(segments, pieces)
    return segments


def from_slash(tokens):
    """The URL tokens from the first slash on; anything before it continues a base value's last segment."""
    for index, token in enumerate(tokens):
        if isinstance(token, str) and "/" in token:
            return [token[token.index("/"):], *tokens[index + 1:]]
    return []


def request_path(parts):
    """(configured, segments) of a request URL.

    Only a value read from configuration is a configured base. A host, or a base the scanner can neither resolve
    nor trace to configuration, such as a parameter, a call or a rebound name, is a leading unknown segment.
    """
    tokens = merged(parts)
    if not tokens:
        return False, []
    head, rest = tokens[0], tokens[1:]
    if head is CONFIGURED and rest:
        path = path_segments(from_slash(rest))
        if isinstance(rest[0], str) and rest[0].startswith("/"):
            return True, path
        # Text right after the base continues the base's last segment, so that segment is unknown.
        return True, [UNKNOWN, *path]
    if not isinstance(head, str):
        return False, [UNKNOWN, *path_segments(from_slash(rest))]
    authority = AUTHORITY.match(head)
    if authority is None:
        return False, path_segments(tokens)
    # The request leaves this application's root.
    return False, [UNKNOWN, *path_segments([head[authority.end():], *rest])]


def request_fact(operation, parts, method):
    """One request fact; a configured base states that the path follows a configuration value."""
    configured, path = request_path(parts)
    return {"operation": operation, **({"method": method} if method else {}),
            **({"configured": True} if configured else {}), "path": path}


def called_method(sources, module, call, verb):
    """The method a client call names, from the verb or a literal first argument."""
    if verb in METHODS:
        return verb.upper()
    text = literal_text(sources, module, call.args[0]) if call.args else None
    return text.upper() if text is not None and METHOD_TOKEN.match(text.upper()) else None


def client_request(sources, module, operation, call, verb, base):
    """One requests, httpx or aiohttp call."""
    url = argument(call, 1 if verb == "request" else 0, "url")
    if url is None:
        return None
    method = called_method(sources, module, call, verb)
    return request_fact(operation, [*base, *text_parts(sources, module, url)], method)


def urlopen_request(sources, module, operation, call):
    """One urllib.request.urlopen call, whose method follows its data and Request arguments."""
    url = argument(call, 0, "url")
    method = "POST" if argument(call, 1, "data") is not None else "GET"
    if isinstance(url, ast.Call) and imported_chain(module, url.func) == REQUEST_CLASS:
        if argument(url, 1, "data") is not None:
            method = "POST"
        named = keyword_value(url, "method")
        if named is not None:
            text = literal_text(sources, module, named)
            method = text.upper() if text is not None and METHOD_TOKEN.match(text.upper()) else None
        url = argument(url, 0, "url")
    if url is None:
        return None
    return request_fact(operation, text_parts(sources, module, url), method)


def operation_calls(operation):
    """Every call in one operation's body; a nested function, lambda or class owns its own calls."""
    return [node for node in scope_nodes(operation) if isinstance(node, ast.Call)]


def sent_request(sources, module, sessions, operation, call):
    """The request one call sends, or None when it is not a recognized client call.

    `sessions` holds the module's sessions and the operation's own ones.
    """
    chain = imported_chain(module, call.func)
    if chain == URLOPEN:
        return urlopen_request(sources, module, operation, call)
    if not isinstance(call.func, ast.Attribute):
        return None
    verb = call.func.attr
    if verb != "request" and verb not in METHODS:
        return None
    # The library itself, or a session a recognized constructor built.
    if chain is not None and chain.rpartition(".")[0] in CLIENTS:
        return client_request(sources, module, operation, call, verb, [])
    receiver = call.func.value
    if not isinstance(receiver, ast.Name):
        return None
    # A name some function binds holds only the session this operation binds; any other is a module constant.
    constants, own = sessions
    found = (own if receiver in module["shadowed"] else constants).get(receiver.id)
    return None if found is None else client_request(sources, module, operation, call, verb, found)


def sent_requests(sources):
    """Every request these modules send through a recognized client."""
    requests = []
    for module in sources.modules.values():
        constants = module_sessions(sources, module)
        for node, operation in module["identities"].items():
            sessions = (constants, operation_sessions(sources, module, node))
            requests.extend(fact for call in operation_calls(node)
                            if (fact := sent_request(sources, module, sessions, operation, call)) is not None)
    return requests
