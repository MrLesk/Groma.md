// A CommonJS file next to the broken one, still scanned. Outside strict mode a legacy octal literal is valid,
// and a type annotation, as in a Flow-typed file, still parses.

function count(items: Array<string>) {
  require('fs').chmodSync('build', 0755)
  return items.length
}

module.exports = { count }
