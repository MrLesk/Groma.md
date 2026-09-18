"""Recognize requests, httpx, aiohttp and urllib calls as request facts.

Runs after sources.py, whose module reading and name resolution it uses.
"""
import ast
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


def client_names(sources, module, operation):
    """Names that hold a client session here: module constants, then what this operation binds once."""
    sessions = {}
    for name, value in module["values"].items():
        parts = session_parts(sources, module, value)
        if parts is not None:
            sessions[name] = parts
    bindings = operation_bindings(operation)
    counts = {}
    for name, _ in bindings:
        counts[name] = counts.get(name, 0) + 1
    for name, value in bindings:
        # A name this operation binds more than once, or binds to anything else, holds no known session.
        parts = session_parts(sources, module, value) if counts[name] == 1 and value is not None else None
        if parts is None:
            sessions.pop(name, None)
        else:
            sessions[name] = parts
    return sessions


def operation_bindings(operation):
    """What one operation binds: its parameters, and the values its assignments and with items supply."""
    args = operation.args
    parameters = [*args.posonlyargs, *args.args, args.vararg, *args.kwonlyargs, args.kwarg]
    bindings = [(item.arg, None) for item in parameters if item is not None]
    pending = list(operation.body)
    while pending:
        node = pending.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        bindings.extend(bound_values(node))
        pending.extend(ast.iter_child_nodes(node))
    return bindings


def bound_values(node):
    """(name, value) pairs an assignment or with item binds."""
    if isinstance(node, ast.Assign):
        return [(target.id, node.value) for target in node.targets if isinstance(target, ast.Name)]
    if isinstance(node, ast.withitem) and isinstance(node.optional_vars, ast.Name):
        return [(node.optional_vars.id, node.context_expr)]
    return []


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
        if token is COMPUTED:
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


def request_path(parts):
    """(configured, segments) of a request URL: an unresolved base becomes a leading unknown segment."""
    tokens = merged(parts)
    if not tokens:
        return False, []
    if tokens[0] is COMPUTED:
        # A value the scanner cannot see is a configured base only when literal path text follows it.
        if len(tokens) == 1:
            return False, [UNKNOWN]
        head, slash, tail = tokens[1].partition("/")
        if not head:
            return True, path_segments(tokens[1:])
        # Text right after the base continues the base's last segment, so that segment is unknown.
        rest = path_segments([tail, *tokens[2:]]) if slash else []
        return True, [UNKNOWN, *rest]
    authority = AUTHORITY.match(tokens[0])
    if authority is None:
        return False, path_segments(tokens)
    # The request leaves this application's root.
    return False, [UNKNOWN, *path_segments([tokens[0][authority.end():], *tokens[1:]])]


def request_fact(operation, parts, method):
    """One request fact; a configured base states that literal path text follows a value we cannot see."""
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
    """Every call in one operation's body; a nested operation owns its own calls."""
    calls = []
    pending = list(operation.body)
    while pending:
        node = pending.pop()
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if isinstance(node, ast.Call):
            calls.append(node)
        pending.extend(ast.iter_child_nodes(node))
    return calls


def sent_request(sources, module, sessions, operation, call):
    """The request one call sends, or None when it is not a recognized client call."""
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
    if not isinstance(receiver, ast.Name) or receiver.id not in sessions:
        return None
    return client_request(sources, module, operation, call, verb, sessions[receiver.id])


def sent_requests(sources):
    """Every request these modules send through a recognized client."""
    requests = []
    for module in sources.modules.values():
        for node, operation in module["identities"].items():
            sessions = client_names(sources, module, node)
            for call in operation_calls(node):
                fact = sent_request(sources, module, sessions, operation, call)
                if fact is not None:
                    requests.append(fact)
    return requests
