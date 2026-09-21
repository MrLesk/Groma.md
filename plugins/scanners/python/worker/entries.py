"""Declared console scripts and Python's module execution guard, with local module inputs."""


def main_guard(tree):
    for statement in tree.body:
        if not isinstance(statement, ast.If):
            continue
        test = statement.test
        if (isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.Eq)
                and isinstance(test.left, ast.Name) and test.left.id == "__name__"
                and isinstance(test.comparators[0], ast.Constant) and test.comparators[0].value == "__main__"):
            return True
    return False


def entry_modules(sources, entry, memberships):
    """Importing a separately declared project does not make its sources part of this unit."""
    pending, found = [entry], set()
    while pending:
        module = pending.pop()
        file = module["file"]
        if file in found or memberships[file] != memberships[entry["file"]]:
            continue
        found.add(file)
        for spec, name in module["imports"].values():
            target = sources.module(spec, module)
            if target is None:
                continue
            pending.append(target)
            member = sources.lookup(f'{target["path"]}.{name}') if name else None
            if member is not None:
                pending.append(member)
    return sorted(found)


def execution_entries(files, trees, sources, memberships):
    entries = []
    for file, tree in trees.items():
        if PurePosixPath(file).name == "__main__.py" or main_guard(tree):
            name = PurePosixPath(file).parent.name if file.endswith("__main__.py") else PurePosixPath(file).stem
            entries.append({"file": file, "declaration": file, "name": name or "main"})
    for declaration in files:
        if PurePosixPath(declaration).name != "pyproject.toml":
            continue
        with open(declaration, "rb") as stream:
            project = tomllib.load(stream).get("project", {})
        for name, target in project.get("scripts", {}).items():
            module = sources.lookup(target.split(":")[0])
            if module is not None and memberships[module["file"]] == str(PurePosixPath(declaration).parent):
                entries.append({"file": module["file"], "declaration": declaration, "name": name})
    for entry in entries:
        entry["files"] = entry_modules(sources, sources.modules[entry["file"]], memberships)
    return entries
