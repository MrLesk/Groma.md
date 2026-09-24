// Outlines each requested file with one function named after this scanner.
export default {
  id: 'alpha',
  async scan() { return undefined },
  async readCodeStructure(root, references) {
    return references.map(reference => ({
      file: reference.file,
      declarations: [{ kind: 'function', name: 'alpha', line: 1, visibility: 'public', entry: false }],
    }))
  },
}
