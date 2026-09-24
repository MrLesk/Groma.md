// Outlines each requested file with one function named after this scanner.
export default {
  id: 'beta',
  async scan() { return undefined },
  async readCodeStructure(root, references) {
    return references.map(reference => ({
      file: reference.file,
      declarations: [{ kind: 'function', name: 'beta', line: 1, visibility: 'public', entry: false }],
    }))
  },
}
