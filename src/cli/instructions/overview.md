# Groma Overview

Groma keeps a living map of your system's architecture inside your repo, as plain
Markdown files under `groma/` that you can read and review. Humans and AI agents use
the same commands and see the same map.

The map records two kinds of truth side by side and never confuses them:

- **Intent** — what a person or agent said each part of the system is _for_.
- **Evidence** — what a scanner actually found in the code.

Scans refresh the evidence. Intent is never overwritten by a scan, a rename, or a
failure. Missing evidence is not proof that a part is gone.

## The working loop

```text
groma init   # create the groma/ workspace inside this repo
groma scan   # look at the code and record what is really there
groma        # open the visual blueprint (interactive terminal)
groma web    # serve the interactive blueprint on 127.0.0.1
```

After the first scan, people and agents curate meaning (intent, containment,
relationships) while later scans keep checking it against the code.

## Rules that always apply

- Every ordinary read returns exactly one bounded page; page limits are explicit and
  cursors are opaque. Nothing follows a cursor implicitly.
- When identity is uncertain, Groma stops instead of guessing. Expect diagnostics,
  not silent merges.
- Canonical state lives in `groma/` as deterministic Markdown. Change it through the
  CLI only; never edit those files directly.
- The local artifact and the web surface make no network requests and are never a
  mutation surface.
- Add `--format json` to any command for one structured, machine-readable result.

## Where to go next

- `groma instructions scanning` — projects, scanners, and rescans
- `groma instructions curation` — creating and changing components safely
- `groma instructions reading` — bounded reads: search, export, traverse, detail
- `groma <command> --help` shows every option and bound.

Search and read before changing anything: `groma blueprint search "text" --limit 20`
and `groma component get <id> --relationships-limit 20` tell you what the map
already says.
