# Web viewer

Status: **TBD**

A web viewer is another plugin on the same Groma world. It would show
observed boxes and planned ghosts in a browser. It would not read
architecture Markdown or calculate layout.

The TUI is not Groma's only surface. Terminal keys, cell aspect, and
terminal chrome belong only in the TUI plugin. They must not appear in
Groma core, the world model, or architecture Markdown. A web plugin would
use pages and pointers the same way: inside this plugin, never in core.

A contract is added here only when a real web example exists.
